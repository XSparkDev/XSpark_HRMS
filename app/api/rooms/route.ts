import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { roomsService } from '@/lib/services'
import type { RoomFilters, CreateRoomInput, UpdateRoomInput } from '@/lib/services/rooms-service'

const searchSchema = z.object({
  search: z.string().optional(),
  location: z.string().optional(),
  floor: z.string().optional(),
  minCapacity: z.coerce.number().min(0).optional(),
  maxCapacity: z.coerce.number().min(0).optional(),
  isAvailable: z.union([z.string(), z.boolean()]).optional(),
  includeDeleted: z.union([z.string(), z.boolean()]).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
})

const createSchema = z.object({
  room_name: z.string().min(1, 'room_name is required'),
  room_code: z.string().optional(),
  location: z.string().optional(),
  floor: z.string().optional(),
  capacity: z.coerce.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().optional(),
  is_available: z.boolean().optional(),
})

const updateSchema = createSchema
  .partial()
  .extend({
    id: z.string().min(1, 'id is required'),
  })
  .superRefine((data, ctx) => {
    const { id, ...updates } = data
    if (!id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'id is required',
      })
    }

    if (Object.keys(updates).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided to update',
      })
    }
})

const normalizeBoolean = (value: string | boolean | undefined): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes'].includes(normalized)) return true
    if (['false', '0', 'no'].includes(normalized)) return false
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = searchSchema.parse({
      search: searchParams.get('search') ?? undefined,
      location: searchParams.get('location') ?? undefined,
      floor: searchParams.get('floor') ?? undefined,
      minCapacity: searchParams.get('minCapacity') ?? undefined,
      maxCapacity: searchParams.get('maxCapacity') ?? undefined,
      isAvailable: searchParams.get('isAvailable') ?? undefined,
      includeDeleted: searchParams.get('includeDeleted') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    const filters: RoomFilters = {
      search: parsed.search,
      location: parsed.location,
      floor: parsed.floor,
      minCapacity: parsed.minCapacity,
      maxCapacity: parsed.maxCapacity,
      isAvailable: normalizeBoolean(parsed.isAvailable),
      // includeDeleted: normalizeBoolean(parsed.includeDeleted),
      limit: parsed.limit,
      offset: parsed.offset,
    }

    const rooms = await roomsService.listRooms(filters)

    return NextResponse.json({
      success: true,
      data: rooms,
      meta: {
        count: rooms.length,
        limit: filters.limit ?? null,
        offset: filters.offset ?? null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      }, { status: 400 })
    }

    console.error('Failed to list rooms:', error)
    return NextResponse.json({ success: false, error: 'Failed to list rooms' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const payload = createSchema.parse(json)

    const room = await roomsService.createRoom(payload as CreateRoomInput)

    return NextResponse.json({ success: true, data: room }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid room payload',
        details: error.errors,
      }, { status: 400 })
    }

    console.error('Failed to create room:', error)
    return NextResponse.json({ success: false, error: 'Failed to create room' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = updateSchema.parse(json)
    const { id, ...updates } = parsed

    const room = await roomsService.updateRoom(id, updates as UpdateRoomInput)

    if (!room) {
      return NextResponse.json(
        {
          success: false,
          error: 'Room not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: room,
      message: 'Room updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid room update payload',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('Failed to update room:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update room' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = updateSchema.parse(json)
    const { id, ...updates } = parsed

    const room = await roomsService.updateRoom(id, updates as UpdateRoomInput)

    if (!room) {
      return NextResponse.json(
        {
          success: false,
          error: 'Room not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: room,
      message: 'Room updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid room update payload',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('Failed to patch room:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to patch room' },
      { status: 500 }
    )
  }
}





