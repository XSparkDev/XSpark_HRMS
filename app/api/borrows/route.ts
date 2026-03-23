// ============================================================================
// BORROWS API ROUTE (REBUILT)
// ============================================================================
// Clean implementation using only actual database schema
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { borrowService, notificationService, devicesService } from '@/lib/services'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ============================================================================
// OLD IMPLEMENTATION - COMMENTED OUT FOR REBUILD
// ============================================================================
/*
export async function GET(request: NextRequest) {
  // ... old implementation commented out ...
}
*/

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const listSchema = z.object({
  deviceId: z.string().optional(),
  borrowedBy: z.string().optional(),
  // Status-first: borrowStatus accepts either:
  // - 'active' (legacy high-level alias)
  // - one of the canonical borrow_status values
  borrowStatus: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      return typeof val === 'string' ? val.trim().toLowerCase() : val
    },
    z
      .enum(['active', 'pending_borrow', 'borrowed', 'pending_return', 'returned', 'rejected'])
      .optional(),
  ),
  borrowRequest: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      if (typeof val === 'boolean') return val
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase()
        if (['true', '1', 'yes'].includes(normalized)) return true
        if (['false', '0', 'no'].includes(normalized)) return false
      }
      return undefined
    },
    z.boolean().optional(),
  ),
  isBorrowed: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      if (typeof val === 'boolean') return val
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase()
        if (['true', '1', 'yes'].includes(normalized)) return true
        if (['false', '0', 'no'].includes(normalized)) return false
      }
      return undefined
    },
    z.boolean().optional(),
  ),
  isReturned: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      if (typeof val === 'boolean') return val
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase()
        if (['true', '1', 'yes'].includes(normalized)) return true
        if (['false', '0', 'no'].includes(normalized)) return false
      }
      return undefined
    },
    z.boolean().optional(),
  ),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) ? undefined : num
    },
    z.number().min(1).max(200).optional(),
  ),
  offset: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) ? undefined : num
    },
    z.number().min(0).optional(),
  ),
})

const createSchema = z.object({
  device_id: z.string().min(1, 'device_id is required'),
  borrowed_by: z.string().min(1, 'borrowed_by is required'),
  borrow_date: z.string().optional().nullable().or(z.literal('')),
  return_date: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
}).transform((data) => {
  return {
    ...data,
    borrow_date: data.borrow_date === '' ? null : data.borrow_date,
    return_date: data.return_date === '' ? null : data.return_date,
    notes: data.notes === '' ? null : data.notes,
  }
})

const updateSchema = z.object({
  action: z.enum(['approve', 'reject', 'return']),
  supervisorId: z.string().optional(),
  reason: z.string().optional(),
})

// ============================================================================
// GET /api/borrows - List borrows
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Build filter object
    const filters: Record<string, any> = {}
    
    const deviceId = searchParams.get('deviceId')
    if (deviceId && deviceId.trim() !== '') filters.deviceId = deviceId
    
    const borrowedBy = searchParams.get('borrowedBy')
    if (borrowedBy && borrowedBy.trim() !== '') filters.borrowedBy = borrowedBy

    const borrowStatus = searchParams.get('borrowStatus')
    if (borrowStatus && borrowStatus.trim() !== '') filters.borrowStatus = borrowStatus

    const borrowRequest = searchParams.get('borrowRequest')
    if (borrowRequest && borrowRequest.trim() !== '') filters.borrowRequest = borrowRequest
    
    const isBorrowed = searchParams.get('isBorrowed')
    if (isBorrowed && isBorrowed.trim() !== '') filters.isBorrowed = isBorrowed
    
    const isReturned = searchParams.get('isReturned')
    if (isReturned && isReturned.trim() !== '') filters.isReturned = isReturned
    
    const fromDate = searchParams.get('fromDate')
    if (fromDate && fromDate.trim() !== '') filters.fromDate = fromDate
    
    const toDate = searchParams.get('toDate')
    if (toDate && toDate.trim() !== '') filters.toDate = toDate
    
    const limit = searchParams.get('limit')
    if (limit && limit.trim() !== '') filters.limit = limit
    
    const offset = searchParams.get('offset')
    if (offset && offset.trim() !== '') filters.offset = offset
    
    // Parse filters with Zod, but fall back gracefully if validation fails
    let parsed
    try {
      parsed = listSchema.parse(filters)
    } catch (error) {
      console.warn('[borrows] GET query validation failed, falling back to lenient parsing:', error)
      // Lenient fallback: coerce known fields manually so callers are not blocked
      parsed = {
        deviceId: filters.deviceId,
        borrowedBy: filters.borrowedBy,
        borrowStatus:
          typeof filters.borrowStatus === 'string' ? filters.borrowStatus.trim().toLowerCase() : undefined,
        borrowRequest:
          typeof filters.borrowRequest === 'string'
            ? ['true', '1', 'yes'].includes(filters.borrowRequest.trim().toLowerCase())
            : undefined,
        isBorrowed:
          typeof filters.isBorrowed === 'string'
            ? ['true', '1', 'yes'].includes(filters.isBorrowed.trim().toLowerCase())
            : undefined,
        isReturned:
          typeof filters.isReturned === 'string'
            ? ['true', '1', 'yes'].includes(filters.isReturned.trim().toLowerCase())
            : undefined,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        limit: (() => {
          const raw = filters.limit
          const num =
            typeof raw === 'string'
              ? parseInt(raw, 10)
              : typeof raw === 'number'
              ? raw
              : undefined
          if (!num || Number.isNaN(num) || num < 1) return undefined
          // Hard cap to prevent accidental huge queries
          return Math.min(num, 200)
        })(),
        offset: (() => {
          const raw = filters.offset
          const num =
            typeof raw === 'string'
              ? parseInt(raw, 10)
              : typeof raw === 'number'
              ? raw
              : undefined
          if (num === undefined || Number.isNaN(num) || num < 0) return undefined
          return num
        })(),
      }
    }

    console.log('[borrows] GET request with filters:', {
      deviceId: parsed.deviceId,
      borrowedBy: parsed.borrowedBy,
      borrowStatus: parsed.borrowStatus,
      borrowRequest: (parsed as any).borrowRequest,
      isBorrowed: parsed.isBorrowed,
      isReturned: parsed.isReturned,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      limit: parsed.limit,
      offset: parsed.offset,
    })

    const { data, count } = await borrowService.listBorrows({
      deviceId: parsed.deviceId,
      borrowedBy: parsed.borrowedBy,
      borrowStatus: parsed.borrowStatus,
      borrowRequest: (parsed as any).borrowRequest,
      isBorrowed: parsed.isBorrowed,
      isReturned: parsed.isReturned,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      limit: parsed.limit,
      offset: parsed.offset,
    })

    console.log('[borrows] GET response:', {
      dataCount: data?.length || 0,
      count,
      sampleIds: data?.slice(0, 3).map((b: any) => ({
        id: b.borrow_id || b.id,
        is_borrowed: b.is_borrowed,
        is_returned: b.is_returned,
      })),
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

    console.error('[borrows] GET failed', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch borrows' },
      { status: 500 },
    )
  }
}

// ============================================================================
// POST /api/borrows - Create borrow request
// ============================================================================

export async function POST(request: NextRequest) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  try {
    const body = await request.json()
    const payload = createSchema.parse(body)

    // Create borrow record (is_borrowed = false by default)
    const borrow = await borrowService.createBorrow(payload)

    // Send notification to all supervisors
    try {
      // Get borrower information
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const borrowerIdentifier = payload.borrowed_by?.trim()
      const borrowerColumn = borrowerIdentifier && uuidRegex.test(borrowerIdentifier) ? 'id' : 'employee_id'
      
      const { data: borrowerEmployee } = await supabaseAdmin
        .from('employees')
        .select('id, employee_id, first_name, last_name, preferred_name')
        .eq(borrowerColumn, borrowerIdentifier)
        .maybeSingle()

      // Get device information
      const device = await devicesService.getDeviceByIdentifier(payload.device_id)
      
      // Find all supervisors (employees with supervisor role)
      // First, find the supervisor role ID
      const { data: supervisorRole } = await supabaseAdmin
        .from('roles')
        .select('id')
        .ilike('role_name', '%supervisor%')
        .limit(1)
        .maybeSingle()

      if (supervisorRole?.id) {
        // Get all employees with supervisor role
        const { data: supervisors } = await supabaseAdmin
          .from('employees')
          .select('id, employee_id, first_name, last_name, preferred_name')
          .eq('role_id', supervisorRole.id)
          .is('deleted_at', null) // Only active employees

        if (supervisors && supervisors.length > 0) {
          const borrowerName = borrowerEmployee?.preferred_name || 
                               `${borrowerEmployee?.first_name || ''} ${borrowerEmployee?.last_name || ''}`.trim() ||
                               borrowerEmployee?.employee_id ||
                               'Unknown Employee'
          
          const deviceName = device?.model || device?.asset_tag || 'device'
          const assetTag = device?.asset_tag || 'N/A'
          const returnDate = payload.return_date 
            ? new Date(payload.return_date).toLocaleDateString()
            : 'Not specified'

          // Send notification to each supervisor
          const notificationPromises = supervisors.map((supervisor) =>
            notificationService.createNotification(
              {
                employee_id: supervisor.id,
                title: 'New Device Borrow Request',
                message: `Employee ${borrowerName} (ID: ${borrowerEmployee?.employee_id || 'N/A'}) has requested to borrow ${deviceName} (Asset: ${assetTag}). Expected return date: ${returnDate}.${payload.notes ? ` Notes: ${payload.notes}` : ''}`,
                notification_type: 'internal',
                published_by: borrowerEmployee?.id || null,
                is_confidential: false,
              },
              {
                sendEmail: true,
                preventDuplicates: true,
                duplicateWindowMinutes: 5,
              }
            )
          )

          await Promise.allSettled(notificationPromises)
          console.log(`[borrows] Sent notifications to ${supervisors.length} supervisor(s)`)
        } else {
          console.warn('[borrows] No supervisors found to notify')
        }
      } else {
        console.warn('[borrows] Supervisor role not found')
      }
    } catch (notifError) {
      console.error('[borrows] Failed to send notification to supervisors:', notifError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json(
      {
        success: true,
        data: borrow,
        message: 'Device booking request submitted. Awaiting supervisor approval.',
      },
      { 
        status: 201,
        headers,
      },
    )
  } catch (error) {
    console.error('[borrows] POST error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid borrow payload', 
          details: error.errors,
        },
        { 
          status: 400,
          headers,
        },
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create borrow record'
    let userMessage = errorMessage
    let statusCode = 500
    
    if (errorMessage.includes('Device not found')) {
      userMessage = 'The selected device was not found. Please select a valid device.'
      statusCode = 404
    } else if (errorMessage.includes('not available')) {
      userMessage = 'This device is not currently available for booking.'
      statusCode = 409
    } else if (errorMessage.includes('Borrower not found')) {
      userMessage = 'Your employee information was not found. Please contact support.'
      statusCode = 404
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: userMessage,
        ...(process.env.NODE_ENV === 'development' && error instanceof Error && {
          details: error.message,
        }),
      }, 
      { 
        status: statusCode,
        headers,
      },
    )
  }
}

// ============================================================================
// PATCH /api/borrows/[id] - Update borrow (approve/reject/return)
// ============================================================================

export async function PATCH(request: NextRequest) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  try {
    const { searchParams } = new URL(request.url)
    let borrowId = searchParams.get('id')
    const actionFromQuery = searchParams.get('action')

    // Clean up borrowId - remove "id=" prefix if present
    if (borrowId) {
      borrowId = borrowId.replace(/^id=/, '').trim()
    }

    if (!borrowId) {
      return NextResponse.json(
        { success: false, error: 'Borrow ID is required in query params (?id=...)' },
        { status: 400, headers },
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(borrowId)) {
      return NextResponse.json(
        { success: false, error: `Invalid borrow ID format: ${borrowId}. Expected UUID format.` },
        { status: 400, headers },
      )
    }

    // Get action from query params or body
    let action: string | null = actionFromQuery
    let supervisorId: string | undefined
    let reason: string | undefined

    // Try to parse body (only once)
    let body: any = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      // Body is optional, continue with empty object
    }

    // If action not in query params, get it from body
    if (!action) {
      try {
        const parsed = updateSchema.parse(body)
        action = parsed.action
        supervisorId = parsed.supervisorId
        reason = parsed.reason
      } catch (bodyError) {
        // If body parsing fails and no action in query, return error
        return NextResponse.json(
          { success: false, error: 'Action is required (in query params ?action=approve or in request body)' },
          { status: 400, headers },
        )
      }
    } else {
      // Action from query params, get supervisorId and reason from body
      supervisorId = body.supervisorId
      reason = body.reason
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required (approve, reject, or return)' },
        { status: 400, headers },
      )
    }

    let result: any = null

    // Get supervisor ID from body, query params, or current user
    let finalSupervisorId = supervisorId
    if (!finalSupervisorId && (action === 'approve' || action === 'reject')) {
      const user = getCurrentUser()
      finalSupervisorId = user?.id || user?.employeeId || searchParams.get('supervisorId') || undefined
    }

    switch (action) {
      case 'approve':
        if (!finalSupervisorId) {
          return NextResponse.json(
            { success: false, error: 'Supervisor ID is required for approval' },
            { status: 400, headers },
          )
        }
        result = await borrowService.approveBorrow(borrowId, finalSupervisorId)
        break

      case 'reject':
        if (!finalSupervisorId) {
          return NextResponse.json(
            { success: false, error: 'Supervisor ID is required for rejection' },
            { status: 400, headers },
          )
        }
        result = await borrowService.rejectBorrow(borrowId, finalSupervisorId, reason)
        break

      case 'return':
        result = await borrowService.returnDevice(borrowId)
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400, headers },
        )
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Borrow ${action}d successfully`,
      },
      { status: 200, headers },
    )
  } catch (error) {
    console.error('[borrows] PATCH error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid update payload',
          details: error.errors,
        },
        {
          status: 400,
          headers,
        },
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update borrow'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status: 500,
        headers,
      },
    )
  }
}

// ============================================================================
// OPTIONS - CORS preflight
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
