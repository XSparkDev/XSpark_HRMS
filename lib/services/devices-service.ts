// =============================================================================
// DEVICES SERVICE - Repository Layer
// =============================================================================
// Provides CRUD operations and helpers for the `devices` table.
// =============================================================================

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'
import { borrowService, type BorrowRecord } from './borrow-service'
import { incidentsService, type IncidentRecord } from './incidents-service'

export interface DeviceRecord {
  device_id: string
  id?: string // Alias for device_id (for backward compatibility)
  asset_tag?: string | null
  serial_number?: string | null
  device_type?: string | null
  brand?: string | null
  model?: string | null
  specs?: Record<string, any> | null
  status?: string | null
  condition?: string | null
  location?: string | null
  assigned_to?: string | null
  notes?: string | null
  purchase_date?: string | null
  warranty_expiry?: string | null
  qr_code?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export interface DeviceFilters {
  search?: string
  status?: string | string[]
  device_type?: string | string[]
  location?: string
  assigned_to?: string
  isAvailable?: boolean
  limit?: number
  offset?: number
}

export interface CreateDeviceInput {
  asset_tag?: string | null
  serial_number?: string | null
  device_type: string
  brand?: string | null
  model?: string | null
  specs?: Record<string, any> | null
  status?: string | null
  condition?: string | null
  location?: string | null
  assigned_to?: string | null
  notes?: string | null
  purchase_date?: string | null
  warranty_expiry?: string | null
}

export type UpdateDeviceInput = Partial<CreateDeviceInput>

export class DevicesService extends BaseService {
  private readonly table = 'devices'
  private readonly admin = supabaseAdmin

  private normalizeDeviceRecord(record: any): DeviceRecord {
    const deviceId = record.device_id ?? ''
    return {
      ...record,
      device_id: deviceId,
      id: deviceId, // Set id as alias for backward compatibility
    }
  }

  async listDevices(filters: DeviceFilters = {}): Promise<{ data: DeviceRecord[]; count: number }> {
    // Use the service-role client to bypass any RLS limitations when listing devices
    // from backend contexts (e.g. Next.js route handlers). Using the anon client
    // can result in empty result sets when policies check auth.uid().
    let query = this.admin.from(this.table).select('*', { count: 'exact' })
    
    query = query.is('deleted_at', null)

    if (filters.search) {
      const term = `%${filters.search}%`
      query = query.or(
        [
          `asset_tag.ilike.${term}`,
          `serial_number.ilike.${term}`,
          `model.ilike.${term}`,
          `brand.ilike.${term}`,
          `device_type.ilike.${term}`,
          `notes.ilike.${term}`,
        ].join(','),
      )
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters.device_type) {
      if (Array.isArray(filters.device_type)) {
        query = query.in('device_type', filters.device_type)
      } else {
        query = query.eq('device_type', filters.device_type)
      }
    }

    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`)
    }

    // Filter by assigned_to: Only return devices assigned to a specific employee UUID
    // This is used for the "Assigned Devices" card to show devices assigned to the logged-in user
    // Note: This filter automatically excludes devices where assigned_to IS NULL
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to)
    }

    if (typeof filters.isAvailable === 'boolean') {
      if (filters.isAvailable) {
        query = query.eq('status', 'available').is('assigned_to', null)
      } else {
        query = query.neq('status', 'available')
      }
    }

    if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
      query = query.range(filters.offset, filters.offset + filters.limit - 1)
    } else if (typeof filters.limit === 'number') {
      query = query.limit(filters.limit)
    }

    const { data, error, count } = await query.order('updated_at', { ascending: false })
    
    // Handle errors gracefully - log but don't throw
    // Only return empty array if there's a critical error
    if (error) {
      console.error('[DevicesService] Error listing devices:', error)
      // Check if it's a critical error or just a warning
      // For non-critical errors (like RLS issues), try to return data if available
      if (data && Array.isArray(data) && data.length > 0) {
        // If we have data despite the error, return it
        return {
          data: data.map((record: Record<string, any>) => this.normalizeDeviceRecord(record)),
          count: count ?? data.length,
        }
      }
      // Only return empty array if we truly have no data
      return {
        data: [],
        count: 0,
      }
    }

    // Normal successful response
    return {
      data: (data ?? []).map((record: Record<string, any>) => this.normalizeDeviceRecord(record)),
      count: count ?? data?.length ?? 0,
    }
  }

  async getDeviceById(id: string): Promise<DeviceRecord | null> {
    return this.executeQuery<DeviceRecord | null>(
      async () => {
        // Use device_id as the primary key (matches database schema)
        const { data, error } = await supabase
          .from(this.table)
          .select('*')
          .eq('device_id', id)
          .maybeSingle()
        return { data: data ? this.normalizeDeviceRecord(data) : null, error }
      },
      'get device by id',
    )
  }

  async getDeviceByIdentifier(identifier: string): Promise<DeviceRecord | null> {
    // Try multiple lookup strategies: device_id, asset_tag, serial_number, UUID (id if exists)
    // Use admin client to bypass RLS policies
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    // First, try by device_id using admin client (device_id may contain UUIDs)
    // This is the primary identifier - check this first since UUIDs might be stored here
    try {
      const { data: deviceByIdData, error: deviceByIdError } = await this.admin
        .from(this.table)
        .select('*')
        .eq('device_id', identifier)
        .maybeSingle()
      
      if (!deviceByIdError && deviceByIdData) {
        return this.normalizeDeviceRecord(deviceByIdData)
      }
      
      // Log if there was an error (but not "column does not exist")
      if (deviceByIdError) {
        const errorMessage = deviceByIdError.message || String(deviceByIdError)
        if (!errorMessage.includes('does not exist') && !errorMessage.includes('column')) {
          console.warn('[DevicesService] Error querying by device_id:', errorMessage)
        }
      }
    } catch (error) {
      // Continue to next lookup strategy
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('does not exist') && !errorMessage.includes('column')) {
        console.warn('[DevicesService] Exception querying by device_id:', errorMessage)
      }
    }
    
    // If looks like UUID, try by id column (if it exists as separate column)
    // Note: If device_id contains UUIDs, this step might be redundant but safe to try
    if (uuidRegex.test(identifier)) {
      try {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('id', identifier)
          .maybeSingle()
        
        // Only return if no error and data exists
        // Ignore "column does not exist" errors gracefully
        if (!error && data) {
          return this.normalizeDeviceRecord(data)
        }
      } catch (error) {
        // Column might not exist - that's okay, continue to other lookups
        // Only log if it's not a "column does not exist" error
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (!errorMessage.includes('does not exist') && !errorMessage.includes('column')) {
          console.warn('[DevicesService] Error querying by id column:', errorMessage)
        }
      }
    }
    
    // Try by asset_tag
    try {
      const { data: assetTagData, error: assetTagError } = await this.admin
        .from(this.table)
        .select('*')
        .eq('asset_tag', identifier)
        .maybeSingle()
      if (!assetTagError && assetTagData) {
        return this.normalizeDeviceRecord(assetTagData)
      }
    } catch (error) {
      // Continue to next lookup
    }
    
    // Try by serial_number
    try {
      const { data: serialData, error: serialError } = await this.admin
        .from(this.table)
        .select('*')
        .eq('serial_number', identifier)
        .maybeSingle()
      if (!serialError && serialData) {
        return this.normalizeDeviceRecord(serialData)
      }
    } catch (error) {
      // All lookups exhausted
    }
    
    return null
  }

  async getDevicesByIds(ids: string[]): Promise<DeviceRecord[]> {
    const sanitizedIds = Array.from(
      new Set(
        (ids ?? [])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    )

    if (sanitizedIds.length === 0) {
      return []
    }

    return this.executeQueryArray<DeviceRecord>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .in('device_id', sanitizedIds)
        return {
          data: data ? data.map((record: Record<string, any>) => this.normalizeDeviceRecord(record)) : [],
          error,
        }
      },
      'get devices by ids',
    )
  }

  async createDevice(payload: CreateDeviceInput): Promise<DeviceRecord> {
    const sanitized = this.sanitizeInput({
      status: payload.status ?? 'available',
      condition: payload.condition ?? 'good',
      ...payload,
    })

    return this.executeInsert<DeviceRecord>(
      async () => {
        const { data, error } = await this.admin.from(this.table).insert(sanitized).select('*').single()
        return { data: data ? this.normalizeDeviceRecord(data) : null, error }
      },
      'create device',
    )
  }

  async updateDevice(id: string, updates: UpdateDeviceInput): Promise<DeviceRecord | null> {
    const sanitized = this.sanitizeInput({
      ...updates,
      updated_at: new Date().toISOString(),
    })

    return this.executeUpdate<DeviceRecord | null>(
      async () => {
        // Use device_id as the primary key (matches database schema)
        const { data, error } = await this.admin
          .from(this.table)
          .update(sanitized)
          .eq('device_id', id)
          .select('*')
          .maybeSingle()
        return { data: data ? this.normalizeDeviceRecord(data) : null, error }
      },
      'update device',
    )
  }

  async markDeviceAsBorrowed(deviceId: string, employeeId: string): Promise<DeviceRecord | null> {
    return this.updateDevice(deviceId, {
      assigned_to: employeeId,
      status: 'assigned',
    })
  }

  async markDeviceAsAvailable(deviceId: string): Promise<DeviceRecord | null> {
    return this.updateDevice(deviceId, {
      assigned_to: null,
      status: 'available',
    })
  }

  async setDeviceStatus(id: string, status: string): Promise<DeviceRecord | null> {
    return this.updateDevice(id, { status })
  }

  /**
   * Bulk update all devices to a specific status
   * @param status - The status to set for all devices
   * @param options - Optional settings for the bulk update
   * @returns Number of devices updated
   */
  async bulkUpdateAllDevicesStatus(
    status: string,
    options?: { clearAssignments?: boolean; updateAll?: boolean }
  ): Promise<number> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      }

      // Optionally clear assignments (useful when resetting to available)
      if (options?.clearAssignments) {
        updateData.assigned_to = null
      }

      let query = this.admin.from(this.table).update(updateData)

      // If updateAll is true, update ALL devices regardless of current status
      // Otherwise, only update devices that don't already have this status
      if (!options?.updateAll) {
        query = query.neq('status', status)
      }

      const { data, error, count } = await query.select('device_id', { count: 'exact' })

      if (error) {
        console.error('[DevicesService] Error bulk updating device status:', error)
        throw error
      }

      const updatedCount = count ?? data?.length ?? 0
      console.log(`[DevicesService] Bulk updated ${updatedCount} devices to status: ${status}`)
      return updatedCount
    } catch (error) {
      this.handleError(error, 'bulk update all devices status')
      return 0
    }
  }

  /**
   * Sync device statuses based on their actual state (borrows, maintenance, etc.)
   * Updates device statuses in the database to match their real availability
   * @returns Number of devices updated
   */
  async syncDeviceStatuses(): Promise<number> {
    try {
      // Get all devices
      const { data: allDevices, error: devicesError } = await this.admin
        .from(this.table)
        .select('device_id, status, condition, assigned_to')

      if (devicesError) {
        console.error('[DevicesService] Error fetching devices for sync:', devicesError)
        throw devicesError
      }

      if (!allDevices || allDevices.length === 0) {
        return 0
      }

      const deviceIds = allDevices.map((d) => d.device_id).filter(Boolean) as string[]
      
      // Get all active borrows
      const activeBorrowsMap = deviceIds.length > 0
        ? await borrowService.getActiveBorrowsByDeviceIds(deviceIds)
        : new Map()

      // Determine correct status for each device and batch update
      const updates: Array<{ device_id: string; status: string }> = []
      
      for (const device of allDevices) {
        const deviceId = device.device_id
        if (!deviceId) continue

        const activeBorrow = activeBorrowsMap.get(deviceId)
        let correctStatus = device.status || 'available'

        // Determine correct status based on actual state
        if (activeBorrow) {
          // Device is currently borrowed
          correctStatus = 'borrowed'
        } else {
          // No active borrow - check device condition to set status
          const condition = (device.condition || '').toLowerCase()
          if (condition.includes('repair') || condition.includes('maintenance') || condition.includes('broken')) {
            correctStatus = 'maintenance'
          } else if (device.assigned_to && device.assigned_to.trim() !== '') {
            // Device is assigned but not borrowed
            correctStatus = 'assigned'
          } else {
            // Device is available
            correctStatus = 'available'
          }
        }

        // Only update if status needs to change
        const currentStatus = (device.status || '').toLowerCase()
        if (currentStatus !== correctStatus.toLowerCase()) {
          updates.push({ device_id: deviceId, status: correctStatus })
        }
      }

      // Batch update devices
      let updatedCount = 0
      for (const update of updates) {
        try {
          await this.setDeviceStatus(update.device_id, update.status)
          updatedCount++
        } catch (error) {
          console.error(`[DevicesService] Error updating device ${update.device_id}:`, error)
        }
      }

      console.log(`[DevicesService] Synced ${updatedCount} device statuses`)
      return updatedCount
    } catch (error) {
      console.error('[DevicesService] Error syncing device statuses:', error)
      this.handleError(error, 'sync device statuses')
      return 0
    }
  }

  async deleteDevice(id: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    if (options.hardDelete) {
      return this.executeDelete(
        async () => {
          // Use device_id as the primary key (matches database schema)
          const { error } = await this.admin.from(this.table).delete().eq('device_id', id)
          return { error }
        },
        'hard delete device',
      )
    }

    return this.executeDelete(
      async () => {
        // Use device_id as the primary key (matches database schema)
        const { error } = await this.admin
          .from(this.table)
          .update({ deleted_at: new Date().toISOString(), status: 'retired' })
          .eq('device_id', id)
        return { error }
      },
      'soft delete device',
    )
  }

  /**
   * Get device history including both borrows and incidents
   * @param deviceId - Device identifier (device_id, id, asset_tag, or serial_number)
   * @returns Combined history of borrows and incidents for the device
   */
  async getDeviceHistory(deviceId: string): Promise<{
    borrows: BorrowRecord[]
    incidents: IncidentRecord[]
    total: number
  }> {
    try {
      // Resolve device identifier to actual device_id
      const device = await this.getDeviceByIdentifier(deviceId)
      if (!device) {
        throw new Error('Device not found')
      }

      // Fetch borrows directly from database to get ALL borrows (including returned/inactive ones)
      // Using admin client to bypass RLS and get complete history
      const { data: borrowsData, error: borrowsError } = await this.admin
        .from('borrows')
        .select('*')
        .eq('device_id', device.device_id)
        .order('borrow_date', { ascending: false })

      if (borrowsError) {
        console.error('[DevicesService] Error fetching borrows for history:', borrowsError)
        throw new Error(`Failed to fetch borrow history: ${borrowsError.message}`)
      }

      // Fetch incidents using the service
      const incidentsResult = await incidentsService.listIncidents({ deviceId: device.device_id })

      return {
        borrows: (borrowsData || []) as BorrowRecord[],
        incidents: incidentsResult.data || [],
        total: (borrowsData?.length || 0) + (incidentsResult.count || 0),
      }
    } catch (error) {
      this.handleError(error, 'get device history')
    }
  }
}

export const devicesService = new DevicesService()

