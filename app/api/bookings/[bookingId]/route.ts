import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { bookingsService } from '@/lib/services'
import type { UpdateBookingInput } from '@/lib/services/bookings-service'

const updateSchema = z.object({
  room_id: z.string().optional(),
  booking_reason: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.string().optional(),
  recurrence_end_date: z.string().optional(),
  approved_by: z.string().optional(),
  approved_at: z.string().optional(),
  rejection_reason: z.string().optional(),
})

const normalizeErrorResponse = (error: unknown, fallbackMessage: string, status = 500) => {
  console.error(fallbackMessage, error)
  return NextResponse.json({ success: false, error: fallbackMessage }, { status })
}

export async function PATCH(request: NextRequest, { params }: { params: { bookingId: string } }) {
  try {
    const payload = updateSchema.parse(await request.json())

    const updates: UpdateBookingInput = {
      room_id: payload.room_id,
      booking_reason: payload.booking_reason,
      start_time: payload.start_time,
      end_time: payload.end_time,
      status: payload.status,
      is_recurring: payload.is_recurring,
      recurrence_pattern: payload.recurrence_pattern,
      recurrence_end_date: payload.recurrence_end_date,
      approved_by: payload.approved_by,
      approved_at: payload.approved_at,
      rejection_reason: payload.rejection_reason,
    }

    const { data: booking, error: updateError } = await bookingsService.updateBooking(params.bookingId, updates)

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: updateError,
        },
        { status: 500 },
      )
    }

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking not found',
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Booking updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid booking payload',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return normalizeErrorResponse(error, 'Failed to update booking')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { bookingId: string } }) {
  try {
    await bookingsService.deleteBooking(params.bookingId)
    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    })
  } catch (error) {
    return normalizeErrorResponse(error, 'Failed to delete booking')
  }
}

