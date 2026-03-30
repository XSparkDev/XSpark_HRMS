import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { bookingsService, notificationService, roomsService } from '@/lib/services'
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
  booking: BookingRecord & { 
    room_details?: RoomSummary | null
    employee_name?: string | null
    employee_first_name?: string | null
    employee_id?: string | null
    employee_email?: string | null
    employee_auth_user_id?: string | null
    employee_role?: string | null
  },
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
    // Include employee data for display
    employee_name: booking.employee_name ?? undefined,
    employee_first_name: booking.employee_first_name ?? undefined,
    booked_by_name: booking.employee_name ?? undefined, // Legacy alias
    employee_id: booking.employee_id ?? undefined,
    employee_email: booking.employee_email ?? undefined,
    employee_auth_user_id: booking.employee_auth_user_id ?? undefined,
    employee_role: booking.employee_role ?? undefined,
    role: booking.employee_role ?? undefined, // Simple alias
    position: booking.employee_role ?? undefined, // Alternative alias
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
    // Only resolve bookedBy if it's provided - if not provided, return all bookings (for supervisor view)
    const resolvedBookedBy = bookedByCandidate ? await resolveBookedByIdentifier(bookedByCandidate) : undefined

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

    // Fetch employee data for all bookings
    const employeeIds = Array.from(new Set(bookings.map((booking) => booking.booked_by).filter(Boolean)))
    let employeesById: Record<string, { name: string; first_name: string; employee_id: string; email: string | null; auth_user_id: string | null; role_name: string | null; job_title: string | null }> = {}
    if (employeeIds.length > 0) {
      const { data: employeesData, error: employeesError } = await supabaseAdmin
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          preferred_name,
          employee_id,
          role_id,
          job_title_id,
          email,
          auth_user_id
        `)
        .in('id', employeeIds)

      if (employeesError) {
        console.error('[room-bookings] failed to load employee data', employeesError)
      } else if (employeesData) {
        // Fetch roles and job titles separately
        const roleIds = Array.from(new Set(employeesData.map((e: any) => e.role_id).filter(Boolean)))
        const jobTitleIds = Array.from(new Set(employeesData.map((e: any) => e.job_title_id).filter(Boolean)))
        
        let rolesById: Record<string, { role_name: string }> = {}
        let jobTitlesById: Record<string, { title: string }> = {}
        
        if (roleIds.length > 0) {
          const { data: rolesData } = await supabaseAdmin
            .from('roles')
            .select('id, role_name')
            .in('id', roleIds)
          if (rolesData) {
            rolesById = rolesData.reduce((acc, role: any) => {
              acc[role.id] = { role_name: role.role_name }
              return acc
            }, {} as Record<string, { role_name: string }>)
          }
        }
        
        if (jobTitleIds.length > 0) {
          const { data: jobTitlesData } = await supabaseAdmin
            .from('job_titles')
            .select('id, title')
            .in('id', jobTitleIds)
          if (jobTitlesData) {
            jobTitlesById = jobTitlesData.reduce((acc, jobTitle: any) => {
              acc[jobTitle.id] = { title: jobTitle.title }
              return acc
            }, {} as Record<string, { title: string }>)
          }
        }
        
        employeesById = employeesData.reduce<Record<string, { name: string; first_name: string; employee_id: string; email: string | null; auth_user_id: string | null; role_name: string | null; job_title: string | null }>>((acc, emp: any) => {
          const firstName = emp.first_name || ''
          const lastName = emp.last_name || ''
          const preferredName = emp.preferred_name
          const fullName = preferredName 
            ? `${preferredName} ${lastName}`.trim()
            : `${firstName} ${lastName}`.trim()
          
          const role = emp.role_id ? rolesById[emp.role_id] : null
          const jobTitle = emp.job_title_id ? jobTitlesById[emp.job_title_id] : null
          
          acc[emp.id] = {
            name: fullName || 'Unknown',
            first_name: preferredName || firstName || '',
            employee_id: emp.employee_id || '',
            email: emp.email || null,
            auth_user_id: emp.auth_user_id || null,
            role_name: role?.role_name || null,
            job_title: jobTitle?.title || null,
          }
          return acc
        }, {})
      }
    }

    const enhanced = bookings.map((booking) => {
      const employee = employeesById[booking.booked_by]
      return {
        ...booking,
        room_details: roomsById[booking.room_id] ?? null,
        employee_name: employee?.name || null,
        employee_first_name: employee?.first_name || null,
        employee_id: employee?.employee_id || null,
        employee_email: employee?.email || null,
        employee_auth_user_id: employee?.auth_user_id || null,
        employee_role: employee?.role_name || employee?.job_title || null,
        job_title: employee?.job_title || null,
      }
    })

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

    // Check for room conflicts BEFORE throwing error (to send notifications)
    const roomConflicts = await bookingsService.checkForRoomConflicts({
      roomId: payload.room_id,
      bookingDate: payload.date,
      startTime: payload.start_time,
      endTime: payload.end_time,
    })

    // If conflicts exist, send notifications to supervisors
    if (roomConflicts.length > 0) {
      try {
        // Get room information
        const room = await roomsService.getRoomById(payload.room_id)
        const roomName = room?.name || room?.room_number || 'Unknown Room'

        // Get employee information for the person trying to book
        const { data: requestingEmployee } = await supabaseAdmin
          .from('employees')
          .select('id, employee_id, first_name, last_name, preferred_name')
          .eq('id', resolvedBookedBy)
          .maybeSingle()

        const requestingEmployeeName = requestingEmployee?.preferred_name || 
                                      `${requestingEmployee?.first_name || ''} ${requestingEmployee?.last_name || ''}`.trim() ||
                                      requestingEmployee?.employee_id ||
                                      'Unknown Employee'

        // Get conflicting booking details
        const conflictDetails = await Promise.all(
          roomConflicts.map(async (conflict) => {
            const conflictEmployeeName = await getEmployeeName(conflict.booked_by)
            const conflictStartTime = toTimeString(conflict.start_time) || ''
            const conflictEndTime = toTimeString(conflict.end_time) || ''
            return {
              employeeName: conflictEmployeeName || 'Unknown Employee',
              startTime: conflictStartTime,
              endTime: conflictEndTime,
            }
          })
        )

        // Build conflict message
        const conflictMessages = conflictDetails.map(
          (detail) => `${detail.employeeName} (${detail.startTime} - ${detail.endTime})`
        ).join(', ')

        const conflictDate = new Date(payload.date).toLocaleDateString()
        const requestedTime = `${payload.start_time} - ${payload.end_time}`

        // Find all supervisors
        const { data: supervisorRole } = await supabaseAdmin
          .from('roles')
          .select('id')
          .ilike('role_name', '%supervisor%')
          .limit(1)
          .maybeSingle()

        if (supervisorRole?.id) {
          const { data: supervisors } = await supabaseAdmin
            .from('employees')
            .select('id, employee_id, first_name, last_name, preferred_name')
            .eq('role_id', supervisorRole.id)
            .is('deleted_at', null)

          if (supervisors && supervisors.length > 0) {
            // Send notification to each supervisor
            const notificationPromises = supervisors.map((supervisor) =>
              notificationService.createNotification(
                {
                  employee_id: supervisor.id,
                  title: 'Room Booking Conflict Detected',
                  message: `Room booking conflict detected for ${roomName}. Employee ${requestingEmployeeName} (ID: ${requestingEmployee?.employee_id || 'N/A'}) attempted to book ${roomName} on ${conflictDate} from ${requestedTime}, but the room is already booked by: ${conflictMessages}.`,
                  notification_type: 'internal',
                  published_by: resolvedBookedBy,
                  is_confidential: true, // Mark as confidential as it involves scheduling conflicts
                },
                {
                  sendEmail: true,
                  preventDuplicates: true,
                  duplicateWindowMinutes: 5,
                }
              )
            )

            await Promise.allSettled(notificationPromises)
            console.log(`[room-bookings] Sent conflict notifications to ${supervisors.length} supervisor(s)`)
          }
        }
      } catch (notifError) {
        console.error('[room-bookings] Failed to send conflict notification to supervisors:', notifError)
        // Don't fail the request if notification fails
      }
    }

    // Then check if the specific room is available (this will throw if conflicts exist)
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
