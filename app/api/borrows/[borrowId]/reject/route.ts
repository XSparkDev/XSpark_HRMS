import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { borrowService } from '@/lib/services'
import { getCurrentUser } from '@/lib/auth'

const rejectSchema = z.object({
  reason: z.string().optional(),
  rejected_by: z.string().optional(), // Will use current user if not provided
})

export async function PATCH(
  request: NextRequest,
  context: { params: { borrowId: string } | Promise<{ borrowId: string }> }
) {
  try {
    const params = await context.params
    const { borrowId } = params
    
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { reason, rejected_by } = rejectSchema.parse(body)
    
    const supervisorId = rejected_by || user.id || user.employeeId
    if (!supervisorId) {
      return NextResponse.json({ success: false, error: 'Supervisor ID is required' }, { status: 400 })
    }

    const borrow = await borrowService.rejectBorrowRequest(borrowId, supervisorId, reason)

    return NextResponse.json({
      success: true,
      data: borrow,
      message: 'Device booking rejected',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject booking'
    console.error('[borrows] PATCH /reject failed', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
      }, 
      { status: 500 }
    )
  }
}

