import { NextRequest, NextResponse } from 'next/server'
import { borrowService } from '@/lib/services'

export async function PATCH(
  request: NextRequest,
  context: { params: { borrowId: string } | Promise<{ borrowId: string }> }
) {
  try {
    const params = await context.params
    const { borrowId } = params

    const borrow = await borrowService.pickupDevice(borrowId)

    return NextResponse.json({
      success: true,
      data: borrow,
      message: 'Device picked up successfully',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to pickup device'
    console.error('[borrows] PATCH /pickup failed', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
      }, 
      { status: 500 }
    )
  }
}

