import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { devicesService } from '@/lib/services'

const paramsSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
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
  context: { params: { deviceId: string } | Promise<{ deviceId: string }> }
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



