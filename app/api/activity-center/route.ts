import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/activity-center
 *
 * Returns recent activity items from domain tables (bookings, borrows, incidents).
 * Activities are filtered by the user making the request (booked_by, borrowed_by, reported_by).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const userId = searchParams.get('userId') // User identifier to filter activities

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User identifier is required',
        },
        { status: 400 }
      )
    }

    const activities: Array<{
      id: string
      type: string
      title: string
      description: string
      created_at: string
      status: string
      related_id: string | null
    }> = []

    // 1. Fetch room bookings for this user
    try {
      const { data: bookings, error: bookingsError } = await supabaseAdmin
        .from('bookings')
        .select('booking_id, room_id, booking_reason, meeting_agenda, start_time, rejection_reason, created_at, updated_at')
        .eq('booked_by', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!bookingsError && bookings) {
        for (const booking of bookings) {
          const isCancelled = booking.rejection_reason && booking.rejection_reason.toLowerCase().includes('cancel')
          
          activities.push({
            id: `booking-${booking.booking_id}`,
            type: 'room_booking',
            title: isCancelled ? 'Meeting Cancelled' : 'Meeting Booked',
            description: booking.meeting_agenda || booking.booking_reason || `Room booking ${booking.room_id}`,
            created_at: booking.created_at || booking.updated_at || new Date().toISOString(),
            status: isCancelled ? 'cancelled' : 'active',
            related_id: booking.booking_id,
          })
        }
      }
    } catch (error) {
      console.error('[activity-center] Error fetching bookings:', error)
    }

    // 2. Fetch device borrows for this user
    try {
      const { data: borrows, error: borrowsError } = await supabaseAdmin
        .from('borrows')
        .select('borrow_id, device_id, approval_status, status, returned_at, created_at, updated_at')
        .eq('borrowed_by', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!borrowsError && borrows) {
        for (const borrow of borrows) {
          const approvalStatus = (borrow.approval_status || '').toLowerCase()
          const status = (borrow.status || '').toLowerCase()

          // Only show approval/rejection activities
          if (approvalStatus === 'approved' || approvalStatus === 'rejected') {
            activities.push({
              id: `borrow-${borrow.borrow_id}`,
              type: 'device_borrow',
              title: approvalStatus === 'approved' ? 'Device Request Approved' : 'Device Request Rejected',
              description: `Device borrow request ${approvalStatus}`,
              created_at: borrow.updated_at || borrow.created_at || new Date().toISOString(),
              status: approvalStatus,
              related_id: borrow.borrow_id,
            })
          }

          // Show return activities
          if (status === 'returned' || borrow.returned_at) {
            activities.push({
              id: `borrow-return-${borrow.borrow_id}`,
              type: 'device_return',
              title: 'Device Returned',
              description: 'Device has been returned',
              created_at: borrow.returned_at || borrow.updated_at || borrow.created_at || new Date().toISOString(),
              status: 'returned',
              related_id: borrow.borrow_id,
            })
          }
        }
      }
    } catch (error) {
      console.error('[activity-center] Error fetching borrows:', error)
    }

    // 3. Fetch incidents reported by this user
    try {
      const { data: incidents, error: incidentsError } = await supabaseAdmin
        .from('incidents')
        .select('incident_id, device_id, status, description, created_at, updated_at')
        .eq('reported_by', userId)
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (!incidentsError && incidents) {
        for (const incident of incidents) {
          const status = (incident.status || '').toLowerCase()
          
          // Only show updates (reviewed, resolved, closed)
          if (['resolved', 'closed', 'in progress'].includes(status)) {
            activities.push({
              id: `incident-${incident.incident_id}`,
              type: 'incident_update',
              title: `Incident ${incident.status}`,
              description: incident.description || 'Incident update',
              created_at: incident.updated_at || incident.created_at || new Date().toISOString(),
              status: status,
              related_id: incident.incident_id,
            })
          }
        }
      }
    } catch (error) {
      console.error('[activity-center] Error fetching incidents:', error)
    }

    // Sort all activities by created_at (newest first)
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Apply pagination
    const paginatedActivities = activities.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: paginatedActivities,
      meta: {
        total: activities.length,
        limit,
        offset,
        hasMore: offset + limit < activities.length,
      },
    })
  } catch (error) {
    console.error('[activity-center] GET failed', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activities',
      },
      { status: 500 }
    )
  }
}
