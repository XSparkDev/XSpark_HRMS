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

    // Get employee ID from employee record (all roles have employee records)
    let employeeId = user.employeeId
    
    // Comprehensive logging: capture what was provided on the request
    console.log("[Notes2][Scheduled][API] ===== REQUEST START =====")
    console.log("[Notes2][Scheduled][API] Incoming identifiers:", {
      headerEmployeeId: request.headers.get("x-employee-id"),
      userEmployeeId: user.employeeId,
      authUserId: user.id,
      userRole: user.role,
      timestamp: new Date().toISOString(),
    })
    
    // Validate UUID format - if employeeId is not a valid UUID (e.g., "XSP25/11/005"), fetch from DB
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValidUuid = employeeId && uuidRegex.test(employeeId)
    
    console.log("[Notes2][Scheduled][API] UUID validation:", {
      employeeId,
      isValidUuid,
      needsDbLookup: !employeeId || !isValidUuid,
    })
    
    // If employeeId not in headers or not a valid UUID, fetch it from database using auth_user_id
    if (!employeeId || !isValidUuid) {
      console.log("[Notes2][Scheduled][API] Fetching employee UUID from database...")
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id, auth_user_id')
        .eq('auth_user_id', user.id)
        .single()
      
      if (empError || !employee) {
        console.error("[Notes2][Scheduled][API] Employee lookup failed:", {
          error: empError,
          authUserId: user.id,
        })
        return NextResponse.json({ 
          success: false, 
          error: "Employee record not found" 
        }, { status: 404 })
      }
      
      employeeId = employee.id
      console.log("[Notes2][Scheduled][API] Employee UUID fetched from DB:", {
        employeeId,
        authUserId: employee.auth_user_id,
      })
    }

    // Log final resolved identifiers
    console.log("[Notes2][Scheduled][API] Resolved identifiers (final):", {
      employeeId: employeeId,
      employeeIdType: typeof employeeId,
      employeeIdLength: employeeId?.length,
      authUserId: user.id,
      authUserIdType: typeof user.id,
    })

    // Get scheduled notes for dashboard (reminder within 3 days)
    console.log("[Notes2][Scheduled][API] Calling getScheduledNotesForDashboard with employeeId:", employeeId)
    const notes = await notes2Service.getScheduledNotesForDashboard(employeeId, user.id)
    
    console.log("[Notes2][Scheduled][API] Service returned notes:", {
      count: notes?.length ?? 0,
      noteIds: notes?.map(n => n.id) ?? [],
      reminderDates: notes?.map(n => ({ id: n.id, reminder_at: n.reminder_at })) ?? [],
    })
    console.log("[Notes2][Scheduled][API] ===== REQUEST END =====")
    
    return NextResponse.json({ success: true, data: notes })
  } catch (error) {
    console.error("[Notes2][Scheduled][API] ERROR:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    })
    const errorMessage = error instanceof Error ? error.message : "Failed to load scheduled notes"
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}

