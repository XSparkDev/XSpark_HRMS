import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// Validation schemas for devices
const CreateDeviceSchema = z.object({
  asset_tag: z.string().min(1, 'Asset tag is required').optional(),
  serial_number: z.string().min(1, 'Serial number is required').optional(),
  device_type: z.string().min(1, 'Device type is required'),
  brand: z.string().optional(),
  model: z.string().optional(),
  specs: z.record(z.any()).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  warranty_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  condition: z.string().optional().default('Good'),
  status: z.string().optional().default('available'),
  assigned_to: z.string().uuid().nullable().optional(),
  location: z.string().optional(),
  notes: z.string().optional()
})

const DeviceFiltersSchema = z.object({
  status: z.string().optional(),
  device_type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0)
})

// GET /api/devices - list devices with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = DeviceFiltersSchema.parse({
      status: searchParams.get('status') || undefined,
      device_type: searchParams.get('device_type') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0'
    })

    let query = supabase
      .from('devices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.device_type) {
      query = query.eq('device_type', filters.device_type)
    }

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch devices', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { count: count || data?.length || 0, limit: filters.limit, offset: filters.offset }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch devices' }, { status: 500 })
  }
}

// POST /api/devices - create a new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceData = CreateDeviceSchema.parse(body)

    const insertData: any = {
      asset_tag: deviceData.asset_tag ?? null,
      serial_number: deviceData.serial_number ?? null,
      device_type: deviceData.device_type,
      brand: deviceData.brand ?? null,
      model: deviceData.model ?? null,
      specs: deviceData.specs ?? null,
      purchase_date: deviceData.purchase_date ?? null,
      warranty_expiry: deviceData.warranty_expiry ?? null,
      condition: deviceData.condition ?? 'Good',
      status: deviceData.status ?? 'available',
      assigned_to: deviceData.assigned_to ?? null,
      location: deviceData.location ?? null,
      notes: deviceData.notes ?? null
    }

    const { data, error } = await supabase
      .from('devices')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Unique constraint or similar conflict
      if (error.code === '23505' || error.message?.toLowerCase().includes('unique')) {
        return NextResponse.json({ success: false, error: 'Duplicate asset_tag or serial_number' }, { status: 409 })
      }
      return NextResponse.json({ success: false, error: 'Failed to create device', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid device data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to create device' }, { status: 500 })
  }
}






