import { NextRequest, NextResponse } from 'next/server'
import { devicesService, borrowService } from '@/lib/services'
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

const normalizeBoolean = (value: string | boolean | null | undefined): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes'].includes(normalized)) return true
    if (['false', '0', 'no'].includes(normalized)) return false
  }
  return undefined
}

const DeviceFiltersSchema = z.object({
  status: z.string().optional(),
  device_type: z.string().optional(),
  assigned_to: z.string().uuid().optional(), // Filter by employee UUID
  limit: z.coerce.number().min(1).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
  availableOnly: z.union([z.string(), z.boolean()]).optional(),
})

// GET /api/devices - list devices with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const parsedFilters = DeviceFiltersSchema.parse({
      status: searchParams.get('status') || undefined,
      device_type: searchParams.get('device_type') || undefined,
      assigned_to: searchParams.get('assigned_to') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
      availableOnly: searchParams.get('availableOnly') ?? undefined,
    })

    // CRITICAL: Fetch devices with no caching
    // If assigned_to is provided, filter devices assigned to that employee UUID
    // This is used for the "Assigned Devices" card to show only devices assigned to the logged-in user
    // Uses devices-service.ts listDevices method which handles errors gracefully
    let devices: any[] = []
    let count = 0
    
    try {
      const result = await devicesService.listDevices({
        status: parsedFilters.status,
        device_type: parsedFilters.device_type,
        assigned_to: parsedFilters.assigned_to, // Filter by employee UUID
        limit: parsedFilters.limit,
        offset: parsedFilters.offset,
        isAvailable: normalizeBoolean(parsedFilters.availableOnly),
      })
      devices = result.data
      count = result.count
    } catch (error) {
      // If devices-service throws an error, log it and return empty array
      // This prevents the API from completely failing
      console.error('[devices API] Error fetching devices from service:', error)
      devices = []
      count = 0
    }

    // CRITICAL: Batch fetch all active borrows in a single query (performance optimization)
    const deviceIds = devices.map((d) => d.device_id).filter(Boolean) as string[]
    const activeBorrowsMap = deviceIds.length > 0 
      ? await borrowService.getActiveBorrowsByDeviceIds(deviceIds)
      : new Map()

    // Map devices to their actual status based on borrow state
    const devicesWithActualStatus = devices.map((device) => {
      // Check if device has an active borrow
      const activeBorrow = activeBorrowsMap.get(device.device_id)
      
      // Determine actual status based on borrow state and device condition
      let actualStatus = device.status || 'available'
      
      if (activeBorrow) {
        // Device is currently borrowed
        actualStatus = 'borrowed'
      } else {
        // No active borrow - check device condition to set status
        const condition = (device.condition || '').toLowerCase()
        if (condition.includes('repair') || condition.includes('maintenance') || condition.includes('broken')) {
          actualStatus = 'in_maintenance'
        } else if (device.status === 'available' || device.status === 'assigned') {
          // If status was 'assigned' but no active borrow, make it available
          actualStatus = 'available'
        }
      }

      return {
        ...device,
        status: actualStatus, // Override with calculated status
      }
    })

    // CRITICAL: Return with no-cache headers
    return NextResponse.json(
      {
        success: true,
        data: devicesWithActualStatus,
        meta: { count, limit: parsedFilters.limit, offset: parsedFilters.offset },
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 },
      )
    }
    console.error('Failed to fetch devices:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch devices' }, { status: 500 })
  }
}

// POST /api/devices - create a new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceData = CreateDeviceSchema.parse(body)

    const device = await devicesService.createDevice(deviceData)

    return NextResponse.json({ success: true, data: device }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid device data', details: error.errors }, { status: 400 })
    }

    const message = error instanceof Error ? error.message : 'Failed to create device'
    if (message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ success: false, error: 'Duplicate asset_tag or serial_number' }, { status: 409 })
    }

    console.error('Failed to create device:', error)
    return NextResponse.json({ success: false, error: 'Failed to create device' }, { status: 500 })
  }
}

// PATCH /api/devices - update device status by identifier
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, status } = body

    if (!identifier || !status) {
      return NextResponse.json({ success: false, error: 'identifier and status are required' }, { status: 400 })
    }

    // Use devicesService to find device by identifier
    const device = await devicesService.getDeviceByIdentifier(identifier)
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    // Update device status
    const updated = await devicesService.setDeviceStatus(device.device_id, status)
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Failed to update device status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Failed to update device:', error)
    return NextResponse.json({ success: false, error: 'Failed to update device' }, { status: 500 })
  }
}






