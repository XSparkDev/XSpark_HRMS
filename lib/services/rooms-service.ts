// =============================================================================
// ROOMS SERVICE - Repository Layer
// =============================================================================
// Provides CRUD operations and helper utilities for the `rooms` table. This
// service acts as the single integration point between the UI/API layers and
// the database schema that stores room metadata for bookings.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'

export interface Room {
  id: string
  room_name: string
  room_code?: string | null
  location?: string | null
  floor?: string | null
  capacity?: number | null
  features?: string[] | null
  description?: string | null
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface RoomFilters {
  search?: string
  location?: string
  floor?: string
  minCapacity?: number
  maxCapacity?: number
  isAvailable?: boolean
 // includeDeleted?: boolean
  limit?: number
  offset?: number
}

export interface CreateRoomInput {
  room_name: string
  room_code?: string
  location?: string
  floor?: string
  capacity?: number
  features?: string[]
  description?: string
  is_available?: boolean
}

export type UpdateRoomInput = Partial<CreateRoomInput>

export class RoomsService extends BaseService {
  private readonly table = 'rooms'
  private readonly admin = supabaseAdmin

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  async listRooms(filters: RoomFilters = {}): Promise<Room[]> {
    return this.executeQueryArray(
      () => {
        let query = this.supabase.from(this.table).select('*')

          // if (!filters.includeDeleted) {
          //   query = query.is('deleted_at', null)
          // }

        if (filters.isAvailable !== undefined) {
          query = query.eq('is_available', filters.isAvailable)
        }

        if (filters.location) {
          query = query.ilike('location', `%${filters.location}%`)
        }

        if (filters.floor) {
          query = query.eq('floor', filters.floor)
        }

        if (filters.minCapacity !== undefined) {
          query = query.gte('capacity', filters.minCapacity)
        }

        if (filters.maxCapacity !== undefined) {
          query = query.lte('capacity', filters.maxCapacity)
        }

        if (filters.search) {
          const term = `%${filters.search}%`
          query = query.or(
            `room_name.ilike.${term},room_code.ilike.${term},location.ilike.${term},description.ilike.${term}`
          )
        }

        if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
          query = query.range(filters.offset, filters.offset + filters.limit - 1)
        } else if (typeof filters.limit === 'number') {
          query = query.limit(filters.limit)
        }

        return query.order('room_name', { ascending: true })
      },
      'list rooms'
    )
  }

  async getRoomById(id: string): Promise<Room | null> {
    return this.executeQuery(
      () =>
        this.supabase
          .from(this.table)
          .select('*')
          .eq('id', id)
          .maybeSingle(),
      'get room by id'
    )
  }

  async getAvailableRooms(filters: Omit<RoomFilters, 'isAvailable'> = {}): Promise<Room[]> {
    return this.listRooms({ ...filters, isAvailable: true })
  }

  // ===========================================================================
  // CREATE
  // ===========================================================================

  async createRoom(payload: CreateRoomInput): Promise<Room> {
    const data = this.sanitizeInput({
      is_available: payload.is_available ?? true,
      features: payload.features ?? [],
      ...payload,
    })

    return this.executeInsert(
      async () => {
        const result = await this.admin
          .from(this.table)
          .insert(data)
          .select('*')
          .single()
        return result
      },
      'create room'
    )
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  async updateRoom(id: string, updates: UpdateRoomInput): Promise<Room | null> {
    const sanitized = this.sanitizeInput(updates)

    return this.executeUpdate(
      async () => {
        const result = await this.admin
          .from(this.table)
          .update({ ...sanitized, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .maybeSingle()
        return result
      },
      'update room'
    )
  }

  async setRoomAvailability(id: string, isAvailable: boolean): Promise<Room | null> {
    return this.updateRoom(id, { is_available: isAvailable })
  }

  // ===========================================================================
  // DELETE OPERATIONS
  // ===========================================================================

  async deleteRoom(id: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    const { hardDelete = false } = options

    if (hardDelete) {
      return this.executeDelete(
        async () => {
          const { error } = await this.admin.from(this.table).delete().eq('id', id)
          return { error }
        },
        'hard delete room'
      )
    }

    return this.executeDelete(
      async () => {
        const { error } = await this.admin
          .from(this.table)
          .update({ updated_at: new Date().toISOString() })
          .eq('id', id)
        return { error }
      },
      'soft delete room'
    )
  }

  async restoreRoom(id: string): Promise<Room | null> {
    return this.executeUpdate(
      async () => {
        const result = await this.admin
          .from(this.table)
          .update({updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .maybeSingle()
        return result
      },
      'restore room'
    )
  }
}

export const roomsService = new RoomsService()


