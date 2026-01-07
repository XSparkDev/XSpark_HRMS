import 'dotenv/config'
import { bookingsService } from '@/lib/services/bookings-service'

async function main() {
  try {
    const booking = await bookingsService.createBooking({
      room_id: '0f783024-091e-4dc1-a097-167fc34dd7f2',
      booked_by: '7bca7b2d-d395-4321-80af-1afac4a9a476',
      booking_reason: 'Strategy sync',
      start_time: new Date('2025-12-10T10:00:00Z').toISOString(),
      end_time: new Date('2025-12-10T11:00:00Z').toISOString(),
      status: 'Pending',
      meeting_category: 'Internal',
    })
    console.log('Booking created:', booking)
  } catch (error) {
    console.error('Create booking failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
  }
}

main()
