import { NextRequest, NextResponse } from 'next/server'
import { devicesService } from '@/lib/services'
import { z } from 'zod'

// Validation schema for assigned devices query
const AssignedDevicesQuerySchema = z.object({
  employee_id: z.string().uuid('employee_id must be a valid UUID'),
})

/**
 * GET /api/devices/assigned?employee_id={uuid}
 * 
 * Returns devices assigned to a specific employee.
 * 
 * This endpoint:
 * - Filters devices where assigned_to = employee_id
 * - Excludes devices where assigned_to IS NULL
 * - Orders by updated_at DESC (most recently updated first)
 * - Returns only essential fields: asset_tag, device_type, brand, model, status, condition, location
 * - Uses indexed assigned_to column for performance
 * 
 * Query Parameters:
 * - employee_id (required): UUID of the employee
 * 
 * Response:
 * - success: boolean
 * - data: Array of device records
 * - meta: { count: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'employee_id query parameter is required' },
        { status: 400 }
      )
    }

    // Validate employee_id is a valid UUID
    const validation = AssignedDevicesQuerySchema.safeParse({ employee_id: employeeId })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid employee_id format', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Fetch devices assigned to this employee
    // The listDevices method filters by assigned_to and excludes NULL values
    const { data: devices, count } = await devicesService.listDevices({
      assigned_to: employeeId, // Filter by employee UUID
      limit: 1000, // Get all assigned devices (reasonable limit)
      offset: 0,
    })

    // Filter out any devices where assigned_to is NULL (safety check)
    // This should not happen if the service filters correctly, but adding as a safeguard
    const assignedDevices = devices.filter((device) => device.assigned_to === employeeId)

    // Select only the required fields for display
    // Fields: asset_tag, device_type, brand, model, status, condition, location
    const filteredDevices = assignedDevices.map((device) => ({
      device_id: device.device_id,
      asset_tag: device.asset_tag,
      device_type: device.device_type,
      brand: device.brand,
      model: device.model,
      status: device.status,
      condition: device.condition,
      location: device.location,
      updated_at: device.updated_at, // For ordering
    }))

    // Sort by updated_at DESC (most recently updated first)
    filteredDevices.sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return dateB - dateA // DESC order
    })

    return NextResponse.json(
      {
        success: true,
        data: filteredDevices,
        meta: {
          count: filteredDevices.length,
          employee_id: employeeId,
        },
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
    console.error('[devices/assigned] Error fetching assigned devices:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch assigned devices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

