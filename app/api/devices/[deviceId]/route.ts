import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { devicesService } from '@/lib/services'

const paramsSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
})

// Validation schema for device updates (all fields optional)
const UpdateDeviceSchema = z.object({
  asset_tag: z.string().min(1).optional().nullable(),
  serial_number: z.string().min(1).optional().nullable(),
  device_type: z.string().min(1).optional(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  specs: z.record(z.any()).optional().nullable(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  warranty_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  condition: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  qr_code: z.string().optional().nullable(),
})

/**
 * GET /api/devices/[deviceId]
 * 
 * Get a device by identifier using getDeviceByIdentifier from devices-service.ts
 * 
 * This endpoint uses the getDeviceByIdentifier function which:
 * - Tries multiple lookup strategies: device_id, id (UUID), asset_tag, serial_number
 * - Uses flexible identifier matching
 * - Returns the device if found, null if not found
 * 
 * @param deviceId - Can be device_id, UUID (id), asset_tag, or serial_number
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const params = await context.params
    const { deviceId } = paramsSchema.parse(params)

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device identifier is required' },
        { status: 400 }
      )
    }

    // Use getDeviceByIdentifier for flexible lookup
    // This function tries multiple lookup strategies:
    // 1. By device_id (via getDeviceById)
    // 2. By id column (if identifier is a UUID)
    // 3. By asset_tag
    // 4. By serial_number
    const device = await devicesService.getDeviceByIdentifier(deviceId)

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: 'Device not found',
          message: `No device found with identifier: ${deviceId}`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: device,
        identifier: deviceId,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid device identifier', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[devices/[deviceId]] Error fetching device:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch device',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/devices/[deviceId]
 * 
 * Update a device by identifier using updateDevice from devices-service.ts
 * 
 * This endpoint:
 * - Uses getDeviceByIdentifier to find the device (supports device_id, UUID, asset_tag, serial_number)
 * - Updates the device with the provided fields
 * - Returns the updated device record
 * 
 * @param deviceId - Can be device_id, UUID (id), asset_tag, or serial_number
 * @body - Device fields to update (all fields optional)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const params = await context.params
    const { deviceId } = paramsSchema.parse(params)

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device identifier is required' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate request body
    const updateData = UpdateDeviceSchema.parse(body)

    // Find device by identifier (supports multiple lookup strategies)
    const device = await devicesService.getDeviceByIdentifier(deviceId)
    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: 'Device not found',
          message: `No device found with identifier: ${deviceId}`,
        },
        { status: 404 }
      )
    }

    // Update device using the service function
    const updated = await devicesService.updateDevice(device.device_id, updateData)

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update device',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Device updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid device data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('[devices/[deviceId]] Error updating device:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update device',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/devices/[deviceId]
 * 
 * Update a device by identifier using updateDevice from devices-service.ts
 * 
 * This endpoint:
 * - Uses getDeviceByIdentifier to find the device (supports device_id, UUID, asset_tag, serial_number)
 * - Updates the device with the provided fields
 * - Returns the updated device record
 * 
 * @param deviceId - Can be device_id, UUID (id), asset_tag, or serial_number
 * @body - Device fields to update (all fields optional)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const params = await context.params
    const { deviceId } = paramsSchema.parse(params)

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device identifier is required' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate request body
    const updateData = UpdateDeviceSchema.parse(body)

    // Find device by identifier (supports multiple lookup strategies)
    const device = await devicesService.getDeviceByIdentifier(deviceId)
    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: 'Device not found',
          message: `No device found with identifier: ${deviceId}`,
        },
        { status: 404 }
      )
    }

    // Update device using the service function
    const updated = await devicesService.updateDevice(device.device_id, updateData)

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update device',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Device updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid device data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('[devices/[deviceId]] Error updating device:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update device',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}