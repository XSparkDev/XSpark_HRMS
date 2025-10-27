import { bookingsService } from '@/lib/services'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await bookingsService.getById(params.id)
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(booking)
  } catch (error: any) {
    console.error('Error in GET /api/bookings/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking' },
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
    const booking = await bookingsService.update(params.id, updates)
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(booking)
  } catch (error: any) {
    console.error('Error in PATCH /api/bookings/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update booking' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await bookingsService.delete(params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/bookings/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete booking' },
      { status: 500 }
    )
  }
}

