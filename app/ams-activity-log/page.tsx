"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Activity, 
  ArrowLeft, 
  RefreshCw, 
  Loader2, 
  Search,
  Filter,
  Calendar,
  User,
  Database,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

interface AuditLogEntry {
  id: string
  employee_name?: string | null
  employee_number?: string | null
  action: string
  action_type?: string | null
  severity?: string | null
  target_table?: string | null
  target_record_id?: string | null
  created_at: string
  title: string
  description?: string | null
}

export default function ActivityLogPage() {
  const router = useRouter()
  const user = getCurrentUser()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState<string>("")
  const limit = 50

  const fetchLogs = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    setLoading(true)
    setError(null)
    try {
      const offset = (pageNum - 1) * limit
      const response = await fetch(`/api/audit-logs?limit=${limit}&offset=${offset}`, {
        cache: "no-store",
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to fetch audit logs")
      }

      const newLogs = Array.isArray(json.data) ? json.data : []
      if (append) {
        setLogs((prev) => [...prev, ...newLogs])
      } else {
        setLogs(newLogs)
      }

      setHasMore(newLogs.length === limit)
    } catch (err) {
      console.error("Failed to fetch audit logs", err)
      setError(err instanceof Error ? err.message : "Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(1, false)
  }, [fetchLogs])

  const getActionIcon = (actionType: string | null | undefined) => {
    const type = (actionType || "").toLowerCase()
    if (type.includes("create") || type.includes("add")) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (type.includes("update") || type.includes("edit") || type.includes("modify")) return <Info className="h-4 w-4 text-blue-600" />
    if (type.includes("delete") || type.includes("remove")) return <XCircle className="h-4 w-4 text-red-600" />
    if (type.includes("borrow") || type.includes("assign")) return <Database className="h-4 w-4 text-purple-600" />
    if (type.includes("return") || type.includes("release")) return <CheckCircle className="h-4 w-4 text-green-600" />
    return <AlertCircle className="h-4 w-4 text-gray-600" />
  }

  const getSeverityColor = (severity: string | null | undefined) => {
    const sev = (severity || "low").toLowerCase()
    if (sev === "high" || sev === "critical") return "destructive"
    if (sev === "medium" || sev === "warning") return "default"
    return "secondary"
  }

  const formatTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_table?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = !filterAction || log.action_type?.toLowerCase() === filterAction.toLowerCase()

    return matchesSearch && matchesFilter
  })

  const uniqueActionTypes = Array.from(new Set(logs.map((log) => log.action_type).filter(Boolean))) as string[]

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="hover:bg-[#92278F]/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-[#25294B]">Activity / Audit Log</h1>
                <p className="text-muted-foreground mt-2">
                  View system activity history and audit trail
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchLogs(1, false)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#25294B]">
              <Activity className="h-5 w-5 text-[#92278F]" />
              Audit Log Entries
            </CardTitle>
            <CardDescription className="text-[#58595B]">
              System activities including device actions, borrows, returns, updates, and more
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action, user, description, or table..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {uniqueActionTypes.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Actions</option>
                    {uniqueActionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Logs List */}
            {loading && logs.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-[#808285]/20 bg-white/80 p-4 animate-pulse"
                  >
                    <div className="h-10 w-10 rounded bg-[#808285]/20" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-[#808285]/20" />
                      <div className="h-3 w-1/2 rounded bg-[#808285]/20" />
                    </div>
                    <div className="h-6 w-20 rounded bg-[#808285]/20" />
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filterAction ? "No logs match your filters." : "No audit log entries found."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 rounded-lg border border-[#808285]/20 bg-white/80 p-4 transition-colors hover:bg-gradient-to-r hover:from-[#92278F]/5 hover:to-[#BE1E2D]/5"
                    >
                      <div className="mt-1">{getActionIcon(log.action_type)}</div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#25294B]">{log.title}</p>
                            {log.description && (
                              <p className="text-xs text-[#6B6E8A] mt-1">{log.description}</p>
                            )}
                          </div>
                          <Badge variant={getSeverityColor(log.severity) as any} className="text-xs whitespace-nowrap">
                            {log.severity || "low"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B6E8A]">
                          {log.employee_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{log.employee_name}</span>
                              {log.employee_number && (
                                <span className="text-muted-foreground">({log.employee_number})</span>
                              )}
                            </div>
                          )}
                          {log.target_table && (
                            <div className="flex items-center gap-1">
                              <Database className="h-3 w-3" />
                              <span>{log.target_table}</span>
                              {log.target_record_id && (
                                <span className="text-muted-foreground">· {log.target_record_id.slice(0, 8)}...</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatTimestamp(log.created_at)}</span>
                          </div>
                        </div>

                        {log.action && log.action !== log.action_type && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              Action: {log.action}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && !searchTerm && !filterAction && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const nextPage = page + 1
                        setPage(nextPage)
                        fetchLogs(nextPage, true)
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}


