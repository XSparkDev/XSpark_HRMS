import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { borrowService } from '@/lib/services'
import { getCurrentUser } from '@/lib/auth'

const approveSchema = z.object({
  approved_by: z.string().optional(), // Will use current user if not provided
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

    // Get supervisor ID from request body or use current user
    const body = await request.json().catch(() => ({}))
    const { approved_by } = approveSchema.parse(body)
    
    const supervisorId = approved_by || user.id || user.employeeId
    if (!supervisorId) {
      return NextResponse.json({ success: false, error: 'Supervisor ID is required' }, { status: 400 })
    }

    const borrow = await borrowService.approveBorrowRequest(borrowId, supervisorId)

    return NextResponse.json({
      success: true,
      data: borrow,
      message: 'Device booking approved successfully',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to approve booking'
    console.error('[borrows] PATCH /approve failed', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
      }, 
      { status: 500 }
    )
  }
}

