export const ROOM_BOOKINGS_STORAGE_KEY = 'room_bookings'
export const ROOM_BOOKINGS_UPDATED_EVENT = 'room-bookings:updated'

export type RoomBookingRecord = {
  id: string
  employeeId: string
  employeeName: string | null
  employeeRole?: string | null
  jobTitle?: string | null
  room: string
  meetingCategory: string
  editableSections?: string
  meetingAgenda?: string
  date: string
  time: string
  startTime?: string
  endTime?: string
  status: string
  createdAt: string
  updatedAt?: string
  checkedInAt?: string
}

const isBrowser = () => typeof window !== 'undefined'

const getTimeParts = (booking: Pick<RoomBookingRecord, 'startTime' | 'endTime' | 'time'>) => {
  const [rangeStart, rangeEnd] = booking.time?.split('-') ?? []
  const start = booking.startTime || rangeStart
  const end = booking.endTime || rangeEnd
  return { start: start?.trim() ?? '', end: end?.trim() ?? '' }
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

export const getBookingTimeBounds = (booking: RoomBookingRecord) => {
  const { start, end } = getTimeParts(booking)
  return {
    startMinutes: toMinutes(start),
    endMinutes: toMinutes(end),
  }
}

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
  return aStart < bEnd && bStart < aEnd
}

export const hasBookingConflict = (booking: RoomBookingRecord, existingBookings?: RoomBookingRecord[]) => {
  const all = existingBookings ?? loadRoomBookings()
  const { startMinutes, endMinutes } = getBookingTimeBounds(booking)
  if (startMinutes === null || endMinutes === null) return false

  return all.some((existing) => {
    if (existing.id === booking.id) return false
    if (existing.employeeId === booking.employeeId) return false
    if (existing.room !== booking.room) return false
    if (existing.date !== booking.date) return false

    const bounds = getBookingTimeBounds(existing)
    if (bounds.startMinutes === null || bounds.endMinutes === null) return false

    return rangesOverlap(startMinutes, endMinutes, bounds.startMinutes, bounds.endMinutes)
  })
}

export const isBookingInProgress = (booking: RoomBookingRecord, referenceDate = new Date()) => {
  const bookingDate = booking.date
  if (!bookingDate) return false

  const nowIso = referenceDate.toISOString().split('T')[0]
  if (bookingDate !== nowIso) return false

  const { startMinutes, endMinutes } = getBookingTimeBounds(booking)
  if (startMinutes === null || endMinutes === null) return false

  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes
}

export const resolveBookingRuntimeStatus = (
  booking: RoomBookingRecord,
  existingBookings?: RoomBookingRecord[],
  referenceDate = new Date(),
) => {
  const normalized = (booking.status || '').toLowerCase()
  if (normalized.includes('cancel')) return 'Cancelled'
  if (normalized.includes('resched')) return 'Rescheduled'
  if (normalized.includes('miss')) return 'Missed'
  if (normalized.includes('attend')) return 'Attended'
  if (booking.checkedInAt) return 'Attended'

  if (hasBookingConflict(booking, existingBookings)) {
    return 'Upcoming'
  }

  const { endMinutes, startMinutes } = getBookingTimeBounds(booking)
  if (startMinutes === null || endMinutes === null) return 'Upcoming'
  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  if (nowMinutes < startMinutes) return 'Upcoming'

  const graceThreshold = startMinutes + 10
  if (!booking.checkedInAt && nowMinutes >= graceThreshold) return 'Missed'

  if (nowMinutes <= endMinutes) return 'In Progress'
  return booking.checkedInAt ? 'Attended' : 'Missed'
}

export function loadRoomBookings(): RoomBookingRecord[] {
  if (!isBrowser()) return []
  try {
    const stored = window.localStorage.getItem(ROOM_BOOKINGS_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as RoomBookingRecord[]) : []
  } catch (error) {
    console.error('Failed to load room bookings from storage:', error)
    return []
  }
}

const writeRoomBookings = (bookings: RoomBookingRecord[]) => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(ROOM_BOOKINGS_STORAGE_KEY, JSON.stringify(bookings))
    window.dispatchEvent(new CustomEvent(ROOM_BOOKINGS_UPDATED_EVENT))
  } catch (error) {
    console.error('Failed to write room bookings to storage:', error)
  }
}

export const addRoomBooking = (booking: RoomBookingRecord): RoomBookingRecord[] => {
  const all = loadRoomBookings()
  const conflict = hasBookingConflict(booking, all)
  const normalizedBooking: RoomBookingRecord = {
    ...booking,
    status: conflict ? 'Pending' : booking.status || 'Booked',
  }
  const next = [normalizedBooking, ...all]
  writeRoomBookings(next)
  return next
}

export const removeRoomBooking = (id: string, requesterId?: string): RoomBookingRecord[] => {
  const all = loadRoomBookings()
  const target = all.find((booking) => booking.id === id)

  if (target && isBookingInProgress(target)) {
    if (!requesterId || target.employeeId !== requesterId) {
      return all
    }
  }

  const next = all.filter((booking) => booking.id !== id)
  writeRoomBookings(next)
  return next
}

export const getBookingsForUser = (userId?: string | null): RoomBookingRecord[] => {
  if (!userId) return []
  return loadRoomBookings().filter((booking) => booking.employeeId === userId)
}

export const updateRoomBooking = (id: string, patch: Partial<RoomBookingRecord>): RoomBookingRecord[] => {
  const all = loadRoomBookings()
  const next = all.map((booking) => {
    if (booking.id !== id) return booking
    return {
      ...booking,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    }
  })
  writeRoomBookings(next)
  return next
}

