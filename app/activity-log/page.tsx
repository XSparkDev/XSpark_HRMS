"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"

type AuditLogEntry = {
  id: string
  employee_name: string | null
  employee_number: string | null
  action: string | null
  action_type: string | null
  severity: string | null
  target_table: string | null
  target_record_id: string | null
  created_at: string
  title: string
  description: string
}

export default function ActivityLogPage() {
  const router = useRouter()
  const user = getCurrentUser()

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Basic guard: if no user, redirect to login/system-selector
    if (!user) {
      router.replace("/login")
      return
    }
  }, [user, router])

  useEffect(() => {
    let cancelled = false

    const fetchLogs = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/audit-logs?limit=100&offset=0", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        const json = await response.json().catch(() => ({}))

        if (!response.ok || json.success === false) {
          throw new Error(json?.error || "Failed to load activity log")
        }

        if (!cancelled) {
          setLogs(Array.isArray(json.data) ? json.data : [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity log")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchLogs()
    return () => {
      cancelled = true
    }
  }, [])

  const formatWhen = (value: string) => {
    if (!value) return "—"
    const d = new Date(value)
    return d.toLocaleString()
  }

  const severityColor = (severity?: string | null) => {
    const s = (severity || "").toLowerCase()
    if (s === "critical") return "#BE1E2D"
    if (s === "high") return "#F59E0B"
    return "#16A34A"
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#25294B]">Activity & Audit Log</h1>
            <p className="text-muted-foreground mt-2">
              View a history of important actions across devices, resources, and employee records.
            </p>
          </div>
          <Button asChild variant="outline" className="border-[#92278F] text-[#92278F] hover:bg-[#92278F]/10">
            <Link href="/settings">Back to Settings</Link>
          </Button>
        </div>

        <Card className="border border-[#808285]/20 bg-white/90">
          <CardHeader>
            <CardTitle className="text-[#25294B]">Recent Activity</CardTitle>
            <CardDescription className="text-[#58595B]">
              Showing the latest actions from the audit log. Use this to trace changes, approvals, and device activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading activity log…</p>
            ) : error ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // simple reload
                    router.refresh()
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity has been recorded yet.</p>
            ) : (
              <div className="rounded-md border border-[#E4E4E7] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#F9FAFB]">
                    <TableRow>
                      <TableHead className="w-[180px] text-[#4B5563]">When</TableHead>
                      <TableHead className="w-[140px] text-[#4B5563]">User</TableHead>
                      <TableHead className="w-[140px] text-[#4B5563]">Action</TableHead>
                      <TableHead className="w-[160px] text-[#4B5563]">Target</TableHead>
                      <TableHead className="w-[110px] text-[#4B5563] text-center">Severity</TableHead>
                      <TableHead className="text-[#4B5563]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const color = severityColor(log.severity)
                      const actor =
                        log.employee_name ||
                        log.employee_number ||
                        "System"
                      const target =
                        log.target_table && log.target_record_id
                          ? `${log.target_table} · ${log.target_record_id}`
                          : log.target_table || "—"

                      const actionLabel =
                        log.action_type ||
                        (log.action || "")
                          .toString()
                          .replace(/_/g, " ")
                          .toLowerCase()

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-[#4B5563] whitespace-nowrap">
                            {formatWhen(log.created_at)}
                          </TableCell>
                          <TableCell className="text-xs text-[#111827]">
                            {actor}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-[#111827]">
                            {actionLabel || "Activity"}
                          </TableCell>
                          <TableCell className="text-xs text-[#4B5563]">
                            {target}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 font-medium"
                              style={{
                                color,
                                borderColor: color + "40",
                                backgroundColor: color + "15",
                              }}
                            >
                              {(log.severity || "low").toString().toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-[#4B5563]">
                            {log.description}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}



