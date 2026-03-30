import { NextRequest, NextResponse } from 'next/server'
import { sendMeetingRescheduleEmail } from '@/lib/templates'

/**
 * POST /api/test-email
 * 
 * Test endpoint to send a meeting reschedule email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Sample data for reschedule email
    const result = await sendMeetingRescheduleEmail({
      employeeName: 'Kamo',
      employeeEmail: email,
      roomName: 'Conference Room A',
      meetingAgenda: 'Team Standup Meeting',
      originalDate: 'January 15, 2024',
      originalTime: '10:00 AM - 11:00 AM',
      newDate: 'January 16, 2024',
      newTime: '2:00 PM - 3:00 PM',
      reason: 'Due to scheduling conflicts, the meeting has been moved to accommodate all participants.',
      bookingId: 'test-booking-id',
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        result,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send email',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[test-email] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
