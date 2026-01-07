import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { incidentsService } from '@/lib/services'
import { incidentUpdateSchema } from '../validators'

const respondWithError = (message: string, status = 500, details?: unknown) =>
  NextResponse.json({ success: false, error: message, details }, { status })

export async function GET(_request: NextRequest, { params }: { params: { incidentId: string } }) {
  try {
    const incident = await incidentsService.getIncidentById(params.incidentId)

    if (!incident) {
      return respondWithError('Incident not found', 404)
    }

    return NextResponse.json({
      success: true,
      data: incident,
    })
  } catch (error) {
    console.error('[incidents] GET /:id failed', error)
    return respondWithError('Failed to fetch incident')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { incidentId: string } }) {
  try {
    const updates = incidentUpdateSchema.parse(await request.json())
    const incident = await incidentsService.updateIncident(params.incidentId, updates)

    if (!incident) {
      return respondWithError('Incident not found', 404)
    }

    return NextResponse.json({
      success: true,
      data: incident,
      message: 'Incident updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondWithError('Invalid incident payload', 400, error.errors)
    }
    console.error('[incidents] PATCH /:id failed', error)
    const message = error instanceof Error ? error.message : 'Failed to update incident'
    return respondWithError(message)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { incidentId: string } }) {
  try {
    await incidentsService.deleteIncident(params.incidentId)

    return NextResponse.json({
      success: true,
      message: 'Incident deleted successfully',
    })
  } catch (error) {
    console.error('[incidents] DELETE /:id failed', error)
    return respondWithError('Failed to delete incident')
  }
}








