import { NextRequest, NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { notificationService } from "@/lib/services/notification-service"

const extractBearerToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization")
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request)
    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const senderAuthUser = authData.user

    // Resolve the sender employee UUID + display info
    const { data: senderEmployee, error: senderEmployeeError } = await supabaseAdmin
      .from("employees")
      .select("id, first_name, last_name, employee_id")
      .eq("auth_user_id", senderAuthUser.id)
      .maybeSingle()

    if (senderEmployeeError) {
      return NextResponse.json(
        { success: false, error: senderEmployeeError.message || "Failed to resolve employee" },
        { status: 500 },
      )
    }

    if (!senderEmployee) {
      return NextResponse.json({ success: false, error: "Employee record not found" }, { status: 404 })
    }

    const senderFullName = [senderEmployee.first_name, senderEmployee.last_name].filter(Boolean).join(" ").trim()
    const senderCode = senderEmployee.employee_id || senderEmployee.id

    // Find recipient roles (admin + super_admin) and their employees
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select("id, role_name")
      .in("role_name", ["admin", "super_admin"])

    if (rolesError) {
      return NextResponse.json({ success: false, error: rolesError.message || "Failed to fetch roles" }, { status: 500 })
    }

    const roleIds = (roles ?? []).map((r: any) => r.id).filter(Boolean)
    if (roleIds.length === 0) {
      return NextResponse.json({ success: false, error: "No admin roles found" }, { status: 404 })
    }

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .in("role_id", roleIds)
      // Keep recipient selection aligned to the spec: role-based only.

    if (recipientsError) {
      return NextResponse.json(
        { success: false, error: recipientsError.message || "Failed to fetch admin recipients" },
        { status: 500 },
      )
    }

    const recipientIds = (recipients ?? []).map((r: any) => r.id).filter(Boolean)
    if (recipientIds.length === 0) {
      return NextResponse.json({ success: false, error: "No admin recipients found" }, { status: 404 })
    }

    const message = `Employee ${senderFullName} (ID: ${senderCode}) has requested account verification. Please review and verify their ID, bank, and work permit details.`

    await Promise.all(
      recipientIds.map(async (recipientId: string) => {
        await notificationService.createNotification(
          {
            employee_id: recipientId,
            title: "Verification Request",
            message,
            notification_type: "internal",
            is_confidential: false,
            published_by: senderEmployee.id,
            is_read: false,
            email_sent: false,
          },
          {
            sendEmail: false,
            preventDuplicates: true,
            duplicateWindowMinutes: 1440, // 24 hours
          },
        )
      }),
    )

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error("[verification-request] failed:", err)
    const message = err instanceof Error ? err.message : "Failed to request verification"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

