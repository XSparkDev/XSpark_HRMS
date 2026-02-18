// ============================================================================
// EMAIL SERVICE - Send emails using Resend API
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@xspark.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class EmailService {
  private readonly apiKey: string
  private readonly fromEmail: string

  constructor() {
    this.apiKey = RESEND_API_KEY
    this.fromEmail = RESEND_FROM_EMAIL
  }

  async sendEmail(options: EmailOptions): Promise<SendEmailResult> {
    if (!this.apiKey) {
      console.warn('[EmailService] RESEND_API_KEY not configured, email not sent')
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: options.from || this.fromEmail,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          reply_to: options.replyTo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Resend API error: ${response.status}`)
      }

      return {
        success: true,
        messageId: data.id,
      }
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  getAppUrl(): string {
    return APP_URL
  }
}

export const emailService = new EmailService()
