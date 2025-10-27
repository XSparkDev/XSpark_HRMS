import { resourcesService } from '@/lib/services'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const filters = {
      resource_type: searchParams.get('resource_type') || undefined,
      location: searchParams.get('location') || undefined,
      is_available: searchParams.get('is_available') === 'true' ? true : 
                    searchParams.get('is_available') === 'false' ? false : undefined,
      condition: searchParams.get('condition') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    }

    const resources = await resourcesService.getAll(filters)
    return NextResponse.json(resources)
  } catch (error: any) {
    console.error('Error in GET /api/resources:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch resources' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const resource = await resourcesService.create(data)
    return NextResponse.json(resource, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/resources:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create resource' },
      { status: 500 }
    )
  }
}

