import { NextRequest, NextResponse } from "next/server"
import { authService } from "@/lib/services/auth-service"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { employeeId, entries } = body ?? {}

    const authHeader = request.headers.get("Authorization")
    let currentEmployee: { id: string } | null = null

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7)
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseAnonKey) {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        })

        const { data: { user }, error } = await userClient.auth.getUser(token)
        if (!error && user) {
          const { data } = await userClient
            .from("employees")
            .select("id")
            .eq("auth_user_id", user.id)
            .single()
          if (data) {
            currentEmployee = data
          }
        }
      }
    }

    if (!currentEmployee) {
      const authResponse = await authService.getCurrentUserWithEmployee()
      currentEmployee = authResponse.employee || null
    }

    if (!currentEmployee || !currentEmployee.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    if (!employeeId || employeeId !== currentEmployee.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const trimmedEntries = entries
      .slice(0, 2)
      .map((entry, idx) => {
        const firstName = typeof entry.first_name === "string" ? entry.first_name.trim() : ""
        const lastName = typeof entry.last_name === "string" ? entry.last_name.trim() : ""
        const relationship = typeof entry.relationship === "string" ? entry.relationship.trim() : ""
        const phone = typeof entry.phone === "string" ? entry.phone.trim() : ""
        const existingId = typeof entry.id === "string" ? entry.id : undefined

        if (!firstName || !lastName || !relationship || !phone) {
          return null
        }

        return {
          id: existingId,
          first_name: firstName,
          middle_name: typeof entry.middle_name === "string" ? entry.middle_name.trim() || null : null,
          last_name: lastName,
          email: typeof entry.email === "string" ? entry.email.trim() || null : null,
          phone,
          alternative_phone: typeof entry.alternative_phone === "string" ? entry.alternative_phone.trim() || null : null,
          relationship,
          is_primary: typeof entry.is_primary === "boolean" ? entry.is_primary : idx === 0,
        }
      })
      .filter((item): item is {
        id?: string
        first_name: string
        middle_name: string | null
        last_name: string
        email: string | null
        phone: string
        alternative_phone: string | null
        relationship: string
        is_primary: boolean
      } => item !== null)

    if (!trimmedEntries.length) {
      return NextResponse.json({ success: true, data: [] })
    }

    const { data: existingNok, error: existingError } = await supabaseAdmin
      .from("next_of_kin")
      .select("id, is_primary")
      .eq("employee_id", employeeId)
      .order("is_primary", { ascending: false })
      .limit(2)

    if (existingError) {
      console.error("Next of kin lookup failed:", existingError)
      return NextResponse.json({ success: false, error: "Failed to load existing next of kin" }, { status: 500 })
    }

    const payload = trimmedEntries.map((entry, idx) => ({
      ...entry,
      employee_id: employeeId,
      id: entry.id ?? existingNok?.[idx]?.id ?? undefined,
    }))

    const { data, error: upsertError } = await supabaseAdmin
      .from("next_of_kin")
      .upsert(payload, { onConflict: "id" })
      .select()

    if (upsertError) {
      console.error("Next of kin upsert failed:", upsertError)
      return NextResponse.json({ success: false, error: "Failed to save next of kin" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Next of kin upsert unexpected error:", error)
    return NextResponse.json({ success: false, error: "Failed to upsert next of kin" }, { status: 500 })
  }
}

