import { NextRequest, NextResponse } from 'next/server'
import { devicesService } from '@/lib/services/devices-service'

/**
 * GET /api/devices/[deviceId]/history
 * 
 * Get combined history of borrows and incidents for a specific device
 * 
 * @param deviceId - Device identifier (device_id, id, asset_tag, or serial_number)
 * 
 * @returns Combined history object with borrows and incidents
 * 
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "borrows": [...],
 *     "incidents": [...],
 *     "total": 10
 *   }
 * }
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const params = await context.params
    const { deviceId } = params
    
    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      )
    }

    const history = await devicesService.getDeviceHistory(deviceId)

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('[devices/history] GET error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch device history'
    
    // Check for specific error types
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
