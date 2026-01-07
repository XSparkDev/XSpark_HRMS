import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { bookingsService } from "@/lib/services"
import type { BookingRecord } from "@/lib/services/bookings-service"

// Helper functions for transforming booking data
const toDateOnly = (value?: string | null) => {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

const toTimeString = (value?: string | null) => {
  if (!value) return null
  if (/^\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const match = value.match(/(\d{2}):(\d{2})/)
    return match ? `${match[1]}:${match[2]}` : null
  }
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const transformBookingForLegacyClients = (booking: BookingRecord & { room_details?: any }) => {
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
    meeting_agenda: booking.booking_reason ?? null,
    purpose: booking.booking_reason ?? null,
    room_details: booking.room_details ?? null,
  }
}

const postponeSchema = z.object({
  booking_id: z.string().min(1, "booking_id is required"),
  new_start_time: z.string().min(1, "new_start_time is required"),
  new_end_time: z.string().min(1, "new_end_time is required"),
})

const conflictMessage = "The room is already booked for that time window."

export async function POST(request: NextRequest) {
  try {
    const { booking_id, new_start_time, new_end_time } = postponeSchema.parse(await request.json())

    const result = await bookingsService.postponeBooking(booking_id, new_start_time, new_end_time)
    
    // Transform the booking for legacy client compatibility
    const transformedBooking = transformBookingForLegacyClients(
      result.booking as BookingRecord & { room_details?: any },
    )

    return NextResponse.json({
      success: true,
      data: {
        booking: transformedBooking,
        previous_start_time: result.previousStart,
        previous_end_time: result.previousEnd,
        new_start_time: result.booking.start_time,
        new_end_time: result.booking.end_time,
        is_postponed: result.booking.is_postponed ?? true,
      },
      message: "Meeting postponed successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid postpone payload",
          details: error.errors,
        },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message.includes(conflictMessage)) {
      return NextResponse.json(
        { success: false, error: "Room unavailable for selected time window" },
        { status: 409 },
      )
    }

    console.error("[room-bookings] POST /postpone failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to postpone booking",
      },
      { status: 500 },
    )
  }
}

