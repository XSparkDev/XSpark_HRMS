import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

// ============================================================================
// GET /api/visuals/summary - Aggregated company-wide metrics for the admin/
// super_admin "Visuals" dashboard. Single call, grouped server-side to keep
// the client light.
// ============================================================================

const countBy = <T extends Record<string, any>>(rows: T[], key: keyof T, fallback = "unknown") => {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const value = (row[key] ?? fallback) as string
    counts[value] = (counts[value] || 0) + 1
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

export async function GET() {
  try {
    const [
      employeesRes,
      leaveRequestsRes,
      leaveBalancesRes,
      devicesRes,
      bookingsRes,
      maintenanceRes,
      hrTicketsRes,
      contractsRes,
      leaveTypesRes,
      auditLogsRes,
    ] = await Promise.all([
      supabaseAdmin.from("employees").select("id, role_id, employment_status, id_verified, bank_verified, date_hired, roles(role_name)"),
      supabaseAdmin.from("leave_requests").select("id, status, leave_type_id, start_date, end_date, created_at"),
      supabaseAdmin.from("leave_balances").select("leave_type_id, total_accrued, total_used, total_pending"),
      supabaseAdmin.from("devices").select("id, status, device_type"),
      supabaseAdmin.from("bookings").select("booking_id, status, start_time, created_at"),
      supabaseAdmin.from("maintenance_requests").select("id, status, priority, created_at"),
      supabaseAdmin.from("hr_tickets").select("id, status, category, priority, created_at"),
      supabaseAdmin.from("contracts").select("id, status, end_date").eq("status", "active"),
      supabaseAdmin.from("leave_types").select("id, key, display_name"),
      supabaseAdmin.from("audit_logs").select("id, action_type, created_at").order("created_at", { ascending: false }).limit(200),
    ])

    const employees = employeesRes.data ?? []
    const leaveRequests = leaveRequestsRes.data ?? []
    const leaveBalances = leaveBalancesRes.data ?? []
    const devices = devicesRes.data ?? []
    const bookings = bookingsRes.data ?? []
    const maintenance = maintenanceRes.data ?? []
    const hrTickets = hrTicketsRes.data ?? []
    const contracts = contractsRes.data ?? []
    const leaveTypes = leaveTypesRes.data ?? []
    const auditLogs = auditLogsRes.data ?? []

    const leaveTypeMap = new Map(leaveTypes.map((lt: any) => [lt.id, lt.display_name || lt.key]))

    // --- Employees ---
    const employeesByRole = countBy(
      employees.map((e: any) => ({ role_name: e.roles?.role_name || "unassigned" })),
      "role_name",
    )
    const employeesByStatus = countBy(employees, "employment_status")
    const verifiedCount = employees.filter((e: any) => e.id_verified && e.bank_verified).length
    const unverifiedCount = employees.length - verifiedCount

    // Headcount growth: employees by hire month (last 12 months present in data)
    const hireMonthCounts: Record<string, number> = {}
    for (const e of employees as any[]) {
      if (!e.date_hired) continue
      const month = String(e.date_hired).slice(0, 7) // YYYY-MM
      hireMonthCounts[month] = (hireMonthCounts[month] || 0) + 1
    }
    const headcountByMonth = Object.entries(hireMonthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    // --- Leave ---
    const leaveByStatus = countBy(leaveRequests, "status")
    const leaveByType = countBy(
      leaveRequests.map((r: any) => ({ type: leaveTypeMap.get(r.leave_type_id) || "other" })),
      "type",
    )
    const today = new Date().toISOString().slice(0, 10)
    const onLeaveToday = leaveRequests.filter(
      (r: any) => r.status === "approved" && r.start_date <= today && r.end_date >= today,
    ).length

    const leaveUtilization = leaveTypes.map((lt: any) => {
      const balancesForType = leaveBalances.filter((b: any) => b.leave_type_id === lt.id)
      const totalAccrued = balancesForType.reduce((sum: number, b: any) => sum + Number(b.total_accrued || 0), 0)
      const totalUsed = balancesForType.reduce((sum: number, b: any) => sum + Number(b.total_used || 0), 0)
      return { name: lt.display_name || lt.key, accrued: totalAccrued, used: totalUsed }
    })

    // --- Devices ---
    const devicesByStatus = countBy(devices, "status")
    const devicesByType = countBy(devices, "device_type")

    // --- Bookings ---
    const bookingsByStatus = countBy(bookings, "status")
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const bookingsThisWeek = bookings.filter((b: any) => new Date(b.created_at) >= weekAgo).length

    // --- Maintenance ---
    const maintenanceByStatus = countBy(maintenance, "status")
    const maintenanceByPriority = countBy(maintenance, "priority")

    // --- HR Tickets ---
    const ticketsByStatus = countBy(hrTickets, "status")
    const ticketsByCategory = countBy(hrTickets, "category")

    // --- Contracts ---
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const contractsExpiringSoon = contracts.filter((c: any) => c.end_date && c.end_date <= in30Days && c.end_date >= today).length

    // --- Audit activity (last 200 events, bucketed by day) ---
    const activityByDay: Record<string, number> = {}
    for (const log of auditLogs as any[]) {
      const day = String(log.created_at).slice(0, 10)
      activityByDay[day] = (activityByDay[day] || 0) + 1
    }
    const auditActivity = Object.entries(activityByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }))

    return NextResponse.json(
      {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        employees: {
          total: employees.length,
          verified: verifiedCount,
          unverified: unverifiedCount,
          byRole: employeesByRole,
          byStatus: employeesByStatus,
          headcountByMonth,
        },
        leave: {
          total: leaveRequests.length,
          onLeaveToday,
          byStatus: leaveByStatus,
          byType: leaveByType,
          utilization: leaveUtilization,
        },
        devices: {
          total: devices.length,
          byStatus: devicesByStatus,
          byType: devicesByType,
        },
        bookings: {
          total: bookings.length,
          thisWeek: bookingsThisWeek,
          byStatus: bookingsByStatus,
        },
        maintenance: {
          total: maintenance.length,
          byStatus: maintenanceByStatus,
          byPriority: maintenanceByPriority,
        },
        hrTickets: {
          total: hrTickets.length,
          byStatus: ticketsByStatus,
          byCategory: ticketsByCategory,
        },
        contracts: {
          active: contracts.length,
          expiringSoon: contractsExpiringSoon,
        },
        auditActivity,
      },
      },
      // This aggregates ~10 tables; not something we want re-computed on every
      // dashboard render. 30s cache with a 2min stale-while-revalidate window
      // keeps it feeling live without hammering the DB on every nav.
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } }
    )
  } catch (error) {
    console.error("Error building visuals summary:", error)
    return NextResponse.json({ success: false, error: "Failed to load visuals summary" }, { status: 500 })
  }
}
