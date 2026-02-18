// ============================================================================
// NOTIFICATION SERVICE - CRUD + realtime helpers for notifications table
// ============================================================================

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { BaseService } from './base-service'

// Resend API key for sending email notifications
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

export type NotificationType = string

export interface NotificationRecord {
  id: string
  employee_id: string
  title: string
  message: string
  notification_type: NotificationType
  is_confidential: boolean
  published_by: string | null
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
  published_by?: string | null
  is_confidential?: boolean
}

export interface CreateNotificationOptions {
  sendEmail?: boolean
  preventDuplicates?: boolean
  duplicateWindowMinutes?: number
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
  private readonly resendApiKey = RESEND_API_KEY

  private normalize(record: any): NotificationRecord {
    return {
      id: record.id,
      employee_id: record.employee_id,
      title: record.title,
      message: record.message,
      notification_type: record.notification_type,
      is_confidential: Boolean(record.is_confidential),
      published_by: record.published_by ?? null,
      is_read: Boolean(record.is_read),
      read_at: record.read_at ?? null,
      email_sent: Boolean(record.email_sent),
      email_sent_at: record.email_sent_at ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }
  }

  async createNotification(
    payload: CreateNotificationInput,
    options?: CreateNotificationOptions,
  ): Promise<NotificationRecord> {
    this.validateRequired(payload, ['employee_id', 'title', 'message', 'notification_type'])

    const { sendEmail = false, preventDuplicates = true, duplicateWindowMinutes = 5 } = options || {}

    // Check for duplicates if enabled
    if (preventDuplicates) {
      const duplicate = await this.checkForDuplicate(
        payload.employee_id,
        payload.title,
        duplicateWindowMinutes,
      )
      if (duplicate) {
        console.log('[NotificationService] Duplicate notification prevented:', duplicate.id)
        return duplicate // Return existing notification instead of creating duplicate
      }
    }

    const sanitized = this.sanitizeInput({
      ...payload,
      is_confidential: payload.is_confidential ?? false,
      published_by: payload.published_by ?? null,
    })

    const record = await this.executeInsert<any>(
      async () => {
        const { data, error } = await this.supabase
          .from(this.table)
          .insert(sanitized)
          .select('*')
          .single()

        if (error) {
          console.error('[NotificationService] Error creating notification:', error)
          throw error
        }

        // Log for debugging
        console.log('[NotificationService] Notification created successfully:', {
          id: data?.id,
          employee_id: data?.employee_id,
          title: data?.title,
          created_at: data?.created_at,
        })

        return { data, error }
      },
      'create notification',
    )

    const notification = this.normalize(record)

    // Send email if requested
    if (sendEmail) {
      try {
        const emailResult = await this.sendNotificationEmail(notification)
        if (emailResult.success) {
          // Update email tracking
          await this.updateEmailStatus(notification.id, true)
        } else {
          console.error('[NotificationService] Email sending failed:', emailResult.error)
        }
      } catch (emailError) {
        console.error('[NotificationService] Failed to send notification email:', emailError)
        // Notification is still created, but email failed
      }
    }

    return notification
  }

  /**
   * Check for duplicate notifications within a time window
   */
  private async checkForDuplicate(
    employeeId: string,
    title: string,
    windowMinutes: number = 5,
  ): Promise<NotificationRecord | null> {
    try {
      const cutoffTime = new Date()
      cutoffTime.setMinutes(cutoffTime.getMinutes() - windowMinutes)

      const { data, error } = await this.supabase
        .from(this.table)
        .select('*')
        .eq('employee_id', employeeId)
        .eq('title', title)
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('[NotificationService] Error checking for duplicates:', error)
        return null
      }

      return data ? this.normalize(data) : null
    } catch (error) {
      console.error('[NotificationService] Exception checking for duplicates:', error)
      return null
    }
  }

  /**
   * Update email status in the database
   */
  async updateEmailStatus(
    notificationId: string,
    emailSent: boolean,
  ): Promise<NotificationRecord | null> {
    if (!notificationId) {
      return null
    }

    const updateData: any = {
      email_sent: emailSent,
      updated_at: new Date().toISOString(),
    }

    if (emailSent) {
      updateData.email_sent_at = new Date().toISOString()
    }

    const record = await this.executeUpdate<any>(
      async () =>
        await this.supabase
          .from(this.table)
          .update(updateData)
          .eq('id', notificationId)
          .select('*')
          .maybeSingle(),
      'update email status'
    )

    return record ? this.normalize(record) : null
  }

  /**
   * Send notification email to employee
   */
  private async sendNotificationEmail(
    notification: NotificationRecord,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get employee email from employee_id
      const { data: employee, error: employeeError } = await this.supabase
        .from('employees')
        .select('email, name')
        .eq('id', notification.employee_id)
        .maybeSingle()

      if (employeeError) {
        return { success: false, error: `Failed to fetch employee: ${employeeError.message}` }
      }

      if (!employee?.email) {
        return { success: false, error: 'Employee email not found' }
      }

      // Use Resend API to send email
      if (!this.resendApiKey) {
        console.warn('[NotificationService] RESEND_API_KEY not configured, skipping email')
        return { success: false, error: 'Email service not configured' }
      }

      // Format email content
      const emailHtml = this.formatNotificationEmail(notification, employee.name || 'Employee')

      // Send email via Resend API
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'notifications@xspark.com',
          to: employee.email,
          subject: notification.title,
          html: emailHtml,
        }),
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.message || `Email API returned ${emailResponse.status}`,
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      }
    }
  }

  /**
   * Format notification email HTML
   */
  private formatNotificationEmail(notification: NotificationRecord, employeeName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #92278F, #BE1E2D); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .message { background: white; padding: 15px; border-left: 4px solid #92278F; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${notification.title}</h2>
            </div>
            <div class="content">
              <p>Hello ${employeeName},</p>
              <div class="message">
                ${notification.message.replace(/\n/g, '<br>')}
              </div>
              <p>You can view this notification in your dashboard.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from XSpark HRMS.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  async getAllNotifications(employeeId: string): Promise<NotificationRecord[]> {
    if (!employeeId) {
      console.warn('[NotificationService] getAllNotifications called without employeeId')
      return []
    }

    // Normalize employeeId to ensure consistent UUID format
    const normalizedEmployeeId = employeeId.trim()

    const rows = await this.executeQueryArray<any>(
      async () => {
        const { data, error } = await this.supabase
          .from(this.table)
          .select('*')
          .eq('employee_id', normalizedEmployeeId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[NotificationService] Error fetching notifications:', error)
          throw error
        }

        // Log for debugging
        if (data && data.length > 0) {
          console.log(`[NotificationService] Found ${data.length} notifications for employee ${normalizedEmployeeId}`)
        } else {
          console.log(`[NotificationService] No notifications found for employee ${normalizedEmployeeId}`)
        }

        return { data, error }
      },
      'fetch notifications',
    )

    return rows.map((row) => this.normalize(row))
  }

  async getUnreadNotifications(employeeId: string): Promise<NotificationRecord[]> {
    if (!employeeId) {
      console.warn('[NotificationService] getUnreadNotifications called without employeeId')
      return []
    }

    // Normalize employeeId to ensure consistent UUID format
    const normalizedEmployeeId = employeeId.trim()

    const rows = await this.executeQueryArray<any>(
      async () => {
        const { data, error } = await this.supabase
          .from(this.table)
          .select('*')
          .eq('employee_id', normalizedEmployeeId)
          .eq('is_read', false)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[NotificationService] Error fetching unread notifications:', error)
          throw error
        }

        // Log for debugging
        if (data && data.length > 0) {
          console.log(`[NotificationService] Found ${data.length} unread notifications for employee ${normalizedEmployeeId}`)
        }

        return { data, error }
      },
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
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
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
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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

    channel.subscribe((status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
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

  /**
   * Debug method: Get all notifications for an employee (including checking for mismatches)
   * This helps diagnose why notifications might not be appearing
   */
  async debugGetNotificationsForEmployee(employeeId: string): Promise<{
    exactMatch: NotificationRecord[]
    allNotifications: any[]
    employeeIdVariations: string[]
  }> {
    if (!employeeId) {
      return { exactMatch: [], allNotifications: [], employeeIdVariations: [] }
    }

    const normalizedEmployeeId = employeeId.trim()

    // Get exact matches
    const exactMatch = await this.getAllNotifications(normalizedEmployeeId)

    // Get all notifications to check for potential mismatches
    const { data: allNotifications } = await this.supabase
      .from(this.table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    // Check for variations (case-insensitive, trimmed)
    const employeeIdVariations = allNotifications
      ?.filter((n: any) => {
        const nId = (n.employee_id || '').toString().trim().toLowerCase()
        const searchId = normalizedEmployeeId.toLowerCase()
        return nId === searchId
      })
      .map((n: any) => n.employee_id) || []

    return {
      exactMatch,
      allNotifications: allNotifications || [],
      employeeIdVariations: [...new Set(employeeIdVariations)].filter((id): id is string => typeof id === 'string'),
    }
  }
}

export const notificationService = new NotificationService()

