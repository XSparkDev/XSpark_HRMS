import { incidentsService } from '@/lib/services'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incident = await incidentsService.getById(params.id)
    
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(incident)
  } catch (error: any) {
    console.error('Error in GET /api/incidents/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch incident' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json()
    const incident = await incidentsService.update(params.id, updates)
    
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(incident)
  } catch (error: any) {
    console.error('Error in PATCH /api/incidents/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update incident' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await incidentsService.delete(params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/incidents/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete incident' },
      { status: 500 }
    )
  }
}

