import { NextRequest, NextResponse } from 'next/server'
import { leaveManagementService } from '@/lib/services'
import { z } from 'zod'

// ============================================================================
// LEAVE REQUESTS API
// ============================================================================
// Handles leave request operations: GET (list), POST (create), PUT (approve/reject)
// ============================================================================

const CreateLeaveRequestSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type: z.enum(['sick', 'annual', 'unpaid', 'maternity', 'paternity', 'family_responsibility', 'other']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  total_days: z.number().min(0.5).max(365).optional(), // Optional - will be calculated if not provided
  reason: z.string().optional(),
  document_url: z.string().url().optional(),
  document_required: z.boolean().optional(),
  submitted_by: z.string().uuid(), // Employee submitting the request
})

const UpdateLeaveRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'cancelled']),
  reviewed_by: z.string().uuid(),
  review_notes: z.string().optional(),
})

const LeaveRequestFiltersSchema = z.object({
  employee_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  leave_type: z.string().optional(),
  early_return_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reviewed_by: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const filters = LeaveRequestFiltersSchema.parse({
      employee_id: searchParams.get('employee_id') || undefined,
      status: searchParams.get('status') as any || undefined,
      leave_type: searchParams.get('leave_type') || undefined,
      early_return_status: searchParams.get('early_return_status') as any || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      reviewed_by: searchParams.get('reviewed_by') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    })

    const leaveRequests = await leaveManagementService.getLeaveRequests(filters)

    return NextResponse.json({
      success: true,
      data: leaveRequests,
      meta: {
        count: leaveRequests.length,
        limit: filters.limit,
        offset: filters.offset,
      },
    })
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    
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
        error: 'Failed to fetch leave requests',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const leaveRequestData = CreateLeaveRequestSchema.parse(body)

    // Validate dates
    const fromDate = new Date(leaveRequestData.start_date)
    const toDate = new Date(leaveRequestData.end_date)
    
    if (fromDate > toDate) {
      return NextResponse.json(
        {
        success: false,
          error: 'Leave start date cannot be after end date',
        },
        { status: 400 },
      )
    }

    // Calculate working days if not provided or if provided value doesn't match
    let totalDays = leaveRequestData.total_days
    if (!totalDays) {
      totalDays = await leaveManagementService.calculateWorkingDays(
        leaveRequestData.start_date,
        leaveRequestData.end_date,
      )
    } else {
      // Verify the provided total_days matches calculated value (allow small difference for rounding)
      const calculatedDays = await leaveManagementService.calculateWorkingDays(
        leaveRequestData.start_date,
        leaveRequestData.end_date,
      )
      if (Math.abs(totalDays - calculatedDays) > 0.5) {
        // Use calculated value if significantly different
        totalDays = calculatedDays
    }
    }

    const leaveRequest = await leaveManagementService.createLeaveRequest({
      ...leaveRequestData,
      total_days: totalDays,
    })

    return NextResponse.json(
      {
      success: true,
      data: leaveRequest,
        message: 'Leave request created successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating leave request:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
        success: false,
        error: 'Invalid leave request data',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
      success: false,
        error: error instanceof Error ? error.message : 'Failed to create leave request',
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const updateData = UpdateLeaveRequestSchema.parse(body)

    const existingRequest = await leaveManagementService.getLeaveRequestById(updateData.id)
    if (!existingRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Leave request not found',
        },
        { status: 404 },
      )
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot update leave request with status '${existingRequest.status}'`,
        },
        { status: 400 },
      )
    }

    // Require review_notes (rejection reason) when rejecting
    if (updateData.status === 'rejected' && (!updateData.review_notes || !updateData.review_notes.trim())) {
      return NextResponse.json(
        {
        success: false,
          error: 'Rejection reason is required when rejecting a leave request',
        },
        { status: 400 },
      )
    }

    let updatedRequest: any

      if (updateData.status === 'approved') {
      updatedRequest = await leaveManagementService.approveLeaveRequest(
          updateData.id,
        updateData.reviewed_by,
        updateData.review_notes,
        )
        return NextResponse.json({
          success: true,
          data: updatedRequest,
        message: 'Leave request approved successfully',
        })
      } else if (updateData.status === 'rejected') {
      updatedRequest = await leaveManagementService.rejectLeaveRequest(
        updateData.id,
        updateData.reviewed_by,
        updateData.review_notes!,
      )
      return NextResponse.json({
        success: true,
        data: updatedRequest,
        message: 'Leave request rejected successfully',
      })
    } else if (updateData.status === 'cancelled') {
      // Cancellation is similar to rejection but initiated by employee
      updatedRequest = await leaveManagementService.rejectLeaveRequest(
          updateData.id,
        updateData.reviewed_by,
        'Cancelled by employee',
        )
        return NextResponse.json({
          success: true,
          data: updatedRequest,
        message: 'Leave request cancelled successfully',
        })
    }

    return NextResponse.json(
      {
      success: false,
        error: 'Invalid status change',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error('Error updating leave request:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
        success: false,
        error: 'Invalid leave request data',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
      success: false,
        error: error instanceof Error ? error.message : 'Failed to update leave request',
      },
      { status: 500 },
    )
  }
}
