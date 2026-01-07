import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { bookingsService } from '@/lib/services'
import type { BookingFilters, CreateBookingInput } from '@/lib/services/bookings-service'

const listSchema = z.object({
  bookingId: z.string().optional(),
  roomId: z.string().optional(),
  bookedBy: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
})

const createSchema = z.object({
  booking_id: z.string().optional(),
  room_id: z.string().min(1, 'room_id is required'),
  booked_by: z.string().min(1, 'booked_by is required'),
  booking_reason: z.string().optional(),
  start_time: z.string().min(1, 'start_time is required'),
  end_time: z.string().min(1, 'end_time is required'),
  status: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.string().optional(),
  recurrence_end_date: z.string().optional(),
})

const normalizeErrorResponse = (error: unknown, fallbackMessage: string, status = 500) => {
  console.error(fallbackMessage, error)
  return NextResponse.json({ success: false, error: fallbackMessage }, { status })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusParams = searchParams.getAll('status').filter(Boolean)
    const statusPayload = statusParams.length > 0 ? statusParams : searchParams.get('status') ?? undefined

    const parsed = listSchema.parse({
      bookingId: searchParams.get('bookingId') ?? undefined,
      roomId: searchParams.get('roomId') ?? undefined,
      bookedBy: searchParams.get('bookedBy') ?? undefined,
      status: statusPayload,
      fromDate: searchParams.get('fromDate') ?? undefined,
      toDate: searchParams.get('toDate') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    const filters: BookingFilters = {
      bookingId: parsed.bookingId,
      roomId: parsed.roomId,
      bookedBy: parsed.bookedBy,
      status: parsed.status,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      limit: parsed.limit,
      offset: parsed.offset,
    }

    const { data: bookings, error: bookingsError } = await bookingsService.listBookings(filters)
    if (bookingsError) {
      return NextResponse.json(
        { success: false, error: bookingsError, data: [] },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      data: bookings,
      meta: {
        count: bookings.length,
        limit: filters.limit ?? null,
        offset: filters.offset ?? null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return normalizeErrorResponse(error, 'Failed to fetch bookings')
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = createSchema.parse(await request.json())

    const createPayload: CreateBookingInput = {
      booking_id: payload.booking_id,
      room_id: payload.room_id,
      booked_by: payload.booked_by,
      booking_reason: payload.booking_reason,
      start_time: payload.start_time,
      end_time: payload.end_time,
      status: payload.status,
      is_recurring: payload.is_recurring,
      recurrence_pattern: payload.recurrence_pattern,
      recurrence_end_date: payload.recurrence_end_date,
    }

    const booking = await bookingsService.createBooking(createPayload)

    return NextResponse.json(
      {
        success: true,
        data: booking,
        message: 'Booking created successfully',
      },
      { status: 201 },
    )
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

    return normalizeErrorResponse(error, 'Failed to create booking')
  }
}

