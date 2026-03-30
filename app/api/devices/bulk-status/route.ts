import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { devicesService } from '@/lib/services'

const BulkStatusUpdateSchema = z.object({
  status: z.enum(['available', 'assigned', 'borrowed', 'maintenance', 'retired', 'lost']),
  clearAssignments: z.boolean().optional().default(false), // Clear assigned_to when setting to available
  updateAll: z.boolean().optional().default(true), // Update all devices regardless of current status
})

// PATCH /api/devices/bulk-status - Update all devices to a specific status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { status, clearAssignments, updateAll } = BulkStatusUpdateSchema.parse(body)

    const updatedCount = await devicesService.bulkUpdateAllDevicesStatus(status, {
      clearAssignments: clearAssignments || status === 'available', // Auto-clear assignments when setting to available
      updateAll: updateAll, // Update all devices regardless of current status
    })

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} devices to status: ${status}`,
      data: {
        status,
        updatedCount,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value', details: error.errors },
        { status: 400 },
      )
    }

    console.error('[devices] PATCH /api/devices/bulk-status failed', error)
    const message = error instanceof Error ? error.message : 'Failed to update device statuses'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
