import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { bookingsService } from '@/lib/services'
import type { BookingFilters, CreateBookingInput, BookingRecord } from '@/lib/services/bookings-service'
import { supabaseAdmin } from '@/lib/supabase-admin'

const listSchema = z.object({
  roomId: z.string().optional(),
  employeeId: z.string().optional(),
  bookedBy: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  date: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
  scope: z.string().optional(),
  daysAhead: z.coerce.number().min(1).max(30).optional(),
})

const createSchema = z.object({
  room_id: z.string().min(1, 'room_id is required'),
  booked_by: z.string().min(1, 'booked_by is required'),
  date: z.string().min(1, 'date is required'),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'start_time must be in HH:MM format'),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'end_time must be in HH:MM format'),
  status: z.string().optional(),
  meeting_category: z.string().optional(),
  meeting_agenda: z.string().optional(),
  purpose: z.string().optional(),
})

const checkInSchema = z.object({
  booking_id: z.string().min(1, 'booking_id is required'),
})

const postponeSchema = z.object({
  booking_id: z.string().min(1, 'booking_id is required'),
  new_start_time: z.string().min(1, 'new_start_time is required'),
  new_end_time: z.string().min(1, 'new_end_time is required'),
})

const normalizeErrorResponse = (error: unknown, fallbackMessage: string, status = 500) => {
  const message = error instanceof Error ? error.message : fallbackMessage
  console.error(fallbackMessage, error)
  return NextResponse.json({ success: false, error: message }, { status })
}

const conflictMessage = 'The room is already booked for that time window.'

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

const buildDateFilters = (date?: string, fromDate?: string, toDate?: string) => {
  if (date) {
    const start = new Date(`${date}T00:00:00`)
    const end = new Date(`${date}T23:59:59`)
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
  }

  return {
    rangeStart: fromDate ? new Date(fromDate).toISOString() : undefined,
    rangeEnd: toDate ? new Date(toDate).toISOString() : undefined,
  }
}

const transformBookingForLegacyClients = (
  booking: BookingRecord & { room_details?: RoomSummary | null },
) => {
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

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const resolveBookedByIdentifier = async (identifier?: string | null): Promise<string | undefined> => {
  if (!identifier) return undefined
  const trimmed = identifier.trim()
  if (!trimmed) return undefined
  if (uuidRegex.test(trimmed)) {
    return trimmed
  }

  const lookupByColumn = async (column: 'employee_id' | 'email'): Promise<string | undefined> => {
    const { data, error } = await supabaseAdmin.from('employees').select('id').eq(column, trimmed).maybeSingle()
    if (error) {
      console.warn(`[room-bookings] Failed to resolve identifier via ${column}`, error)
      return undefined
    }
    return data?.id ?? undefined
  }

  try {
    const byEmployeeId = await lookupByColumn('employee_id')
    if (byEmployeeId) {
      return byEmployeeId
    }
    return await lookupByColumn('email')
  } catch (error) {
    console.warn('[room-bookings] Unexpected error resolving employee identifier', error)
    return undefined
  }
}

const startOfDayIso = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString()
}

const endOfDayPlusDaysIso = (date: Date, daysAhead: number) => {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  copy.setDate(copy.getDate() + daysAhead)
  return copy.toISOString()
}

type RoomSummary = {
  id: string
  room_name: string
  room_code?: string | null
  location?: string | null
  floor?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusParams = searchParams.getAll('status').filter(Boolean)
    const statusPayload = statusParams.length > 0 ? statusParams : searchParams.get('status') ?? undefined

    const parsedResult = listSchema.safeParse({
      roomId: searchParams.get('roomId') ?? undefined,
      bookedBy: searchParams.get('bookedBy') ?? searchParams.get('employeeId') ?? undefined,
      employeeId: searchParams.get('employeeId') ?? undefined,
      status: statusPayload,
      date: searchParams.get('date') ?? undefined,
      fromDate: searchParams.get('fromDate') ?? undefined,
      toDate: searchParams.get('toDate') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      scope: searchParams.get('scope') ?? undefined,
      daysAhead: searchParams.get('daysAhead') ?? undefined,
    })

    let parsed: z.infer<typeof listSchema>
    if (!parsedResult.success) {
      console.warn('[room-bookings] GET invalid query params, falling back to defaults', parsedResult.error.flatten())
      parsed = {
        roomId: undefined,
        employeeId: undefined,
        bookedBy: undefined,
        status: undefined,
        date: undefined,
        fromDate: undefined,
        toDate: undefined,
        limit: undefined,
        offset: undefined,
        scope: undefined,
        daysAhead: undefined,
      }
    } else {
      parsed = parsedResult.data
    }

    const { rangeStart, rangeEnd } = buildDateFilters(parsed.date, parsed.fromDate, parsed.toDate)
    let effectiveFromDate = rangeStart
    let effectiveToDate = rangeEnd

    if (parsed.scope === 'dashboard') {
      const now = new Date()
      const daysAhead = parsed.daysAhead ?? 7
      if (!effectiveFromDate) {
        effectiveFromDate = startOfDayIso(now)
      }
      if (!effectiveToDate) {
        effectiveToDate = endOfDayPlusDaysIso(now, daysAhead)
      }
    }

    const bookedByCandidate = parsed.bookedBy ?? parsed.employeeId
    const resolvedBookedBy = await resolveBookedByIdentifier(bookedByCandidate)

    if (bookedByCandidate && !resolvedBookedBy) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          count: 0,
          limit: parsed.limit ?? null,
          offset: parsed.offset ?? null,
        },
      })
    }

    const filters: BookingFilters = {
      roomId: parsed.roomId,
      bookedBy: resolvedBookedBy,
      status: parsed.status,
      fromDate: effectiveFromDate,
      toDate: effectiveToDate,
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

    const roomIds = Array.from(new Set(bookings.map((booking) => booking.room_id).filter(Boolean)))
    let roomsById: Record<string, RoomSummary> = {}
    if (roomIds.length > 0) {
      const { data: roomsData, error: roomsError } = await supabaseAdmin
        .from('rooms')
        .select('id, room_name, room_code, location, floor')
        .in('id', roomIds)

      if (roomsError) {
        console.error('[room-bookings] failed to load room summaries', roomsError)
      } else if (roomsData) {
        roomsById = roomsData.reduce<Record<string, RoomSummary>>((acc, room) => {
          acc[room.id] = room as RoomSummary
          return acc
        }, {})
      }
    }

    const enhanced = bookings.map((booking) => ({
      ...booking,
      room_details: roomsById[booking.room_id] ?? null,
    }))

    return NextResponse.json({
      success: true,
      data: enhanced.map(transformBookingForLegacyClients),
      meta: {
        count: enhanced.length,
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
        { status: 400 }
      )
    }

    return normalizeErrorResponse(error, 'Failed to fetch room bookings')
  }
}

export async function POST(request: NextRequest) {
  const action = resolveAction(request)
  if (action === 'check-in') {
    return handleCheckIn(request)
  }
  if (action === 'postpone') {
    return handlePostpone(request)
  }
  return handleCreateBooking(request)
}

async function handleCreateBooking(request: NextRequest) {
  try {
    const payload = createSchema.parse(await request.json())

    const resolvedBookedBy = await resolveBookedByIdentifier(payload.booked_by)
    if (!resolvedBookedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to resolve booked_by identifier. Provide a valid employee UUID, employee ID, or email.',
        },
        { status: 400 },
      )
    }

    const startIso = combineDateTime(payload.date, payload.start_time)
    const endIso = combineDateTime(payload.date, payload.end_time)

    // First check if user already has a booking at this time (regardless of room)
    await bookingsService.ensureUserTimeSlotIsAvailable({
      bookedBy: resolvedBookedBy,
      bookingDate: payload.date,
      startTime: payload.start_time,
      endTime: payload.end_time,
    })

    // Then check if the specific room is available
    await bookingsService.ensureRoomIsAvailable({
      roomId: payload.room_id,
      bookingDate: payload.date,
      startTime: payload.start_time,
      endTime: payload.end_time,
    })

    const createPayload: CreateBookingInput = {
      room_id: payload.room_id,
      booked_by: resolvedBookedBy,
      booking_reason: payload.meeting_agenda ?? payload.purpose ?? null,
      start_time: startIso,
      end_time: endIso,
      meeting_category: payload.meeting_category ?? null,
    }

    const booking = await bookingsService.createBooking(createPayload)

    return NextResponse.json(
      {
        success: true,
        data: transformBookingForLegacyClients(booking),
        message: 'Room booked successfully',
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

    if (error instanceof Error && error.message.includes(conflictMessage)) {
      return NextResponse.json(
        { success: false, error: 'Room unavailable for selected time window' },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message.includes('already have a booking at this time')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 },
      )
    }

    return normalizeErrorResponse(error, 'Failed to create room booking')
  }
}

async function handleCheckIn(request: NextRequest) {
  try {
    const { booking_id } = checkInSchema.parse(await request.json())
    const booking = await bookingsService.checkInBooking(booking_id)

    return NextResponse.json({
      success: true,
      data: {
        booking: transformBookingForLegacyClients(booking as BookingRecord & { room_details?: RoomSummary | null }),
        check_in_status: booking.check_in_status ?? 'Checked-In',
        check_in_time: booking.check_in_time,
      },
      message: 'Meeting checked in successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid check-in payload',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return normalizeErrorResponse(error, 'Failed to check in booking')
  }
}

async function handlePostpone(request: NextRequest) {
  try {
    const { booking_id, new_start_time, new_end_time } = postponeSchema.parse(await request.json())
    const result = await bookingsService.postponeBooking(booking_id, new_start_time, new_end_time)
    const transformedBooking = transformBookingForLegacyClients(
      result.booking as BookingRecord & { room_details?: RoomSummary | null },
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
      message: 'Meeting postponed successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid postpone payload',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message.includes(conflictMessage)) {
      return NextResponse.json(
        { success: false, error: 'Room unavailable for selected time window' },
        { status: 409 },
      )
    }

    return normalizeErrorResponse(error, 'Failed to postpone booking')
  }
}

const resolveAction = (request: NextRequest) => {
  const url = new URL(request.url)
  const pathname = url.pathname.toLowerCase()
  if (pathname.endsWith('/check-in')) return 'check-in'
  if (pathname.endsWith('/postpone')) return 'postpone'
  const actionParam = url.searchParams.get('action')
  return actionParam ? actionParam.toLowerCase() : null
}
