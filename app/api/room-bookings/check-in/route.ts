import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { bookingsService } from "@/lib/services"

const bodySchema = z.object({
  booking_id: z.string().min(1, "booking_id is required"),
})

export async function POST(request: NextRequest) {
  try {
    const payload = bodySchema.parse(await request.json())

    const booking = await bookingsService.checkInBooking(payload.booking_id)

    return NextResponse.json({
      success: true,
      data: booking,
      message: "Booking marked as checked-in.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid check-in payload",
          details: error.errors,
        },
        { status: 400 },
      )
    }

    console.error("[room-bookings] POST /check-in failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check in booking",
      },
      { status: 500 },
    )
  }
}


