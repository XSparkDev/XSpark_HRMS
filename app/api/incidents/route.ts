import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { incidentsService } from '@/lib/services'
import { incidentCreateSchema, incidentListSchema } from './validators'

const respondWithError = (message: string, status = 500, details?: unknown) =>
  NextResponse.json({ success: false, error: message, details }, { status })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = incidentListSchema.parse({
      deviceId: searchParams.get('deviceId') ?? undefined,
      reportedBy: searchParams.get('reportedBy') ?? undefined,
      resolvedBy: searchParams.get('resolvedBy') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      severity: searchParams.get('severity') ?? undefined,
      incidentType: searchParams.get('incidentType') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      fromDate: searchParams.get('fromDate') ?? undefined,
      toDate: searchParams.get('toDate') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    const { data, count } = await incidentsService.listIncidents(filters)

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count,
        limit: filters.limit ?? null,
        offset: filters.offset ?? null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondWithError('Invalid query parameters', 400, error.errors)
    }
    console.error('[incidents] GET failed', error)
    return respondWithError('Failed to fetch incidents')
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = incidentCreateSchema.parse(await request.json())
    const incident = await incidentsService.createIncident(payload)

    return NextResponse.json(
      {
        success: true,
        data: incident,
        message: 'Incident reported successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondWithError('Invalid incident payload', 400, error.errors)
    }
    const message = error instanceof Error ? error.message : 'Failed to create incident'
    console.error('[incidents] POST failed', error)
    return respondWithError(message)
  }
}


