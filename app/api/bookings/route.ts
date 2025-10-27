import { bookingsService } from '@/lib/services'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const filters = {
      resource_id: searchParams.get('resource_id') || undefined,
      booked_by: searchParams.get('booked_by') || undefined,
      status: searchParams.get('status') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    }

    const bookings = await bookingsService.getAll(filters)
    return NextResponse.json(bookings)
  } catch (error: any) {
    console.error('Error in GET /api/bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const booking = await bookingsService.create(data)
    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}

