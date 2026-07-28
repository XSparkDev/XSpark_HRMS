import { NextRequest, NextResponse } from "next/server"

import { getRequestUser } from "@/lib/auth/request-user"
import { notes2Service } from "@/lib/services/notes2-service"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get employee ID (UUID) from employee record
    let employeeId = user.employeeId

    // Validate UUID format - if employeeId is not a valid UUID, fetch from DB
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let isValidUuid = Boolean(employeeId && uuidRegex.test(employeeId))

    // If employeeId not in headers or not a valid UUID, fetch it from database using auth_user_id
    if (!employeeId || !isValidUuid) {
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (empError || !employee) {
        console.error("[Notes2 high-alert API][GET] Error fetching employee:", empError)
        // Continue without employee ID - will only get public notes
      } else {
        employeeId = employee.id
        isValidUuid = true
      }
    }

    // Fetch personal high alerts, public high alerts, and high alerts sent to the employee
    const [personal, shared, forEmployee] = await Promise.all([
      notes2Service.getHighAlertNotesByEmployee(user.id),
      notes2Service.getHighAlertPublicNotes(),
      // If we have an employee ID, also fetch high alerts sent to this employee
      employeeId && isValidUuid
        ? notes2Service.getHighAlertNotesForEmployee(employeeId).catch(() => [])
        : Promise.resolve([]),
    ])

    const combined = [
      ...personal,
      ...shared.filter((note) => note.employee_id !== user.id),
      ...forEmployee,
    ]

    // Deduplicate by note id
    const uniqueNotes = combined.filter((note, index, self) =>
      index === self.findIndex((n) => n.id === note.id)
    )

    return NextResponse.json({ success: true, data: uniqueNotes })
  } catch (error) {
    console.error("Notes2 high-alert GET error:", error)
    return NextResponse.json({ success: false, error: "Failed to load high alert notes" }, { status: 500 })
  }
}

