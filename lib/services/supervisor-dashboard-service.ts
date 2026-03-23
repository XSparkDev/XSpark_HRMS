// ============================================================================
// SUPERVISOR DASHBOARD SERVICE - Database operations for supervisor dashboard
// ============================================================================
// Provides optimized queries, real-time updates, and caching for supervisor metrics
// ============================================================================

import { BaseService } from './base-service'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { devicesService } from './devices-service'
import { borrowService } from './borrow-service'
import { employeeService } from './employee-service'

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

  private getEmployeeDisplayName(employee: any): string {
    if (!employee) return 'Unknown'
    const preferred = typeof employee.preferred_name === 'string' ? employee.preferred_name.trim() : ''
    if (preferred) return preferred
    const first = typeof employee.first_name === 'string' ? employee.first_name.trim() : ''
    const last = typeof employee.last_name === 'string' ? employee.last_name.trim() : ''
    const fullName = `${first} ${last}`.trim()
    if (fullName) return fullName
    const fallback = typeof employee.name === 'string' ? employee.name.trim() : ''
    return fallback || 'Unknown'
  }

  private async buildEmployeesMap(employeeIds: string[]): Promise<Map<string, any>> {
    if (employeeIds.length === 0) return new Map()
    const employees = await employeeService.getAllActive({ limit: 1000 })
    return new Map(
      (employees || [])
        .filter((employee: any) => employeeIds.includes(employee.id))
        .map((employee: any) => [employee.id, employee]),
    )
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
  async getPendingBorrowRequests(forceRefresh: boolean = false): Promise<BorrowRequest[]> {
    // If force refresh is requested, clear cache first
    if (forceRefresh) {
      this.clearCache('pending-borrow-requests')
    }
    return this.getCachedOrFetch('pending-borrow-requests', async () => {
      // Call API route instead of borrowService directly (borrowService uses supabaseAdmin which only works server-side)
      // The API route runs on the server and can use supabaseAdmin correctly
      console.log('[SupervisorDashboardService] Fetching pending borrows via API route')

      try {
        // Use absolute URL when running server-side (Node fetch requires it),
        // and relative URL in the browser.
        const baseUrl =
          typeof window !== 'undefined'
            ? ''
            : process.env.NEXT_PUBLIC_SITE_URL ||
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        // Status-first: pending borrows are borrow_status='pending_borrow'
        // (we keep boolean filters for compatibility, but pending should be driven by status)
        const response = await fetch(`${baseUrl}/api/borrows?borrowStatus=pending_borrow&limit=100`, {
          cache: 'no-store',
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new Error(`API request failed: ${response.status} ${errorText}`)
        }

        const json = await response.json()
        
        console.log('[SupervisorDashboardService] API response:', {
          success: json.success,
          dataCount: json.data?.length || 0,
          meta: json.meta,
        })

        if (!json.success || !Array.isArray(json.data)) {
          console.warn('[SupervisorDashboardService] Invalid API response format')
          return []
        }

        const borrowRecords = json.data

        console.log('[SupervisorDashboardService] Raw pending borrow records from API:', {
          count: borrowRecords?.length || 0,
          sample: borrowRecords?.slice(0, 2).map((b: any) => ({
            id: b.borrow_id || b.id,
            device_id: b.device_id,
            borrowed_by: b.borrowed_by,
            is_borrowed: b.is_borrowed,
            borrow_status: b.borrow_status,
            status: b.status,
            approval_status: b.approval_status,
          }))
        })

        if (!borrowRecords || borrowRecords.length === 0) {
          console.warn('[SupervisorDashboardService] No pending borrows found via API')
          return []
        }

      // Fetch device and employee info for all borrows
      const deviceIds = [...new Set(borrowRecords.map((b: any) => b.device_id).filter(Boolean))]
      const employeeIds = [...new Set(borrowRecords.map((b: any) => b.borrowed_by).filter(Boolean))]

      console.log('[SupervisorDashboardService] Fetching relations:', {
        deviceIds: deviceIds.length,
        employeeIds: employeeIds.length,
      })

      // Fetch devices via API (supabaseAdmin doesn't work from client-side)
      const devicesResponse = await fetch(`/api/devices?limit=1000&offset=0`, {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })
      const devicesJson = await devicesResponse.json().catch(() => ({ success: false, data: [] }))
      const allDevices = devicesJson.success && Array.isArray(devicesJson.data) ? devicesJson.data : []
      const devicesMap = new Map(allDevices.filter((d: any) => deviceIds.includes(d.device_id)).map((d: any) => [d.device_id, d]))

      // Fetch employees via employee-service
      const employeesMap = await this.buildEmployeesMap(employeeIds)

      // Sort by borrow_date descending
      const sortedData = borrowRecords.sort((a: any, b: any) => {
        const dateA = new Date(a.borrow_date || 0).getTime()
        const dateB = new Date(b.borrow_date || 0).getTime()
        return dateB - dateA
      })

      const mapped = sortedData.map((item: any) => {
        const device = devicesMap.get(item.device_id) as any
        const employee = employeesMap.get(item.borrowed_by) as any

        return {
          id: item.borrow_id || item.id,
          employee_id: employee?.employee_id || item.borrowed_by || 'Unknown',
          employee_name: this.getEmployeeDisplayName(employee),
          device_id: item.device_id,
          device_name: device?.model || device?.brand || device?.device_type || 'Device',
          asset_tag: device?.asset_tag || item.device_id,
          borrow_date: item.borrow_date,
          expected_return_date: item.return_date,
          purpose: item.notes || '',
          status: 'pending',
          created_at: item.borrow_date,
          updated_at: item.borrow_date,
        }
      })

      console.log('[SupervisorDashboardService] Mapped pending borrow requests (status-first):', {
        count: mapped.length,
        sample: mapped.slice(0, 2).map((m: any) => ({
          id: m.id,
          employee_name: m.employee_name,
          device_name: m.device_name,
        }))
      })

      return mapped
      } catch (error) {
        console.error('[SupervisorDashboardService] Error fetching pending borrows via API:', error)
        return []
      }
    })
  }

  /**
   * Get active borrows (current borrows - approved but not returned)
   * Uses standard definition: approved_at IS NOT NULL AND returned_at IS NULL
   */
  async getActiveBorrows(forceRefresh: boolean = false): Promise<BorrowRequest[]> {
    // If force refresh is requested, clear cache first
    if (forceRefresh) {
      this.clearCache('active-borrows')
    }
    return this.getCachedOrFetch('active-borrows', async () => {
      console.log('[SupervisorDashboardService] Fetching active borrows via /api/borrows')

      // 1) Fetch active borrows from API (which uses BorrowService and borrows table)
      const borrowsResponse = await fetch('/api/borrows?borrowStatus=active&limit=100', {
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (!borrowsResponse.ok) {
        const errorText = await borrowsResponse.text().catch(() => 'Unknown error')
        throw new Error(`Failed to fetch active borrows: ${borrowsResponse.status} ${errorText}`)
      }

      const borrowsJson = await borrowsResponse.json()
      if (!borrowsJson.success || !Array.isArray(borrowsJson.data)) {
        throw new Error('Invalid /api/borrows response format for active borrows')
      }

      const borrowRecords = borrowsJson.data as any[]

      console.log('[SupervisorDashboardService] Active borrows API result:', {
        count: borrowRecords.length,
        sample: borrowRecords.slice(0, 2).map((b) => ({
          id: b.borrow_id || b.id,
          is_borrowed: b.is_borrowed,
          is_returned: b.is_returned,
          borrow_status: b.borrow_status,
        })),
      })

      if (borrowRecords.length === 0) {
        return []
      }

      // 2) Enrich with devices and employees
      const deviceIds = [...new Set(borrowRecords.map((b) => b.device_id).filter(Boolean))]
      const employeeIds = [...new Set(borrowRecords.map((b) => b.borrowed_by).filter(Boolean))]

      const [devicesResponse, employeesMap] = await Promise.all([
        fetch('/api/devices?limit=1000&offset=0', {
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        this.buildEmployeesMap(employeeIds),
      ])

      const [devicesJson] = await Promise.all([
        devicesResponse.json().catch(() => ({ success: false, data: [] })),
      ])

      const allDevices =
        devicesJson.success && Array.isArray(devicesJson.data) ? devicesJson.data : []

      const devicesMap = new Map(
        allDevices.filter((d: any) => deviceIds.includes(d.device_id)).map((d: any) => [
          d.device_id,
          d,
        ]),
      )
      // 3) Map into BorrowRequest shape used by the supervisor dashboard
      return borrowRecords.map((item: any) => {
        const device = devicesMap.get(item.device_id) as any
        const employee = employeesMap.get(item.borrowed_by) as any

        return {
          id: item.borrow_id || item.id,
          employee_id: employee?.employee_id || item.borrowed_by || 'Unknown',
          employee_name: this.getEmployeeDisplayName(employee),
          device_id: item.device_id,
          device_name: device?.model || device?.brand || device?.device_type || 'Device',
          asset_tag: device?.asset_tag || item.device_id,
          borrow_date: item.borrow_date,
          expected_return_date: item.return_date,
          purpose: item.notes || '',
          status: 'Borrowed', // All rows here are active borrows
          created_at: item.borrow_date,
          updated_at: item.borrow_date,
        }
      })
    })
  }

  /**
   * Get pending return requests
   */
  async getPendingReturnRequests(): Promise<ReturnRequest[]> {
    return this.getCachedOrFetch('pending-return-requests', async () => {
      const baseUrl =
        typeof window !== 'undefined'
          ? ''
          : process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

      const response = await fetch(`${baseUrl}/api/returns?status=pending&limit=100`, {
        cache: 'no-store',
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Failed to fetch pending return requests: ${response.status} ${errorText}`)
      }

      const result = await response.json().catch(() => ({} as any))
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error('Invalid /api/returns response format for pending return requests')
      }

      const employeeIds = [...new Set(result.data.map((item: any) => item.employee_id).filter(Boolean))]
      const employeesMap = await this.buildEmployeesMap(employeeIds)

      return result.data.map((item: any) => {
        const employee = employeesMap.get(item.employee_id)
        return {
          id: item.id,
          employee_id: employee?.employee_id || item.employee_id,
          employee_name: this.getEmployeeDisplayName(employee),
          device_id: item.device_id,
          device_name:
            item.device_name || item.devices?.model || item.devices?.brand || item.devices?.device_type || 'Device',
          asset_tag: item.asset_tag || item.devices?.asset_tag || item.device_id,
          return_date: item.return_date,
          device_condition: item.device_condition || 'Good',
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }
      })
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
          asset_tag: device.asset_tag ?? null,
          serial_number: device.serial_number ?? null,
          device_type: device.device_type ?? null,
          brand: device.brand ?? null,
          model: device.model ?? null,
          status: device.status ?? null,
          created_at: device.created_at ?? null,
          updated_at: device.updated_at ?? null,
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
          (payload: any) => {
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
          (payload: any) => {
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
          (payload: any) => {
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
   * Uses the new clean API endpoint
   */
  async approveBorrowRequest(requestId: string, notes?: string): Promise<void> {
    try {
      // Get current user for supervisorId
      const { getCurrentUser } = await import('@/lib/auth')
      const user = getCurrentUser()
      const supervisorId = user?.id || user?.employeeId

      if (!supervisorId) {
        throw new Error('Supervisor ID is required for approval')
      }

      // Call the new API endpoint
      const response = await fetch(`/api/borrows/${requestId}?action=approve`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          supervisorId,
          reason: notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message =
          (errorData && typeof errorData.error === 'string' && errorData.error) ||
          `Failed to approve borrow request: ${response.statusText}`

        // If the backend reports that the borrow is already approved, treat this as a
        // non-fatal, idempotent success: clear caches and return without throwing.
        if (message.toLowerCase().includes('already approved')) {
          console.warn('[SupervisorDashboardService] Borrow already approved, treating as success')
          this.clearCache('pending-borrow-requests')
          this.clearCache('device-stats')
          return
        }

        throw new Error(message)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve borrow request')
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
   * Uses the new clean API endpoint
   */
  async rejectBorrowRequest(requestId: string, reason?: string): Promise<void> {
    try {
      // Get current user for supervisorId
      const { getCurrentUser } = await import('@/lib/auth')
      const user = getCurrentUser()
      const supervisorId = user?.id || user?.employeeId

      if (!supervisorId) {
        throw new Error('Supervisor ID is required for rejection')
      }

      // Call the new API endpoint
      const response = await fetch(`/api/borrows/${requestId}?action=reject`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          supervisorId,
          reason: reason,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to reject borrow request: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to reject borrow request')
      }

      this.clearCache('pending-borrow-requests')
      this.clearCache('device-stats')
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
      // Fetch request so we can finalize the underlying borrow record.
      // Keeping `borrows.is_returned = false` until this supervisor approval.
      const { data: req, error: fetchError } = await supabase
        .from('returns')
        .select('id, device_id, employee_id')
        .eq('id', requestId)
        .maybeSingle()

      if (fetchError) {
        throw new Error(`Failed to fetch return request: ${fetchError.message}`)
      }

      const deviceId = (req as any)?.device_id as string | null | undefined
      if (!deviceId) {
        throw new Error('Return request is missing device_id')
      }

      // Mark the return request approved
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

      // Finalize the active borrow for this device (if present)
      const { data: activeBorrow, error: activeBorrowError } = await supabase
        .from('borrows')
        .select('borrow_id')
        .eq('device_id', deviceId)
        .eq('is_borrowed', true)
        .eq('is_returned', false)
        .order('borrow_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeBorrowError) {
        throw new Error(`Failed to find active borrow: ${activeBorrowError.message}`)
      }

      const borrowId = (activeBorrow as any)?.borrow_id as string | null | undefined
      if (borrowId) {
        const now = new Date().toISOString()
        const { error: borrowUpdateError } = await supabase
          .from('borrows')
          .update({
            is_returned: true,
            is_borrowed: false,
            borrow_status: 'returned',
            return_date: now,
            updated_at: now,
          })
          .eq('borrow_id', borrowId)

        if (borrowUpdateError) {
          throw new Error(`Failed to update borrow as returned: ${borrowUpdateError.message}`)
        }
      }

      // Set device back to available (best-effort; do not fail approval if this update is blocked by RLS)
      const { error: deviceUpdateError } = await supabase
        .from('devices')
        .update({ status: 'available', updated_at: new Date().toISOString() } as any)
        .eq('device_id', deviceId)

      if (deviceUpdateError) {
        console.warn('[SupervisorDashboardService] Device status update failed after return approval:', deviceUpdateError)
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

  /**
   * Delete a borrow request (only for approved or rejected requests)
   */
  async deleteBorrowRequest(requestId: string): Promise<void> {
    try {
      // Use borrowService.deleteBorrow which handles device status updates
      await borrowService.deleteBorrow(requestId, { hardDelete: true })
      
      this.clearCache('pending-borrow-requests')
      this.clearCache('device-stats')
    } catch (error) {
      console.error('Failed to delete borrow request:', error)
      throw error
    }
  }

  /**
   * Delete a return request (only for approved or rejected requests)
   */
  async deleteReturnRequest(requestId: string): Promise<void> {
    try {
      // Get the return request to find the device_id
      const { data: returnData, error: fetchError } = await supabase
        .from('returns')
        .select('device_id')
        .eq('id', requestId)
        .single()

      if (fetchError || !returnData) {
        throw new Error(`Failed to fetch return request: ${fetchError?.message || 'Request not found'}`)
      }

      const deviceId = returnData.device_id

      // Delete the return request
      const { error: deleteError } = await supabase
        .from('returns')
        .delete()
        .eq('id', requestId)

      if (deleteError) {
        throw new Error(`Failed to delete return request: ${deleteError.message}`)
      }

      // Update device status to available after deletion
      if (deviceId) {
        try {
          await devicesService.setDeviceStatus(deviceId, 'available')
        } catch (deviceError) {
          console.error('Failed to update device status:', deviceError)
          // Don't throw here - deletion succeeded, device status update is secondary
        }
      }

      this.clearCache('pending-return-requests')
      this.clearCache('device-stats')
    } catch (error) {
      console.error('Failed to delete return request:', error)
      throw error
    }
  }
}

export const supervisorDashboardService = new SupervisorDashboardService()

