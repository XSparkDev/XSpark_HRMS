import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { maintenanceService } from '@/lib/services'

const listSchema = z.object({
  assetType: z.enum(['device', 'resource', 'room']).optional(),
  assetId: z.string().optional(),
  reportedBy: z.string().optional(),
  assignedTo: z.string().optional(),
  status: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      if (Array.isArray(val)) return val
      if (typeof val === 'string' && val.includes(',')) {
        return val.split(',').map(s => s.trim()).filter(s => s !== '')
      }
      return val
    },
    z.union([z.string(), z.array(z.string())]).optional()
  ),
  priority: z.string().optional(),
  issueCategory: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) ? undefined : num
    },
    z.number().min(1).max(200).optional()
  ),
  offset: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) ? undefined : num
    },
    z.number().min(0).optional()
  ),
})

const createSchema = z.object({
  asset_type: z.enum(['device', 'resource', 'room'], {
    errorMap: () => ({ message: 'asset_type must be "device", "resource", or "room"' })
  }),
  asset_id: z.string().min(1, 'asset_id is required'),
  reported_by: z.string().min(1, 'reported_by is required'),
  assigned_to: z.string().optional().nullable().or(z.literal('')),
  issue_title: z.string().min(1, 'issue_title is required'),
  issue_description: z.string().optional().nullable().or(z.literal('')),
  issue_category: z.string().optional().nullable().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['submitted', 'in_progress', 'completed', 'resolved']).optional(),
  asset_usability: z.enum(['usable', 'not_usable', 'partially_usable']).optional().nullable(),
  attachments: z.array(z.string()).optional().nullable().or(z.literal('')),
}).transform((data) => {
  // Convert empty strings to null/undefined for optional fields
  return {
    ...data,
    assigned_to: data.assigned_to === '' ? null : data.assigned_to,
    issue_description: data.issue_description === '' ? null : data.issue_description,
    issue_category: data.issue_category === '' ? null : data.issue_category,
    attachments: data.attachments === '' ? null : (Array.isArray(data.attachments) ? data.attachments : null),
  }
})

// ============================================================================
// GET /api/maintenance-requests - List maintenance requests
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Build filter object, handling null/empty values
    const filters: Record<string, any> = {}
    
    const assetType = searchParams.get('assetType')
    if (assetType && assetType.trim() !== '') filters.assetType = assetType
    
    const assetId = searchParams.get('assetId')
    if (assetId && assetId.trim() !== '') filters.assetId = assetId
    
    const reportedBy = searchParams.get('reportedBy')
    if (reportedBy && reportedBy.trim() !== '') filters.reportedBy = reportedBy
    
    const assignedTo = searchParams.get('assignedTo')
    if (assignedTo && assignedTo.trim() !== '') filters.assignedTo = assignedTo
    
    const status = searchParams.get('status')
    if (status && status.trim() !== '') {
      // Support comma-separated status values (e.g., "completed,resolved")
      const statusValues = status.split(',').map(s => s.trim()).filter(s => s !== '')
      if (statusValues.length > 1) {
        filters.status = statusValues
      } else {
        filters.status = statusValues[0]
      }
    }
    
    const priority = searchParams.get('priority')
    if (priority && priority.trim() !== '') filters.priority = priority
    
    const issueCategory = searchParams.get('issueCategory')
    if (issueCategory && issueCategory.trim() !== '') filters.issueCategory = issueCategory
    
    const fromDate = searchParams.get('fromDate')
    if (fromDate && fromDate.trim() !== '') filters.fromDate = fromDate
    
    const toDate = searchParams.get('toDate')
    if (toDate && toDate.trim() !== '') filters.toDate = toDate
    
    const limit = searchParams.get('limit')
    if (limit && limit.trim() !== '') filters.limit = limit
    
    const offset = searchParams.get('offset')
    if (offset && offset.trim() !== '') filters.offset = offset
    
    const parsed = listSchema.parse(filters)

    const { data, count } = await maintenanceService.listMaintenanceRequests({
      assetType: parsed.assetType,
      assetId: parsed.assetId,
      reportedBy: parsed.reportedBy,
      assignedTo: parsed.assignedTo,
      status: parsed.status,
      priority: parsed.priority,
      issueCategory: parsed.issueCategory,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      limit: parsed.limit,
      offset: parsed.offset,
    })

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count,
        limit: parsed.limit ?? null,
        offset: parsed.offset ?? null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 },
      )
    }

    console.error('[maintenance-requests] GET failed', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch maintenance requests' }, { status: 500 })
  }
}

// ============================================================================
// POST /api/maintenance-requests - Create a new maintenance request
// ============================================================================
export async function POST(request: NextRequest) {
  // Add CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  try {
    console.log('[maintenance-requests] POST request received at:', new Date().toISOString())
    
    const body = await request.json()
    console.log('[maintenance-requests] Request payload:', { 
      asset_type: body.asset_type, 
      asset_id: body.asset_id,
      reported_by: body.reported_by,
      issue_title: body.issue_title,
      has_issue_description: !!body.issue_description,
      has_attachments: Array.isArray(body.attachments) && body.attachments.length > 0,
    })

    // Validate and parse payload using Zod schema
    const payload = createSchema.parse(body)
    console.log('[maintenance-requests] Validated payload:', payload)

    // Use maintenance-service to create the maintenance request
    const maintenanceRequest = await maintenanceService.createMaintenanceRequest(payload)
    console.log('[maintenance-requests] Maintenance request created successfully:', maintenanceRequest.id)

    return NextResponse.json(
      {
        success: true,
        data: maintenanceRequest,
        message: 'Maintenance request submitted successfully.',
      },
      { 
        status: 201,
        headers,
      },
    )
  } catch (error) {
    console.error('[maintenance-requests] POST error:', error)
    
    if (error instanceof z.ZodError) {
      console.error('[maintenance-requests] Validation errors:', error.errors)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid maintenance request payload', 
          details: error.errors 
        },
        { 
          status: 400,
          headers,
        },
      )
    }

    // Extract error message from error object
    const errorMessage = error instanceof Error ? error.message : 'Failed to create maintenance request'
    console.error('[maintenance-requests] POST failed:', errorMessage)
    
    // Provide user-friendly error messages
    let userMessage = errorMessage
    let statusCode = 500
    
    if (errorMessage.includes('not found')) {
      if (errorMessage.includes('device')) {
        userMessage = 'The selected device was not found. Please select a valid device.'
      } else if (errorMessage.includes('resource')) {
        userMessage = 'The selected resource was not found. Please select a valid resource.'
      } else if (errorMessage.includes('room')) {
        userMessage = 'The selected room was not found. Please select a valid room.'
      } else {
        userMessage = 'The selected asset was not found. Please select a valid asset.'
      }
      statusCode = 404
    } else if (errorMessage.includes('Reporter not found')) {
      userMessage = 'Your employee information was not found. Please contact support.'
      statusCode = 404
    } else if (errorMessage.includes('Invalid asset_type')) {
      userMessage = 'Invalid asset type. Must be "device", "resource", or "room".'
      statusCode = 400
    } else if (errorMessage.includes('column') || errorMessage.includes('does not exist')) {
      userMessage = 'There was a database configuration issue. Please contact support.'
      statusCode = 500
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: userMessage,
        ...(process.env.NODE_ENV === 'development' && error instanceof Error && {
          details: error.message,
          stack: error.stack
        })
      }, 
      { 
        status: statusCode,
        headers,
      }
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
