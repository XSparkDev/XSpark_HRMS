import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { employeeService } from "@/lib/services"
import { getRequestUser } from "@/lib/auth/request-user"

const EmployeeIdSchema = z.string().uuid()

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Admin / Super Admin only (per requirement)
    const allowedRoles = ["admin", "super_admin"]
    if (!allowedRoles.includes(user.role.toLowerCase())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const { id } = await context.params
    const employeeId = EmployeeIdSchema.parse(id)

    await employeeService.verifyBank(employeeId)

    return NextResponse.json({ success: true, message: "Employee bank verified" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid employee ID", details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to verify bank details" },
      { status: 500 },
    )
  }
}

