import { NextRequest, NextResponse } from 'next/server'
import { leaveManagementService } from '@/lib/services'
import { z } from 'zod'

// Legacy Supabase-backed leave requests API (kept for reference only)

const CreateLeaveRequestSchema = z.object({
  employee_id: z.string().uuid(),
  full_name: z.string().min(1).max(255),
  employee_number: z.string().min(1).max(20),
  id_number: z.string().length(13),
  job_title: z.string().min(1).max(255),
  direct_superior: z.string().max(255).optional(),
  leave_type: z.enum(['sick', 'annual', 'unpaid', 'maternity', 'paternity', 'family_responsibility', 'other']),
  leave_type_other: z.string().max(255).optional(),
  leave_day_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leave_day_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_days: z.number().min(0.5).max(365),
  reason: z.string().optional(),
  supporting_document_url: z.string().url().optional(),
  employee_signature: z.string().optional()
})

const UpdateLeaveRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  rejection_reason: z.string().optional(),
  reviewed_by: z.string().uuid().optional(),
  employer_signature: z.string().optional()
})

const LeaveRequestFiltersSchema = z.object({
  employee_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  leave_type: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reviewed_by: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const filters = LeaveRequestFiltersSchema.parse({
      employee_id: searchParams.get('employee_id') || undefined,
      status: searchParams.get('status') as any || undefined,
      leave_type: searchParams.get('leave_type') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      reviewed_by: searchParams.get('reviewed_by') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    })

    const leaveRequests = await leaveManagementService.getLeaveRequests(filters)

    return NextResponse.json({
      success: true,
      data: leaveRequests,
      meta: {
        count: leaveRequests.length,
        limit: filters.limit,
        offset: filters.offset
      }
    })
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch leave requests'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const leaveRequestData = CreateLeaveRequestSchema.parse(body)

    const fromDate = new Date(leaveRequestData.leave_day_from)
    const toDate = new Date(leaveRequestData.leave_day_to)
    
    if (fromDate > toDate) {
      return NextResponse.json({
        success: false,
        error: 'Leave start date cannot be after end date'
      }, { status: 400 })
    }

    const calculatedDays = leaveManagementService.calculateWorkingDays(
      leaveRequestData.leave_day_from,
      leaveRequestData.leave_day_to
    )

    if (!leaveRequestData.total_days || Math.abs(leaveRequestData.total_days - calculatedDays) > 0.5) {
      leaveRequestData.total_days = calculatedDays
    }

    const leaveRequest = await leaveManagementService.createLeaveRequest(leaveRequestData)

    return NextResponse.json({
      success: true,
      data: leaveRequest,
      message: 'Leave request created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating leave request:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid leave request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create leave request'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    const updateData = UpdateLeaveRequestSchema.parse(body)

    const existingRequest = await leaveManagementService.getLeaveRequestById(updateData.id)
    if (!existingRequest) {
      return NextResponse.json({
        success: false,
        error: 'Leave request not found'
      }, { status: 404 })
    }

    if (updateData.status && updateData.status !== existingRequest.status) {
      if (updateData.status === 'approved') {
        const updatedRequest = await leaveManagementService.approveLeaveRequest(
          updateData.id,
          updateData.reviewed_by!
        )
        return NextResponse.json({
          success: true,
          data: updatedRequest,
          message: 'Leave request approved successfully'
        })
      } else if (updateData.status === 'rejected') {
        const updatedRequest = await leaveManagementService.rejectLeaveRequest(
          updateData.id,
          updateData.reviewed_by!,
          updateData.rejection_reason || 'No reason provided'
        )
        return NextResponse.json({
          success: true,
          data: updatedRequest,
          message: 'Leave request rejected successfully'
        })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid status change'
    }, { status: 400 })
  } catch (error) {
    console.error('Error updating leave request:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid leave request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update leave request'
    }, { status: 500 })
  }
}





