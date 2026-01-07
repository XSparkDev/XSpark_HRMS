import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { devicesService } from '@/lib/services'

const bodySchema = z.object({
  ids: z.array(z.string().min(1, 'device id is required')).min(1, 'Provide at least one device id'),
})

export async function POST(request: NextRequest) {
  try {
    const payload = bodySchema.parse(await request.json())
    const devices = await devicesService.getDevicesByIds(payload.ids)

    return NextResponse.json({
      success: true,
      data: devices,
      meta: {
        count: devices.length,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid device ids payload', details: error.errors },
        { status: 400 },
      )
    }

    console.error('[devices] POST /api/devices/bulk failed', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch devices' }, { status: 500 })
  }
}



