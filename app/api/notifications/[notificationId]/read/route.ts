import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/services'

const respondWithError = (message: string, status = 500, details?: unknown) =>
  NextResponse.json({ success: false, error: message, details }, { status })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params
    
    if (!notificationId) {
      return respondWithError('Notification ID is required', 400)
    }

    const notification = await notificationService.markAsRead(notificationId)

    if (!notification) {
      return respondWithError('Notification not found', 404)
    }

    return NextResponse.json({
      success: true,
      data: notification,
      message: 'Notification marked as read',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read'
    console.error('[notifications] PATCH /read failed', error)
    return respondWithError(message)
  }
}
