import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { notificationService } from '@/lib/services'
import { notificationCreateSchema, notificationsListSchema } from './validators'
import { supabaseAdmin } from '@/lib/supabase-admin'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const respondWithError = (message: string, status = 500, details?: unknown) =>
  NextResponse.json({ success: false, error: message, details }, { status })

/**
 * Resolve employee identifier to UUID
 * Handles both UUID and employee_id string formats
 */
async function resolveEmployeeUuid(identifier: string): Promise<string | null> {
  if (!identifier) return null
  
  const trimmed = identifier.trim()
  if (!trimmed) return null
  
  // If it's already a UUID, return it (normalized to lowercase)
  if (uuidRegex.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  
  // Otherwise, try to find employee by employee_id string
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('employee_id', trimmed)
      .maybeSingle()
    
    if (error) {
      console.error('[notifications] Error resolving employee UUID:', error)
      return null
    }
    
    if (data?.id) {
      console.log(`[notifications] Resolved employee_id "${trimmed}" to UUID "${data.id}"`)
      return data.id
    }
    
    console.warn(`[notifications] Employee not found with employee_id: "${trimmed}"`)
    return null
  } catch (err) {
    console.error('[notifications] Failed to resolve employee UUID:', err)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = notificationsListSchema.parse({
      employeeId: searchParams.get('employeeId'),
      onlyUnread: searchParams.get('onlyUnread') ?? undefined,
    })

    console.log('[notifications] GET request:', {
      employeeId: params.employeeId,
      onlyUnread: params.onlyUnread,
    })

    // Resolve employee identifier to UUID (handles both UUID and employee_id string)
    const employeeUuid = await resolveEmployeeUuid(params.employeeId)
    
    if (!employeeUuid) {
      console.warn('[notifications] Could not resolve employee UUID from:', params.employeeId)
      return NextResponse.json({ success: true, data: [] })
    }

    const data = params.onlyUnread
      ? await notificationService.getUnreadNotifications(employeeUuid)
      : await notificationService.getAllNotifications(employeeUuid)

    console.log('[notifications] GET response:', {
      employeeId: params.employeeId,
      employeeUuid,
      count: data.length,
      notifications: data.map((n) => ({ id: n.id, title: n.title, employee_id: n.employee_id })),
    })

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


