import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const expiringWithinDays = searchParams.get("expiring_within_days")
    const employeeId = searchParams.get("employee_id")

    let query = supabaseAdmin
      .from("contracts")
      .select("id, employee_id, contract_type, start_date, end_date, status, employees(first_name, last_name, employee_id)")
      .eq("status", "active")
      .order("end_date", { ascending: true })

    if (employeeId) {
      query = query.eq("employee_id", employeeId)
    }

    if (expiringWithinDays) {
      const days = parseInt(expiringWithinDays, 10)
      const today = new Date().toISOString().slice(0, 10)
      const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      query = query.not("end_date", "is", null).gte("end_date", today).lte("end_date", future)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data, meta: { count: data?.length ?? 0 } })
  } catch (error) {
    console.error("Error fetching contracts:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch contracts" }, { status: 500 })
  }
}
