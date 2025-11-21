import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getRequestUser } from "@/lib/auth/request-user"
import { notes2Service, type Notes2Record } from "@/lib/services/notes2-service"
import { supabaseAdmin } from "@/lib/supabase-admin"

// All non-employee roles can create public notes
const PUBLIC_NOTE_ROLES = new Set(["admin", "super_admin", "junior_hr", "hr_manager", "hr_admin", "manager", "supervisor"])
// All non-employee roles can create notes for specific employees
const CAN_CREATE_FOR_EMPLOYEE_ROLES = new Set(["admin", "super_admin", "junior_hr", "hr_manager", "hr_admin", "manager", "supervisor"])

const createNoteSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  content: z.string().min(1, "Content is required").max(2000, "Note is too long"),
  alert_level: z.enum(["high", "medium", "low"]).default("low"),
  visibility: z.enum(["private", "public"]).optional().default("private"),
  target_employee_id: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get employee ID from employee record (all roles have employee records)
    // user.id is auth_user_id, user.employeeId should be the employee UUID (not employee_id string)
    let employeeId = user.employeeId
    
    // Validate UUID format - if employeeId is not a valid UUID (e.g., "XSP25/11/005"), fetch from DB
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValidUuid = employeeId && uuidRegex.test(employeeId)
    
    // If employeeId not in headers or not a valid UUID, fetch it from database using auth_user_id
    if (!employeeId || !isValidUuid) {
      console.log("[Notes2 API][GET] employeeId invalid or missing, fetching from DB. employeeId:", employeeId)
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      
      if (empError) {
        console.error("[Notes2 API][GET] Error fetching employee:", empError)
        return NextResponse.json({ 
          success: false, 
          error: "Employee record not found",
          details: empError.message 
        }, { status: 404 })
      }
      
      if (!employee) {
        console.error("[Notes2 API][GET] No employee record found for auth_user_id:", user.id)
        return NextResponse.json({ success: false, error: "Employee record not found" }, { status: 404 })
      }
      employeeId = employee.id
      console.log("[Notes2 API][GET] Found employee UUID:", employeeId)
    }

    const scope = new URL(request.url).searchParams.get("scope") || "personal"
    if (scope === "public") {
      const notes = await notes2Service.getPublicNotes()
      return NextResponse.json({ success: true, data: notes })
    }
    
    if (scope === "for_you") {
      // For employees: show notes sent to them (target_employee_id = their employee UUID)
      // For non-employees: show notes they sent to specific employees (employee_id = their auth_user_id AND target_employee_id IS NOT NULL)
      const isEmployee = user.role.toLowerCase() === "employee"
      let notes: Notes2Record[]
      
      if (isEmployee) {
        // Employees see notes sent to them
        notes = await notes2Service.getNotesForEmployee(employeeId)
      } else {
        // Non-employees see notes they sent to specific employees
        notes = await notes2Service.getNotesSentToEmployees(user.id)
      }
      
      return NextResponse.json({ success: true, data: notes })
    }

    const notes = await notes2Service.getNotesByEmployee(employeeId)
    return NextResponse.json({ success: true, data: notes })
  } catch (error) {
    console.error("Notes2 GET error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to load notes"
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("[Notes2 API][POST] incoming body", body)
    console.log("[Notes2 API][POST] user from headers:", { id: user.id, employeeId: user.employeeId, role: user.role })
    const payload = createNoteSchema.parse(body)
    
    // Get employee ID from employee record (all roles have employee records)
    // user.id is auth_user_id, user.employeeId should be the employee UUID (not employee_id string like "XSP25/11/005")
    let employeeId = user.employeeId
    
    // Validate UUID format - if employeeId is not a valid UUID (e.g., "XSP25/11/005"), fetch from DB
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValidUuid = employeeId && uuidRegex.test(employeeId)
    
    // If employeeId not in headers or not a valid UUID, fetch it from database using auth_user_id
    if (!employeeId || !isValidUuid) {
      console.log("[Notes2 API][POST] employeeId invalid or missing, fetching from DB. employeeId:", employeeId)
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      
      if (empError) {
        console.error("[Notes2 API][POST] Error fetching employee:", empError)
        return NextResponse.json({ 
          success: false, 
          error: "Employee record not found",
          details: empError.message 
        }, { status: 404 })
      }
      
      if (!employee) {
        console.error("[Notes2 API][POST] No employee record found for auth_user_id:", user.id)
        return NextResponse.json({ success: false, error: "Employee record not found" }, { status: 404 })
      }
      employeeId = employee.id
      console.log("[Notes2 API][POST] Found employee UUID:", employeeId)
    }
    
    // Normalize role for comparison (handle case sensitivity and variations)
    const normalizedRole = user.role.toLowerCase().trim()
    console.log("[Notes2 API][POST] normalized role:", normalizedRole, "original:", user.role)
    
    // Permission checks only apply to public notes and notes for specific employees
    // All roles (including employees) can create personal/private notes
    const isPersonalNote = !payload.target_employee_id && (payload.visibility === "private" || !payload.visibility)
    const isPublicNote = payload.visibility === "public"
    const isForSpecificEmployee = !!payload.target_employee_id
    
    console.log("[Notes2 API][POST] note type check:", { isPersonalNote, isPublicNote, isForSpecificEmployee })
    
    // Check permissions only for non-personal notes
    if (!isPersonalNote) {
      const canCreatePublic = PUBLIC_NOTE_ROLES.has(normalizedRole)
      const canCreateForEmployee = CAN_CREATE_FOR_EMPLOYEE_ROLES.has(normalizedRole)
      
      console.log("[Notes2 API][POST] permission check:", { canCreatePublic, canCreateForEmployee, role: normalizedRole })
      
      if (isPublicNote && !canCreatePublic) {
        return NextResponse.json(
          { 
            success: false, 
            error: "You do not have permission to create public notes.",
            details: `Your role "${user.role}" (normalized: "${normalizedRole}") does not have permission. Allowed roles: ${Array.from(PUBLIC_NOTE_ROLES).join(", ")}`
          },
          { status: 403 },
        )
      }

      // Only non-employee roles can create notes for specific employees
      if (isForSpecificEmployee && !canCreateForEmployee) {
        return NextResponse.json(
          { 
            success: false, 
            error: "You do not have permission to create notes for other employees.",
            details: `Your role "${user.role}" (normalized: "${normalizedRole}") does not have permission. Allowed roles: ${Array.from(CAN_CREATE_FOR_EMPLOYEE_ROLES).join(", ")}`
          },
          { status: 403 },
        )
      }
    }

    // Cannot create a note for yourself with target_employee_id
    // Compare target_employee_id (employee UUID) with employeeId (also employee UUID from employees table)
    if (payload.target_employee_id === employeeId) {
      return NextResponse.json(
        { success: false, error: "Cannot create a 'for you' note for yourself." },
        { status: 400 },
      )
    }

    // Notes with target_employee_id must always be private (only visible to that employee)
    const finalVisibility = payload.target_employee_id ? "private" : (payload.visibility ?? "private")

    // IMPORTANT: employee_id must be auth_user_id (from users table), NOT employee UUID from employees table
    // The foreign key constraint notes2_employee_id_fkey references users table, not employees table
    // For target_employee_id, we use employee UUID from employees table (this FK references employees table)
    const noteInput = {
      employee_id: user.id, // Use auth_user_id (from users table) - this is what works for personal/public notes
      target_employee_id: payload.target_employee_id ?? null, // Use employee UUID from employees table
      title: payload.title ?? null,
      content: payload.content,
      alert_level: payload.alert_level,
      visibility: finalVisibility,
    }
    console.log("[Notes2 API][POST] create payload", noteInput)
    const note = await notes2Service.createNote(noteInput)
    console.log("[Notes2 API][POST] created note", note)

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 },
      )
    }
    console.error("Notes2 POST error:", error)
    return NextResponse.json({ success: false, error: "Failed to create note" }, { status: 500 })
  }
}

