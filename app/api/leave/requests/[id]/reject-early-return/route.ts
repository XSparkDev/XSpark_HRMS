import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { leaveManagementService, notificationService } from "@/lib/services"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getCurrentUser(request)
    if (!user?.employeeId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const role = (user.role || "").toLowerCase()
    if (!["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const { id } = ParamsSchema.parse(await context.params)

    const updated = await leaveManagementService.rejectEarlyReturn(id, user.employeeId)

    // Notify employee (best-effort)
    try {
      await notificationService.createNotification(
        {
          employee_id: updated.employee_id,
          title: "Early return rejected",
          message: "Your early return from leave has been rejected.",
          notification_type: "internal",
          published_by: user.employeeId,
          is_confidential: false,
        },
        { sendEmail: false, preventDuplicates: true },
      )
    } catch (notifyErr) {
      console.warn("[reject-early-return] Failed to send notification:", notifyErr)
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reject early return" },
      { status: 500 },
    )
  }
}

