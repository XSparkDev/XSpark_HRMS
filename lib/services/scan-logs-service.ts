// ============================================================================
// SCAN LOGS SERVICE - Asset Management System
// ============================================================================
// Manages QR code scan history for resource check-in/check-out
// ============================================================================

import { supabase } from '@/lib/supabase'

export interface ScanLog {
  scan_id: string
  resource_id: string
  scanned_by: string
  scan_type: 'Check-In' | 'Check-Out'
  scan_time: string
  location?: string
  notes?: string
  booking_id?: string
}

export interface CreateScanLogData {
  resource_id: string
  scanned_by: string
  scan_type: 'Check-In' | 'Check-Out'
  location?: string
  notes?: string
  booking_id?: string
}

export interface ScanLogFilters {
  resource_id?: string
  scanned_by?: string
  scan_type?: string
  start_date?: string
  end_date?: string
  booking_id?: string
  limit?: number
  offset?: number
}

export class ScanLogsService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get all scan logs with optional filtering
   */
  async getAll(filters?: ScanLogFilters): Promise<ScanLog[]> {
    try {
      let query = supabase.from('scan_logs').select('*')

      if (filters?.resource_id) {
        query = query.eq('resource_id', filters.resource_id)
      }

      if (filters?.scanned_by) {
        query = query.eq('scanned_by', filters.scanned_by)
      }

      if (filters?.scan_type) {
        query = query.eq('scan_type', filters.scan_type)
      }

      if (filters?.booking_id) {
        query = query.eq('booking_id', filters.booking_id)
      }

      if (filters?.start_date) {
        query = query.gte('scan_time', filters.start_date)
      }

      if (filters?.end_date) {
        query = query.lte('scan_time', filters.end_date)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('scan_time', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching scan logs:', error)
      throw new Error('Failed to fetch scan logs')
    }
  }

  /**
   * Get scan log by ID
   */
  async getById(scanId: string): Promise<ScanLog | null> {
    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .select('*')
        .eq('scan_id', scanId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching scan log by ID:', error)
      return null
    }
  }

  /**
   * Get scan logs by resource
   */
  async getByResource(resourceId: string): Promise<ScanLog[]> {
    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .select('*')
        .eq('resource_id', resourceId)
        .order('scan_time', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching scan logs by resource:', error)
      throw new Error('Failed to fetch scan logs by resource')
    }
  }

  /**
   * Get scan logs by user
   */
  async getByUser(userId: string): Promise<ScanLog[]> {
    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .select('*')
        .eq('scanned_by', userId)
        .order('scan_time', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching scan logs by user:', error)
      throw new Error('Failed to fetch scan logs by user')
    }
  }

  /**
   * Get recent scans
   */
  async getRecent(limit: number = 20): Promise<ScanLog[]> {
    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .select('*')
        .order('scan_time', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching recent scans:', error)
      throw new Error('Failed to fetch recent scans')
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Create a new scan log
   */
  async create(scanLogData: CreateScanLogData): Promise<ScanLog> {
    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .insert([scanLogData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating scan log:', error)
      throw new Error('Failed to create scan log')
    }
  }

  /**
   * Check in a resource (QR code scan)
   */
  async checkIn(resourceId: string, userId: string, bookingId?: string, location?: string): Promise<ScanLog> {
    try {
      const scanLog = await this.create({
        resource_id: resourceId,
        scanned_by: userId,
        scan_type: 'Check-In',
        booking_id: bookingId,
        location: location
      })

      return scanLog
    } catch (error) {
      console.error('Error checking in resource:', error)
      throw new Error('Failed to check in resource')
    }
  }

  /**
   * Check out a resource (QR code scan)
   */
  async checkOut(resourceId: string, userId: string, bookingId?: string, location?: string): Promise<ScanLog> {
    try {
      const scanLog = await this.create({
        resource_id: resourceId,
        scanned_by: userId,
        scan_type: 'Check-Out',
        booking_id: bookingId,
        location: location
      })

      return scanLog
    } catch (error) {
      console.error('Error checking out resource:', error)
      throw new Error('Failed to check out resource')
    }
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update scan log
   */
  async update(scanId: string, updates: Partial<CreateScanLogData>): Promise<ScanLog | null> {
    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .update(updates)
        .eq('scan_id', scanId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating scan log:', error)
      throw new Error('Failed to update scan log')
    }
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete a scan log
   */
  async delete(scanId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('scan_logs')
        .delete()
        .eq('scan_id', scanId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting scan log:', error)
      throw new Error('Failed to delete scan log')
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get scan count by type
   */
  async getCountByType(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase.from('scan_logs').select('scan_type')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, log: { scan_type: string }) => {
        acc[log.scan_type] = (acc[log.scan_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting scan count by type:', error)
      throw new Error('Failed to get scan count by type')
    }
  }

  /**
   * Get scan count by resource
   */
  async getCountByResource(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase.from('scan_logs').select('resource_id')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, log: { resource_id: string }) => {
        acc[log.resource_id] = (acc[log.resource_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting scan count by resource:', error)
      throw new Error('Failed to get scan count by resource')
    }
  }
}

// Export singleton instance
export const scanLogsService = new ScanLogsService()
export default scanLogsService

