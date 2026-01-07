// ============================================================================
// SUPERVISOR DASHBOARD SERVICE - Database operations for supervisor dashboard
// ============================================================================
// Provides optimized queries, real-time updates, and caching for supervisor metrics
// ============================================================================

import { BaseService } from './base-service'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { devicesService } from './devices-service'

export interface DeviceStats {
  total: number
  borrowed: number
  maintenance: number
  available: number
}

export interface BorrowRequest {
  id: string
  employee_id: string
  employee_name: string
  device_id: string
  device_name: string
  asset_tag: string
  borrow_date: string
  expected_return_date: string | null
  purpose: string
  status: string
  created_at: string
  updated_at: string
}

export interface ReturnRequest {
  id: string
  employee_id: string
  employee_name: string
  device_id: string
  device_name: string
  return_date: string
  device_condition: string
  status: string
  created_at: string
  updated_at: string
}

export interface MaintenanceTicket {
  id: string
  device_id: string
  device_name: string
  issue_type: string
  reported_by: string
  reported_by_id: string
  description: string
  priority: string
  status: string
  created_at: string
  updated_at: string
}

export interface RoomBooking {
  id: string
  room_id: string
  room_name: string
  booked_by: string
  employee_name: string
  date: string
  start_time: string
  end_time: string
  meeting_category: string
  meeting_agenda: string
  status: string
  checked_in_at: string | null
  created_at: string
}

export interface DashboardMetrics {
  deviceStats: DeviceStats
  pendingBorrowRequests: number
  pendingReturnRequests: number
  activeMaintenanceTickets: number
  upcomingRoomBookings: number
  totalEmployees: number
}

// Cache configuration
const CACHE_TTL = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class SupervisorDashboardService extends BaseService {
  private cache = new Map<string, CacheEntry<any>>()
  private realtimeChannels: Map<string, RealtimeChannel> = new Map()

  /**
   * Get cached data or fetch fresh data
   */
  private async getCachedOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL
  ): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data
    }

    const data = await this.retryOperation(fetchFn, `fetch-${key}`)
    this.cache.set(key, { data, timestamp: now })
    return data
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries: number = MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`${operationName} attempt ${attempt + 1} failed:`, lastError.message)

        if (attempt < retries - 1) {
          const delay = RETRY_DELAY * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`${operationName} failed after ${retries} attempts: ${lastError?.message}`)
  }

  /**
   * Clear cache for a specific key or all cache
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get device statistics with caching
   */
  async getDeviceStats(): Promise<DeviceStats> {
    return this.getCachedOrFetch('device-stats', async () => {
      const { data: devices } = await devicesService.listDevices({ limit: 10000 })

      const statusCounts = devices.reduce(
        (acc, device) => {
          const status = (device.status || '').toLowerCase()
          acc.total++
          if (status.includes('borrow') || status.includes('borrowed')) {
            acc.borrowed++
          } else if (status.includes('maintenance')) {
            acc.maintenance++
          } else if (status === 'available' || status === '') {
            acc.available++
          }
          return acc
        },
        { total: 0, borrowed: 0, maintenance: 0, available: 0 }
      )

      return statusCounts
    })
  }

  /**
   * Get pending borrow requests
   */
  async getPendingBorrowRequests(): Promise<BorrowRequest[]> {
    return this.getCachedOrFetch('pending-borrow-requests', async () => {
      const { data, error } = await supabase
        .from('borrows')
        .select(`
          id,
          employee_id,
          device_id,
          borrow_date,
          expected_return_date,
          purpose,
          status,
          created_at,
          updated_at,
          devices:device_id (
            asset_tag,
            model,
            brand,
            device_type
          ),
          employees:employee_id (
            name,
            employee_id
          )
        `)
        .in('status', ['Pending', 'Pending Approval', 'Awaiting Approval'])
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch borrow requests: ${error.message}`)
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        employee_id: item.employee_id,
        employee_name: item.employees?.name || 'Unknown',
        device_id: item.device_id,
        device_name: item.devices?.model || item.devices?.brand || item.devices?.device_type || 'Device',
        asset_tag: item.devices?.asset_tag || item.device_id,
        borrow_date: item.borrow_date,
        expected_return_date: item.expected_return_date,
        purpose: item.purpose || '',
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    })
  }

  /**
   * Get pending return requests
   */
  async getPendingReturnRequests(): Promise<ReturnRequest[]> {
    return this.getCachedOrFetch('pending-return-requests', async () => {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          id,
          employee_id,
          device_id,
          return_date,
          device_condition,
          status,
          created_at,
          updated_at,
          devices:device_id (
            asset_tag,
            model,
            brand,
            device_type
          ),
          employees:employee_id (
            name,
            employee_id
          )
        `)
        .in('status', ['Pending', 'Pending Approval', 'Awaiting Approval'])
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch return requests: ${error.message}`)
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        employee_id: item.employee_id,
        employee_name: item.employees?.name || 'Unknown',
        device_id: item.device_id,
        device_name: item.devices?.model || item.devices?.brand || item.devices?.device_type || 'Device',
        return_date: item.return_date,
        device_condition: item.device_condition || 'Good',
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    })
  }

  /**
   * Get devices with pending borrow status
   */
  async getDevicesWithPendingBorrowStatus(): Promise<Array<{
    id: string
    device_id: string
    asset_tag: string | null
    serial_number: string | null
    device_type: string | null
    brand: string | null
    model: string | null
    status: string | null
    created_at: string | null
    updated_at: string | null
  }>> {
    return this.getCachedOrFetch('devices-pending-borrow', async () => {
      // Fetch all devices and filter for pending borrow status
      const { data: devices } = await devicesService.listDevices({ limit: 10000 })

      // Filter to ensure we only get devices with "pending borrow" in status
      return devices
        .filter((device) => {
          const status = (device.status || '').toLowerCase()
          return status.includes('pending') && status.includes('borrow')
        })
        .map((device) => ({
          id: device.id || device.device_id,
          device_id: device.device_id,
          asset_tag: device.asset_tag,
          serial_number: device.serial_number,
          device_type: device.device_type,
          brand: device.brand,
          model: device.model,
          status: device.status,
          created_at: device.created_at,
          updated_at: device.updated_at,
        }))
    })
  }

  /**
   * Get active maintenance tickets
   */
  async getActiveMaintenanceTickets(): Promise<MaintenanceTicket[]> {
    return this.getCachedOrFetch('active-maintenance-tickets', async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select(`
          id,
          device_id,
          issue_type,
          reported_by,
          description,
          priority,
          status,
          created_at,
          updated_at,
          devices:device_id (
            asset_tag,
            model,
            brand,
            device_type
          ),
          employees:reported_by (
            name,
            employee_id
          )
        `)
        .neq('status', 'Completed')
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        throw new Error(`Failed to fetch maintenance tickets: ${error.message}`)
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        device_id: item.device_id,
        device_name: item.devices?.model || item.devices?.brand || item.devices?.device_type || 'Device',
        issue_type: item.issue_type || 'General',
        reported_by: item.employees?.name || 'Unknown',
        reported_by_id: item.reported_by,
        description: item.description || '',
        priority: item.priority || 'Medium',
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    })
  }

  /**
   * Get upcoming room bookings
   */
  async getUpcomingRoomBookings(limit: number = 10): Promise<RoomBooking[]> {
    return this.getCachedOrFetch('upcoming-room-bookings', async () => {
      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const upcomingEnd = new Date(todayStart)
      upcomingEnd.setDate(upcomingEnd.getDate() + 7)
      upcomingEnd.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('room_bookings')
        .select(`
          id,
          room_id,
          booked_by,
          date,
          start_time,
          end_time,
          meeting_category,
          meeting_agenda,
          status,
          checked_in_at,
          created_at,
          rooms:room_id (
            room_name
          ),
          employees:booked_by (
            name,
            employee_id
          )
        `)
        .gte('date', todayStart.toISOString().split('T')[0])
        .lte('date', upcomingEnd.toISOString().split('T')[0])
        .neq('status', 'Cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit)

      if (error) {
        throw new Error(`Failed to fetch room bookings: ${error.message}`)
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        room_id: item.room_id,
        room_name: item.rooms?.room_name || 'Room',
        booked_by: item.booked_by,
        employee_name: item.employees?.name || 'Unknown',
        date: item.date,
        start_time: item.start_time,
        end_time: item.end_time,
        meeting_category: item.meeting_category || 'Internal',
        meeting_agenda: item.meeting_agenda || '',
        status: item.status,
        checked_in_at: item.checked_in_at,
        created_at: item.created_at,
      }))
    })
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const [deviceStats, borrowRequests, returnRequests, maintenanceTickets, roomBookings] =
        await Promise.all([
          this.getDeviceStats(),
          this.getPendingBorrowRequests(),
          this.getPendingReturnRequests(),
          this.getActiveMaintenanceTickets(),
          this.getUpcomingRoomBookings(5),
        ])

      // Get total employees count
      const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true })
      const totalEmployees = count || 0

      return {
        deviceStats,
        pendingBorrowRequests: borrowRequests.length,
        pendingReturnRequests: returnRequests.length,
        activeMaintenanceTickets: maintenanceTickets.length,
        upcomingRoomBookings: roomBookings.length,
        totalEmployees,
      }
    } catch (error) {
      console.error('Failed to get dashboard metrics:', error)
      throw error
    }
  }

  /**
   * Subscribe to real-time updates for devices
   */
  subscribeToDevices(
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ): () => void {
    // Check if channel method exists (Supabase might not be configured)
    if (!supabase || typeof supabase.channel !== 'function') {
      console.warn('Supabase real-time not available. Real-time updates disabled.')
      return () => {} // Return no-op unsubscribe function
    }

    try {
      const channel = supabase
        .channel('supervisor-devices')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'devices',
          },
          (payload) => {
            this.clearCache('device-stats')
            callback({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            })
          }
        )
        .subscribe()

      this.realtimeChannels.set('devices', channel)

      return () => {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe()
        }
        this.realtimeChannels.delete('devices')
      }
    } catch (error) {
      console.error('Failed to subscribe to device updates:', error)
      return () => {} // Return no-op unsubscribe function
    }
  }

  /**
   * Subscribe to real-time updates for borrow requests
   */
  subscribeToBorrowRequests(
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ): () => void {
    // Check if channel method exists (Supabase might not be configured)
    if (!supabase || typeof supabase.channel !== 'function') {
      console.warn('Supabase real-time not available. Real-time updates disabled.')
      return () => {} // Return no-op unsubscribe function
    }

    try {
      const channel = supabase
        .channel('supervisor-borrows')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'borrows',
          },
          (payload) => {
            this.clearCache('pending-borrow-requests')
            callback({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            })
          }
        )
        .subscribe()

      this.realtimeChannels.set('borrows', channel)

      return () => {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe()
        }
        this.realtimeChannels.delete('borrows')
      }
    } catch (error) {
      console.error('Failed to subscribe to borrow request updates:', error)
      return () => {} // Return no-op unsubscribe function
    }
  }

  /**
   * Subscribe to real-time updates for room bookings
   */
  subscribeToRoomBookings(
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ): () => void {
    // Check if channel method exists (Supabase might not be configured)
    if (!supabase || typeof supabase.channel !== 'function') {
      console.warn('Supabase real-time not available. Real-time updates disabled.')
      return () => {} // Return no-op unsubscribe function
    }

    try {
      const channel = supabase
        .channel('supervisor-room-bookings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_bookings',
          },
          (payload) => {
            this.clearCache('upcoming-room-bookings')
            callback({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            })
          }
        )
        .subscribe()

      this.realtimeChannels.set('room-bookings', channel)

      return () => {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe()
        }
        this.realtimeChannels.delete('room-bookings')
      }
    } catch (error) {
      console.error('Failed to subscribe to room booking updates:', error)
      return () => {} // Return no-op unsubscribe function
    }
  }

  /**
   * Cleanup all real-time subscriptions
   */
  cleanup(): void {
    this.realtimeChannels.forEach((channel) => {
      channel.unsubscribe()
    })
    this.realtimeChannels.clear()
    this.cache.clear()
  }

  /**
   * Approve a borrow request
   */
  async approveBorrowRequest(requestId: string, notes?: string): Promise<void> {
    try {
      // First, get the borrow request to find the device_id
      const { data: borrowData, error: fetchError } = await supabase
        .from('borrows')
        .select('device_id')
        .eq('id', requestId)
        .single()

      if (fetchError || !borrowData) {
        throw new Error(`Failed to fetch borrow request: ${fetchError?.message || 'Request not found'}`)
      }

      const deviceId = borrowData.device_id

      // Update borrow request status
      const { error: borrowError } = await supabase
        .from('borrows')
        .update({
          status: 'Approved',
          updated_at: new Date().toISOString(),
          supervisor_notes: notes,
        })
        .eq('id', requestId)

      if (borrowError) {
        throw new Error(`Failed to approve borrow request: ${borrowError.message}`)
      }

      // Update device status from "available" to "borrowed"
      if (deviceId) {
        try {
          await devicesService.setDeviceStatus(deviceId, 'borrowed')
        } catch (deviceError) {
          console.error('Failed to update device status:', deviceError)
          // Don't throw here - approval succeeded, device status update is secondary
        }
      }

      this.clearCache('pending-borrow-requests')
      this.clearCache('device-stats')
    } catch (error) {
      console.error('Failed to approve borrow request:', error)
      throw error
    }
  }

  /**
   * Reject a borrow request
   */
  async rejectBorrowRequest(requestId: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('borrows')
        .update({
          status: 'Rejected',
          updated_at: new Date().toISOString(),
          supervisor_notes: reason,
        })
        .eq('id', requestId)

      if (error) {
        throw new Error(`Failed to reject borrow request: ${error.message}`)
      }

      this.clearCache('pending-borrow-requests')
    } catch (error) {
      console.error('Failed to reject borrow request:', error)
      throw error
    }
  }

  /**
   * Approve a return request
   */
  async approveReturnRequest(requestId: string, notes?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('returns')
        .update({
          status: 'Approved',
          updated_at: new Date().toISOString(),
          supervisor_notes: notes,
        })
        .eq('id', requestId)

      if (error) {
        throw new Error(`Failed to approve return request: ${error.message}`)
      }

      this.clearCache('pending-return-requests')
      this.clearCache('device-stats')
    } catch (error) {
      console.error('Failed to approve return request:', error)
      throw error
    }
  }

  /**
   * Reject a return request
   */
  async rejectReturnRequest(requestId: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('returns')
        .update({
          status: 'Rejected',
          updated_at: new Date().toISOString(),
          supervisor_notes: reason,
        })
        .eq('id', requestId)

      if (error) {
        throw new Error(`Failed to reject return request: ${error.message}`)
      }

      this.clearCache('pending-return-requests')
    } catch (error) {
      console.error('Failed to reject return request:', error)
      throw error
    }
  }
}

export const supervisorDashboardService = new SupervisorDashboardService()

