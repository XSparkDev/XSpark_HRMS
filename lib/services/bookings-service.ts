// ============================================================================
// BOOKINGS SERVICE - Asset Management System
// ============================================================================
// Manages resource bookings and availability
// ============================================================================

import { supabase } from '@/lib/supabase'

export interface Booking {
  booking_id: string
  resource_id: string
  booked_by: string
  booking_reason?: string
  start_time: string
  end_time: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled'
  is_recurring: boolean
  recurrence_pattern?: string
  recurrence_end_date?: string
  location_type?: 'Online' | 'Offline'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface CreateBookingData {
  booking_id: string
  resource_id: string
  booked_by: string
  booking_reason?: string
  start_time: string
  end_time: string
  status?: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled'
  is_recurring?: boolean
  recurrence_pattern?: string
  recurrence_end_date?: string
  location_type?: 'Online' | 'Offline'
}

export interface UpdateBookingData extends Partial<CreateBookingData> {
  booking_id: string
}

export interface BookingFilters {
  resource_id?: string
  booked_by?: string
  status?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

export class BookingsService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get all bookings with optional filtering
   */
  async getAll(filters?: BookingFilters): Promise<Booking[]> {
    try {
      let query = supabase.from('bookings').select('*')

      if (filters?.resource_id) {
        query = query.eq('resource_id', filters.resource_id)
      }

      if (filters?.booked_by) {
        query = query.eq('booked_by', filters.booked_by)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.start_date) {
        query = query.gte('start_time', filters.start_date)
      }

      if (filters?.end_date) {
        query = query.lte('end_time', filters.end_date)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('start_time', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching bookings:', error)
      throw new Error('Failed to fetch bookings')
    }
  }

  /**
   * Get booking by ID
   */
  async getById(bookingId: string): Promise<Booking | null> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching booking by ID:', error)
      return null
    }
  }

  /**
   * Get bookings by resource
   */
  async getByResource(resourceId: string): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('resource_id', resourceId)
        .order('start_time', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching bookings by resource:', error)
      throw new Error('Failed to fetch bookings by resource')
    }
  }

  /**
   * Get bookings by user
   */
  async getByUser(userId: string): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booked_by', userId)
        .order('start_time', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching bookings by user:', error)
      throw new Error('Failed to fetch bookings by user')
    }
  }

  /**
   * Get pending bookings
   */
  async getPending(): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching pending bookings:', error)
      throw new Error('Failed to fetch pending bookings')
    }
  }

  /**
   * Check resource availability for a time period
   */
  async checkAvailability(
    resourceId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    try {
      let query = supabase
        .from('bookings')
        .select('booking_id')
        .eq('resource_id', resourceId)
        .in('status', ['Pending', 'Approved'])
        .or(`and(start_time.lte.${startTime},end_time.gt.${startTime}),and(start_time.lt.${endTime},end_time.gte.${endTime}),and(start_time.gte.${startTime},end_time.lte.${endTime})`)

      if (excludeBookingId) {
        query = query.neq('booking_id', excludeBookingId)
      }

      const { data, error } = await query

      if (error) throw error
      return (data || []).length === 0
    } catch (error) {
      console.error('Error checking availability:', error)
      throw new Error('Failed to check availability')
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Create a new booking
   */
  async create(bookingData: CreateBookingData): Promise<Booking> {
    try {
      // Check availability first
      const isAvailable = await this.checkAvailability(
        bookingData.resource_id,
        bookingData.start_time,
        bookingData.end_time
      )

      if (!isAvailable) {
        throw new Error('Resource is not available during this time period')
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating booking:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create booking')
    }
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update booking
   */
  async update(bookingId: string, updates: Partial<UpdateBookingData>): Promise<Booking | null> {
    try {
      // If updating time, check availability
      if (updates.start_time || updates.end_time) {
        const booking = await this.getById(bookingId)
        if (booking) {
          const startTime = updates.start_time || booking.start_time
          const endTime = updates.end_time || booking.end_time
          const isAvailable = await this.checkAvailability(
            booking.resource_id,
            startTime,
            endTime,
            bookingId
          )

          if (!isAvailable) {
            throw new Error('Resource is not available during this time period')
          }
        }
      }

      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('booking_id', bookingId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating booking:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update booking')
    }
  }

  /**
   * Approve a booking
   */
  async approve(bookingId: string, approvedBy: string): Promise<Booking | null> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'Approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error approving booking:', error)
      throw new Error('Failed to approve booking')
    }
  }

  /**
   * Reject a booking
   */
  async reject(bookingId: string, reason?: string): Promise<Booking | null> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'Rejected',
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error rejecting booking:', error)
      throw new Error('Failed to reject booking')
    }
  }

  /**
   * Cancel a booking
   */
  async cancel(bookingId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error canceling booking:', error)
      throw new Error('Failed to cancel booking')
    }
  }

  /**
   * Complete a booking
   */
  async complete(bookingId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error completing booking:', error)
      throw new Error('Failed to complete booking')
    }
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete a booking
   */
  async delete(bookingId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('booking_id', bookingId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting booking:', error)
      throw new Error('Failed to delete booking')
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get booking count by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase.from('bookings').select('status')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, booking: { status: string }) => {
        acc[booking.status] = (acc[booking.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting booking count by status:', error)
      throw new Error('Failed to get booking count by status')
    }
  }

  /**
   * Get upcoming bookings
   */
  async getUpcoming(limit: number = 10): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'Approved')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching upcoming bookings:', error)
      throw new Error('Failed to fetch upcoming bookings')
    }
  }
}

// Export singleton instance
export const bookingsService = new BookingsService()
export default bookingsService

