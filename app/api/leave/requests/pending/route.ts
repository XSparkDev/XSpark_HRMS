// ============================================================================
// PENDING LEAVE REQUESTS API ROUTE
// ============================================================================
// GET /api/leave/requests/pending
// Returns all pending leave requests for managers/admins to review.
// Supports optional filtering and pagination.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { leaveManagementService } from '@/lib/services'
import { z } from 'zod'

const PendingLeaveRequestsQuerySchema = z.object({
  employee_id: z.string().uuid().optional(), // Filter by specific employee
  leave_type: z.string().optional(), // Filter by leave type (e.g., 'annual', 'sick')
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Filter by start date (YYYY-MM-DD)
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Filter by end date (YYYY-MM-DD)
  limit: z.coerce.number().min(1).max(100).default(50).optional(), // Pagination limit
  offset: z.coerce.number().min(0).default(0).optional(), // Pagination offset
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const query = PendingLeaveRequestsQuerySchema.parse({
      employee_id: searchParams.get('employee_id') || undefined,
      leave_type: searchParams.get('leave_type') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0,
    })

    // Build filters - always include status: 'pending'
    const filters = {
      status: 'pending' as const,
      employee_id: query.employee_id,
      leave_type: query.leave_type,
      date_from: query.date_from,
      date_to: query.date_to,
      limit: query.limit,
      offset: query.offset,
    }

    const pendingRequests = await leaveManagementService.getLeaveRequests(filters)

    return NextResponse.json(
      {
        success: true,
        data: pendingRequests,
        meta: {
          count: pendingRequests.length,
          limit: query.limit,
          offset: query.offset,
          total: pendingRequests.length, // Note: This is the filtered count, not total in DB
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching pending leave requests:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch pending leave requests',
      },
      { status: 500 },
    )
  }
}











