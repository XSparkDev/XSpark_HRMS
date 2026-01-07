"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { supervisorDashboardService, type BorrowRequest, type ReturnRequest } from "@/lib/services/supervisor-dashboard-service"
import { Loader2, MoreVertical, ArrowLeft, ClipboardList } from "lucide-react"

type OperationType = "borrow" | "return"

type ManagementRow = {
  id: string
  employeeId: string
  employeeName: string
  deviceType: string
  deviceName: string
  borrowDate: string
  operation: OperationType
  status: string
  rawBorrow?: BorrowRequest
  rawReturn?: ReturnRequest
}

// Get device status badge color
const getDeviceStatusBadgeColor = (status: string) => {
  const statusLower = status.toLowerCase().trim()
  
  if (statusLower === "pending borrow" || statusLower === "pending") {
    return "#2563EB" // Pending Borrow
  }
  if (statusLower === "borrowed") {
    return "#92278F" // Borrowed (brand purple)
  }
  if (statusLower === "returned") {
    return "#16A34A" // Returned
  }
  if (statusLower === "awaiting review") {
    return "#6B7280" // Awaiting Review (incidents)
  }
  if (statusLower === "reported") {
    return "#DC2626" // Reported (incidents)
  }
  if (statusLower === "awaiting return") {
    return "#BE1E2D" // Awaiting Return (overdue, brand red)
  }
  
  return undefined
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.split("T")[0] ?? value
  }
  return parsed.toLocaleDateString()
}

export default function DeviceManagementHistoryPage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const [rows, setRows] = useState<ManagementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<ManagementRow | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isSupervisor = (user?.role ?? "").toString().toLowerCase() === "supervisor"

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [borrowRequests, returnRequests] = await Promise.all([
        supervisorDashboardService.getPendingBorrowRequests(),
        supervisorDashboardService.getPendingReturnRequests(),
      ])

      const borrowRows: ManagementRow[] = borrowRequests.map((request) => ({
        id: request.id,
        employeeId: request.employee_id,
        employeeName: request.employee_name || "Employee",
        deviceType: request.device_name,
        deviceName: request.device_name,
        borrowDate: request.borrow_date,
        operation: "borrow",
        status: request.status,
        rawBorrow: request,
      }))

      const returnRows: ManagementRow[] = returnRequests.map((request) => ({
        id: request.id,
        employeeId: request.employee_id,
        employeeName: request.employee_name || "Employee",
        deviceType: request.device_name,
        deviceName: request.device_name,
        borrowDate: request.return_date,
        operation: "return",
        status: request.status,
        rawReturn: request,
      }))

      const combined = [...borrowRows, ...returnRows].sort(
        (a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime(),
      )

      setRows(combined)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to load device management history.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isSupervisor) {
      setLoading(false)
      return
    }
    loadRows()
  }, [isSupervisor, loadRows])

  const handleViewDetails = (row: ManagementRow) => {
    setSelectedRow(row)
    setDetailsOpen(true)
  }

  const handleAction = async (row: ManagementRow, action: "approve" | "decline") => {
    setActionLoading(`${row.id}-${action}`)
    try {
      if (row.operation === "borrow") {
        if (action === "approve") {
          await supervisorDashboardService.approveBorrowRequest(row.id)
        } else {
          await supervisorDashboardService.rejectBorrowRequest(row.id)
        }
      } else {
        if (action === "approve") {
          await supervisorDashboardService.approveReturnRequest(row.id)
        } else {
          await supervisorDashboardService.rejectReturnRequest(row.id)
        }
      }
      toast({
        title: action === "approve" ? "Request approved" : "Request declined",
        description: `${row.deviceName} for ${row.employeeName}`,
      })
      await loadRows()
    } catch (err) {
      toast({
        variant: "destructive",
        title: action === "approve" ? "Approval failed" : "Decline failed",
        description: err instanceof Error ? err.message : "Unexpected error occurred.",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const content = useMemo(() => {
    if (!isSupervisor) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-destructive">Only supervisors can view the device management history.</p>
          <Link href="/ams-devices">
            <Button variant="outline" className="mt-4">
              Back to Device Management
            </Button>
          </Link>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted/50 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#92278F]" />
          <p className="text-sm text-muted-foreground">Loading device management history…</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button variant="outline" onClick={loadRows}>
            Retry
          </Button>
        </div>
      )
    }

    if (rows.length === 0) {
      return (
        <div className="rounded-lg border border-muted/40 bg-muted/10 px-4 py-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No device management activity found.</p>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader className="bg-slate-100/50">
            <TableRow>
              <TableHead className="px-4 py-3">Employee ID</TableHead>
              <TableHead className="px-4 py-3">Device Type</TableHead>
              <TableHead className="px-4 py-3">Device Name</TableHead>
              <TableHead className="px-4 py-3">Borrow Date</TableHead>
              <TableHead className="px-4 py-3">Operation</TableHead>
              <TableHead className="px-4 py-3">Status</TableHead>
              <TableHead className="px-4 py-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const statusColor = getDeviceStatusBadgeColor(row.status)
              return (
                <TableRow key={`${row.operation}-${row.id}`} className="border-b border-slate-200">
                  <TableCell className="px-4 py-3 font-mono text-sm">{row.employeeId || "—"}</TableCell>
                  <TableCell className="px-4 py-3 capitalize">{row.deviceType || "Device"}</TableCell>
                  <TableCell className="px-4 py-3 font-medium text-[#25294B]">{row.deviceName || "—"}</TableCell>
                  <TableCell className="px-4 py-3">{formatDate(row.borrowDate)}</TableCell>
                  <TableCell className="px-4 py-3">{row.operation === "borrow" ? "Borrow Request" : "Return Request"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge 
                      variant="outline" 
                      className={!statusColor ? "bg-slate-100 text-slate-700 border-slate-200" : undefined}
                      style={statusColor ? { backgroundColor: statusColor, color: "white", borderColor: statusColor } : undefined}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Row actions"
                          className="hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#92278F]/30"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.preventDefault()
                            handleViewDetails(row)
                          }}
                          className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.preventDefault()
                            handleAction(row, "approve")
                          }}
                          disabled={actionLoading !== null}
                          className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          {actionLoading === `${row.id}-approve` ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Approving…
                            </span>
                          ) : (
                            "Approve Request"
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.preventDefault()
                            handleAction(row, "decline")
                          }}
                          disabled={actionLoading !== null}
                          className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 disabled:cursor-not-allowed disabled:text-[#BE1E2D]/40"
                        >
                          {actionLoading === `${row.id}-decline` ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Declining…
                            </span>
                          ) : (
                            "Decline Request"
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }, [actionLoading, error, isSupervisor, loadRows, loading, rows])

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/ams-devices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Device Management
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-navy">Device Management History</h1>
          <p className="text-muted-foreground mt-1">
            Review organisation-wide borrow and return activity, and approve or decline outstanding requests.
          </p>
        </div>

        {content}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>Full context for this device action.</DialogDescription>
          </DialogHeader>
          {selectedRow ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employee</span>
                <span className="font-medium text-[#25294B]">
                  {selectedRow.employeeName} ({selectedRow.employeeId})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Device</span>
                <span className="font-medium text-[#25294B]">{selectedRow.deviceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Device Type</span>
                <span className="font-medium text-[#25294B]">{selectedRow.deviceType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Borrow Date</span>
                <span className="font-medium text-[#25294B]">{formatDate(selectedRow.borrowDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Operation</span>
                <span className="font-medium text-[#25294B]">
                  {selectedRow.operation === "borrow" ? "Borrow Request" : "Return Request"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="text-xs uppercase tracking-wide">
                  {selectedRow.status}
                </Badge>
              </div>
              {selectedRow.rawBorrow?.purpose ? (
                <div>
                  <span className="text-muted-foreground block mb-1">Purpose</span>
                  <p className="text-sm">{selectedRow.rawBorrow.purpose}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a record to view more details.</p>
          )}
        </DialogContent>
      </Dialog>
    </AMSDashboardLayout>
  )
}



