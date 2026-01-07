// =============================================================================
// RESOURCES SERVICE - Repository Layer
// =============================================================================
// Provides CRUD and hydration helpers for the `resources` table. This service
// determines which specialised model (room/device/generic) should be returned
// based on the resource_type stored in the database.
// =============================================================================

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'
import type { Room } from './rooms-service'
import type {
  ResourceRecord,
  ResourceModel,
  ResourceKind,
  RoomResourceModel,
  DeviceResourceModel,
  GenericResourceModel,
} from '@/lib/models/resource-models'
import { devicesService, type DeviceRecord } from './devices-service'

type ResourceFilters = {
  search?: string
  resource_type?: string
  is_available?: boolean
  includeDeleted?: boolean
  limit?: number
  offset?: number
}

type ListOptions = ResourceFilters & {
  hydrate?: boolean
}


export class ResourcesService extends BaseService {
  private readonly table = 'resources'
  private readonly admin = supabaseAdmin

  async listResources(options: ListOptions = {}): Promise<ResourceModel[]> {
    const rows = await this.executeQueryArray<ResourceRecord>(
      async () => {
        let query = supabase.from(this.table).select('*')

        if (!options.includeDeleted) {
          query = query.is('deleted_at', null)
        }

        // IMPORTANT: Exclude devices from resources queries
        // Devices are now stored in the separate devices table
        // This prevents double-counting in dashboard cards
        query = query.or('resource_type.is.null,resource_type.neq.Device')

        if (options.resource_type) {
          // Prevent filtering by 'Device' type - devices are in devices table now
          if (options.resource_type === 'Device') {
            console.warn('[ResourcesService] Cannot filter by Device type. Use DevicesService instead.')
            // Return empty array instead of throwing error for backward compatibility
            return { data: [], error: null }
          }
          query = query.eq('resource_type', options.resource_type)
        }

        if (options.is_available !== undefined) {
          query = query.eq('is_available', options.is_available)
        }

        if (options.search) {
          const term = `%${options.search}%`
          query = query.or(
            `resource_name.ilike.${term},description.ilike.${term},location.ilike.${term}`
          )
        }

        if (typeof options.limit === 'number' && typeof options.offset === 'number') {
          query = query.range(options.offset, options.offset + options.limit - 1)
        } else if (typeof options.limit === 'number') {
          query = query.limit(options.limit)
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        return { data, error }
      },
      'list resources'
    )

    if (!options.hydrate) {
      return rows.map((row) => this.mapRowToModel(row))
    }

    return Promise.all(rows.map((row) => this.hydrateResource(row)))
  }

  async getResourceById(id: string, options: { hydrate?: boolean } = {}): Promise<ResourceModel | null> {
    const row = await this.executeQuery<ResourceRecord | null>(
      async () => {
        const { data, error } = await supabase
          .from(this.table)
          .select('*')
          .eq('resource_id', id)
          .maybeSingle()
        return { data, error }
      },
      'get resource by id'
    )

    if (!row) return null
    return options.hydrate ? this.hydrateResource(row) : this.mapRowToModel(row)
  }

  async createResource(payload: ResourceRecord): Promise<ResourceModel> {
    // IMPORTANT: Prevent creating devices in resources table
    // Devices should be created via DevicesService
    if (payload.resource_type === 'Device') {
      throw new Error('Devices cannot be created as resources. Use DevicesService.createDevice() instead.')
    }

    const sanitized = this.sanitizeInput({
      ...payload,
      created_at: payload.created_at ?? new Date().toISOString(),
      updated_at: payload.updated_at ?? new Date().toISOString(),
    })

    const row = await this.executeInsert<ResourceRecord>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .insert(sanitized)
          .select('*')
          .single()
        return { data, error }
      },
      'create resource'
    )

    return this.mapRowToModel(row)
  }

  async updateResource(id: string, updates: Partial<ResourceRecord>): Promise<ResourceModel | null> {
    // IMPORTANT: Prevent updating resource_type to 'Device'
    // Devices should be managed via DevicesService
    if (updates.resource_type === 'Device') {
      throw new Error('Cannot set resource_type to "Device". Devices are managed separately via DevicesService.')
    }

    const sanitized = this.sanitizeInput({ ...updates, updated_at: new Date().toISOString() })

    const row = await this.executeUpdate<ResourceRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update(sanitized)
          .eq('resource_id', id)
          .select('*')
          .maybeSingle()
        return { data, error }
      },
      'update resource'
    )

    if (!row) return null
    return this.mapRowToModel(row)
  }

  async deleteResource(id: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    const { hardDelete = false } = options

    if (hardDelete) {
      return this.executeDelete(
        async () => {
          const { error } = await this.admin.from(this.table).delete().eq('resource_id', id)
          return { error }
        },
        'hard delete resource'
      )
    }

    return this.executeDelete(
      async () => {
        const { error } = await this.admin
          .from(this.table)
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('resource_id', id)
        return { error }
      },
      'soft delete resource'
    )
  }

  async restoreResource(id: string): Promise<ResourceModel | null> {
    const row = await this.executeUpdate<ResourceRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({ deleted_at: null, updated_at: new Date().toISOString() })
          .eq('resource_id', id)
          .select('*')
          .maybeSingle()
        return { data, error }
      },
      'restore resource'
    )

    if (!row) return null
    return this.mapRowToModel(row)
  }

  private mapRowToModel(row: ResourceRecord): ResourceModel {
    const kind = this.resolveKind(row.resource_type)

    if (kind === 'room') {
      const model: RoomResourceModel = {
        ...row,
        kind,
        roomDetails: undefined,
        features: undefined,
      }
      return model
    }

    if (kind === 'device') {
      const model: DeviceResourceModel = {
        ...row,
        kind,
        deviceId: row.resource_id,
        asset_tag: undefined,
        serial_number: undefined,
        device_type: undefined,
        status: undefined,
      }
      return model
    }

    const model: GenericResourceModel = { ...row, kind }
    return model
  }

  private async hydrateResource(row: ResourceRecord): Promise<ResourceModel> {
    const kind = this.resolveKind(row.resource_type)

    if (kind === 'room') {
      const [roomDetails] = await Promise.all([this.fetchRoom(row.resource_id)])
      const model: RoomResourceModel = {
        ...row,
        kind,
        roomDetails,
        features: roomDetails?.features ?? null,
      }
      return model
    }

    if (kind === 'device') {
      const device = await this.fetchDevice(row.resource_id)
      const model: DeviceResourceModel = {
        ...row,
        kind,
        deviceId: device?.id ?? row.resource_id,
        asset_tag: device?.asset_tag ?? null,
        serial_number: device?.serial_number ?? null,
        device_type: device?.device_type ?? null,
        status: device?.status ?? null,
      }
      return model
    }

    return { ...row, kind: 'other' }
  }

  private resolveKind(resourceType?: string | null): ResourceKind {
    const normalized = (resourceType || '').trim().toLowerCase()
    if (['room', 'meeting_room', 'conference_room'].includes(normalized)) return 'room'
    if (['device', 'hardware', 'computer', 'laptop'].includes(normalized)) return 'device'
    return 'other'
  }

  private async fetchRoom(id: string): Promise<Room | null> {
    try {
      const { roomsService } = await import('./rooms-service')
      return await roomsService.getRoomById(id)
    } catch (error) {
      console.warn(`Unable to hydrate room resource ${id}:`, error)
      return null
    }
  }

  private async fetchDevice(id: string): Promise<DeviceRecord | null> {
    try {
      return await devicesService.getDeviceById(id)
    } catch (error) {
      console.warn(`Unable to hydrate device resource ${id}:`, error)
      return null
    }
  }
}

export const resourcesService = new ResourcesService()



