"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { borrowService, type BorrowRecord } from "@/lib/services/borrow-service"
import { employeeService, type Employee } from "@/lib/services/employee-service"
import { incidentsService, type IncidentRecord } from "@/lib/services/incidents-service"
import { devicesService, type DeviceRecord } from "@/lib/services/devices-service"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  Loader2,
  MoreVertical,
  ArrowLeft,
  ClipboardList,
  Search,
  CheckCircle2,
  XCircle,
  PackageCheck,
  PackageX,
  Calendar,
  UserCheck,
  Mail,
  AlertTriangle,
  Trash2,
  Eye,
  RefreshCw,
  Clock,
} from "lucide-react"
import { DeleteHistoryConfirmationModal } from "@/components/delete-history-confirmation-modal"
import { ApproveBorrowModal } from "@/components/approve-borrow-modal"

type ManagementHistoryRecord = {
  id: string // borrow_id or incident_id
  record_type: "Borrow" | "Return" | "Incident"
  device_id: string
  device_name: string
  device_type: string
  asset_tag: string | null
  booked_by_uuid: string // borrowed_by or reported_by
  booked_by_first_name: string
  booked_by_last_name: string
  booked_by_full_name: string
  booked_by_employee_id: string
  booked_by_email: string | null
  date: string | null // borrow_date or incident created_at
  return_date: string | null // expected_return_date for borrows, null for incidents
  actual_return_date: string | null // For returns
  status: string // Combined status for display
  approval_status?: "Pending" | "Approved" | "Rejected" // For borrows/returns
  // Display-oriented status derived from authoritative `borrows.borrow_status`
  borrow_status?: "Pending Borrow" | "Borrowed" | "Awaiting Return" | "Returned" | "Rejected" | "Overdue" // For borrows
  incident_type?: string // For incidents
  incident_severity?: string | null | undefined // For incidents
  approved_by_name: string | null
  condition_on_return: string | null
  notes: string | null
  description: string | null // For incidents
  created_at: string | null
}

const getApprovalStatusBadgeColor = (status: string) => {
  const statusLower = status.toLowerCase()
  if (statusLower === "pending" || statusLower === "pending_approval") return "#2563EB"
  if (statusLower === "approved") return "#16A34A"
  if (statusLower === "rejected") return "#DC2626"
  return undefined
}

const getBorrowStatusBadgeColor = (status: string) => {
  const statusLower = status.toLowerCase()
  if (statusLower === "borrowed") return "#92278F"
  if (statusLower === "returned") return "#16A34A"
  if (statusLower === "overdue") return "#BE1E2D"
  if (statusLower === "pending borrow") return "#2563EB"
  if (statusLower === "awaiting return") return "#F59E0B"
  if (statusLower === "rejected") return "#DC2626"
  return undefined
}

const getDeviceStatusBadgeColor = (status: string) => {
  const statusLower = (status || "").toLowerCase().replace(/[_\s]/g, "")
  // Green badges for available, pending borrow, pending_borrow, in_maintenance
  if (statusLower === "available") return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" }
  if (statusLower === "pendingborrow" || statusLower === "pending_borrow") return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" }
  if (statusLower === "in_maintenance" || statusLower === "inmaintenance") return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" }
  if (statusLower === "in_use" || statusLower === "inuse") return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" }
  // Default - green styling for all statuses as per the example
  return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" }
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  try {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value.split("T")[0] ?? value
    }
    return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return value.split("T")[0] ?? value
  }
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "—"
  try {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }
    return parsed.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch {
    return value
  }
}

export default function DeviceManagementHistoryPage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const [rows, setRows] = useState<ManagementHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<ManagementHistoryRecord | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [approvalFilter, setApprovalFilter] = useState<string>("all")
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [extendDialogOpen, setExtendDialogOpen] = useState(false)
  const [newReturnDate, setNewReturnDate] = useState("")
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnCondition, setReturnCondition] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<ManagementHistoryRecord | null>(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [recordToApprove, setRecordToApprove] = useState<ManagementHistoryRecord | null>(null)
  
  // Devices table state
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null)
  const [deviceHistoryOpen, setDeviceHistoryOpen] = useState(false)
  const [deviceHistory, setDeviceHistory] = useState<{ borrows: BorrowRecord[]; incidents: IncidentRecord[] } | null>(null)
  const [deviceHistoryLoading, setDeviceHistoryLoading] = useState(false)

  const isSupervisor = (user?.role ?? "").toString().toLowerCase() === "supervisor"
  const currentUserEmployeeId = user?.employeeId || user?.email || ""

  const loadRows = useCallback(async () => {
    console.log('[Management History] loadRows called, isSupervisor:', isSupervisor)
    if (!isSupervisor) {
      console.log('[Management History] User is not a supervisor, skipping load')
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log('[Management History] Starting data fetch...')
      // Fetch ALL borrow records, return records, and incident records for ALL users
      // This is the complete history across all users for supervisor oversight
      
      // Fetch borrows (includes both active and returned)
      const { data: borrowsData, error: borrowsError } = await supabaseAdmin
        .from("borrows")
        .select("*")
        .order("borrow_date", { ascending: false, nullsLast: true })
        .limit(5000)

      if (borrowsError) {
        console.error("[Management History] Error fetching borrows:", borrowsError)
        throw new Error(`Failed to fetch borrow records: ${borrowsError.message}`)
      }

      // Fetch incidents
      let incidents: IncidentRecord[] = []
      try {
        console.log('[Management History] Fetching incidents...')
        const incidentsResult = await incidentsService.listIncidents({})
        incidents = incidentsResult.data || []
        console.log('[Management History] Fetched', incidents.length, 'incidents')
      } catch (incidentsError: any) {
        console.error("[Management History] Error fetching incidents:", incidentsError)
        // Don't throw, just log - we can still show borrows/returns
        incidents = []
      }

      const borrows = (borrowsData || []) as BorrowRecord[]
      
      // Sort in-memory to ensure proper ordering (most recent first)
      // Handle null dates by putting them at the end
      borrows.sort((a, b) => {
        const aDate = a.borrow_date ? new Date(a.borrow_date).getTime() : 0
        const bDate = b.borrow_date ? new Date(b.borrow_date).getTime() : 0
        if (aDate === 0 && bDate === 0) return 0
        if (aDate === 0) return 1 // a has no date, put it after b
        if (bDate === 0) return -1 // b has no date, put it after a
        return bDate - aDate // Most recent first
      })
      
      console.log(`[Management History] Fetched ${borrows.length} total borrow records from all users (all statuses)`)

      // Get unique employee UUIDs and device IDs from both borrows and incidents
      const borrowEmployeeUuids = borrows.map((b) => b.borrowed_by).filter(Boolean)
      const incidentEmployeeUuids = incidents.map((i) => i.reported_by).filter(Boolean)
      const employeeUuids = Array.from(new Set([...borrowEmployeeUuids, ...incidentEmployeeUuids]))
      const approverUuids = Array.from(new Set((borrows as any[]).map((b) => b.approved_by).filter(Boolean)))
      const borrowDeviceIds = borrows.map((b) => b.device_id).filter(Boolean)
      const incidentDeviceIds = incidents.map((i) => i.device_id).filter(Boolean)
      const deviceIds = Array.from(new Set([...borrowDeviceIds, ...incidentDeviceIds]))

      console.log('[Management History] Unique employee UUIDs:', employeeUuids.length, 'Device IDs:', deviceIds.length)

      // Fetch employee data
      const employeesMap = new Map<string, Employee>()
      if (employeeUuids.length > 0) {
        console.log('[Management History] Fetching employee data...')
        const { data: employeesData, error: employeesError } = await supabaseAdmin
          .from("employees")
          .select("id, employee_id, first_name, last_name, preferred_name, email, role_id, job_title_id")
          .in("id", employeeUuids)

        if (!employeesError && employeesData) {
          // Fetch roles and job titles
          const roleIds = Array.from(new Set(employeesData.map((e: any) => e.role_id).filter(Boolean)))
          const jobTitleIds = Array.from(new Set(employeesData.map((e: any) => e.job_title_id).filter(Boolean)))

          let rolesMap = new Map<string, { name: string }>()
          let jobTitlesMap = new Map<string, { title: string }>()

          if (roleIds.length > 0) {
            const { data: rolesData } = await supabaseAdmin.from("roles").select("id, role_name").in("id", roleIds)
            if (rolesData) {
              rolesMap = new Map(rolesData.map((r: any) => [r.id, { name: r.role_name }]))
            }
          }

          if (jobTitleIds.length > 0) {
            const { data: jobTitlesData } = await supabaseAdmin.from("job_titles").select("id, title").in("id", jobTitleIds)
            if (jobTitlesData) {
              jobTitlesMap = new Map(jobTitlesData.map((j: any) => [j.id, { title: j.title }]))
            }
          }

          // Map employees with roles and job titles
          employeesData.forEach((emp: any) => {
            const firstName = emp.preferred_name || emp.first_name || ""
            const lastName = emp.last_name || ""
            const fullName = `${firstName} ${lastName}`.trim() || "Unknown"
            const role = emp.role_id ? rolesMap.get(emp.role_id) : null
            const jobTitle = emp.job_title_id ? jobTitlesMap.get(emp.job_title_id) : null

            employeesMap.set(emp.id, {
              id: emp.id,
              employee_id: emp.employee_id || "",
              first_name: firstName,
              last_name: lastName,
              preferred_name: emp.preferred_name || null,
              email: emp.email || null,
              role_name: role?.name || jobTitle?.title || null,
            } as Partial<Employee> as Employee)
          })
        }
      }

      // Fetch approver names
      const approversMap = new Map<string, { name: string }>()
      if (approverUuids.length > 0) {
        const { data: approversData } = await supabaseAdmin
          .from("employees")
          .select("id, first_name, last_name, preferred_name")
          .in("id", approverUuids)

        if (approversData) {
          approversData.forEach((app: any) => {
            const firstName = app.preferred_name || app.first_name || ""
            const lastName = app.last_name || ""
            approversMap.set(app.id, { name: `${firstName} ${lastName}`.trim() || "Unknown" })
          })
        }
        console.log('[Management History] Loaded', employeesMap.size, 'employees')
      }

      // Fetch device data
      const devicesMap = new Map<string, { name: string; type: string; asset_tag: string | null }>()
      if (deviceIds.length > 0) {
        console.log('[Management History] Fetching device data...')
        const { data: devicesData, error: devicesError } = await supabaseAdmin
          .from("devices")
          .select("device_id, model, brand, device_type, asset_tag")
          .in("device_id", deviceIds)

        if (!devicesError && devicesData) {
          devicesData.forEach((dev: any) => {
            const name = dev.model || dev.brand || dev.device_type || "Device"
            devicesMap.set(dev.device_id, {
              name,
              type: dev.device_type || "Unknown",
              asset_tag: dev.asset_tag || null,
            })
          })
        }
        console.log('[Management History] Loaded', devicesMap.size, 'devices')
      }

      // Build comprehensive records from borrows, returns, and incidents
      console.log('[Management History] Building records...')
      const now = new Date()
      const records: ManagementHistoryRecord[] = []

      // Process borrow records
      borrows.forEach((borrow) => {
        const employee = employeesMap.get(borrow.borrowed_by)
        const device = devicesMap.get(borrow.device_id)
        const approverId = (borrow as any).approved_by
        const approver = approverId ? approversMap.get(approverId) : null

        // Status-first: authoritative field is `borrow.borrow_status`
        const rawBorrowStatus = String((borrow as any).borrow_status || "").toLowerCase().trim()

        // Derive display statuses + approval status for UI filters
        let approvalStatus: "Pending" | "Approved" | "Rejected" = "Pending"
        let borrowStatus: "Pending Borrow" | "Borrowed" | "Awaiting Return" | "Returned" | "Rejected" | "Overdue" =
          "Pending Borrow"

        if (rawBorrowStatus === "pending_borrow") {
          approvalStatus = "Pending"
          borrowStatus = "Pending Borrow"
        } else if (rawBorrowStatus === "rejected") {
          approvalStatus = "Rejected"
          borrowStatus = "Rejected"
        } else if (rawBorrowStatus === "borrowed") {
          approvalStatus = "Approved"
          if (borrow.return_date) {
            const returnDate = new Date(borrow.return_date)
            borrowStatus = returnDate < now ? "Overdue" : "Borrowed"
          } else {
            borrowStatus = "Borrowed"
          }
        } else if (rawBorrowStatus === "pending_return") {
          approvalStatus = "Approved"
          borrowStatus = "Awaiting Return"
        } else if (rawBorrowStatus === "returned") {
          approvalStatus = "Approved"
          borrowStatus = "Returned"
        } else {
          // Legacy fallback if borrow_status isn't populated yet
          const statusLower = String(borrow.status || "").toLowerCase()
          const approvalStatusRaw = String(borrow.approval_status || borrow.status || "").toLowerCase()
          if (approvalStatusRaw.includes("approved")) approvalStatus = "Approved"
          else if (approvalStatusRaw.includes("rejected")) approvalStatus = "Rejected"

          if (borrow.is_returned === true || borrow.returned_at || statusLower === "returned") {
            borrowStatus = "Returned"
          } else if (statusLower.includes("rejected")) {
            borrowStatus = "Rejected"
          } else if (borrow.is_borrowed === true) {
            if (borrow.return_date) {
              const returnDate = new Date(borrow.return_date)
              borrowStatus = returnDate < now ? "Overdue" : "Borrowed"
            } else {
              borrowStatus = "Borrowed"
            }
          } else {
            borrowStatus = "Pending Borrow"
          }
        }

        const employeeFullName = employee
          ? `${employee.preferred_name || employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Unknown Employee"
          : "Unknown Employee"

        records.push({
          id: borrow.borrow_id,
          record_type: borrowStatus === "Returned" ? "Return" : "Borrow",
          device_id: borrow.device_id,
          device_name: device?.name || "Unknown Device",
          device_type: device?.type || "Unknown",
          asset_tag: device?.asset_tag || null,
          booked_by_uuid: borrow.borrowed_by,
          booked_by_first_name: employee?.first_name || "",
          booked_by_last_name: employee?.last_name || "",
          booked_by_full_name: employeeFullName,
          booked_by_employee_id: employee?.employee_id || "",
          booked_by_email: employee?.email || null,
          date: borrow.borrow_date,
          return_date: borrow.return_date,
          actual_return_date: borrow.returned_at || null,
          status: `${borrowStatus}${approvalStatus !== "Pending" ? ` (${approvalStatus})` : ""}`,
          approval_status: approvalStatus,
          borrow_status: borrowStatus,
          approved_by_name: approver?.name || null,
          condition_on_return: null,
          notes: borrow.notes || null,
          description: null,
          created_at: borrow.borrow_date || null,
        })
      })

      // Process incident records
      incidents.forEach((incident) => {
        const employee = employeesMap.get(incident.reported_by)
        const device = devicesMap.get(incident.device_id)

        const employeeFullName = employee
          ? `${employee.preferred_name || employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Unknown Employee"
          : "Unknown Employee"

        records.push({
          id: incident.incident_id,
          record_type: "Incident",
          device_id: incident.device_id,
          device_name: device?.name || "Unknown Device",
          device_type: device?.type || "Unknown",
          asset_tag: device?.asset_tag || null,
          booked_by_uuid: incident.reported_by,
          booked_by_first_name: employee?.first_name || "",
          booked_by_last_name: employee?.last_name || "",
          booked_by_full_name: employeeFullName,
          booked_by_employee_id: employee?.employee_id || "",
          booked_by_email: employee?.email || null,
          date: incident.created_at,
          return_date: null, // Incidents don't have return dates
          actual_return_date: null,
          status: `Incident Reported (${incident.status})`,
          incident_type: incident.incident_type,
          incident_severity: incident.severity || null,
          approved_by_name: null,
          condition_on_return: null,
          notes: null,
          description: incident.description,
          created_at: incident.created_at,
        })
      })

      // Sort all records by date (most recent first)
      records.sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0
        const bDate = b.date ? new Date(b.date).getTime() : 0
        return bDate - aDate
      })

      console.log(`[Management History] Processed ${records.length} records (${borrows.length} borrows, ${incidents.length} incidents)`)
      if (records.length > 0) {
        console.log(`[Management History] Sample records:`, records.slice(0, 3))
      } else {
        console.warn('[Management History] No records found! Borrows:', borrows.length, 'Incidents:', incidents.length)
      }
      
      setRows(records)
      setLoading(false)
      console.log('[Management History] Data loaded successfully, loading set to false')
    } catch (err) {
      console.error("Failed to load device management history:", err)
      setError(err instanceof Error ? err.message : "Failed to load device management history.")
      setLoading(false)
    }
  }, [isSupervisor])

  // Load devices
  const loadDevices = useCallback(async () => {
    if (!isSupervisor) return

    setDevicesLoading(true)
    setDevicesError(null)
    try {
      console.log('[Management History] Fetching devices...')
      const response = await fetch('/api/devices?limit=200&offset=0', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      })
      
      const json = await response.json().catch(() => ({}))
      
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || 'Failed to fetch devices')
      }
      
      setDevices(json.data || [])
      console.log('[Management History] Loaded', json.data?.length || 0, 'devices')
    } catch (err) {
      console.error('[Management History] Failed to load devices:', err)
      setDevicesError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setDevicesLoading(false)
    }
  }, [isSupervisor])

  useEffect(() => {
    console.log('[Management History] useEffect triggered, isSupervisor:', isSupervisor, 'user:', user)
    if (!isSupervisor) {
      console.log('[Management History] User is not a supervisor, setting loading to false')
      setLoading(false)
      setDevicesLoading(false)
      return
    }
    console.log('[Management History] Calling loadRows and loadDevices...')
    loadRows().catch((err) => {
      console.error('[Management History] loadRows failed in useEffect:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setLoading(false)
    })
    loadDevices()
  }, [isSupervisor, loadRows, loadDevices])

  const filteredRows = useMemo(() => {
    console.log('[Management History] filteredRows useMemo, rows.length:', rows.length, 'searchTerm:', searchTerm, 'statusFilter:', statusFilter, 'approvalFilter:', approvalFilter)
    let filtered = rows

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (row) =>
          row.device_name.toLowerCase().includes(searchLower) ||
          row.booked_by_full_name.toLowerCase().includes(searchLower) ||
          row.booked_by_employee_id.toLowerCase().includes(searchLower) ||
          (row.asset_tag && row.asset_tag.toLowerCase().includes(searchLower)) ||
          (row.device_id && row.device_id.toLowerCase().includes(searchLower)) ||
          (row.status && row.status.toLowerCase().includes(searchLower))
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((row) => {
        if (statusFilter === "active") return row.borrow_status === "Borrowed"
        if (statusFilter === "returned") return row.borrow_status === "Returned" || row.record_type === "Return"
        if (statusFilter === "overdue") return row.borrow_status === "Overdue"
        // Pending includes: pending borrow + awaiting return approval
        if (statusFilter === "pending") return row.borrow_status === "Pending Borrow" || row.borrow_status === "Awaiting Return"
        if (statusFilter === "incident") return row.record_type === "Incident"
        return true
      })
    }

    // Approval filter (only applies to borrows/returns)
    if (approvalFilter !== "all") {
      filtered = filtered.filter((row) => {
        if (row.record_type === "Incident") return true // Incidents aren't filtered by approval
        return row.approval_status?.toLowerCase() === approvalFilter.toLowerCase()
      })
    }

    console.log('[Management History] Filtered rows result:', filtered.length, 'from', rows.length, 'total')
    return filtered
  }, [rows, searchTerm, statusFilter, approvalFilter])

  // Open approve confirmation modal
  const handleApproveClick = (row: ManagementHistoryRecord) => {
    setRecordToApprove(row)
    setApproveModalOpen(true)
  }

  // Actually approve the request after QR scan confirmation
  const handleApproveConfirm = async (borrowId: string) => {
    if (!currentUserEmployeeId || !recordToApprove) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to identify current user. Please refresh the page.",
      })
      return
    }

    setActionLoading(`${borrowId}-approve`)
    try {
      // Get current user's employee UUID
      const { data: currentUserEmployee } = await supabaseAdmin
        .from("employees")
        .select("id")
        .or(`employee_id.eq.${currentUserEmployeeId},email.eq.${currentUserEmployeeId}`)
        .maybeSingle()

      if (!currentUserEmployee?.id) {
        throw new Error("Current user not found in employees table")
      }

      await borrowService.approveBorrowRequest(borrowId, currentUserEmployee.id)
      
      // Update local state instead of reloading from database
      // This preserves history even if borrows table is empty
      setRows((prevRows) =>
        prevRows.map((r) =>
          r.id === borrowId
            ? {
                ...r,
                approval_status: "Approved" as const,
                borrow_status: "Borrowed" as const,
                status: "Borrowed (Approved)",
              }
            : r
        )
      )

      toast({
        title: "Request Approved",
        description: `${recordToApprove.device_name} borrow request approved for ${recordToApprove.booked_by_full_name}`,
      })
      
      setApproveModalOpen(false)
      setRecordToApprove(null)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: err instanceof Error ? err.message : "Failed to approve request",
      })
      throw err // Re-throw so modal can handle error
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (row: ManagementHistoryRecord, reason: string) => {
    if (!currentUserEmployeeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to identify current user. Please refresh the page.",
      })
      return
    }

    setActionLoading(`${row.id}-reject`)
    try {
      const { data: currentUserEmployee } = await supabaseAdmin
        .from("employees")
        .select("id")
        .or(`employee_id.eq.${currentUserEmployeeId},email.eq.${currentUserEmployeeId}`)
        .maybeSingle()

      if (!currentUserEmployee?.id) {
        throw new Error("Current user not found in employees table")
      }

      await borrowService.rejectBorrowRequest(row.id, currentUserEmployee.id, reason)
      
      // Update local state instead of reloading from database
      // This preserves history even if borrows table is empty
      setRows((prevRows) =>
        prevRows.map((r) =>
          r.id === row.id
            ? {
                ...r,
                approval_status: "Rejected" as const,
                status: `${r.borrow_status || "Pending"} (Rejected)`,
                notes: reason ? `${r.notes || ""}\nRejection reason: ${reason}`.trim() : r.notes,
              }
            : r
        )
      )

      toast({
        title: "Request Rejected",
        description: `${row.device_name} borrow request rejected for ${row.booked_by_full_name}`,
      })
      setRejectDialogOpen(false)
      setRejectReason("")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Rejection Failed",
        description: err instanceof Error ? err.message : "Failed to reject request",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkReturned = async (row: ManagementHistoryRecord, condition: string) => {
    setActionLoading(`${row.id}-return`)
    try {
      await borrowService.returnDevice(row.id)
      
      // Update local state instead of reloading from database
      // This preserves history even if borrows table is empty
      const now = new Date().toISOString()
      setRows((prevRows) =>
        prevRows.map((r) =>
          r.id === row.id
            ? {
                ...r,
                borrow_status: "Returned" as const,
                actual_return_date: now,
                condition_on_return: condition || null,
                status: "Returned",
                record_type: "Return" as const,
              }
            : r
        )
      )

      toast({
        title: "Device Marked as Returned",
        description: `${row.device_name} has been marked as returned`,
      })
      setReturnDialogOpen(false)
      setReturnCondition("")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Return Failed",
        description: err instanceof Error ? err.message : "Failed to mark device as returned",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleExtendReturnDate = async (row: ManagementHistoryRecord, newDate: string) => {
    setActionLoading(`${row.id}-extend`)
    try {
      await borrowService.updateBorrow(row.id, { return_date: newDate })
      
      // Update local state instead of reloading from database
      // This preserves history even if borrows table is empty
      setRows((prevRows) =>
        prevRows.map((r) =>
          r.id === row.id
            ? {
                ...r,
                return_date: newDate,
              }
            : r
        )
      )

      toast({
        title: "Return Date Extended",
        description: `Return date extended to ${formatDate(newDate)}`,
      })
      setExtendDialogOpen(false)
      setNewReturnDate("")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Extension Failed",
        description: err instanceof Error ? err.message : "Failed to extend return date",
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Open delete confirmation modal
  const handleDeleteClick = (row: ManagementHistoryRecord) => {
    setRecordToDelete(row)
    setDeleteDialogOpen(true)
  }

  // Actually delete the record after confirmation
  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return

    const row = recordToDelete
    setActionLoading(`${row.id}-delete`)
    try {
      if (row.record_type === "Incident") {
        // Delete incident
        await supabaseAdmin.from("incidents").delete().eq("incident_id", row.id)
      } else {
        await borrowService.deleteBorrow(row.id, { hardDelete: true })
      }
      
      // Remove from local state
      setRows((prevRows) => prevRows.filter((r) => r.id !== row.id))
      
      toast({
        title: "Record Deleted",
        description: `${row.record_type} record has been permanently deleted`,
      })
      
      setDeleteDialogOpen(false)
      setRecordToDelete(null)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Failed to delete record",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleContactUser = (row: ManagementHistoryRecord) => {
    if (row.booked_by_email) {
      const recordType = row.record_type === "Incident" ? "Incident Report" : "Device Borrow Request"
      const subject = encodeURIComponent(`Regarding ${recordType} - ${row.device_name}`)
      const body = encodeURIComponent(`Hello ${row.booked_by_full_name},\n\nRegarding your ${recordType.toLowerCase()} for ${row.device_name}...`)
      window.location.href = `mailto:${row.booked_by_email}?subject=${subject}&body=${body}`
    } else {
      toast({
        variant: "destructive",
        title: "Email Not Available",
        description: "Borrower email address is not available",
      })
    }
  }

  const handleViewDeviceHistory = async (device: DeviceRecord) => {
    setSelectedDevice(device)
    setDeviceHistoryOpen(true)
    setDeviceHistoryLoading(true)
    setDeviceHistory(null)

    try {
      const response = await fetch(`/api/devices/${device.device_id}/history`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || json.success === false) {
        throw new Error(json?.error || 'Failed to fetch device history')
      }

      setDeviceHistory(json.data || { borrows: [], incidents: [] })
    } catch (err) {
      console.error('[Management History] Failed to fetch device history:', err)
      toast({
        variant: "destructive",
        title: "Failed to Load History",
        description: err instanceof Error ? err.message : "Failed to fetch device history",
      })
      setDeviceHistory({ borrows: [], incidents: [] })
    } finally {
      setDeviceHistoryLoading(false)
    }
  }

  console.log('[Management History] Render - isSupervisor:', isSupervisor, 'loading:', loading, 'error:', error, 'rows.length:', rows.length, 'filteredRows.length:', filteredRows.length)
  
  if (!isSupervisor) {
    return (
      <AMSDashboardLayout>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-destructive">Only supervisors can view the device management history.</p>
          <p className="text-xs text-muted-foreground mt-2">Current role: {user?.role || 'Unknown'}</p>
          <Link href="/ams-devices">
            <Button variant="outline" className="mt-4">
              Back to Device Management
            </Button>
          </Link>
        </div>
      </AMSDashboardLayout>
    )
  }

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
            Comprehensive oversight of all devices, borrow requests, approvals, active borrows, and returns across the organization.
          </p>
        </div>

        {/* Devices Table Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[#25294B]">Devices</h2>
            <p className="text-sm text-muted-foreground">All devices in the system with their current status</p>
          </div>

          {devicesLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted/50 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#92278F]" />
              <p className="text-sm text-muted-foreground">Loading devices…</p>
            </div>
          ) : devicesError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
              <p className="text-sm text-destructive mb-3">{devicesError}</p>
              <Button variant="outline" onClick={loadDevices}>
                Retry
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-lg border border-muted/40 bg-muted/10 px-4 py-10 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No devices found.</p>
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader className="bg-[#92278F]/5">
                  <TableRow className="hover:bg-muted/50 border-b">
                    <TableHead className="h-10 px-2 text-left align-middle whitespace-nowrap font-semibold text-[#25294B]">Asset Tag</TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle whitespace-nowrap font-semibold text-[#25294B]">Device Type</TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle whitespace-nowrap font-semibold text-[#25294B]">Brand</TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle whitespace-nowrap font-semibold text-[#25294B]">Model</TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle whitespace-nowrap font-semibold text-[#25294B]">Status</TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle whitespace-nowrap font-semibold text-[#25294B]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => {
                    const statusBadge = getDeviceStatusBadgeColor(device.status || "")
                    const statusText = (device.status || "").replace(/_/g, " ")
                    
                    return (
                      <TableRow key={device.device_id} className="border-b transition-colors hover:bg-[#92278F]/5">
                        <TableCell className="p-2 align-middle whitespace-nowrap font-medium text-[#25294B]">
                          {device.asset_tag || "—"}
                        </TableCell>
                        <TableCell className="p-2 align-middle whitespace-nowrap text-[#58595B]">
                          {device.device_type || "—"}
                        </TableCell>
                        <TableCell className="p-2 align-middle whitespace-nowrap text-[#58595B]">
                          {device.brand || "—"}
                        </TableCell>
                        <TableCell className="p-2 align-middle whitespace-nowrap text-[#58595B]">
                          {device.model || "—"}
                        </TableCell>
                        <TableCell className="p-2 align-middle whitespace-nowrap">
                          <Badge className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                            {statusText || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2 align-middle whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleViewDeviceHistory(device)}
                                className="cursor-pointer"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View History
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
          )}
        </div>

        {/* History Records Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[#25294B]">History Records</h2>
            <p className="text-sm text-muted-foreground">All borrow requests, returns, and incident reports</p>
          </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by device name, employee name, employee ID, or asset tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Approvals</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted/50 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#92278F]" />
            <p className="text-sm text-muted-foreground">Loading device management history…</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" onClick={loadRows}>
              Retry
            </Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-muted/40 bg-muted/10 px-4 py-10 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "all" || approvalFilter !== "all"
                ? "No records match your filters."
                : "No device management activity found."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader className="bg-slate-100/50">
                <TableRow>
                  <TableHead className="px-4 py-3">Device Name</TableHead>
                  <TableHead className="px-4 py-3">Booked By</TableHead>
                  <TableHead className="px-4 py-3">Date</TableHead>
                  <TableHead className="px-4 py-3">Return Date</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const approvalColor = row.approval_status ? getApprovalStatusBadgeColor(row.approval_status) : undefined
                  const borrowColor = row.borrow_status ? getBorrowStatusBadgeColor(row.borrow_status) : undefined
                  const isLoading = actionLoading?.startsWith(row.id)
                  // Status-first actions:
                  // - Approve/Reject only applies to pending borrow requests
                  // - "Mark returned" only applies to pending return approvals
                  const canApprove = row.record_type !== "Incident" && row.borrow_status === "Pending Borrow"
                  const canReject = row.record_type !== "Incident" && row.borrow_status === "Pending Borrow"
                  const canMarkReturned = row.record_type !== "Incident" && row.borrow_status === "Awaiting Return"
                  const canExtend = row.record_type !== "Incident" && (row.borrow_status === "Borrowed" || row.borrow_status === "Overdue")
                  const canDelete = row.record_type === "Incident"
                  const canViewDetails = true // All records can be viewed

                  // Determine badge color based on record type
                  let statusColor = borrowColor || approvalColor
                  if (row.record_type === "Incident") {
                    statusColor = "#BE1E2D" // Red for incidents
                  }

                  return (
                    <TableRow key={`${row.record_type}-${row.id}`} className="border-b border-slate-200">
                      <TableCell className="px-4 py-3 font-medium text-[#25294B]">{row.device_name}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div>
                          <div className="font-medium">{row.booked_by_full_name}</div>
                          <div className="text-xs text-muted-foreground">{row.booked_by_employee_id || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">{formatDate(row.date)}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">{row.return_date ? formatDate(row.return_date) : "—"}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          style={statusColor ? { backgroundColor: statusColor, color: "white", borderColor: statusColor } : undefined}
                          className={!statusColor ? "bg-slate-100 text-slate-700 border-slate-200" : undefined}
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
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {canViewDetails && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRow(row)
                                    setDetailsOpen(true)
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {canApprove && (
                              <DropdownMenuItem
                                onClick={() => handleApproveClick(row)}
                                disabled={isLoading}
                                className="cursor-pointer text-green-600"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve Request
                              </DropdownMenuItem>
                            )}
                            {canReject && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRow(row)
                                  setRejectDialogOpen(true)
                                }}
                                disabled={isLoading}
                                className="cursor-pointer text-red-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject Request
                              </DropdownMenuItem>
                            )}
                            {canMarkReturned && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRow(row)
                                  setReturnDialogOpen(true)
                                }}
                                disabled={isLoading}
                                className="cursor-pointer"
                              >
                                <PackageCheck className="mr-2 h-4 w-4" />
                                Mark as Returned
                              </DropdownMenuItem>
                            )}
                            {canExtend && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRow(row)
                                  setNewReturnDate(row.return_date || "")
                                  setExtendDialogOpen(true)
                                }}
                                disabled={isLoading}
                                className="cursor-pointer"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                Extend Return Date
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleContactUser(row)}
                              disabled={!row.booked_by_email || isLoading}
                              className="cursor-pointer"
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Contact Booker
                            </DropdownMenuItem>
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(row)}
                                  disabled={isLoading}
                                  className="cursor-pointer text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRow?.record_type === "Incident" ? "Incident Details" : "Borrow Record Details"}
            </DialogTitle>
            <DialogDescription>
              Complete information for this {selectedRow?.record_type.toLowerCase() || "record"}
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Device Name</Label>
                  <p className="font-medium">{selectedRow.device_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Device Type</Label>
                  <p className="font-medium">{selectedRow.device_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Asset Tag</Label>
                  <p className="font-medium font-mono">{selectedRow.asset_tag || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Record Type</Label>
                  <p className="font-medium">{selectedRow.record_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Booked By</Label>
                  <p className="font-medium">{selectedRow.booked_by_full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRow.booked_by_employee_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedRow.booked_by_email || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{formatDateTime(selectedRow.date)}</p>
                </div>
                {selectedRow.return_date && (
                  <div>
                    <Label className="text-muted-foreground">Return Date</Label>
                    <p className="font-medium">{formatDateTime(selectedRow.return_date)}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant="outline" className="mt-1">
                    {selectedRow.status}
                  </Badge>
                </div>
                {selectedRow.record_type === "Incident" && (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Incident Type</Label>
                      <p className="font-medium">{selectedRow.incident_type || "—"}</p>
                    </div>
                    {selectedRow.incident_severity && (
                      <div>
                        <Label className="text-muted-foreground">Severity</Label>
                        <p className="font-medium">{selectedRow.incident_severity}</p>
                      </div>
                    )}
                  </>
                )}
                {selectedRow.record_type !== "Incident" && (
                  <>
                    {selectedRow.approval_status && (
                      <div>
                        <Label className="text-muted-foreground">Approval Status</Label>
                        <Badge
                          variant="outline"
                          style={
                            getApprovalStatusBadgeColor(selectedRow.approval_status)
                              ? {
                                  backgroundColor: getApprovalStatusBadgeColor(selectedRow.approval_status),
                                  color: "white",
                                  borderColor: getApprovalStatusBadgeColor(selectedRow.approval_status),
                                }
                              : undefined
                          }
                        >
                          {selectedRow.approval_status}
                        </Badge>
                      </div>
                    )}
                    {selectedRow.borrow_status && (
                      <div>
                        <Label className="text-muted-foreground">Borrow Status</Label>
                        <Badge
                          variant="outline"
                          style={
                            getBorrowStatusBadgeColor(selectedRow.borrow_status)
                              ? {
                                  backgroundColor: getBorrowStatusBadgeColor(selectedRow.borrow_status),
                                  color: "white",
                                  borderColor: getBorrowStatusBadgeColor(selectedRow.borrow_status),
                                }
                              : undefined
                          }
                        >
                          {selectedRow.borrow_status}
                        </Badge>
                      </div>
                    )}
                    {selectedRow.approved_by_name && (
                      <div>
                        <Label className="text-muted-foreground">Approved By</Label>
                        <p className="font-medium">{selectedRow.approved_by_name}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              {selectedRow.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium whitespace-pre-wrap">{selectedRow.description}</p>
                </div>
              )}
              {selectedRow.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="font-medium whitespace-pre-wrap">{selectedRow.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Borrow Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => selectedRow && handleReject(selectedRow, rejectReason)}
              disabled={!rejectReason.trim() || actionLoading !== null}
              variant="destructive"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Return Date Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Return Date</DialogTitle>
            <DialogDescription>Set a new expected return date for this borrow</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-return-date">New Return Date</Label>
              <Input
                id="new-return-date"
                type="date"
                value={newReturnDate ? newReturnDate.split("T")[0] : ""}
                onChange={(e) => setNewReturnDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => selectedRow && handleExtendReturnDate(selectedRow, newReturnDate)}
              disabled={!newReturnDate || actionLoading !== null}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extending...
                </>
              ) : (
                "Extend Date"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Returned Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Device as Returned</DialogTitle>
            <DialogDescription>Record the return and condition of the device</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="return-condition">Condition on Return</Label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                  <SelectItem value="Needs Maintenance">Needs Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => selectedRow && handleMarkReturned(selectedRow, returnCondition)}
              disabled={!returnCondition || actionLoading !== null}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Returning...
                </>
              ) : (
                "Mark as Returned"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device History Dialog */}
      <Dialog open={deviceHistoryOpen} onOpenChange={setDeviceHistoryOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Device History - {selectedDevice?.asset_tag || selectedDevice?.device_id}
            </DialogTitle>
            <DialogDescription>
              Complete history of borrows and incidents for {selectedDevice?.model || selectedDevice?.device_type || 'this device'}
            </DialogDescription>
          </DialogHeader>
          
          {deviceHistoryLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#92278F]" />
              <p className="text-sm text-muted-foreground">Loading device history…</p>
            </div>
          ) : deviceHistory ? (
            <div className="space-y-6">
              {/* Borrows Section */}
              {deviceHistory.borrows.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-[#25294B] mb-3">Borrows ({deviceHistory.borrows.length})</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#92278F]/5">
                          <TableHead className="font-semibold text-[#25294B]">Borrow Date</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Return Date</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Status</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceHistory.borrows.map((borrow) => (
                          <TableRow key={borrow.borrow_id}>
                            <TableCell>{formatDate(borrow.borrow_date)}</TableCell>
                            <TableCell>{formatDate(borrow.return_date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {borrow.status || (borrow.is_borrowed ? "Borrowed" : "Returned")}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{borrow.notes || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Incidents Section */}
              {deviceHistory.incidents.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-[#25294B] mb-3">Incidents ({deviceHistory.incidents.length})</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#92278F]/5">
                          <TableHead className="font-semibold text-[#25294B]">Date</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Type</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Severity</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Status</TableHead>
                          <TableHead className="font-semibold text-[#25294B]">Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceHistory.incidents.map((incident) => (
                          <TableRow key={incident.incident_id}>
                            <TableCell>{formatDate(incident.created_at)}</TableCell>
                            <TableCell>{incident.incident_type}</TableCell>
                            <TableCell>{incident.severity || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {incident.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{incident.description || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {deviceHistory.borrows.length === 0 && deviceHistory.incidents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No history found for this device.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load device history.
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteHistoryConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        recordType={recordToDelete?.record_type || "Borrow"}
        deviceName={recordToDelete?.device_name || ""}
        employeeName={recordToDelete?.booked_by_full_name || ""}
        onConfirm={handleDeleteConfirm}
        isDeleting={actionLoading !== null && actionLoading.includes("-delete")}
      />

      {/* Approve Confirmation Modal */}
      <ApproveBorrowModal
        open={approveModalOpen}
        onOpenChange={setApproveModalOpen}
        request={
          recordToApprove
            ? {
                id: recordToApprove.id,
                deviceId: recordToApprove.device_id,
                deviceName: recordToApprove.device_name,
                assetTag: recordToApprove.asset_tag || "",
                employeeName: recordToApprove.booked_by_full_name,
                employeeId: recordToApprove.booked_by_employee_id,
                borrowDate: recordToApprove.date || "",
                purpose: recordToApprove.notes || undefined,
              }
            : null
        }
        onConfirm={handleApproveConfirm}
      />
    </AMSDashboardLayout>
  )
}
