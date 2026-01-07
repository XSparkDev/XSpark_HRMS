import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { borrowService } from '@/lib/services'

const listSchema = z.object({
  deviceId: z.string().optional(),
  borrowedBy: z.string().optional(),
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
    z.boolean().optional()
  ),
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
  device_id: z.string().min(1, 'device_id is required'),
  borrowed_by: z.string().min(1, 'borrowed_by is required'),
  borrow_date: z.string().optional().nullable().or(z.literal('')),
  return_date: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
  status: z.enum(['pending', 'approved', 'borrowed']).optional(), // Will default to pending
  approval_status: z.enum(['pending_approval', 'approved', 'rejected']).optional(), // Will default to pending_approval
}).transform((data) => {
  // Convert empty strings to null/undefined for optional fields
  return {
    ...data,
    borrow_date: data.borrow_date === '' ? null : data.borrow_date,
    return_date: data.return_date === '' ? null : data.return_date,
    notes: data.notes === '' ? null : data.notes,
  }
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Build filter object, handling null/empty values
    const filters: Record<string, any> = {}
    
    const deviceId = searchParams.get('deviceId')
    if (deviceId && deviceId.trim() !== '') filters.deviceId = deviceId
    
    const borrowedBy = searchParams.get('borrowedBy')
    if (borrowedBy && borrowedBy.trim() !== '') filters.borrowedBy = borrowedBy
    
    const isBorrowed = searchParams.get('isBorrowed')
    if (isBorrowed && isBorrowed.trim() !== '') filters.isBorrowed = isBorrowed
    
    const fromDate = searchParams.get('fromDate')
    if (fromDate && fromDate.trim() !== '') filters.fromDate = fromDate
    
    const toDate = searchParams.get('toDate')
    if (toDate && toDate.trim() !== '') filters.toDate = toDate
    
    const limit = searchParams.get('limit')
    if (limit && limit.trim() !== '') filters.limit = limit
    
    const offset = searchParams.get('offset')
    if (offset && offset.trim() !== '') filters.offset = offset
    
    const parsed = listSchema.parse(filters)

    const { data, count } = await borrowService.listBorrows({
      deviceId: parsed.deviceId,
      borrowedBy: parsed.borrowedBy,
      isBorrowed: parsed.isBorrowed,
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

    console.error('[borrows] GET failed', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch borrows' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Add CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  try {
    // Log incoming request for debugging
    console.log('[borrows] POST request received at:', new Date().toISOString())
    
    const body = await request.json()
    console.log('[borrows] Request payload:', { 
      device_id: body.device_id, 
      borrowed_by: body.borrowed_by,
      has_borrow_date: !!body.borrow_date,
      has_return_date: !!body.return_date,
    })

    // Validate and parse payload using Zod schema
    const payload = createSchema.parse(body)
    console.log('[borrows] Validated payload:', payload)

    // Use borrow-service to create the borrow record
    const borrow = await borrowService.createBorrow(payload)
    console.log('[borrows] Borrow created successfully:', borrow.borrow_id)

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
      console.error('[borrows] Validation errors:', error.errors)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid borrow payload', 
          details: error.errors 
        },
        { 
          status: 400,
          headers,
        },
      )
    }

    // Extract error message from error object
    const errorMessage = error instanceof Error ? error.message : 'Failed to create borrow record'
    console.error('[borrows] POST failed:', errorMessage)
    
    // Provide user-friendly error messages
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







