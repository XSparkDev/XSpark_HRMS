// ============================================================================
// AUDIT LOGS API ROUTE - Read-only access for Super Admins
// ============================================================================
// Auth pattern copied from /api/employees GET handler
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/request-user'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// GET /api/audit-logs - Get audit log entries with optional filtering
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    console.log(
      "[AuditLogs] incoming headers:",
      Object.fromEntries(request.headers.entries()),
    )

    // Try custom headers first (for notes API consistency)
    let user = getRequestUser(request)
    
    // Fallback to Bearer token authentication (like /api/auth/me)
    if (!user) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const supabaseUrl = process.env.SUPABASE_URL!
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        })

        const { data: { user: authUser }, error } = await userClient.auth.getUser(token)
        if (!error && authUser) {
          // Get employee record to get employee ID and role
          const { data: employee } = await supabaseAdmin
            .from('employees')
            .select('id, role_id, roles(role_name)')
            .eq('auth_user_id', authUser.id)
            .single()
          
          if (employee) {
            const roleName = (employee.roles as any)?.role_name?.toLowerCase?.() || 'employee'
            user = {
              id: authUser.id,
              employeeId: employee.id,
              role: roleName
            }
          }
        }
      }
    }
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Only super admin can access audit logs
    if (user.role.toLowerCase() !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only Super Admin can access audit logs'
      }, { status: 403 })
    }

    console.log("[AuditLogs] user from auth:", JSON.stringify(user))
    console.log("[AuditLogs] Authenticated as:", user.role, user.employeeId)

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1)
    const limit = Math.max(parseInt(searchParams.get("limit") || "20", 10), 1)
    const search = searchParams.get("search")?.trim() || ""
    const action = searchParams.get("action")?.trim() || ""
    const targetTable = searchParams.get("target_table")?.trim() || ""
    console.log("[AuditLogs] Querying with:", { page, limit, search, action, targetTable })
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: schemaTest } = await supabaseAdmin
      .from("audit_logs")
      .select("id")
      .limit(1)
    console.log("[AuditLogs] public schema test:", schemaTest)

    const { data: appSchemaTest } = await supabaseAdmin
      .schema("app")
      .from("audit_logs")
      .select("id")
      .limit(1)
    console.log("[AuditLogs] app schema test:", appSchemaTest)

    const selectFields =
      "id, employee_name, employee_number, action, action_type, severity, target_table, description, created_at, published_by_system"

    // Prefer app schema if available; fall back to public.
    let query = supabaseAdmin
      .schema("app")
      .from("audit_logs")
      .select(selectFields, { count: "exact" })
      .order("created_at", { ascending: false })

    if (search) query = query.ilike("employee_name", `%${search}%`)
    if (action) query = query.eq("action", action)
    if (targetTable) query = query.eq("target_table", targetTable)

    let { data, error, count } = await query.range(from, to)

    if (error) {
      console.warn("[AuditLogs] app schema query failed, falling back to public:", error)
      let publicQuery = supabaseAdmin
        .from("audit_logs")
        .select(selectFields, { count: "exact" })
        .order("created_at", { ascending: false })
      if (search) publicQuery = publicQuery.ilike("employee_name", `%${search}%`)
      if (action) publicQuery = publicQuery.eq("action", action)
      if (targetTable) publicQuery = publicQuery.eq("target_table", targetTable)
      ;({ data, error, count } = await publicQuery.range(from, to))
    }

    if (error) {
      console.error("[AuditLogs] DB error:", error)
      return NextResponse.json({ message: "Failed to load audit logs" }, { status: 500 })
    }

    return NextResponse.json({
      data: data ?? [],
      count: count ?? 0,
      page,
    })
  } catch (error) {
    console.error("[AuditLogs] Unexpected error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

