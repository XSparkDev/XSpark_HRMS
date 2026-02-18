import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { bookingsService } from '@/lib/services'
import type { UpdateBookingInput, BookingRecord } from '@/lib/services/bookings-service'
import { supabaseAdmin } from '@/lib/supabase-admin'

const updateSchema = z.object({
  room_id: z.string().optional(),
  booked_by: z.string().optional(),
  date: z.string().optional(),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'start_time must be in HH:MM format')
    .optional(),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'end_time must be in HH:MM format')
    .optional(),
  status: z.string().optional(),
  check_in_status: z.string().optional(),
  meeting_category: z.string().optional(),
  meeting_agenda: z.string().optional(),
  purpose: z.string().optional(),
  booking_reason: z.string().optional(),
  checked_in_at: z.string().optional(),
})

const conflictMessage = 'The room is already booked for that time window.'

const getEmployeeName = async (employeeUuid: string): Promise<string | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('first_name, last_name, preferred_name')
      .eq('id', employeeUuid)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    const firstName = data.first_name || ''
    const lastName = data.last_name || ''
    const preferredName = data.preferred_name
    
    if (preferredName) {
      return `${preferredName} ${lastName}`.trim()
    }
    return `${firstName} ${lastName}`.trim() || 'Unknown'
  } catch (error) {
    console.warn('[room-bookings] Failed to get employee name', error)
    return null
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params
    const { data, error } = await bookingsService.getBookingById(bookingId)
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: transformBookingForLegacyClients(data),
    })
  } catch (error) {
    console.error('Failed to fetch booking details:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch booking' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const payload = updateSchema.parse(await request.json())

    const { data: existing, error: fetchError } = await bookingsService.getBookingById(bookingId)
    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError },
        { status: 500 },
      )
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    const roomId = payload.room_id ?? existing.room_id
    const nextDate = payload.date ?? toDateOnly(existing.start_time) ?? new Date(existing.start_time).toISOString().split('T')[0]
    const nextStartTime = payload.start_time ?? toTimeString(existing.start_time) ?? '00:00'
    const nextEndTime = payload.end_time ?? toTimeString(existing.end_time) ?? '01:00'

    if (payload.room_id || payload.date || payload.start_time || payload.end_time) {
      // First check if user already has a booking at this time (regardless of room)
      await bookingsService.ensureUserTimeSlotIsAvailable({
        bookedBy: existing.booked_by,
        bookingDate: nextDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        excludeBookingId: bookingId,
      })

      // Then check if the specific room is available
      await bookingsService.ensureRoomIsAvailable({
        roomId,
        bookingDate: nextDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        excludeBookingId: bookingId,
      })
    }

    const updates: UpdateBookingInput = {
      room_id: payload.room_id,
      booking_reason: payload.booking_reason ?? undefined,
      start_time: payload.date || payload.start_time ? combineDateTime(nextDate, nextStartTime) : undefined,
      end_time: payload.date || payload.end_time ? combineDateTime(nextDate, nextEndTime) : undefined,
      meeting_category: payload.meeting_category ?? undefined,
      checked_in_at: payload.checked_in_at,
    }
    
    // Handle cancellation: set rejection_reason to mark as cancelled
    // DO NOT modify any agenda fields - preserve them as-is
    if (payload.status === 'cancelled') {
      updates.rejection_reason = 'Cancelled by user'
      // Preserve all original agenda fields - do not modify them
      // Only set booking_reason if explicitly provided in payload, otherwise leave unchanged
      if (payload.booking_reason === undefined) {
        delete updates.booking_reason
      }
    }

    if (payload.check_in_status !== undefined) {
      const normalizedStatus = payload.check_in_status.trim()
      updates.check_in_status = normalizedStatus
      updates.check_in_time =
        normalizedStatus.toLowerCase() === 'checked-in' ? new Date().toISOString() : null
    }

    const { data: booking, error: updateError } = await bookingsService.updateBooking(bookingId, updates)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError },
        { status: 500 },
      )
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: transformBookingForLegacyClients(booking),
      message: 'Booking updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid booking update payload',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes(conflictMessage)) {
      // Check if we have conflict booking info
      const conflictBooking = (error as any).conflictBooking as BookingRecord | undefined
      let errorMessage = 'The selected room is already booked for that time window.'
      
      if (conflictBooking?.booked_by) {
        const employeeName = await getEmployeeName(conflictBooking.booked_by)
        if (employeeName) {
          const startTime = toTimeString(conflictBooking.start_time) || ''
          const endTime = toTimeString(conflictBooking.end_time) || ''
          errorMessage = `The room is already booked by ${employeeName} from ${startTime} to ${endTime}. Please select a different time slot or room.`
        }
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 409 }
      )
    }

    if (error instanceof Error && error.message.includes('already have a booking at this time')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    console.error('Failed to update room booking:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    await bookingsService.deleteBooking(bookingId)
    return NextResponse.json(
      { success: true, message: 'Booking deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete room booking:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete booking' },
      { status: 500 }
    )
  }
}

const combineDateTime = (date: string, time: string) => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time
  const candidate = new Date(`${date}T${normalizedTime}`)
  return Number.isNaN(candidate.getTime()) ? new Date(date).toISOString() : candidate.toISOString()
}

const toDateOnly = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0]
}

const toTimeString = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const transformBookingForLegacyClients = (booking: BookingRecord | null) => {
  if (!booking) {
    return booking
  }

  const date = toDateOnly(booking.start_time)
  const startTime = toTimeString(booking.start_time)
  const endTime = toTimeString(booking.end_time)

  return {
    ...booking,
    date: date ?? undefined,
    booking_date: date ?? undefined,
    start_time: startTime ?? undefined,
    end_time: endTime ?? undefined,
    time: startTime && endTime ? `${startTime}-${endTime}` : undefined,
    meeting_category: booking.meeting_category ?? null,
    // Preserve all agenda fields - use the actual values from database
    meeting_agenda: booking.meeting_agenda ?? booking.booking_reason ?? null,
    purpose: booking.purpose ?? booking.booking_reason ?? null,
    booking_reason: booking.booking_reason ?? null,
  }
}

