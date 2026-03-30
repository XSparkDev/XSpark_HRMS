// =============================================================================
// RESOURCE DOMAIN MODELS
// =============================================================================
// Defines the shape of the generic resource record stored in the `resources`
// table and the discriminated union used by the ResourcesService to expose
// strongly typed models to the rest of the application.
// =============================================================================

import type { Room } from '@/lib/services/rooms-service'

export type ResourceKind = 'room' | 'device' | 'other'

export interface ResourceRecord {
  resource_id: string
  resource_name: string
  resource_type?: string | null
  description?: string | null
  location?: string | null
  capacity?: number | null
  condition?: string | null
  is_available?: boolean | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export interface BaseResourceModel extends ResourceRecord {
  kind: ResourceKind
}

export interface RoomResourceModel extends BaseResourceModel {
  kind: 'room'
  roomDetails?: Room | null
  features?: string[] | null
}

export interface DeviceResourceModel extends BaseResourceModel {
  kind: 'device'
  deviceId?: string | null
  asset_tag?: string | null
  serial_number?: string | null
  device_type?: string | null
  status?: string | null
}

export interface GenericResourceModel extends BaseResourceModel {
  kind: 'other'
}

export type ResourceModel = RoomResourceModel | DeviceResourceModel | GenericResourceModel




















