// =============================================================================
// BOOKINGS SERVICE - Repository Layer
// =============================================================================
// Provides CRUD operations for the `bookings` table.
//
// Database Schema:
// - booking_id (text, PK)
// - room_id (uuid, FK to rooms.id)
// - booked_by (uuid)
// - booking_reason (text, nullable)
// - start_time (timestamp with time zone)
// - end_time (timestamp with time zone)
// =============================================================================

import { randomUUID } from 'crypto'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'
import { roomsService } from './rooms-service'

export interface BookingRecord {
  booking_id: string
  room_id: string
  booked_by: string
  booking_reason?: string | null
  start_time: string
  end_time: string
  status?: string | null
  checked_in_at?: string | null
  check_in_status?: string | null
  check_in_time?: string | null
  is_postponed?: boolean | null
  postponed_from?: string | null
  postponed_to?: string | null
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  created_at?: string | null
  updated_at?: string | null
  meeting_category?: string | null
  meeting_agenda?: string | null
  purpose?: string | null
  date?: string | null
  booking_date?: string | null
  time?: string | null
}

export interface BookingFilters {
  bookingId?: string
  roomId?: string
  bookedBy?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface CreateBookingInput {
  booking_id?: string
  room_id: string
  booked_by: string
  booking_reason?: string | null
  start_time: string
  end_time: string
  status?: string | null
  meeting_category?: string | null
  is_recurring?: boolean | null
  recurrence_pattern?: string | null
  recurrence_end_date?: string | null
}

export type UpdateBookingInput = Partial<CreateBookingInput> & {
  status?: string | null
  checked_in_at?: string | null
  check_in_status?: string | null
  check_in_time?: string | null
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
}

type AvailabilityParams = {
  roomId?: string
  bookingDate: string
  startTime: string
  endTime: string
  excludeBookingId?: string
}

export class BookingsService extends BaseService {
  private readonly table = 'bookings'
  private readonly admin = supabaseAdmin

  private toIsoString(value?: string | null): string | null {
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }
    return parsed.toISOString()
  }

  private normalizeRecord(record: any): BookingRecord {
    return {
      booking_id: record.booking_id ?? record.id ?? '',
      room_id: record.room_id ?? '',
      booked_by: record.booked_by ?? '',
      booking_reason: record.booking_reason ?? null,
      start_time: this.toIsoString(record.start_time) ?? '',
      end_time: this.toIsoString(record.end_time) ?? '',
      status: record.status ?? null,
      checked_in_at: this.toIsoString(record.checked_in_at),
      check_in_status: record.check_in_status ?? null,
      check_in_time: this.toIsoString(record.check_in_time),
      is_postponed: record.is_postponed ?? null,
      postponed_from: this.toIsoString(record.postponed_from),
      postponed_to: this.toIsoString(record.postponed_to),
      approved_by: record.approved_by ?? null,
      approved_at: this.toIsoString(record.approved_at),
      rejection_reason: record.rejection_reason ?? null,
      created_at: this.toIsoString(record.created_at),
      updated_at: this.toIsoString(record.updated_at),
      meeting_category: record.meeting_category ?? null,
      meeting_agenda: record.meeting_agenda ?? record.booking_reason ?? null,
      purpose: record.purpose ?? record.booking_reason ?? null,
      date: record.date ?? record.booking_date ?? this.toIsoString(record.start_time)?.split('T')[0] ?? null,
      booking_date: record.booking_date ?? record.date ?? this.toIsoString(record.start_time)?.split('T')[0] ?? null,
      time: record.time ?? null,
    }
  }

  private combineDateAndTime(date: string, time: string): string {
    if (!date) {
      return new Date().toISOString()
    }
    const normalizedTime = time?.length === 5 ? `${time}:00` : time
    const candidate = normalizedTime ? new Date(`${date}T${normalizedTime}`) : new Date(date)
    if (Number.isNaN(candidate.getTime())) {
      return new Date(date).toISOString()
    }
    return candidate.toISOString()
  }

  async listBookings(filters: BookingFilters = {}): Promise<{ data: BookingRecord[]; error?: string }> {
    console.debug('[BookingsService] listBookings filters:', filters)
    try {
      let query = this.admin.from(this.table).select('*')

      if (filters.bookingId) {
        query = query.eq('booking_id', filters.bookingId)
      }

      if (filters.roomId) {
        query = query.eq('room_id', filters.roomId)
      }

      if (filters.bookedBy) {
        query = query.eq('booked_by', filters.bookedBy)
      }

      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      } else if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query.order('start_time', { ascending: true })

      if (error) {
        console.error('[BookingsService] listBookings error:', error)
        return { data: [], error: error.message ?? 'Failed to load bookings' }
      }

      const normalized = (data ?? []).map((row: any) => this.normalizeRecord(row))
      console.debug('[BookingsService] listBookings results:', normalized.length)
      return { data: normalized }
    } catch (error: any) {
      console.error('[BookingsService] listBookings unexpected error:', error)
      return { data: [], error: error?.message ?? 'Unexpected error while loading bookings' }
    }
  }

  async getBookingById(bookingId: string): Promise<{ data: BookingRecord | null; error?: string }> {
    try {
      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle()

      if (error) {
        console.error('[BookingsService] getBookingById error:', error)
        return { data: null, error: error.message ?? 'Failed to load booking' }
      }

      return { data: data ? this.normalizeRecord(data) : null }
    } catch (error: any) {
      console.error('[BookingsService] getBookingById unexpected error:', error)
      return { data: null, error: error?.message ?? 'Unexpected error while loading booking' }
    }
  }

  async createBooking(payload: CreateBookingInput): Promise<BookingRecord> {
    this.validateRequired(payload, ['room_id', 'booked_by', 'start_time', 'end_time'])

    // Validate that the room exists (room_id now references rooms.id UUID)
    const room = await roomsService.getRoomById(payload.room_id)
    if (!room) {
      throw new Error(`Room with id "${payload.room_id}" does not exist.`)
    }

    const bookingId = payload.booking_id ?? randomUUID()

    const insertPayload = this.sanitizeInput({
      booking_id: bookingId,
      room_id: payload.room_id,
      booked_by: payload.booked_by,
      booking_reason: payload.booking_reason ?? null,
      start_time: payload.start_time,
      end_time: payload.end_time,
      meeting_category: payload.meeting_category ?? null,
    })

    const record = await this.executeInsert<any>(
      async () =>
        await this.admin
          .from(this.table)
          .insert(insertPayload)
          .select('*')
          .single(),
      'create booking',
    )

    return this.normalizeRecord(record)
  }

  async checkInBooking(bookingId: string): Promise<BookingRecord> {
    const updates = this.sanitizeInput({
      check_in_status: 'Checked-In',
      check_in_time: new Date().toISOString(),
    })

    const { data, error } = await this.admin
      .from(this.table)
      .update(updates)
      .eq('booking_id', bookingId)
      .select('*')
      .single()

    if (error) {
      this.handleError(error, 'check in booking')
    }
    if (!data) {
      throw new Error('Booking not found')
    }

    return this.normalizeRecord(data)
  }

  async postponeBooking(
    bookingId: string,
    newStartTime: string,
    newEndTime: string,
  ): Promise<{ booking: BookingRecord; previousStart: string; previousEnd: string }> {
    if (!newStartTime || !newEndTime) {
      throw new Error('New start and end time are required')
    }

    const normalizedStart = this.normalizeIsoInput(newStartTime, 'new_start_time')
    const normalizedEnd = this.normalizeIsoInput(newEndTime, 'new_end_time')

    const { data: current, error: currentError } = await this.admin
      .from(this.table)
      .select('room_id, start_time, end_time')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (currentError) {
      this.handleError(currentError, 'load booking before postpone')
    }
    if (!current) {
      throw new Error('Booking not found')
    }

    await this.ensureRoomIsAvailable({
      roomId: current.room_id,
      bookingDate: this.extractDatePart(normalizedStart),
      startTime: this.extractTimePart(normalizedStart),
      endTime: this.extractTimePart(normalizedEnd),
      excludeBookingId: bookingId,
    })

    const updates = this.sanitizeInput({
      start_time: normalizedStart,
      end_time: normalizedEnd,
      is_postponed: true,
      postponed_from: current.start_time,
      postponed_to: normalizedStart,
      // Note: status column doesn't exist in database, rescheduled status is indicated by is_postponed flag
    })

    const { data, error: updateError } = await this.admin
      .from(this.table)
      .update(updates)
      .eq('booking_id', bookingId)
      .select('*')
      .single()

    if (updateError) {
      this.handleError(updateError, 'postpone booking')
    }
    if (!data) {
      throw new Error('Booking not found')
    }

    return {
      booking: this.normalizeRecord(data),
      previousStart: this.toIsoString(current.start_time) ?? current.start_time,
      previousEnd: this.toIsoString(current.end_time) ?? current.end_time,
    }
  }

  async updateBooking(bookingId: string, updates: UpdateBookingInput): Promise<{ data: BookingRecord | null; error?: string }> {
    if (!updates || Object.keys(updates).length === 0) {
      return this.getBookingById(bookingId)
    }

    try {
      // Remove status from updates as it doesn't exist in the database schema
      // Cancellation is handled via rejection_reason field instead
      const { status, ...dbUpdates } = updates
      const sanitized = this.sanitizeInput(dbUpdates)

      const { data, error } = await this.admin
        .from(this.table)
        .update(sanitized)
        .eq('booking_id', bookingId)
        .select('*')
        .maybeSingle()

      if (error) {
        console.error('[BookingsService] updateBooking error:', error)
        return { data: null, error: error.message ?? 'Failed to update booking' }
      }

      return { data: data ? this.normalizeRecord(data) : null }
    } catch (error: any) {
      console.error('[BookingsService] updateBooking unexpected error:', error)
      return { data: null, error: error?.message ?? 'Unexpected error while updating booking' }
    }
  }

  async deleteBooking(bookingId: string): Promise<boolean> {
    return this.executeDelete(
      async () => {
        const { error } = await this.admin.from(this.table).delete().eq('booking_id', bookingId)
        return { error }
      },
      'delete booking',
    )
  }

  async ensureRoomIsAvailable(params: {
    roomId: string
    bookingDate: string
    startTime: string
    endTime: string
    excludeBookingId?: string
  }): Promise<void> {
    const conflicts = await this.fetchConflictingBookings(params)

    if (conflicts.length > 0) {
      // Include conflict booking info in error for better error messages
      const error: Error & { conflictBooking?: BookingRecord } = new Error('The room is already booked for that time window.')
      error.conflictBooking = conflicts[0]
      throw error
    }
  }

  async ensureUserTimeSlotIsAvailable(params: {
    bookedBy: string
    bookingDate: string
    startTime: string
    endTime: string
    excludeBookingId?: string
  }): Promise<void> {
    const startIso = this.combineDateAndTime(params.bookingDate, params.startTime)
    const endIso = this.combineDateAndTime(params.bookingDate, params.endTime)

    // Check for any booking by this user at the same time (regardless of room)
    let query = this.admin
      .from(this.table)
      .select('booking_id, room_id, start_time, end_time')
      .eq('booked_by', params.bookedBy)
      .lt('start_time', endIso)  // Existing booking starts before new booking ends
      .gt('end_time', startIso)  // Existing booking ends after new booking starts

    if (params.excludeBookingId) {
      query = query.neq('booking_id', params.excludeBookingId)
    }

    const { data, error } = await query

    if (error) {
      this.handleError(error, 'check user time slot availability')
    }

    if (data && data.length > 0) {
      throw new Error('You already have a booking at this time on this date. You cannot book multiple rooms simultaneously.')
    }
  }

  async getConflictingRoomIds(params: {
    bookingDate: string
    startTime: string
    endTime: string
    excludeBookingId?: string
  }): Promise<Set<string>> {
    const conflicts = await this.fetchConflictingBookings(params)
    const unavailable = new Set<string>()

    conflicts.forEach((booking: BookingRecord) => {
      if (booking.room_id) {
        unavailable.add(booking.room_id)
      }
    })

    return unavailable
  }

  /**
   * Check for conflicting bookings for a specific room without throwing
   * Returns array of conflicting bookings
   */
  async checkForRoomConflicts(params: {
    roomId: string
    bookingDate: string
    startTime: string
    endTime: string
    excludeBookingId?: string
  }): Promise<BookingRecord[]> {
    return this.fetchConflictingBookings({
      roomId: params.roomId,
      bookingDate: params.bookingDate,
      startTime: params.startTime,
      endTime: params.endTime,
      excludeBookingId: params.excludeBookingId,
    })
  }

  private async fetchConflictingBookings(params: AvailabilityParams) {
    const startIso = this.combineDateAndTime(params.bookingDate, params.startTime)
    const endIso = this.combineDateAndTime(params.bookingDate, params.endTime)

    // Correct overlap detection: Two time ranges overlap if:
    // start1 < end2 AND start2 < end1
    // This means: the new booking starts before the existing one ends AND
    // the existing booking starts before the new one ends
    let query = this.admin
      .from(this.table)
      .select('booking_id, room_id, start_time, end_time, booked_by')
      .lt('start_time', endIso)  // Existing booking starts before new booking ends
      .gt('end_time', startIso)  // Existing booking ends after new booking starts

    if (params.roomId) {
      query = query.eq('room_id', params.roomId)
    }

    if (params.excludeBookingId) {
      query = query.neq('booking_id', params.excludeBookingId)
    }

    const { data, error } = await query

    if (error) {
      this.handleError(error, 'check room availability')
    }

    return (data ?? []).map((row: any) => this.normalizeRecord(row))
  }

  private normalizeIsoInput(value: string, field: string): string {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${field} must be a valid ISO timestamp`)
    }
    return parsed.toISOString()
  }

  private extractDatePart(isoValue: string): string {
    return isoValue.split('T')[0]
  }

  private extractTimePart(isoValue: string): string {
    const timeSegment = isoValue.split('T')[1]
    return timeSegment ? timeSegment.slice(0, 5) : '00:00'
  }
}

export const bookingsService = new BookingsService()