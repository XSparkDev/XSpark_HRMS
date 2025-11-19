import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// Validation schemas
const CreateResourceSchema = z.object({
  resource_id: z.string().min(1, 'Resource ID is required'),
  resource_name: z.string().min(1, 'Resource name is required'),
  resource_type: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  condition: z.string().optional(),
  is_available: z.boolean().optional().default(true),
  notes: z.string().optional(),
})

const ResourceFiltersSchema = z.object({
  is_available: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  resource_type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
})

// GET /api/resources - Get all resources with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const filters = ResourceFiltersSchema.parse({
      is_available: searchParams.get('is_available') || undefined,
      resource_type: searchParams.get('resource_type') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    })

    // Build query
    let query = supabase
      .from('resources')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1)

    // Apply filters
    if (filters.is_available !== undefined) {
      query = query.eq('is_available', filters.is_available)
    }

    if (filters.resource_type) {
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
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch resources'
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

    // Prepare data for insertion
    const insertData: any = {
      resource_id: resourceData.resource_id,
      resource_name: resourceData.resource_name,
      resource_type: resourceData.resource_type || null,
      description: resourceData.description || null,
      location: resourceData.location || null,
      capacity: resourceData.capacity || null,
      condition: resourceData.condition || null,
      is_available: resourceData.is_available ?? true,
      notes: resourceData.notes || null,
    }

    // Try to get user ID from Authorization header if provided
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // If authentication is set up, you can extract user ID here
      // For now, we'll leave created_by as null if not provided
    }

    // Insert resource
    const { data, error } = await supabase
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

