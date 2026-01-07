import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'
import { ALLOWED_CONDITION_VALUES, normalizeCondition, type AllowedCondition } from '@/lib/utils/resource-conditions'

// Validation schemas
const CreateResourceSchema = z.object({
  resource_id: z.string().min(1, 'Resource ID is required'),
  resource_name: z.string().min(1, 'Resource name is required'),
  resource_type: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  condition: z.string()
    .optional()
    .nullable()
    .transform((val) => normalizeCondition(val))
    .refine(
      (val) => val === null || ALLOWED_CONDITION_VALUES.includes(val as AllowedCondition),
      {
        message: `Invalid condition. Allowed values: ${ALLOWED_CONDITION_VALUES.join(', ')}`
      }
    ),
  is_available: z.boolean().optional().default(true),
  notes: z.string().optional(),
})

const ResourceFiltersSchema = z.object({
  is_available: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      return val === 'true' ? true : val === 'false' ? false : undefined
    },
    z.boolean().optional()
  ),
  resource_type: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  limit: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return 50
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) || num < 1 ? 50 : Math.min(num, 500)
    },
    z.number().min(1).max(500)
  ),
  offset: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return 0
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) || num < 0 ? 0 : num
    },
    z.number().min(0)
  ),
})

// GET /api/resources - Get all resources with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    // Handle empty strings and null values gracefully
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const isAvailableParam = searchParams.get('is_available')
    const resourceTypeParam = searchParams.get('resource_type')
    
    // Use safeParse for better error handling
    const validationResult = ResourceFiltersSchema.safeParse({
      is_available: isAvailableParam || undefined,
      resource_type: resourceTypeParam || undefined,
      limit: limitParam || '50',
      offset: offsetParam || '0',
    })
    
    if (!validationResult.success) {
      console.error('[resources] Validation error:', validationResult.error.errors)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }
    
    const filters = validationResult.data

    // Build query
    // IMPORTANT: Exclude devices from resources count
    // Devices are now stored in the separate devices table
    // This prevents double-counting in dashboard cards
    let query = supabaseAdmin
      .from('resources')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1)
      // Exclude devices: filter out rows where resource_type = 'Device'
      .or('resource_type.is.null,resource_type.neq.Device')

    // Apply filters
    if (filters.is_available !== undefined) {
      query = query.eq('is_available', filters.is_available)
    }

    if (filters.resource_type) {
      // Prevent filtering by 'Device' type - devices are in devices table now
      if (filters.resource_type === 'Device') {
        return NextResponse.json(
          {
            success: false,
            error: 'Devices are managed separately. Use /api/devices endpoint instead.',
          },
          { status: 400 }
        )
      }
      query = query.eq('resource_type', filters.resource_type)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching resources:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch resources',
          details: error.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        count: count || data?.length || 0,
        limit: filters.limit,
        offset: filters.offset
      }
    })
  } catch (error) {
    console.error('Error in GET /api/resources:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch resources',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/resources - Create a new resource
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const resourceData = CreateResourceSchema.parse(body)

    // IMPORTANT: Prevent creating devices in resources table
    // Devices should be created via /api/devices endpoint
    if (resourceData.resource_type === 'Device') {
      return NextResponse.json(
        {
          success: false,
          error: 'Devices cannot be created as resources. Use /api/devices endpoint instead.',
          details: 'Devices are managed separately in the devices table to prevent counting issues.'
        },
        { status: 400 }
      )
    }

    // Prepare data for insertion
    // Condition is already normalized by the schema transform
    const insertData: any = {
      resource_id: resourceData.resource_id,
      resource_name: resourceData.resource_name,
      resource_type: resourceData.resource_type || null,
      description: resourceData.description || null,
      location: resourceData.location || null,
      capacity: resourceData.capacity || null,
      is_available: resourceData.is_available ?? true,
      notes: resourceData.notes || null,
    }
    
    // Only include condition if it's a valid normalized value
    // Database stores capitalized values (e.g., "Good"), so capitalize to match database format
    if (resourceData.condition && typeof resourceData.condition === 'string') {
      const normalized = resourceData.condition.toLowerCase().trim()
      if (ALLOWED_CONDITION_VALUES.includes(normalized as AllowedCondition)) {
        // Capitalize first letter to match database format (e.g., "good" -> "Good")
        insertData.condition = normalized.charAt(0).toUpperCase() + normalized.slice(1)
      } else {
        // If condition was provided but failed validation, don't include it
        console.warn('[resources] Condition value failed validation, omitting:', resourceData.condition)
      }
    }

    // Try to get user ID from Authorization header if provided
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // If authentication is set up, you can extract user ID here
      // For now, we'll leave created_by as null if not provided
    }

    // Insert resource
    const { data, error } = await supabaseAdmin
      .from('resources')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating resource:', error)
      
      // Handle unique constraint violation
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Resource ID already exists',
            details: error.message
          },
          { status: 409 }
        )
      }

      // Handle check constraint violation for condition
      if (error.code === '23514' || error.message?.includes('resources_condition_check') || error.message?.includes('check constraint')) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid condition. Allowed values: ${ALLOWED_CONDITION_VALUES.join(', ')}`,
            details: error.message,
            allowedValues: ALLOWED_CONDITION_VALUES
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create resource',
          details: error.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/resources:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid resource data',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create resource'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/resources - Update a resource
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('id') || body.resource_id

    if (!resourceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resource ID is required for update'
        },
        { status: 400 }
      )
    }

    // Validate request body (all fields optional for update)
    const UpdateResourceSchema = z.object({
      resource_id: z.string().optional(),
      resource_name: z.string().optional(),
      resource_type: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      capacity: z.number().int().positive().optional().nullable(),
      condition: z.string()
        .optional()
        .nullable()
        .transform((val) => normalizeCondition(val))
        .refine(
          (val) => val === null || ALLOWED_CONDITION_VALUES.includes(val as AllowedCondition),
          {
            message: `Invalid condition. Allowed values: ${ALLOWED_CONDITION_VALUES.join(', ')}`
          }
        ),
      is_available: z.boolean().optional(),
      notes: z.string().optional().nullable(),
    })

    const resourceData = UpdateResourceSchema.parse(body)

    // IMPORTANT: Prevent updating resource_type to 'Device'
    // Devices should be managed via /api/devices endpoint
    if (resourceData.resource_type === 'Device') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot set resource_type to "Device". Devices are managed separately via /api/devices endpoint.',
        },
        { status: 400 }
      )
    }

    // Prepare data for update (only include provided fields)
    const updateData: any = {}
    if (resourceData.resource_name !== undefined) updateData.resource_name = resourceData.resource_name
    if (resourceData.resource_type !== undefined) updateData.resource_type = resourceData.resource_type
    if (resourceData.description !== undefined) updateData.description = resourceData.description
    if (resourceData.location !== undefined) updateData.location = resourceData.location
    if (resourceData.capacity !== undefined) updateData.capacity = resourceData.capacity
    if (resourceData.condition !== undefined) {
      // Normalize and capitalize condition to match database format
      if (resourceData.condition && typeof resourceData.condition === 'string') {
        const normalized = resourceData.condition.toLowerCase().trim()
        if (ALLOWED_CONDITION_VALUES.includes(normalized as AllowedCondition)) {
          updateData.condition = normalized.charAt(0).toUpperCase() + normalized.slice(1)
        } else {
          console.warn('[resources] Invalid condition value in update, skipping:', resourceData.condition)
        }
      } else if (resourceData.condition === null) {
        updateData.condition = null
      }
    }
    if (resourceData.is_available !== undefined) updateData.is_available = resourceData.is_available
    if (resourceData.notes !== undefined) updateData.notes = resourceData.notes

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No fields provided for update'
        },
        { status: 400 }
      )
    }

    // Update resource
    const { data, error } = await supabaseAdmin
      .from('resources')
      .update(updateData)
      .eq('resource_id', resourceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating resource:', error)
      
      // Handle check constraint violation for condition
      if (error.code === '23514' || error.message?.includes('resources_condition_check') || error.message?.includes('check constraint')) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid condition. Allowed values: ${ALLOWED_CONDITION_VALUES.join(', ')}`,
            details: error.message,
            allowedValues: ALLOWED_CONDITION_VALUES
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update resource',
          details: error.message
        },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resource not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in PATCH /api/resources:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid resource data',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update resource'
      },
      { status: 500 }
    )
  }
}

