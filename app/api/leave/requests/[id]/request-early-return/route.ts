import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { leaveManagementService } from "@/lib/services"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getCurrentUser(request)
    if (!user?.employeeId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id } = ParamsSchema.parse(await context.params)
    // Record early return date as today (as requested)
    const today = new Date().toISOString().slice(0, 10)

    // Only the employee who owns the leave can request early return
    const updated = await leaveManagementService.requestEarlyReturn(id, user.employeeId, today)

    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to request early return" },
      { status: 500 },
    )
  }
}

