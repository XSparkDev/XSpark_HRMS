"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Filter, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import * as Tooltip from "@radix-ui/react-tooltip"
import { getCurrentUser, type User } from "@/lib/auth"

type AuditLogEntry = {
  id: string
  employee_name: string | null
  employee_number: string | null
  created_at: string
  action: string
  target_table: string | null
  description: string | null
  published_by_system: boolean
  severity: "high" | "medium" | "low" | "critical" | string | null
}

export default function AuditLogsPage() {
  console.log("[AuditPage] component rendering")
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<"all" | "created" | "updated" | "deleted" | "approved" | "rejected" | "archived" | "restored">("all")
  const [targetFilter, setTargetFilter] = useState<"all" | "employees" | "documents">("all")
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const limit = 20
  const user = getCurrentUser()

  const buildApiHeaders = (user: User | null) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (user?.id) headers["x-user-id"] = user.id
    if (user?.role) headers["x-user-role"] = user.role
    if (user?.employeeId) headers["x-employee-id"] = user.employeeId
    else if (user?.id) headers["x-employee-id"] = user.id

    try {
      const storedSession = localStorage.getItem("xspark_session")
      if (storedSession) {
        const sessionParsed = JSON.parse(storedSession)
        if (sessionParsed?.access_token) {
          headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
          console.log("[AuditPage] token:", String(sessionParsed.access_token).slice(0, 20))
        }
      }
    } catch (error) {
      console.warn("[AuditPage] Failed to read xspark_session token:", error)
    }

    return headers
  }

  useEffect(() => {
    console.log("[AuditPage] useEffect fired")
    const fetchLogs = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("page", page.toString())
        params.set("limit", limit.toString())
        if (search.trim()) params.set("search", search.trim())
        if (actionFilter !== "all") params.set("action", actionFilter)
        if (targetFilter !== "all") params.set("target_table", targetFilter)

        const res = await fetch(`/api/audit-logs?${params.toString()}`, {
          headers: buildApiHeaders(user),
        })
        console.log("[AuditLogs] response status:", res.status)
        if (!res.ok) {
          const err = await res.json()
          console.error("[AuditLogs] error:", err)
          setLogs([])
          setCount(0)
          return
        }
        const json = await res.json()
        console.log("[AuditLogs] data:", json)
        setLogs((json.data ?? []) as AuditLogEntry[])
        setCount(typeof json.count === "number" ? json.count : 0)
      } catch (err) {
        console.error("[AuditLogs] fetch failed:", err)
      } finally {
        setIsLoading(false)
      }
    }
    void fetchLogs()
  }, [page, search, actionFilter, targetFilter, user?.id, user?.role, user?.employeeId])

  const filteredLogs = logs

  const formatTimestamp = (iso: string) => {
    try {
      return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
    } catch {
      return iso
    }
  }

  const deriveSeverity = (log: AuditLogEntry): "high" | "medium" | "low" | null => {
    const s = (log.severity ?? "").toString().toLowerCase()
    if (!s) return null
    if (s === "critical") return "high"
    if (s === "high" || s === "medium" || s === "low") return s as any
    return null
  }

  const severityDotClass = (severity: "high" | "medium" | "low" | null) => {
    switch (severity) {
      case "high":
        return "bg-red-500"
      case "medium":
        return "bg-amber-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-muted-foreground"
    }
  }

  const getActionBadgeClasses = (action: string) => {
    switch (action) {
      case "created":
      case "approved":
        return "bg-green-500 text-white"
      case "updated":
        return "bg-blue-500 text-white"
      case "deleted":
      case "rejected":
        return "bg-red-500 text-white"
      case "archived":
        return "bg-muted text-muted-foreground"
      case "restored":
        return "bg-purple-500 text-white"
      default:
        return "bg-muted text-foreground"
    }
  }

  const formatTarget = (target: string | null) => {
    if (!target) return "—"
    if (target === "documents") return "Document"
    if (target === "employees") return "Employee Profile"
    return target.charAt(0).toUpperCase() + target.slice(1)
  }

  const pageFrom = count === 0 ? 0 : (page - 1) * limit + 1
  const pageTo = Math.min(page * limit, count)
  const canPrev = page > 1
  const canNext = page * limit < count

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy">Audit Logs</h1>
            <p className="text-muted-foreground mt-2">
              Review security‑sensitive actions and system changes across employees, leave, documents and more.
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-navy flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription>Search and narrow down audit events by employee, action, or target.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <Input
                placeholder="Search by employee name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Action</label>
              <Select
                value={actionFilter}
                onValueChange={(val) => setActionFilter(val as typeof actionFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="restored">Restored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Target</label>
              <Select
                value={targetFilter}
                onValueChange={(val) => setTargetFilter(val as typeof targetFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All targets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All targets</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="employees">Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 flex items-end justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  setSearch("")
                  setActionFilter("all")
                  setTargetFilter("all")
                  setPage(1)
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-navy">Recent activity</CardTitle>
            <CardDescription>
              Showing {pageFrom.toString()}–{pageTo.toString()} of {count.toString()} events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading audit logs…</p>
            ) : filteredLogs.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">No audit events found.</p>
                <p className="text-xs text-muted-foreground">
                  Once users start updating profiles, managing leave, and accessing documents, you&apos;ll see a full
                  history of actions here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 sticky top-0 z-10 bg-white">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Created At</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Target</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      (() => {
                        const sev = deriveSeverity(log)
                        const hasEmployeeName = Boolean(log.employee_name && log.employee_name.trim().length > 0)
                        const effectiveEmployeeName = hasEmployeeName
                          ? (log.employee_name as string)
                          : log.published_by_system
                            ? "System"
                            : "Unknown"
                        const description = log.description || ""
                        const truncated = description.length > 80 ? `${description.slice(0, 80)}…` : description
                        const rowSeverityBorder =
                          sev === "high"
                            ? "border-l-2 border-l-red-400"
                            : sev === "medium"
                              ? "border-l-2 border-l-yellow-400"
                              : sev === "low"
                                ? "border-l-2 border-l-green-400"
                                : "border-l-2 border-l-transparent"
                        return (
                      <tr
                        key={log.id}
                        className={cn("border-b last:border-0 hover:bg-muted/40 transition-colors", rowSeverityBorder)}
                      >
                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            <span className="font-medium inline-flex items-center gap-2">
                              {!hasEmployeeName && log.published_by_system && <Bot className="h-4 w-4 text-muted-foreground" />}
                              {effectiveEmployeeName}
                            </span>
                            {log.employee_number && (
                              <span className="text-xs text-muted-foreground">
                                {log.employee_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="py-2 px-3">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className={cn("inline-block h-2 w-2 rounded-full", severityDotClass(sev))}
                              aria-label={`Severity ${sev ?? "unknown"}`}
                              title={`Severity: ${sev ?? "unknown"}`}
                            />
                            <Badge
                              variant="secondary"
                              className={cn("text-xs", getActionBadgeClasses(log.action))}
                            >
                              {log.action.toUpperCase()}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-sm text-foreground">
                            {formatTarget(log.target_table)}
                          </span>
                        </td>
                        <td className="py-2 px-3 max-w-xs">
                          {description ? (
                            <Tooltip.Provider>
                              <Tooltip.Root delayDuration={200}>
                                <Tooltip.Trigger asChild>
                                  <p className="text-sm text-muted-foreground cursor-default line-clamp-2">
                                    {truncated}
                                  </p>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content
                                    side="top"
                                    align="start"
                                    className="z-50 max-w-md rounded-md border bg-background px-3 py-2 text-xs text-foreground shadow-md"
                                  >
                                    {description}
                                    <Tooltip.Arrow className="fill-border" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </td>
                      </tr>
                        )
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && count > 0 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {pageFrom.toString()}–{pageTo.toString()} of {count.toString()} events
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!canPrev}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!canNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

