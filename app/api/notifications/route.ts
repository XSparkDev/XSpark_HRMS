import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { notificationService } from '@/lib/services'
import { notificationCreateSchema, notificationsListSchema } from './validators'

const respondWithError = (message: string, status = 500, details?: unknown) =>
  NextResponse.json({ success: false, error: message, details }, { status })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = notificationsListSchema.parse({
      employeeId: searchParams.get('employeeId'),
      onlyUnread: searchParams.get('onlyUnread') ?? undefined,
    })

    const data = params.onlyUnread
      ? await notificationService.getUnreadNotifications(params.employeeId)
      : await notificationService.getAllNotifications(params.employeeId)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondWithError('Invalid query parameters', 400, error.errors)
    }
    console.error('[notifications] GET failed', error)
    return respondWithError('Failed to fetch notifications')
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = notificationCreateSchema.parse(await request.json())
    const notification = await notificationService.createNotification(payload)
    return NextResponse.json(
      {
        success: true,
        data: notification,
        message: 'Notification created successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondWithError('Invalid notification payload', 400, error.errors)
    }
    const message = error instanceof Error ? error.message : 'Failed to create notification'
    console.error('[notifications] POST failed', error)
    return respondWithError(message)
  }
}


