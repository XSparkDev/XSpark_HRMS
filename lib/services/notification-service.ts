// ============================================================================
// NOTIFICATION SERVICE - CRUD + realtime helpers for notifications table
// ============================================================================

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { BaseService } from './base-service'

export type NotificationType = string

export interface NotificationRecord {
  id: string
  employee_id: string
  title: string
  message: string
  notification_type: NotificationType
  is_confidential: boolean
  published_by: string
  is_read: boolean
  read_at: string | null
  email_sent: boolean
  email_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateNotificationInput {
  employee_id: string
  title: string
  message: string
  notification_type: NotificationType
  published_by: string
  is_confidential?: boolean
}

export interface NotificationRealtimeHandlers {
  onNotification?: (notification: NotificationRecord) => void
  onBadgeCountChange?: (unreadCount: number) => void
  onToast?: (notification: NotificationRecord) => void
  onError?: (error: Error) => void
  onStatusChange?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void
}

export class NotificationService extends BaseService {
  private readonly table = 'notifications'

  private normalize(record: any): NotificationRecord {
    return {
      id: record.id,
      employee_id: record.employee_id,
      title: record.title,
      message: record.message,
      notification_type: record.notification_type,
      is_confidential: Boolean(record.is_confidential),
      published_by: record.published_by,
      is_read: Boolean(record.is_read),
      read_at: record.read_at ?? null,
      email_sent: Boolean(record.email_sent),
      email_sent_at: record.email_sent_at ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }
  }

  async createNotification(payload: CreateNotificationInput): Promise<NotificationRecord> {
    this.validateRequired(payload, ['employee_id', 'title', 'message', 'notification_type', 'published_by'])

    const sanitized = this.sanitizeInput({
      ...payload,
      is_confidential: payload.is_confidential ?? false,
    })

    const record = await this.executeInsert<any>(
      async () =>
        await this.supabase.from(this.table).insert(sanitized).select('*').single(),
      'create notification',
    )

    return this.normalize(record)
  }

  async getAllNotifications(employeeId: string): Promise<NotificationRecord[]> {
    if (!employeeId) {
      return []
    }

    const rows = await this.executeQueryArray<any>(
      async () =>
        await this.supabase
          .from(this.table)
          .select('*')
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false }),
      'fetch notifications',
    )

    return rows.map((row) => this.normalize(row))
  }

  async getUnreadNotifications(employeeId: string): Promise<NotificationRecord[]> {
    if (!employeeId) {
      return []
    }

    const rows = await this.executeQueryArray<any>(
      async () =>
        await this.supabase
          .from(this.table)
          .select('*')
          .eq('employee_id', employeeId)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
      'fetch unread notifications',
    )

    return rows.map((row) => this.normalize(row))
  }

  async markAsRead(notificationId: string): Promise<NotificationRecord | null> {
    if (!notificationId) {
      return null
    }

    const record = await this.executeUpdate<any>(
      async () =>
        await this.supabase
          .from(this.table)
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId)
          .select('*')
          .maybeSingle(),
      'mark notification as read',
    )

    return record ? this.normalize(record) : null
  }

  async markAllAsRead(employeeId: string): Promise<number> {
    if (!employeeId) {
      return 0
    }

    try {
      const { data, error } = await this.supabase
        .from(this.table)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('employee_id', employeeId)
        .eq('is_read', false)
        .select('id')

      if (error) {
        this.handleError(error, 'mark all notifications as read')
      }

      return data?.length ?? 0
    } catch (error) {
      this.handleError(error, 'mark all notifications as read')
    }
  }

  subscribeToNotifications(
    employeeId: string,
    handlers: NotificationRealtimeHandlers = {},
  ): RealtimeChannel | null {
    if (!employeeId || !this.supabase?.channel) {
      return null
    }

    const channel = this.supabase
      .channel(`notifications:employee:${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: this.table,
          filter: `employee_id=eq.${employeeId}`,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          try {
            const notification = this.normalize(payload.new)
            handlers.onNotification?.(notification)
            handlers.onToast?.(notification)

            if (!notification.is_read && handlers.onBadgeCountChange) {
              const unread = await this.getUnreadNotifications(employeeId)
              handlers.onBadgeCountChange(unread.length)
            }
          } catch (error) {
            handlers.onError?.(error as Error)
          }
        },
      )

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' && status !== 'CLOSED') {
        handlers.onError?.(new Error(`Notification channel status: ${status}`))
      }
      handlers.onStatusChange?.(status)
    })

    return channel
  }

  async unsubscribe(channel: RealtimeChannel | null): Promise<void> {
    if (!channel) return
    await channel.unsubscribe()
  }
}

export const notificationService = new NotificationService()

