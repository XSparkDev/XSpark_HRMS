import { incidentsService } from '@/lib/services'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const filters = {
      resource_id: searchParams.get('resource_id') || undefined,
      reported_by: searchParams.get('reported_by') || undefined,
      incident_type: searchParams.get('incident_type') || undefined,
      severity: searchParams.get('severity') || undefined,
      status: searchParams.get('status') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    }

    const incidents = await incidentsService.getAll(filters)
    return NextResponse.json(incidents)
  } catch (error: any) {
    console.error('Error in GET /api/incidents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch incidents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const incident = await incidentsService.create(data)
    return NextResponse.json(incident, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/incidents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create incident' },
      { status: 500 }
    )
  }
}

