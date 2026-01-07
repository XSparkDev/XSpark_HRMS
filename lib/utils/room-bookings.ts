type BookingTimeFields = {
  start_time?: string | null
  startTime?: string | null
  end_time?: string | null
  endTime?: string | null
  time?: string | null
}

export type RoomBookingLike = BookingTimeFields & {
  id: string
  room_id?: string | null
  room?: string | null
  booking_date?: string | null
  bookingDate?: string | null
  date?: string | null
  status?: string | null
  checked_in_at?: string | null
  checkedInAt?: string | null
  check_in_status?: string | null
  checkInStatus?: string | null
}

const toMinutes = (value?: string | null) => {
  if (!value) return null
  const [hoursStr, minutesStr] = value.split(':')
  if (!hoursStr || !minutesStr) return null
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

const extractRange = (booking: BookingTimeFields) => {
  const [rangeStart, rangeEnd] = booking.time?.split('-') ?? []
  const start = booking.start_time ?? booking.startTime ?? rangeStart?.trim() ?? null
  const end = booking.end_time ?? booking.endTime ?? rangeEnd?.trim() ?? null
  return { start, end }
}

const getDate = (booking: RoomBookingLike) =>
  booking.booking_date ?? booking.bookingDate ?? booking.date ?? null

export const getBookingTimeBounds = (booking: RoomBookingLike) => {
  const { start, end } = extractRange(booking)
  return {
    startMinutes: toMinutes(start),
    endMinutes: toMinutes(end),
  }
}

export const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

export const isBookingInProgress = (booking: RoomBookingLike, referenceDate = new Date()) => {
  const bookingDate = getDate(booking)
  if (!bookingDate) return false

  const today = referenceDate.toISOString().split('T')[0]
  if (bookingDate !== today) return false

  const { startMinutes, endMinutes } = getBookingTimeBounds(booking)
  if (startMinutes === null || endMinutes === null) return false

  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes
}

export const resolveBookingRuntimeStatus = (
  booking: RoomBookingLike,
  existingBookings: RoomBookingLike[] = [],
  referenceDate = new Date(),
) => {
  const normalized = (booking.status || '').toLowerCase()
  
  // Check for cancellation via rejection_reason or status
  const rejectionReason = (booking as any).rejection_reason || (booking as any).rejectionReason || ''
  if (rejectionReason.toLowerCase().includes('cancelled') || normalized.includes('cancel')) return 'Cancelled'
  
  // Check for rescheduled status (leave unchanged)
  if (normalized.includes('resched')) return 'Rescheduled'
  
  // Check for completed status (leave unchanged)
  if (normalized.includes('completed')) return 'Completed'
  
  // Check if checked in - need to handle check_in_status field too
  const isCheckedIn = Boolean(
    booking.checked_in_at || 
    booking.checkedInAt ||
    (booking as any).check_in_status === 'Checked-In' ||
    (booking as any).checkInStatus === 'Checked-In'
  )

  const conflict = existingBookings.some((existing) => {
    if (existing.id === booking.id) return false
    const sameRoom =
      ('room_id' in existing && 'room_id' in booking && existing.room_id === booking.room_id) ||
      ('room' in existing && 'room' in booking && existing.room === booking.room)

    if (!sameRoom) return false
    if ((existing.booking_date ?? existing.date) !== (booking.booking_date ?? booking.date)) return false

    const existingBounds = getBookingTimeBounds(existing)
    const bookingBounds = getBookingTimeBounds(booking)
    if (
      existingBounds.startMinutes === null ||
      existingBounds.endMinutes === null ||
      bookingBounds.startMinutes === null ||
      bookingBounds.endMinutes === null
    ) {
      return false
    }
    return rangesOverlap(
      bookingBounds.startMinutes,
      bookingBounds.endMinutes,
      existingBounds.startMinutes,
      existingBounds.endMinutes,
    )
  })

  if (conflict) {
    return 'Upcoming'
  }

  const { startMinutes, endMinutes } = getBookingTimeBounds(booking)
  if (startMinutes === null || endMinutes === null) return 'Upcoming'

  // Get booking date
  const bookingDate = booking.booking_date ?? booking.date
  if (!bookingDate) return 'Upcoming'

  // Create date objects for booking start and end times
  const bookingDateObj = new Date(bookingDate)
  const bookingStartDate = new Date(bookingDateObj)
  bookingStartDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  
  const bookingEndDate = new Date(bookingDateObj)
  bookingEndDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)

  // Check if meeting time has passed (ended)
  if (referenceDate > bookingEndDate) {
    // If user checked-in: Status → "Attended"
    // If no check-in: Status → "Missed"
    return isCheckedIn ? 'Attended' : 'Missed'
  }

  // Check if meeting is in progress (between start and end time)
  if (referenceDate >= bookingStartDate && referenceDate <= bookingEndDate) {
    // If user DID check-in: Status → "In Progress – Confirmed"
    // If check-in was NOT clicked: Status → "Missed" (remove check-in option when in progress)
    return isCheckedIn ? 'In Progress – Confirmed' : 'Missed'
  }

  // Check if booking is in the future (before start time)
  if (referenceDate < bookingStartDate) {
    // If checked-in BEFORE start time: Status → "Confirmed"
    // Otherwise: Status → "Upcoming"
    return isCheckedIn ? 'Confirmed' : 'Upcoming'
  }

  // Fallback
  return 'Upcoming'
}

