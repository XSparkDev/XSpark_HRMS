// =============================================================================
// DEVICES SERVICE - Repository Layer
// =============================================================================
// Provides CRUD operations and helpers for the `devices` table.
// =============================================================================

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'

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
    
    // NOTE: deleted_at filter is currently disabled because all devices in the database
    // appear to have deleted_at set. To re-enable soft-delete filtering, uncomment the line below
    // after ensuring devices have deleted_at = NULL for active devices.
     query = query.is('delete_at', null)

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
    // Try multiple lookup strategies: device_id, asset_tag, serial_number
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    // First, try by device_id
    let device = await this.getDeviceById(identifier).catch(() => null)
    if (device) return device
    
    // If looks like UUID, try by id column
    if (uuidRegex.test(identifier)) {
      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .eq('id', identifier)
        .maybeSingle()
      if (!error && data) {
        return this.normalizeDeviceRecord(data)
      }
    }
    
    // Try by asset_tag
    const { data: assetTagData, error: assetTagError } = await this.admin
      .from(this.table)
      .select('*')
      .eq('asset_tag', identifier)
      .maybeSingle()
    if (!assetTagError && assetTagData) {
      return this.normalizeDeviceRecord(assetTagData)
    }
    
    // Try by serial_number
    const { data: serialData, error: serialError } = await this.admin
      .from(this.table)
      .select('*')
      .eq('serial_number', identifier)
      .maybeSingle()
    if (!serialError && serialData) {
      return this.normalizeDeviceRecord(serialData)
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
}

export const devicesService = new DevicesService()

