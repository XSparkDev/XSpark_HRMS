"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getCurrentUser } from "@/lib/auth"
import Link from "next/link"
import {
  Package,
  Camera,
  Sparkles,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Headphones,
  UserPlus,
  QrCode,
  Calendar,
  Building2,
  MoreVertical,
  AlertTriangle,
  Search,
  Filter,
  Pencil,
  RotateCcw,
  Trash2,
  Repeat,
  ChevronDown,
  Plus,
  ClipboardList,
} from "lucide-react"
import { QRScanner } from "@/components/qr-scanner"
import { CollectScanDeviceModal } from "@/components/collect-scan-device-modal"
import { DeviceConditionCheckModal } from "@/components/device-condition-check-modal"
import { useCallback, useEffect, useMemo, useState, ChangeEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { DEVICE_HISTORY_UPDATED_EVENT } from "@/lib/storage/device-history"
import { BUSINESS_START_TIME, BUSINESS_END_TIME, timeStringToMinutes, isWithinBusinessHours as isBusinessTime, BUSINESS_TIME_PATTERN } from "@/lib/utils/business-hours"
import { employeeService, type Employee } from "@/lib/services/employee-service"

type InventoryDevice = {
  id: string
  asset_tag?: string | null
  serial_number?: string | null
  device_type?: string | null
  brand?: string | null
  model?: string | null
  status?: string | null
  condition?: string | null
  location?: string | null
  notes?: string | null
}

type DeviceActionType = "Borrow" | "Return" | "Incident"
type DeviceHistoryStatus = "Pending" | "Borrowed" | "Awaiting Return" | "Awaiting Review" | "Returned" | "Attended"

type DeviceHistoryRow = {
  recordId: string
  deviceId: string
  deviceRecordId?: string | null
  deviceName: string
  deviceType: string
  borrowDate: string
  expectedReturnDate?: string
  returnDate?: string
  status: DeviceHistoryStatus
  action: DeviceActionType
  notes?: string
  returnCondition?: string
  returnImage?: string | null
  supervisorName?: string
  supervisorNotes?: string
  isReturnPending?: boolean
  borrowerId?: string | null
}

type BorrowReceipt = {
  deviceName: string
  deviceType: string
  deviceId: string
  borrowDate: string
  expectedReturnDate?: string
  status: DeviceHistoryStatus
}

type ReturnReceipt = {
  deviceName: string
  deviceType: string
  deviceId: string
  returnDate: string
  status: DeviceHistoryStatus
  condition?: string
  image?: string | null
  supervisorName?: string
  supervisorNotes?: string
}

const MAX_BORROW_DURATION_DAYS = 30
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const toTitleCase = (value?: string | null): string => {
  if (!value) return "Unknown"
  return value
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    const datePart = value.split("T")[0]
    return datePart || value
  }
  return parsed.toLocaleDateString()
}

const toDateInputValue = (value?: string | null) => {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    const datePart = value.split("T")[0]
    return datePart || ""
  }
  return parsed.toISOString().split("T")[0]
}

const formatDeviceStatusLabel = (status?: string | null, context?: { isReturnPending?: boolean }) => {
  if (!status) return "Status unknown"
  if (context?.isReturnPending) return "Awaiting Return"
  return status.toLowerCase().includes("pending") ? "Pending Borrow" : toTitleCase(status)
}

// Get status badge color for device borrowing statuses
const getDeviceStatusBadgeColor = (status: string) => {
  const statusLower = status.toLowerCase().trim()
  
  if (statusLower === "pending borrow" || statusLower.includes("pending")) {
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
  if (statusLower === "awaiting return" || statusLower.includes("awaiting return")) {
    return "#BE1E2D" // Awaiting Return (overdue, brand red)
  }
  if (statusLower === "attended") {
    return "#16A34A" // Attended (brand success green)
  }
  
  return undefined
}

const allowedStatuses: DeviceHistoryStatus[] = ["Pending", "Borrowed", "Awaiting Return", "Awaiting Review", "Returned", "Attended"]
const editableStatusSet = new Set(["pending", "awaiting review"])

type AssignedDeviceRecord = {
  id: string
  status: string | null
  assignment_type?: string | null
  assigned_date?: string | null
  expected_return_date?: string | null
  actual_return_date?: string | null
  assignment_notes?: string | null
  device?: {
    id: string
    asset_tag?: string | null
    serial_number?: string | null
    device_type?: string | null
    brand?: string | null
    model?: string | null
    status?: string | null
    condition?: string | null
    location?: string | null
    notes?: string | null
    updated_at?: string | null
  } | null
}

const assignedDeviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  desktop: Monitor,
  monitor: Monitor,
  phone: Smartphone,
  tablet: Tablet,
  mobile: Smartphone,
  accessories: Headphones,
  headset: Headphones,
}

const assignmentStatusClasses: Record<string, string> = {
  active: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30",
  approved: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30",
  borrowed: "bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30",
  awaiting_return: "bg-[#BE1E2D]/10 text-[#BE1E2D] border-[#BE1E2D]/30",
  overdue: "bg-[#BE1E2D]/10 text-[#BE1E2D] border-[#BE1E2D]/30",
  pending: "bg-[#808285]/10 text-[#808285] border-[#808285]/30",
  returned: "bg-[#808285]/10 text-[#808285] border-[#808285]/30",
  cancelled: "bg-[#808285]/10 text-[#808285] border-[#808285]/30",
  rejected: "bg-[#808285]/10 text-[#808285] border-[#808285]/30",
}

const normalizeHistoryEntry = (entry: any): DeviceHistoryRow => {
  const deriveSupervisorName = (source: any) =>
    source?.supervisorName ??
    source?.supervisor_name ??
    source?.supervisor ??
    source?.approvedBy ??
    undefined

  const deriveSupervisorNotes = (source: any) =>
    source?.supervisorNotes ??
    source?.supervisor_notes ??
    source?.returnNotes ??
    source?.approvalNotes ??
    undefined

  const deriveReturnCondition = (source: any) =>
    source?.returnCondition ?? source?.return_condition ?? source?.condition ?? undefined

  const deriveReturnImage = (source: any) =>
    source?.returnImage ?? source?.return_image ?? source?.image ?? null

  const deriveIsReturnPending = (source: any) =>
    Boolean(source?.isReturnPending ?? source?.returnPending ?? false)

  const deriveDeviceRecordId = (source: any) =>
    source?.deviceRecordId ??
    source?.device_record_id ??
    source?.deviceUuid ??
    source?.device_uuid ??
    null

  const deriveBorrowerId = (source: any) =>
    source?.borrowerId ??
    source?.borrowed_by ??
    source?.employeeId ??
    source?.employee_id ??
    null

  const sanitizeStatus = (rawStatus: any): DeviceHistoryStatus => {
    let incoming = typeof rawStatus === 'string' ? rawStatus : undefined
    if (incoming === 'Awaiting Returned') incoming = 'Awaiting Return'
    if (!incoming) return 'Borrowed'
    if (!allowedStatuses.includes(incoming as DeviceHistoryStatus)) return 'Borrowed'
    return incoming as DeviceHistoryStatus
  }

  const deriveAction = (rawAction: any, sanitizedStatus: DeviceHistoryStatus): DeviceActionType => {
    const normalized = typeof rawAction === "string" ? rawAction.toLowerCase() : ""
    if (normalized === "borrow") return "Borrow"
    if (normalized === "return") return "Return"
    if (normalized === "incident") return "Incident"

    switch (sanitizedStatus) {
      case "Returned":
        return "Return"
      case "Awaiting Review":
        return "Incident"
      default:
        return "Borrow"
    }
  }

  if (entry && typeof entry === "object" && "recordId" in entry) {
    const sanitizedStatus = sanitizeStatus(entry.status)
    return {
      recordId: entry.recordId ?? crypto.randomUUID(),
      deviceId: entry.deviceId ?? entry.assetTag ?? `LEGACY-${crypto.randomUUID()}`,
      deviceRecordId: deriveDeviceRecordId(entry),
      deviceName: entry.deviceName ?? "Unknown Device",
      deviceType: entry.deviceType ?? "Device",
      borrowDate: entry.borrowDate ?? new Date().toISOString().split("T")[0],
      expectedReturnDate: entry.expectedReturnDate ?? undefined,
      returnDate: entry.returnDate ?? undefined,
      status: sanitizedStatus,
      action: deriveAction(entry.action, sanitizedStatus),
      notes: entry.notes ?? undefined,
      returnCondition: deriveReturnCondition(entry),
      returnImage: deriveReturnImage(entry),
      supervisorName: deriveSupervisorName(entry),
      supervisorNotes: deriveSupervisorNotes(entry),
      isReturnPending: deriveIsReturnPending(entry),
      borrowerId: deriveBorrowerId(entry),
    }
  }

  const sanitizedStatus = sanitizeStatus(entry?.status)
  return {
    recordId: entry?.id ?? crypto.randomUUID(),
    deviceId: entry?.deviceId ?? entry?.asset_tag ?? `LEGACY-${crypto.randomUUID()}`,
    deviceRecordId: deriveDeviceRecordId(entry),
    deviceName: entry?.deviceName ?? entry?.deviceName ?? entry?.model ?? entry?.name ?? "Unknown Device",
    deviceType: entry?.deviceType ? toTitleCase(entry.deviceType) : toTitleCase(entry?.type ?? "Device"),
    borrowDate: entry?.borrowDate ?? entry?.date ?? new Date().toISOString().split("T")[0],
    expectedReturnDate: entry?.expectedReturnDate ?? entry?.returnDate ?? undefined,
    returnDate: entry?.returnDate ?? undefined,
    status: sanitizedStatus,
    action: deriveAction(entry?.action, sanitizedStatus),
    notes: entry?.notes ?? undefined,
    returnCondition: deriveReturnCondition(entry),
    returnImage: deriveReturnImage(entry),
    supervisorName: deriveSupervisorName(entry),
    supervisorNotes: deriveSupervisorNotes(entry),
    isReturnPending: deriveIsReturnPending(entry),
    borrowerId: deriveBorrowerId(entry),
  }
}

export default function AMSDevicesLandingPage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const userIdentity = user?.employeeId ?? user?.email ?? null
  const [employeeRecord, setEmployeeRecord] = useState<any>(null)
  const [assignedDevices, setAssignedDevices] = useState<AssignedDeviceRecord[]>([])
  const [assignedLoading, setAssignedLoading] = useState(true)
  const [assignedError, setAssignedError] = useState<string | null>(null)
  const [inventoryDevices, setInventoryDevices] = useState<InventoryDevice[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [history, setHistory] = useState<DeviceHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  type FilterOption = "All" | DeviceHistoryStatus
  const [filter, setFilter] = useState<FilterOption>("All")
  const [searchTerm, setSearchTerm] = useState("")
  
  // Add Device Modal States
  const [addDeviceOpen, setAddDeviceOpen] = useState(false)
  const [addDeviceSubmitting, setAddDeviceSubmitting] = useState(false)
  const [assignDeviceSubmitting, setAssignDeviceSubmitting] = useState(false)
  const [deviceForm, setDeviceForm] = useState({
    asset_tag: "",
    serial_number: "",
    device_type: "",
    brand: "",
    model: "",
    cpu: "",
    ram_gb: "",
    storage_gb: "",
    os: "",
    purchase_date: "",
    warranty_expiry: "",
    condition: "Excellent",
    status: "available",
    location: "storage",
    notes: "",
  })
  const [qrCodeValue, setQrCodeValue] = useState("")
  const [qrScannerError, setQrScannerError] = useState<string | null>(null)
  const [deviceFormErrors, setDeviceFormErrors] = useState<Record<string, string>>({})
  
  // Assign Device Modal States
  const [assignDeviceOpen, setAssignDeviceOpen] = useState(false)
  const [assignDeviceForm, setAssignDeviceForm] = useState({
    deviceId: "",
    employeeId: "",
    purpose: "",
    expectedReturnDate: "",
  })
  const [assignDeviceErrors, setAssignDeviceErrors] = useState<Record<string, string>>({})
  const [availableDevicesForAssign, setAvailableDevicesForAssign] = useState<InventoryDevice[]>([])
  const [availableDevicesLoading, setAvailableDevicesLoading] = useState(false)
  const [employeesList, setEmployeesList] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)

  const storageKey = userIdentity ? `ams_device_history_${userIdentity}` : null

  // Device form validation
  const validateDeviceForm = useCallback((form: typeof deviceForm): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Asset Tag validation - Format: DEV-012 (DEV- followed by numbers)
    if (!form.asset_tag || form.asset_tag.trim() === "") {
      errors.asset_tag = "Asset tag is required."
    } else if (!/^DEV-\d+$/i.test(form.asset_tag.trim())) {
      errors.asset_tag = "Asset tag must be in format: DEV-012 (DEV- followed by numbers)."
    }

    // Serial Number validation - Format: XXX-123456789 (hyphen followed by exactly 9 digits, no letters)
    if (!form.serial_number || form.serial_number.trim() === "") {
      errors.serial_number = "Serial number is required."
    } else {
      const trimmed = form.serial_number.trim()
      // Must have a hyphen and exactly 9 digits after it, no letters allowed
      if (!/^[^-]+-\d{9}$/.test(trimmed)) {
        errors.serial_number = "Serial number must have exactly 9 digits after the hyphen. Format: XXX-123456789 (no letters allowed)."
      }
    }

    // Device Type validation
    if (!form.device_type || form.device_type.trim() === "") {
      errors.device_type = "Device type is required."
    }

    // Brand validation
    if (!form.brand || form.brand.trim() === "") {
      errors.brand = "Brand is required."
    } else if (form.brand.trim().length < 2) {
      errors.brand = "Brand must be at least 2 characters."
    }

    // Model validation
    if (!form.model || form.model.trim() === "") {
      errors.model = "Model is required."
    } else if (form.model.trim().length < 2) {
      errors.model = "Model must be at least 2 characters."
    }

    // Location validation
    if (!form.location || form.location.trim() === "") {
      errors.location = "Location is required."
    }

    // RAM validation (if provided) - Numbers only
    if (form.ram_gb && form.ram_gb.trim() !== "") {
      const ramValue = parseInt(form.ram_gb)
      if (isNaN(ramValue) || ramValue <= 0) {
        errors.ram_gb = "RAM must be a positive number."
      } else if (!/^\d+$/.test(form.ram_gb.trim())) {
        errors.ram_gb = "RAM must contain numbers only."
      } else if (ramValue > 1024) {
        errors.ram_gb = "RAM value seems too high. Please verify."
      }
    }

    // Storage validation (if provided) - Numbers only
    if (form.storage_gb && form.storage_gb.trim() !== "") {
      const storageValue = parseInt(form.storage_gb)
      if (isNaN(storageValue) || storageValue <= 0) {
        errors.storage_gb = "Storage must be a positive number."
      } else if (!/^\d+$/.test(form.storage_gb.trim())) {
        errors.storage_gb = "Storage must contain numbers only."
      } else if (storageValue > 100000) {
        errors.storage_gb = "Storage value seems too high. Please verify."
      }
    }

    // OS validation (if provided) - Should include numbers
    if (form.os && form.os.trim() !== "") {
      if (!/\d/.test(form.os.trim())) {
        errors.os = "Operating system should include version numbers (e.g., Android 14, Windows 11)."
      }
    }

    // Purchase Date validation (if provided)
    if (form.purchase_date && form.purchase_date.trim() !== "") {
      const purchaseDate = new Date(form.purchase_date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (purchaseDate > today) {
        errors.purchase_date = "Purchase date cannot be in the future."
      }
    }

    // Warranty Expiry validation (if provided)
    if (form.warranty_expiry && form.warranty_expiry.trim() !== "") {
      const warrantyDate = new Date(form.warranty_expiry)
      if (isNaN(warrantyDate.getTime())) {
        errors.warranty_expiry = "Invalid warranty expiry date."
      } else if (form.purchase_date && form.purchase_date.trim() !== "") {
        const purchaseDate = new Date(form.purchase_date)
        if (warrantyDate <= purchaseDate) {
          errors.warranty_expiry = "Warranty expiry must be after purchase date."
        }
      }
    }


    // Notes validation (optional but if provided, check length)
    if (form.notes && form.notes.length > 1000) {
      errors.notes = "Notes cannot exceed 1000 characters."
    }

    return errors
  }, [])

  const updateHistory = useCallback(
    (updater: (prev: DeviceHistoryRow[]) => DeviceHistoryRow[]) => {
      setHistory((prev) => {
        const next = updater(prev)
        if (storageKey && typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(next))
        }
        return next
      })
    },
    [storageKey],
  )

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true)
    setInventoryError(null)
    try {
      const response = await fetch(`/api/devices?limit=100`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to fetch devices")
      }
      const records = Array.isArray(json.data) ? (json.data as InventoryDevice[]) : []
      setInventoryDevices(records)
    } catch (error) {
      console.error("Failed to load devices", error)
      setInventoryDevices([])
      setInventoryError("Unable to load devices right now.")
    } finally {
      setInventoryLoading(false)
    }
  }, [])

  // Borrow modal state
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [borrowType, setBorrowType] = useState("")
  const [borrowId, setBorrowId] = useState("")
  const [borrowDate, setBorrowDate] = useState("")
  const [borrowReturnDate, setBorrowReturnDate] = useState("")
  const [borrowPurpose, setBorrowPurpose] = useState("")
  const [borrowReturnError, setBorrowReturnError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [borrowReceipt, setBorrowReceipt] = useState<BorrowReceipt | null>(null)
  const [borrowConfirmOpen, setBorrowConfirmOpen] = useState(false)
  const [borrowSubmitting, setBorrowSubmitting] = useState(false)
  const updateDeviceStatusGlobal = useCallback(
    async (identifier: string | null | undefined, status: 'available' | 'pending borrow' | 'borrowed') => {
      const trimmed = identifier?.trim()
      if (!trimmed) return false

      try {
        const response = await fetch('/api/devices', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: trimmed, status }),
        })
        const result = await response.json()
        return result.success === true
      } catch (error) {
        console.warn('Device status update skipped; identifier not found:', trimmed, error)
        return false
      }
    },
    [],
  )
  // Return modal state
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnDeviceId, setReturnDeviceId] = useState("")
  
  // Collect & Scan Device Modal States
  const [collectScanModalOpen, setCollectScanModalOpen] = useState(false)
  const [collectScanMode, setCollectScanMode] = useState<"collect" | "return">("collect")
  const [collectScanBorrowId, setCollectScanBorrowId] = useState<string | undefined>(undefined)
  const [collectScanDeviceId, setCollectScanDeviceId] = useState<string | undefined>(undefined)
  
  // Device Condition Check Modal States (for supervisor)
  const [conditionCheckModalOpen, setConditionCheckModalOpen] = useState(false)
  const [pendingReturnBorrowId, setPendingReturnBorrowId] = useState<string | undefined>(undefined)
  const [pendingReturnScannedCode, setPendingReturnScannedCode] = useState<string | undefined>(undefined)
  const [returnCondition, setReturnCondition] = useState("")
  const [returnFileName, setReturnFileName] = useState<string | null>(null)
  const [returnReceipt, setReturnReceipt] = useState<ReturnReceipt | null>(null)
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false)
  const [lastBorrowRecordId, setLastBorrowRecordId] = useState<string | null>(null)

// Incident modal state
const [incidentOpen, setIncidentOpen] = useState(false)
const [incidentType, setIncidentType] = useState("")
const [incidentDescription, setIncidentDescription] = useState("")
const [incidentDocument, setIncidentDocument] = useState<File | null>(null)
const [incidentTarget, setIncidentTarget] = useState<DeviceHistoryRow | null>(null)
const [incidentSummaryOpen, setIncidentSummaryOpen] = useState(false)
const [incidentSummaryData, setIncidentSummaryData] = useState<{
  deviceName: string
  deviceType: string
  assetTag: string
  incidentType: string
  attachmentName?: string
} | null>(null)
const [incidentSubmitting, setIncidentSubmitting] = useState(false)
const [editDialogOpen, setEditDialogOpen] = useState(false)
const [editRecord, setEditRecord] = useState<DeviceHistoryRow | null>(null)
const [editReturnDate, setEditReturnDate] = useState("")
  if (!user) return null

  const normalizedRole = (user.role ?? "").toString().toLowerCase()
  const isSupervisor = normalizedRole === "supervisor"
  const canManageInventory = normalizedRole !== "employee"

  const employeeId = useMemo(() => {
    const candidate =
      employeeRecord?.id ??
      employeeRecord?.employee_id ??
      employeeRecord?.employeeId ??
      user.employeeId ??
      null

    if (typeof candidate !== "string") return null
    const trimmed = candidate.trim()
    return trimmed.length > 0 ? trimmed : null
  }, [employeeRecord?.employeeId, employeeRecord?.employee_id, employeeRecord?.id, user.employeeId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedEmployee = localStorage.getItem("xspark_employee")
    if (storedEmployee) {
      try {
        setEmployeeRecord(JSON.parse(storedEmployee))
      } catch (error) {
        console.error("Failed to parse stored employee record", error)
      }
    }
  }, [userIdentity])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  useEffect(() => {
    if (borrowOpen) {
      loadInventory()
    }
  }, [borrowOpen, loadInventory])

  useEffect(() => {
    if (!userIdentity || typeof window === "undefined") return

    let isActive = true

    const fetchEmployee = async () => {
      try {
        let authHeaders: Record<string, string> = {}
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          try {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              authHeaders["Authorization"] = `Bearer ${sessionParsed.access_token}`
            }
          } catch (error) {
            console.error("Failed to parse session for auth headers", error)
          }
        }

        const response = await fetch("/api/auth/me", {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        })
        const json = await response.json()
        if (!isActive) return
        if (response.ok && json.success && json.data?.employee) {
          setEmployeeRecord(json.data.employee)
          try {
            localStorage.setItem("xspark_employee", JSON.stringify(json.data.employee))
          } catch {
            // ignore storage errors
          }
        }
      } catch (error) {
        if (isActive) {
          console.error("Failed to fetch employee profile", error)
        }
      }
    }

    fetchEmployee()

    return () => {
      isActive = false
    }
  }, [userIdentity])

  useEffect(() => {
    if (!employeeId) {
      setAssignedDevices([])
      setAssignedLoading(false)
      return
    }

    let isMounted = true
    setAssignedLoading(true)
    setAssignedError(null)

    const fetchAssignments = async () => {
      const { data, error } = await supabase
        .from("assigned_devices")
        .select(`
          id,
          status,
          assignment_type,
          assigned_date,
          expected_return_date,
          actual_return_date,
          assignment_notes,
          device:device_id (
            id,
            asset_tag,
            serial_number,
            device_type,
            brand,
            model,
            status,
            condition,
            location,
            notes,
            updated_at
          )
        `)
        .eq("employee_id", employeeId)
        .is("deleted_at", null)
        .order("assigned_date", { ascending: false })

      if (!isMounted) return

      if (error) {
        console.error("Failed to load assigned devices", error)
        setAssignedDevices([])
        setAssignedError("Unable to load your assigned devices right now.")
      } else {
        setAssignedDevices((data ?? []) as AssignedDeviceRecord[])
        setAssignedError(null)
      }
      setAssignedLoading(false)
    }

    fetchAssignments()

    return () => {
      isMounted = false
    }
  }, [employeeId])

  const formatDateDisplay = (value?: string | null) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString()
  }

  const visibleAssignments = useMemo(() => {
    return assignedDevices.filter((assignment) => {
      const status = (assignment.status ?? "").toLowerCase()
      return status !== "cancelled"
    })
  }, [assignedDevices])

  const availableInventoryDevices = useMemo(
    () => inventoryDevices.filter((device) => (device.status ?? "").toLowerCase() === "available"),
    [inventoryDevices],
  )

  const borrowDeviceTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableInventoryDevices
            .map((device) => toTitleCase(device.device_type ?? undefined))
            .filter((type): type is string => !!type && type !== "Unknown"),
        ),
      ).sort(),
    [availableInventoryDevices],
  )


const filteredBorrowDevices = useMemo(
  () =>
    availableInventoryDevices.filter((device) => {
      if (!borrowType) return true
      return toTitleCase(device.device_type ?? undefined) === borrowType
    }),
  [availableInventoryDevices, borrowType],
)

const selectedBorrowDevice = useMemo(
  () => inventoryDevices.find((device) => device.id === borrowId),
  [inventoryDevices, borrowId],
)

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      setLoadingHistory(false)
      return
    }

    setLoadingHistory(true)
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        const sanitized = Array.isArray(parsed)
          ? (parsed as any[]).map((entry) => normalizeHistoryEntry(entry))
          : []
        setHistory(sanitized)
      } else {
        setHistory([])
      }
      setHistoryError(null)
    } catch (error) {
      console.error("Failed to load device history", error)
      setHistoryError("We couldn't load your device history. Please try again later.")
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return

    const syncHistory = () => {
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            setHistory(parsed.map((entry) => normalizeHistoryEntry(entry)))
          }
        }
      } catch (error) {
        console.error("Failed to sync device history", error)
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncHistory()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(DEVICE_HISTORY_UPDATED_EVENT, syncHistory)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(DEVICE_HISTORY_UPDATED_EVENT, syncHistory)
    }
  }, [storageKey])

  useEffect(() => {
    if (!history.length) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueIds = history
      .filter((entry) => entry.status === "Borrowed" && entry.expectedReturnDate)
      .filter((entry) => {
        const dueDate = new Date(entry.expectedReturnDate as string)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate < today
      })
      .map((entry) => entry.recordId)

    if (overdueIds.length === 0) return

    updateHistory((prev) =>
      prev.map((entry) =>
        overdueIds.includes(entry.recordId)
          ? {
              ...entry,
              status: "Awaiting Return",
            }
          : entry,
      ),
    )
  }, [history, updateHistory])


  // Removed automatic real-time date setting - user can now edit the date manually

  useEffect(() => {
    if (!borrowOpen) {
      setBorrowReturnError(null)
    }
  }, [borrowOpen])
  useEffect(() => {
    if (returnOpen) return
    setReturnDeviceId("")
    setReturnCondition("")
    setReturnFileName(null)
  }, [returnOpen])

  const filteredHistory = useMemo(() => {
    let filtered = history

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(entry => 
        entry.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.deviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.deviceId.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (filter !== "All") {
      filtered = filtered.filter((entry) => entry.status === filter)
    }

    return filtered
  }, [history, filter, searchTerm])
  const borrowDialogReady = Boolean(borrowId && borrowReturnDate && borrowPurpose.trim() && !borrowReturnError)

  // Borrow handlers
  const parseDateOnly = (value: string) => {
    if (!value) return null
    const [year, month, day] = value.split("-").map(Number)
    if ([year, month, day].some((part) => Number.isNaN(part))) return null
    return new Date(year, month - 1, day)
  }

  const isWeekendDate = (value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const day = parsed.getDay()
    return day === 0 || day === 6
  }

  const borrowDateIso = useMemo(() => {
    if (borrowDate) {
      return borrowDate.split("T")[0]
    }
    const today = new Date()
    return today.toISOString().split("T")[0]
  }, [borrowDate])

  const borrowReturnLimitIso = useMemo(() => {
    const start = parseDateOnly(borrowDateIso)
    if (!start) return undefined
    const limit = new Date(start)
    limit.setDate(limit.getDate() + MAX_BORROW_DURATION_DAYS)
    return limit.toISOString().split("T")[0]
  }, [borrowDateIso])

  const isReturnDateValid = (value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const today = parseDateOnly(borrowDateIso)
    if (!today) return false
    today.setHours(0, 0, 0, 0)
    if (parsed <= today) {
      return false
    }
    if (isWeekendDate(value)) {
      return false
    }
    const diff = (parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    if (diff > MAX_BORROW_DURATION_DAYS) {
      return false
    }
    return true
  }

  const isValidReturnDateForEntry = (entry: DeviceHistoryRow, value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const borrowDateOnly = parseDateOnly(entry.borrowDate.split("T")[0] ?? entry.borrowDate)
    if (!borrowDateOnly) return true
    borrowDateOnly.setHours(0, 0, 0, 0)
    parsed.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (parsed <= borrowDateOnly || parsed < today) {
      return false
    }
    if (isWeekendDate(value)) {
      return false
    }
    const diff = (parsed.getTime() - borrowDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    if (diff > MAX_BORROW_DURATION_DAYS) {
      return false
    }
    return true
  }

  const handleBorrowReturnDateChange = (value: string) => {
    setBorrowReturnDate(value)
    if (!value) {
      setBorrowReturnError(null)
      return
    }
    if (!parseDateOnly(value)) {
      setBorrowReturnError("Invalid return date.")
      return
    }
    if (isWeekendDate(value)) {
      setBorrowReturnError("Return date cannot fall on a weekend.")
      toast({
        variant: "destructive",
        title: "Weekend not allowed",
        description: "Device returns must be scheduled for weekdays.",
      })
      return
    }
    if (!isReturnDateValid(value)) {
      const diffError =
        borrowReturnLimitIso && value > borrowReturnLimitIso
          ? `Return date can be at most ${MAX_BORROW_DURATION_DAYS} days after the borrow date.`
          : "Return date must be after the borrow date."
      setBorrowReturnError(diffError)
      toast({
        variant: "destructive",
        title: "Invalid return date",
        description: diffError,
      })
    } else {
      setBorrowReturnError(null)
    }
  }

  const submitBorrow = async () => {
    const trimmedPurpose = borrowPurpose.trim()
    if (!borrowDialogReady) {
      toast({
        variant: "destructive",
        title: "Borrowing details incomplete",
        description: "Select a device, return date, and purpose before borrowing.",
      })
      return
    }

    const selectedDevice = inventoryDevices.find((device) => device.id === borrowId)
    if (!selectedDevice) {
      setBannerMessage("Selected device is no longer available.")
      setTimeout(() => setBannerMessage(null), 3000)
      return
    }

    if (borrowReturnDate && !isReturnDateValid(borrowReturnDate)) {
      const message =
        borrowReturnLimitIso && borrowReturnDate > borrowReturnLimitIso
          ? `Return date can be at most ${MAX_BORROW_DURATION_DAYS} days after the borrow date.`
          : "Please choose a valid weekday after today."
      setBorrowReturnError(message)
      toast({
        variant: "destructive",
        title: "Invalid return date",
        description: message,
      })
      return
    }

    const borrowDateValue = borrowDate || new Date().toISOString()
    const assetTag = selectedDevice.asset_tag || selectedDevice.serial_number || selectedDevice.id
    const resolvedDeviceName = selectedDevice.model || selectedDevice.brand || toTitleCase(selectedDevice.device_type ?? undefined) || "Device"
    const resolvedDeviceType = toTitleCase(selectedDevice.device_type ?? undefined) || "Device"

    const borrowerIdentifier =
      employeeRecord?.id ||
      employeeRecord?.employee_id ||
      userIdentity ||
      user?.employeeId ||
      user?.email ||
      user?.id

    if (!borrowerIdentifier) {
      toast({
        variant: "destructive",
        title: "Missing profile data",
        description: "We could not determine who is borrowing this device.",
      })
      return
    }

    if (borrowSubmitting) return
    setBorrowSubmitting(true)

    let borrowResponse: any = null
    try {
      const response = await fetch("/api/borrows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: selectedDevice.id,
          borrowed_by: borrowerIdentifier,
          borrow_date: borrowDateValue,
          return_date: borrowReturnDate || null,
          notes: trimmedPurpose || undefined,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to record borrow in the database.")
      }
      borrowResponse = json
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Borrow not saved",
        description: error instanceof Error ? error.message : "Unable to save this borrow request.",
      })
      setBorrowSubmitting(false)
      return
    } finally {
      setBorrowSubmitting(false)
    }

    // If auto-approved (supervisor), show scanner immediately
    if (borrowResponse?.autoApproved && borrowResponse?.data?.borrow_id && isSupervisor) {
      // Add to history with "Approved" status
      const recordId = borrowResponse.data.borrow_id
      const newEntry: DeviceHistoryRow = {
        recordId,
        deviceId: assetTag,
        deviceRecordId: selectedDevice.id,
        deviceName: resolvedDeviceName,
        deviceType: resolvedDeviceType,
        borrowDate: borrowDateValue,
        expectedReturnDate: borrowReturnDate || undefined,
        status: "Pending" as DeviceHistoryStatus, // Will be updated to "Borrowed" after scan
        action: "Borrow",
        notes: trimmedPurpose || undefined,
        borrowerId: borrowerIdentifier,
      }
      updateHistory((prev) => [newEntry, ...prev])

      // Open scanner modal
      setCollectScanMode("collect")
      setCollectScanBorrowId(recordId)
      setCollectScanDeviceId(selectedDevice.id)
      setBorrowOpen(false)
      setCollectScanModalOpen(true)
      toast({
        title: "Request Approved",
        description: "Please scan the device to complete pickup.",
      })
      // Reset form
      setBorrowType("")
      setBorrowId("")
      setBorrowReturnDate("")
      setBorrowPurpose("")
      setBorrowReturnError(null)
      return
    }

    // Regular flow for non-supervisors or non-auto-approved requests
    const recordId = borrowResponse?.data?.borrow_id || crypto.randomUUID()
    const newEntry: DeviceHistoryRow = {
      recordId,
      deviceId: assetTag,
      deviceRecordId: selectedDevice.id,
      deviceName: resolvedDeviceName,
      deviceType: resolvedDeviceType,
      borrowDate: borrowDateValue,
      expectedReturnDate: borrowReturnDate || undefined,
      status: "Pending",
      action: "Borrow",
      notes: trimmedPurpose || undefined,
      borrowerId: borrowerIdentifier,
    }

    updateHistory((prev) => [newEntry, ...prev])
    setLastBorrowRecordId(recordId)

    setBorrowReceipt({
      deviceId: assetTag,
      deviceName: resolvedDeviceName,
      deviceType: resolvedDeviceType,
      borrowDate: borrowDateValue,
      expectedReturnDate: borrowReturnDate || undefined,
      status: 'Pending',
    })
    setBorrowConfirmOpen(true)
    setBorrowOpen(false)
    setBannerMessage(`${resolvedDeviceName} added to your borrowing history.`)
    setTimeout(() => setBannerMessage(null), 6000)

    setBorrowType("")
    setBorrowId("")
    setBorrowReturnDate("")
    setBorrowPurpose("")
    setBorrowReturnError(null)

    const statusUpdated = await updateDeviceStatusGlobal(selectedDevice.id ?? assetTag, 'pending borrow')

    if (!statusUpdated) {
      toast({
        variant: "destructive",
        title: "Inventory update failed",
        description: "Your request was logged but the device status could not be updated automatically.",
      })
    } else {
      await loadInventory()
    }
  }

  // Return handlers
  const returnableDevices = useMemo(
    () => history.filter((entry) => entry.status === "Borrowed"),
    [history],
  )
  const selectedReturnEntry = useMemo(
    () => history.find((entry) => entry.recordId === returnDeviceId),
    [history, returnDeviceId]
  )
  const canSubmitReturn = Boolean(returnDeviceId && returnCondition)
  const submitReturn = async () => {
    if (!canSubmitReturn) {
      toast({
        variant: "destructive",
        title: "Return details incomplete",
        description: "Select a device and its condition before returning.",
      })
      return
    }

    const returningEntry = history.find((entry) => entry.recordId === returnDeviceId)
    if (!returningEntry) {
      setBannerMessage("We couldn't find that borrowing record.")
      setTimeout(() => setBannerMessage(null), 3000)
      return
    }

    const today = new Date().toISOString().split("T")[0]
    const todayDate = new Date(today)
    const dayOfWeek = todayDate.getDay()
    
    // Check if today is a weekend (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      toast({
        variant: "destructive",
        title: "Weekend not allowed",
        description: "Device returns are not allowed on weekends. Please return the device on a weekday.",
      })
      return
    }
    updateHistory((prev) =>
      prev.map((entry) =>
        entry.recordId === returnDeviceId
          ? {
              ...entry,
              status: "Pending",
              returnDate: today,
              action: entry.action === "Incident" ? entry.action : "Return",
              returnCondition,
              returnImage: returnFileName || null,
              isReturnPending: true,
            }
          : entry
      )
    )

    setReturnReceipt({
      deviceId: returningEntry.deviceId,
      deviceName: returningEntry.deviceName,
      deviceType: returningEntry.deviceType,
      returnDate: today,
      status: "Pending",
      condition: returnCondition || undefined,
      image: returnFileName || null,
    })

    setReturnOpen(false)
    setReturnConfirmOpen(true)
    setBannerMessage(`${returningEntry.deviceName} return recorded.`)
    setTimeout(() => setBannerMessage(null), 6000)
    setReturnDeviceId("")
    setReturnCondition("")
    setReturnFileName(null)

    await loadInventory()
  }

  // Incident handlers
  const submitIncident = async () => {
    if (!incidentTarget) return
    if (incidentTarget.status !== "Borrowed") {
      toast({
        variant: "destructive",
        title: "Unable to report",
        description: "Only borrowed devices can be reported.",
      })
      return
    }

    const trimmedDescription = incidentDescription.trim()
    if (!incidentType || !trimmedDescription) {
      toast({
        variant: "destructive",
        title: "Incident details incomplete",
        description: "Select an incident type and provide an explanation.",
      })
      return
    }

    const reporterId =
      employeeRecord?.id ||
      employeeRecord?.employee_id ||
      user?.employeeId ||
      user?.id ||
      null

    if (!reporterId) {
      toast({
        variant: "destructive",
        title: "Missing profile data",
        description: "We could not determine who is reporting this incident.",
      })
      return
    }

    const resolvedDeviceRecordId =
      incidentTarget.deviceRecordId ||
      inventoryDevices.find(
        (device) =>
          device.id === incidentTarget.deviceId ||
          device.asset_tag === incidentTarget.deviceId ||
          device.serial_number === incidentTarget.deviceId,
      )?.id ||
      null

    if (!resolvedDeviceRecordId) {
      toast({
        variant: "destructive",
        title: "Device not linked",
        description: "We couldn't match this record to a device in the database.",
      })
      return
    }

    if (incidentDocument && !["image/jpeg", "image/png", "application/pdf"].includes(incidentDocument.type)) {
      toast({
        variant: "destructive",
        title: "Unsupported file",
        description: "Only JPG/JPEG, PNG, or PDF files are allowed.",
      })
      return
    }

    setIncidentSubmitting(true)
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: resolvedDeviceRecordId,
          reported_by: reporterId,
          incident_type: incidentType,
          description: `${trimmedDescription}${incidentDocument ? `\nAttachment: ${incidentDocument.name}` : ""}`,
          status: "Open",
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to submit incident")
      }

      updateHistory((prev) =>
        prev.map((entry) =>
          entry.recordId === incidentTarget.recordId
            ? {
                ...entry,
                status: "Awaiting Review",
                action: "Incident",
                notes: trimmedDescription,
              }
            : entry,
        ),
      )

      setIncidentSummaryData({
        deviceName: incidentTarget.deviceName,
        deviceType: incidentTarget.deviceType,
        assetTag: incidentTarget.deviceId,
        incidentType,
        attachmentName: incidentDocument?.name,
      })

      setIncidentOpen(false)
      setIncidentSummaryOpen(true)
      setIncidentTarget(null)
      setIncidentType("")
      setIncidentDescription("")
      setIncidentDocument(null)
      setBannerMessage("Incident captured. We'll follow up soon.")
      setTimeout(() => setBannerMessage(null), 6000)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Incident not saved",
        description: error instanceof Error ? error.message : "Unable to log this incident.",
      })
    } finally {
      setIncidentSubmitting(false)
    }
  }

  const canEditEntry = (entry: DeviceHistoryRow) => editableStatusSet.has(entry.status.toLowerCase())

  const handleEditEntry = (entry: DeviceHistoryRow) => {
    if (!canEditEntry(entry)) {
      toast({
        variant: "destructive",
        title: "Editing not allowed",
        description: "This record cannot be edited in its current state.",
      })
      return
    }

    setEditRecord(entry)
    setEditReturnDate(toDateInputValue(entry.expectedReturnDate ?? entry.returnDate ?? ""))
    setEditDialogOpen(true)
  }

  const handleReturnFromHistory = async (entry: DeviceHistoryRow) => {
    if (entry.status !== "Borrowed" && entry.status !== "Awaiting Return") {
      toast({
        variant: "destructive",
        title: "Return unavailable",
        description: "Only borrowed devices or devices awaiting return can be returned.",
      })
      return
    }
    
    // Update status to "Awaiting Return" if not already
    if (entry.status !== "Awaiting Return") {
      updateHistory((prev) =>
        prev.map((e) =>
          e.recordId === entry.recordId
            ? { ...e, status: "Awaiting Return" as DeviceHistoryStatus }
            : e,
        ),
      )
    }
    
    // Open scan modal for return
    setCollectScanMode("return")
    setCollectScanBorrowId(entry.recordId)
    setCollectScanDeviceId(entry.deviceId)
    setCollectScanModalOpen(true)
  }
  
  const handleScanSuccess = useCallback(
    async (scannedCode: string) => {
      if (collectScanMode === "return") {
        // Before completing return, show condition check modal for supervisor
        if (isSupervisor) {
          setPendingReturnBorrowId(collectScanBorrowId)
          setPendingReturnScannedCode(scannedCode)
          setConditionCheckModalOpen(true)
          setCollectScanModalOpen(false)
        } else {
          // For non-supervisors, proceed directly
          await completeReturnScan(collectScanBorrowId, scannedCode)
        }
      } else {
        // Collect flow - device has been picked up and marked as borrowed
        toast({
          title: "Device collected successfully",
          description: "Device has been scanned and marked as borrowed.",
        })
        // Update local history if we have the borrow_id
        if (collectScanBorrowId) {
          updateHistory((prev) =>
            prev.map((e) =>
              e.recordId === collectScanBorrowId ? { ...e, status: "Borrowed" as DeviceHistoryStatus } : e,
            ),
          )
        }
        // Reload inventory to reflect device status change
        await loadInventory()
        // Trigger history sync
        if (storageKey && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(DEVICE_HISTORY_UPDATED_EVENT))
        }
      }
    },
    [collectScanMode, collectScanBorrowId, isSupervisor, storageKey, updateHistory, loadInventory],
  )
  
  const completeReturnScan = async (borrowId: string | undefined, scannedCode: string) => {
    if (!borrowId) return
    
    try {
      // Update status to "Returned"
      updateHistory((prev) =>
        prev.map((e) =>
          e.recordId === borrowId ? { ...e, status: "Returned" as DeviceHistoryStatus, returnDate: new Date().toISOString().split("T")[0] } : e,
        ),
      )
      
      // Log scan to scan_history (stub)
      await fetch("/api/device-scans/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrow_id: borrowId,
          scanned_code: scannedCode,
          scan_type: "return",
        }),
      }).catch(() => {}) // Ignore errors for stub
      
      // Generate receipt (stub)
      await generateReturnReceipt(borrowId)
      
      toast({
        title: "Device returned successfully",
        description: "Device has been scanned and returned.",
      })
      
      // Trigger history sync
      if (storageKey && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(DEVICE_HISTORY_UPDATED_EVENT))
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Return failed",
        description: error instanceof Error ? error.message : "Failed to complete return.",
      })
    }
  }
  
  const generateReturnReceipt = async (borrowId: string) => {
    // Stub function - placeholder for receipt generation
    const entry = history.find((e) => e.recordId === borrowId)
    if (!entry) return
    
    // Stub call - would generate receipt with employee name, devices, borrow datetime, return due date
    console.log("Generate receipt stub:", {
      employee_name: user?.name,
      devices: [entry.deviceName],
      borrow_datetime: entry.borrowDate,
      return_due_date: entry.expectedReturnDate,
    })
    
    // Email stub (would send email to employee)
    await fetch("/api/receipts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "return",
        borrow_id: borrowId,
        employee_email: user?.email,
      }),
    }).catch(() => {}) // Ignore errors for stub
  }

  const handleReportIncident = (entry: DeviceHistoryRow) => {
    const statusLower = entry.status.toLowerCase()
    if (statusLower !== "borrowed" && statusLower !== "awaiting return") {
      toast({
        variant: "destructive",
        title: "Incident reporting unavailable",
        description: "You can only report incidents on devices you have borrowed or are awaiting return.",
      })
      return
    }
    setIncidentTarget(entry)
    setIncidentType("")
    setIncidentDescription("")
    setIncidentDocument(null)
    setIncidentSummaryData(null)
    setIncidentOpen(true)
  }

  const handleDeleteEntry = (entry: DeviceHistoryRow) => {
    updateHistory((prev) => prev.filter((e) => e.recordId !== entry.recordId))
    toast({
      title: "Entry deleted",
      description: "Device history entry has been removed.",
    })
  }

  const handleReBook = (entry: DeviceHistoryRow) => {
    if (entry.status !== "Attended") {
      toast({
        variant: "destructive",
        title: "Re-book unavailable",
        description: "You can only re-book devices with 'Attended' status.",
      })
      return
    }

    // Pre-fill the borrow modal with the device information
    const deviceType = entry.deviceType || ""
    setBorrowType(deviceType)
    
    // Find the device in inventory to get its ID
    const matchingDevice = inventoryDevices.find(
      (d) => 
        d.id === entry.deviceRecordId || 
        d.asset_tag === entry.deviceId ||
        d.serial_number === entry.deviceId
    )
    
    if (matchingDevice) {
      setBorrowId(matchingDevice.id || entry.deviceRecordId || entry.deviceId)
    } else {
      setBorrowId(entry.deviceRecordId || entry.deviceId)
    }
    
    // Set default dates (tomorrow as borrow date, and a week later as return date)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const returnDate = new Date(tomorrow)
    returnDate.setDate(returnDate.getDate() + 7)
    
    setBorrowDate(tomorrow.toISOString().split('T')[0])
    setBorrowReturnDate(returnDate.toISOString().split('T')[0])
    setBorrowPurpose("")
    setBorrowReturnError(null)
    
    // Open the borrow modal
    setBorrowOpen(true)
  }

  const handleIncidentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setIncidentDocument(null)
      return
    }
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Unsupported file",
        description: "Only JPG/JPEG, PNG, or PDF files are allowed.",
      })
      event.target.value = ""
      setIncidentDocument(null)
      return
    }
    setIncidentDocument(file)
  }

  const handleSaveEdit = () => {
    if (!editRecord) return
    if (!editReturnDate) {
      toast({
        variant: "destructive",
        title: "Return date required",
        description: "Select a new return date before saving.",
      })
      return
    }

    if (!isValidReturnDateForEntry(editRecord, editReturnDate)) {
      toast({
        variant: "destructive",
        title: "Invalid return date",
        description: "Return date must be after the borrow date, fall on a weekday, and be within 30 days.",
      })
      return
    }

    updateHistory((prev) =>
      prev.map((entry) => {
        if (entry.recordId !== editRecord.recordId) return entry
        return {
          ...entry,
          expectedReturnDate: editReturnDate,
        }
      }),
    )

    setEditDialogOpen(false)
    setEditRecord(null)
    setEditReturnDate("")
    toast({
      title: "Return date updated",
      description: "Device return date saved successfully.",
    })
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-navy">Device Management</h1>
          <p className="text-muted-foreground">Track, borrow, and manage company devices and equipment.</p>
          {bannerMessage && (
            <div className="mt-2 flex items-center justify-end gap-2 rounded-md border border-[#E6D9FF] bg-[#F6F1FF] px-3 py-2 text-sm text-[#3F3D56] shadow-sm">
              <Sparkles className="h-4 w-4 text-[#92278F]" />
              <span>{bannerMessage}</span>
            </div>
          )}
          {inventoryError && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {inventoryError}
            </div>
          )}
        </div>


        <div className="space-y-4">
          <div className="flex flex-row items-center justify-end gap-3">
            {isSupervisor ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 h-10 px-4">
                    Actions
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => setAddDeviceOpen(true)}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Device
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      setAssignDeviceOpen(true)
                      setAvailableDevicesLoading(true)
                      setEmployeesLoading(true)
                      try {
                        // Fetch both devices and employees in parallel
                        const [devicesResponse, employeesData] = await Promise.all([
                          fetch("/api/devices?availableOnly=true&limit=200", {
                            method: "GET",
                            cache: "no-store",
                            credentials: "include",
                            headers: {
                              Accept: "application/json",
                            },
                          }),
                          employeeService.getAllActive({ limit: 500 })
                        ])
                        
                        const devicesJson = await devicesResponse.json()
                        
                        if (devicesResponse.ok && devicesJson.success && Array.isArray(devicesJson.data)) {
                          setAvailableDevicesForAssign(devicesJson.data)
                        } else {
                          throw new Error(devicesJson?.error || "Failed to fetch devices")
                        }
                        
                        // Use employee service data directly
                        if (Array.isArray(employeesData)) {
                          setEmployeesList(employeesData)
                        } else {
                          console.error("Failed to fetch employees: Invalid response")
                          toast({
                            variant: "destructive",
                            title: "Failed to load employees",
                            description: "Could not fetch employees list.",
                          })
                        }
                      } catch (error) {
                        console.error("Failed to fetch data", error)
                        toast({
                          variant: "destructive",
                          title: "Failed to load data",
                          description: error instanceof Error ? error.message : "Could not fetch required data.",
                        })
                      } finally {
                        setAvailableDevicesLoading(false)
                        setEmployeesLoading(false)
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign Device
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setBorrowOpen(true)}
                    className="cursor-pointer"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Book a Device
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCollectScanMode("collect")
                      setCollectScanModalOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Collect & Scan Device
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer"
                  >
                    <Link href="/ams-devices/management-history">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Device Management History
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                {/* DialogTrigger for non-supervisors only */}
                <Dialog open={borrowOpen} onOpenChange={setBorrowOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 h-10 px-4">Book a Device</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg space-y-4">
                    <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                      <DialogTitle>Book a Device</DialogTitle>
                      <DialogDescription>Request to book a device</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
                      <div className="space-y-2">
                        <Label>Device Type</Label>
                        <Select
                          value={borrowType}
                          onValueChange={(value) => {
                            setBorrowType(value)
                            setBorrowId("")
                          }}
                          disabled={borrowDeviceTypeOptions.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                borrowDeviceTypeOptions.length === 0 ? "No available types" : "Select device type"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {borrowDeviceTypeOptions.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Device</Label>
                        <Select
                          value={borrowId}
                          onValueChange={(value) => {
                            setBorrowId(value)
                            const selected = availableInventoryDevices.find((device) => device.id === value)
                            setBorrowType(selected ? toTitleCase(selected.device_type ?? undefined) : borrowType)
                          }}
                          disabled={inventoryLoading || filteredBorrowDevices.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                inventoryLoading
                                  ? "Loading devices..."
                                  : filteredBorrowDevices.length === 0
                                    ? borrowType
                                      ? "No devices for this type"
                                      : "Select a device type first"
                                    : "Select device"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredBorrowDevices.map((device) => {
                              const label = device.model || device.brand || toTitleCase(device.device_type ?? undefined) || "Device"
                              const tag = device.asset_tag || device.serial_number || device.id
                              return (
                                <SelectItem key={device.id} value={device.id}>
                                  {label} ({tag})
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-lg border border-dashed border-muted/70 px-3 py-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Identifier</span>
                          <span className="font-medium text-[#25294B]">
                            {selectedBorrowDevice?.asset_tag ||
                              selectedBorrowDevice?.serial_number ||
                              (borrowId ? "Fetching details..." : "—")}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Borrow Date</Label>
                          <Input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={borrowDate ? new Date(borrowDate).toISOString().split('T')[0] : ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                const date = new Date(e.target.value + 'T00:00:00')
                                const day = date.getDay()
                                if (day === 0 || day === 6) {
                                  toast({
                                    variant: "destructive",
                                    title: "Invalid borrow date",
                                    description: "Borrow date cannot fall on a weekend.",
                                  })
                                  return
                                }
                                setBorrowDate(date.toISOString())
                              } else {
                                setBorrowDate("")
                              }
                            }}
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground">Select a date (weekdays only, today or future).</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Return Date</Label>
                          <Input
                            type="date"
                            min={borrowDateIso}
                            max={borrowReturnLimitIso}
                            value={borrowReturnDate}
                            onChange={(e) => handleBorrowReturnDateChange(e.target.value)}
                            aria-invalid={Boolean(borrowReturnError) || undefined}
                            className={`text-sm ${borrowReturnError ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                          />
                          {borrowReturnError ? (
                            <p className="text-xs text-destructive">{borrowReturnError}</p>
                          ) : (
                            borrowReturnLimitIso && (
                              <p className="text-[11px] text-muted-foreground">
                                Return within {MAX_BORROW_DURATION_DAYS} days ({borrowReturnLimitIso} latest).
                              </p>
                            )
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Purpose</Label>
                        <Textarea rows={3} placeholder="Provide a brief purpose for borrowing" value={borrowPurpose} onChange={(e) => setBorrowPurpose(e.target.value)} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <DialogClose asChild>
                          <Button variant="outline" className="w-40">
                            Cancel
                          </Button>
                        </DialogClose>
                        <Button
                          className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={submitBorrow}
                          disabled={!borrowDialogReady || borrowSubmitting}
                        >
                          {borrowSubmitting ? "Submitting…" : "Submit Request"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 h-10 px-4"
                  onClick={() => {
                    setCollectScanMode("collect")
                    setCollectScanModalOpen(true)
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Collect & Scan Device
                </Button>
              </>
            )}
            
          {/* Book a Device Dialog - For supervisor (triggered via dropdown onClick) */}
          {isSupervisor && (
            <Dialog open={borrowOpen} onOpenChange={setBorrowOpen}>
              <DialogContent className="sm:max-w-lg space-y-4">
              <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                <DialogTitle>Book a Device</DialogTitle>
                <DialogDescription>Request to book a device</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select
                    value={borrowType}
                    onValueChange={(value) => {
                      setBorrowType(value)
                      setBorrowId("")
                    }}
                    disabled={borrowDeviceTypeOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          borrowDeviceTypeOptions.length === 0 ? "No available types" : "Select device type"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {borrowDeviceTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Device</Label>
                  <Select
                    value={borrowId}
                    onValueChange={(value) => {
                      setBorrowId(value)
                      const selected = availableInventoryDevices.find((device) => device.id === value)
                      setBorrowType(selected ? toTitleCase(selected.device_type ?? undefined) : borrowType)
                    }}
                    disabled={inventoryLoading || filteredBorrowDevices.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          inventoryLoading
                            ? "Loading devices..."
                            : filteredBorrowDevices.length === 0
                              ? borrowType
                                ? "No devices for this type"
                                : "Select a device type first"
                              : "Select device"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBorrowDevices.map((device) => {
                        const label = device.model || device.brand || toTitleCase(device.device_type ?? undefined) || "Device"
                        const tag = device.asset_tag || device.serial_number || device.id
                        return (
                          <SelectItem key={device.id} value={device.id}>
                            {label} ({tag})
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-dashed border-muted/70 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Identifier</span>
                    <span className="font-medium text-[#25294B]">
                      {selectedBorrowDevice?.asset_tag ||
                        selectedBorrowDevice?.serial_number ||
                        (borrowId ? "Fetching details..." : "—")}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Borrow Date</Label>
                    <Input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={borrowDate ? new Date(borrowDate).toISOString().split('T')[0] : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          const date = new Date(e.target.value + 'T00:00:00')
                          setBorrowDate(date.toISOString())
                        } else {
                          setBorrowDate("")
                        }
                      }}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Select a date (today or future).</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Return Date</Label>
                    <Input
                      type="date"
                      min={borrowDateIso}
                      max={borrowReturnLimitIso}
                      value={borrowReturnDate}
                      onChange={(e) => handleBorrowReturnDateChange(e.target.value)}
                      aria-invalid={Boolean(borrowReturnError) || undefined}
                      className={`text-sm ${borrowReturnError ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {borrowReturnError ? (
                      <p className="text-xs text-destructive">{borrowReturnError}</p>
                    ) : (
                      borrowReturnLimitIso && (
                        <p className="text-[11px] text-muted-foreground">
                          Return within {MAX_BORROW_DURATION_DAYS} days ({borrowReturnLimitIso} latest).
                        </p>
                      )
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Textarea rows={3} placeholder="Provide a brief purpose for borrowing" value={borrowPurpose} onChange={(e) => setBorrowPurpose(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="w-40">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={submitBorrow}
                    disabled={!borrowDialogReady || borrowSubmitting}
                  >
                    {borrowSubmitting ? "Submitting…" : "Submit Request"}
                  </Button>
                </div>
              </div>
              </DialogContent>
            </Dialog>
          )}
          </div>
            {/* Borrow Confirmation Slip */}
            <Dialog
              open={borrowConfirmOpen}
              onOpenChange={(open) => {
                setBorrowConfirmOpen(open)
                if (!open) {
                  if (lastBorrowRecordId) {
                    updateHistory((prev) =>
                      prev.map((entry) =>
                        entry.recordId === lastBorrowRecordId ? { ...entry, status: "Borrowed" } : entry,
                      ),
                    )
                    setLastBorrowRecordId(null)
                  }
                  setBorrowReceipt(null)
                }
              }}
            >
              <DialogContent className="sm:max-w-lg space-y-4 rounded-xl">
                <DialogHeader className="space-y-1 rounded-lg bg-white/80 p-4 shadow-sm border-b border-[#E4E4E7]">
                  <DialogTitle>Borrow Summary</DialogTitle>
                  <DialogDescription>Quick confirmation of your borrow request.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm px-4">
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Device:</span>
                    <span className="font-medium text-[#25294B]">{borrowReceipt?.deviceName ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Type:</span>
                    <span className="font-medium text-[#25294B]">{borrowReceipt?.deviceType ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Asset Tag:</span>
                    <span className="font-medium text-[#25294B]">{borrowReceipt?.deviceId ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Borrowed On:</span>
                    <span className="font-medium text-[#25294B]">
                      {borrowReceipt ? new Date(borrowReceipt.borrowDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Return Date:</span>
                    <span className="font-medium text-[#25294B]">
                      {borrowReceipt?.expectedReturnDate
                        ? new Date(borrowReceipt.expectedReturnDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#808285]/20 flex items-center justify-between">
                    <span className="text-[#58595B] text-xs">Status</span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                      style={(() => {
                        const status = borrowReceipt?.status || "Pending"
                        const color = getDeviceStatusBadgeColor(status) || "#F59E0B"
                        return {
                          backgroundColor: color,
                          color: "white",
                          borderColor: color,
                        }
                      })()}
                    >
                      {borrowReceipt?.status ?? "Pending"}
                    </Badge>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

              <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                <DialogContent className="sm:max-w-lg space-y-4">
                  <DialogHeader className="space-y-2 mb-4">
                    <DialogTitle>Return Device</DialogTitle>
                    <DialogDescription className="mt-1">Provide the return details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Borrowed Devices</Label>
                      <Select value={returnDeviceId} onValueChange={setReturnDeviceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a device" />
                        </SelectTrigger>
                        <SelectContent>
                          {returnableDevices.map((entry) => (
                            <SelectItem key={entry.recordId} value={entry.recordId}>
                              {entry.deviceName} ({entry.deviceId}) ·{" "}
                              {formatDeviceStatusLabel(entry.status, { isReturnPending: entry.isReturnPending })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedReturnEntry && (
                      <div className="rounded-lg border border-dashed border-[#C7EDE0] bg-white/70 p-3 text-xs text-[#1E3A5F]">
                        <div className="flex items-center justify-between">
                          <span className="uppercase tracking-wide text-[#64748B]">Device</span>
                          <span className="font-medium">{selectedReturnEntry.deviceName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="uppercase tracking-wide text-[#64748B]">Type</span>
                          <span className="font-medium">{selectedReturnEntry.deviceType}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="uppercase tracking-wide text-[#64748B]">Asset Tag</span>
                          <span className="font-medium">{selectedReturnEntry.deviceId}</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Device Type</Label>
                        <Input
                          value={selectedReturnEntry?.deviceType ?? ""}
                          readOnly
                          placeholder="Auto-filled"
                          className="bg-muted/40 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Asset Tag</Label>
                        <Input
                          value={selectedReturnEntry?.deviceId ?? ""}
                          readOnly
                          placeholder="Auto-filled"
                          className="bg-muted/40 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Upload Picture <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-dashed p-3 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Camera className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Provide a reference photo if needed.</span>
                        </div>
                        <Input className="w-60" type="file" accept="image/*" onChange={(e) => setReturnFileName(e.target.files?.[0]?.name || null)} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Photos help with review but are not required.</p>
                      {returnFileName && (
                        <p className="text-xs text-muted-foreground mt-1">Selected file: {returnFileName}</p>
                      )}
                    </div>
                    <div>
                      <Label>Condition</Label>
                      <Select value={returnCondition} onValueChange={setReturnCondition}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Fair">Fair</SelectItem>
                          <SelectItem value="Damaged">Damaged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <DialogClose asChild>
                        <Button variant="outline" className="w-40">Cancel</Button>
                      </DialogClose>
                      <Button
                        className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!canSubmitReturn}
                        onClick={submitReturn}
                      >
                        Return Device
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

            {/* Return Confirmation Slip */}
            <Dialog
              open={returnConfirmOpen}
              onOpenChange={(open) => {
                setReturnConfirmOpen(open)
                if (!open) {
                  setReturnReceipt(null)
                }
              }}
            >
              <DialogContent className="sm:max-w-lg space-y-4">
                <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                  <DialogTitle>Return Summary</DialogTitle>
                  <DialogDescription>Snapshot of the device return.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-[#1F2937] rounded-lg bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Device</span>
                    <span className="font-medium">{returnReceipt?.deviceName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{returnReceipt?.deviceType ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Asset Tag</span>
                    <span className="font-medium">{returnReceipt?.deviceId ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Returned On</span>
                    <span className="font-medium">
                      {returnReceipt ? new Date(returnReceipt.returnDate).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Condition</span>
                    <span className="font-medium">{returnReceipt?.condition ?? "N/A"}</span>
                  </div>
                  {returnReceipt?.image && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Image</span>
                      <span className="font-medium text-[#2563EB]">{returnReceipt.image}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-[#111827]">{returnReceipt?.status ?? "—"}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                    onClick={() => {
                      setReturnConfirmOpen(false)
                      setReturnReceipt(null)
                    }}
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

      <Dialog
        open={incidentOpen}
        onOpenChange={(open) => {
          setIncidentOpen(open)
          if (!open) {
            setIncidentTarget(null)
            setIncidentType("")
            setIncidentDescription("")
            setIncidentDocument(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl space-y-4">
          <DialogHeader className="space-y-2 mb-2">
            <DialogTitle>Report Incident</DialogTitle>
            <DialogDescription>Only devices you have borrowed can be reported.</DialogDescription>
          </DialogHeader>
          {incidentTarget ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Device</Label>
                  <Input
                    value={incidentTarget.deviceName}
                    readOnly
                    className="bg-muted/40 text-sm"
                  />
                </div>
                <div>
                  <Label>Device Type</Label>
                  <Input
                    value={incidentTarget.deviceType}
                    readOnly
                    className="bg-muted/40 text-sm"
                  />
                </div>
                <div>
                  <Label>Asset Tag / ID</Label>
                  <Input
                    value={incidentTarget.deviceId}
                    readOnly
                    className="bg-muted/40 text-sm"
                  />
                </div>
                <div>
                  <Label>Borrowed On</Label>
                  <Input value={formatDateOnly(incidentTarget.borrowDate)} readOnly className="bg-muted/40 text-sm" />
                </div>
                <div>
                  <Label>Reported By</Label>
                  <Input
                    value={user?.name || user?.email || user?.employeeId || "Unknown Reporter"}
                    readOnly
                    className="bg-muted/40 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label>Incident Type</Label>
                <Select value={incidentType} onValueChange={setIncidentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Damage">Damage</SelectItem>
                    <SelectItem value="Malfunction">Malfunction</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Explanation</Label>
                <Textarea
                  rows={5}
                  placeholder="Describe what happened"
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Supporting Document{" "}
                  <span className="text-xs text-muted-foreground">(jpg/jpeg, png, pdf)</span>
                </Label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleIncidentFileChange}
                />
                {incidentDocument && (
                  <p className="text-xs text-muted-foreground">Selected: {incidentDocument.name}</p>
                )}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  className="w-40"
                  onClick={() => setIncidentOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!incidentType || !incidentDescription.trim() || incidentSubmitting}
                  onClick={submitIncident}
                >
                  {incidentSubmitting ? "Submitting…" : "Submit Report"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a borrowed device from the actions menu to report an incident.
            </p>
          )}
        </DialogContent>
      </Dialog>

            {/* Report Summary Modal */}
            <Dialog open={incidentSummaryOpen} onOpenChange={(open) => {
              setIncidentSummaryOpen(open)
              if (!open) {
                setIncidentSummaryData(null)
              }
            }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Incident Summary</DialogTitle>
                  <DialogDescription>Details of the submitted incident.</DialogDescription>
                </DialogHeader>
                {incidentSummaryData ? (
                  <div className="space-y-3 text-sm text-[#1F2937]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Device</span>
                      <span className="font-medium">{incidentSummaryData.deviceName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{incidentSummaryData.deviceType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Asset Tag</span>
                      <span className="font-medium">{incidentSummaryData.assetTag}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Incident</span>
                      <span className="font-medium">{incidentSummaryData.incidentType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Supporting Document</span>
                      <span className="font-medium text-right text-sm">
                        {incidentSummaryData.attachmentName ?? "Not provided"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reported On</span>
                      <span className="font-medium">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge 
                        variant="default"
                        style={{ backgroundColor: "#6B7280", color: "white", borderColor: "#6B7280" }}
                      >
                        Awaiting Review
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No incident details available.</p>
                )}
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setIncidentSummaryOpen(false)
                      setIncidentSummaryData(null)
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
          
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search devices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 uniform-input"
                    />
                  </div>
                </div>
                <Select value={filter} onValueChange={(value) => setFilter(value as FilterOption)}>
                  <SelectTrigger className="w-full md:w-48 uniform-input">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Borrowed">Borrowed</SelectItem>
                    <SelectItem value="Awaiting Return">Awaiting Return</SelectItem>
                    <SelectItem value="Awaiting Review">Awaiting Review</SelectItem>
                    <SelectItem value="Returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => {
                  setFilter("All")
                  setSearchTerm("")
                }}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Device History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Device History ({filteredHistory.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {historyError && (
                <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {historyError}
                </div>
              )}
              {loadingHistory && history.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading your device history...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead>Device Type</TableHead>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Borrow Date</TableHead>
                      <TableHead>Operations</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 && !loadingHistory ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No device records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((entry) => {
                        const statusLabel = formatDeviceStatusLabel(entry.status, {
                          isReturnPending: entry.isReturnPending,
                        })
                        const canEdit = canEditEntry(entry)
                        const statusLower = entry.status.toLowerCase()

                        return (
                          <TableRow key={`${entry.recordId}-${entry.status}-${entry.borrowDate}`}>
                            <TableCell className="capitalize">{entry.deviceType}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{entry.deviceName}</div>
                                <div className="text-sm text-muted-foreground">{formatDateOnly(entry.borrowDate)}</div>
                              </div>
                            </TableCell>
                            <TableCell>{formatDateOnly(entry.borrowDate)}</TableCell>
                            <TableCell>{entry.action}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={statusLower.includes("unverified") || statusLower === "pending" ? "destructive" : "default"}
                                style={getDeviceStatusBadgeColor(statusLabel) ? { backgroundColor: getDeviceStatusBadgeColor(statusLabel), color: "white", borderColor: getDeviceStatusBadgeColor(statusLabel) } : undefined}
                              >
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    aria-label="More actions"
                                    className="hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#92278F]/30"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault()
                                      handleEditEntry(entry)
                                    }}
                                    disabled={!canEdit}
                                    className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault()
                                      handleReturnFromHistory(entry)
                                    }}
                                    disabled={entry.status !== "Borrowed" && entry.status !== "Awaiting Return"}
                                    className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Return
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault()
                                      handleReportIncident(entry)
                                    }}
                                    disabled={statusLower !== "borrowed" && statusLower !== "awaiting return"}
                                    className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                  >
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Incident Report
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault()
                                      handleReBook(entry)
                                    }}
                                    disabled={statusLower !== "attended"}
                                    className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                  >
                                    <Repeat className="mr-2 h-4 w-4" />
                                    Re-book
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault()
                                      handleDeleteEntry(entry)
                                    }}
                                    className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 disabled:cursor-not-allowed disabled:text-slate-300"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open)
              if (!open) {
                setEditRecord(null)
                setEditReturnDate("")
              }
            }}
          >
            <DialogContent className="sm:max-w-md space-y-4">
              <DialogHeader className="mb-2">
                <DialogTitle>Edit Return Date</DialogTitle>
                <DialogDescription>Adjust the expected return date for this device.</DialogDescription>
              </DialogHeader>
              {editRecord ? (
                <div className="space-y-3">
                  <div>
                    <Label>Device</Label>
                    <Input
                      value={`${editRecord.deviceName} (${editRecord.deviceId})`}
                      readOnly
                      className="bg-muted/40 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Borrowed On</Label>
                <Input value={formatDateOnly(editRecord.borrowDate)} readOnly className="bg-muted/40 text-sm" />
                  </div>
                  <div>
                    <Label>Current Return Date</Label>
                    <Input
                      value={formatDateOnly(editRecord.expectedReturnDate || editRecord.returnDate)}
                      readOnly
                      className="bg-muted/40 text-sm"
                    />
                  </div>
                  </div>
                  <div>
                    <Label>New Return Date</Label>
                    <Input
                      type="date"
                      value={editReturnDate}
                      min={toDateInputValue(editRecord.borrowDate)}
                      onChange={(e) => setEditReturnDate(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a record to edit.</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 disabled:opacity-60"
                  onClick={handleSaveEdit}
                  disabled={!editRecord}
                >
                  Save Return Date
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        {/* Add Device Modal */}
        <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <Package className="h-5 w-5" />
                Add New Device
              </DialogTitle>
              <DialogDescription>
                Register a new device to the inventory. Scan QR code or enter details manually.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* QR Scanner Section */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Scan Device QR Code</Label>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <QRScanner
                    onScan={(result) => {
                      setQrCodeValue(result)
                      setQrScannerError(null)
                      // Optionally auto-fill asset_tag if QR code matches pattern
                      if (!deviceForm.asset_tag && result) {
                        setDeviceForm({ ...deviceForm, asset_tag: result })
                      }
                    }}
                    onError={(error) => {
                      setQrScannerError(error)
                    }}
                    className="w-full"
                  />
                  {qrCodeValue && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        Scanned: <span className="font-mono font-semibold">{qrCodeValue}</span>
                      </p>
                    </div>
                  )}
                  {qrScannerError && (
                    <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded">
                      <p className="text-sm text-destructive">{qrScannerError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Device Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset_tag">Asset Tag *</Label>
                  <Input
                    id="asset_tag"
                    value={deviceForm.asset_tag}
                    onChange={(e) => {
                      const updated = { ...deviceForm, asset_tag: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="DEV-012"
                    className={deviceFormErrors.asset_tag ? "border-destructive focus-visible:ring-destructive/40" : ""}
                    required
                  />
                  {deviceFormErrors.asset_tag && (
                    <p className="text-xs text-destructive">{deviceFormErrors.asset_tag}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number *</Label>
                  <Input
                    id="serial_number"
                    value={deviceForm.serial_number}
                    onChange={(e) => {
                      const updated = { ...deviceForm, serial_number: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="SN-123456789"
                    className={deviceFormErrors.serial_number ? "border-destructive focus-visible:ring-destructive/40" : ""}
                    required
                  />
                  {deviceFormErrors.serial_number && (
                    <p className="text-xs text-destructive">{deviceFormErrors.serial_number}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_type">Device Type *</Label>
                  <Select
                    value={deviceForm.device_type}
                    onValueChange={(value) => {
                      const updated = { ...deviceForm, device_type: value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                  >
                    <SelectTrigger className={deviceFormErrors.device_type ? "border-destructive focus-visible:ring-destructive/40" : ""}>
                      <SelectValue placeholder="Select device type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laptop">Laptop</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="Tablet">Tablet</SelectItem>
                      <SelectItem value="Monitor">Monitor</SelectItem>
                      <SelectItem value="Headphones">Headphones</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {deviceFormErrors.device_type && (
                    <p className="text-xs text-destructive">{deviceFormErrors.device_type}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    value={deviceForm.brand}
                    onChange={(e) => {
                      const updated = { ...deviceForm, brand: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="Samsung"
                    className={deviceFormErrors.brand ? "border-destructive focus-visible:ring-destructive/40" : ""}
                    required
                  />
                  {deviceFormErrors.brand && (
                    <p className="text-xs text-destructive">{deviceFormErrors.brand}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    value={deviceForm.model}
                    onChange={(e) => {
                      const updated = { ...deviceForm, model: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="Galaxy A05"
                    className={deviceFormErrors.model ? "border-destructive focus-visible:ring-destructive/40" : ""}
                    required
                  />
                  {deviceFormErrors.model && (
                    <p className="text-xs text-destructive">{deviceFormErrors.model}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition *</Label>
                  <Select
                    value={deviceForm.condition}
                    onValueChange={(value) => setDeviceForm({ ...deviceForm, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={deviceForm.status}
                    onValueChange={(value) => setDeviceForm({ ...deviceForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="borrowed">Borrowed</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={deviceForm.location}
                    onChange={(e) => {
                      const updated = { ...deviceForm, location: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="storage"
                    className={deviceFormErrors.location ? "border-destructive focus-visible:ring-destructive/40" : ""}
                    required
                  />
                  {deviceFormErrors.location && (
                    <p className="text-xs text-destructive">{deviceFormErrors.location}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpu">CPU</Label>
                  <Input
                    id="cpu"
                    value={deviceForm.cpu}
                    onChange={(e) => setDeviceForm({ ...deviceForm, cpu: e.target.value })}
                    placeholder="Snapdragon 8 Gen 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ram_gb">RAM (GB)</Label>
                  <Input
                    id="ram_gb"
                    type="number"
                    min="1"
                    max="1024"
                    value={deviceForm.ram_gb}
                    onChange={(e) => {
                      const updated = { ...deviceForm, ram_gb: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="12"
                    className={deviceFormErrors.ram_gb ? "border-destructive focus-visible:ring-destructive/40" : ""}
                  />
                  {deviceFormErrors.ram_gb && (
                    <p className="text-xs text-destructive">{deviceFormErrors.ram_gb}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_gb">Storage (GB)</Label>
                  <Input
                    id="storage_gb"
                    type="number"
                    min="1"
                    max="100000"
                    value={deviceForm.storage_gb}
                    onChange={(e) => {
                      const updated = { ...deviceForm, storage_gb: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="256"
                    className={deviceFormErrors.storage_gb ? "border-destructive focus-visible:ring-destructive/40" : ""}
                  />
                  {deviceFormErrors.storage_gb && (
                    <p className="text-xs text-destructive">{deviceFormErrors.storage_gb}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="os">Operating System</Label>
                  <Input
                    id="os"
                    value={deviceForm.os}
                    onChange={(e) => {
                      const updated = { ...deviceForm, os: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    placeholder="Android 14"
                    className={deviceFormErrors.os ? "border-destructive focus-visible:ring-destructive/40" : ""}
                  />
                  {deviceFormErrors.os && (
                    <p className="text-xs text-destructive">{deviceFormErrors.os}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={deviceForm.purchase_date}
                    onChange={(e) => {
                      const updated = { ...deviceForm, purchase_date: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    className={deviceFormErrors.purchase_date ? "border-destructive focus-visible:ring-destructive/40" : ""}
                  />
                  {deviceFormErrors.purchase_date && (
                    <p className="text-xs text-destructive">{deviceFormErrors.purchase_date}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input
                    id="warranty_expiry"
                    type="date"
                    min={deviceForm.purchase_date || undefined}
                    value={deviceForm.warranty_expiry}
                    onChange={(e) => {
                      const updated = { ...deviceForm, warranty_expiry: e.target.value }
                      setDeviceForm(updated)
                      const errors = validateDeviceForm(updated)
                      setDeviceFormErrors(errors)
                    }}
                    className={deviceFormErrors.warranty_expiry ? "border-destructive focus-visible:ring-destructive/40" : ""}
                  />
                  {deviceFormErrors.warranty_expiry && (
                    <p className="text-xs text-destructive">{deviceFormErrors.warranty_expiry}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={deviceForm.notes}
                  onChange={(e) => {
                    const updated = { ...deviceForm, notes: e.target.value }
                    setDeviceForm(updated)
                    const errors = validateDeviceForm(updated)
                    setDeviceFormErrors(errors)
                  }}
                  placeholder="Allocated for creating mobile application"
                  rows={3}
                  maxLength={1000}
                  className={deviceFormErrors.notes ? "border-destructive focus-visible:ring-destructive/40" : ""}
                />
                <div className="flex justify-between items-center">
                  {deviceFormErrors.notes && (
                    <p className="text-xs text-destructive">{deviceFormErrors.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground ml-auto">
                    {deviceForm.notes.length}/1000 characters
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAddDeviceOpen(false)
                setDeviceForm({
                  asset_tag: "",
                  serial_number: "",
                  device_type: "",
                  brand: "",
                  model: "",
                  cpu: "",
                  ram_gb: "",
                  storage_gb: "",
                  os: "",
                  purchase_date: "",
                  warranty_expiry: "",
                  condition: "Excellent",
                  status: "available",
                  location: "storage",
                  notes: "",
                })
                setQrCodeValue("")
                setQrScannerError(null)
                setDeviceFormErrors({})
              }}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (addDeviceSubmitting) return
                  
                  // Validate all fields
                  const errors = validateDeviceForm(deviceForm)
                  setDeviceFormErrors(errors)

                  if (Object.keys(errors).length > 0) {
                    toast({
                      variant: "destructive",
                      title: "Validation errors",
                      description: "Please fix the errors in the form before submitting.",
                    })
                    return
                  }

                  // Double-check required fields
                  if (!deviceForm.asset_tag || !deviceForm.serial_number || !deviceForm.device_type || !deviceForm.brand || !deviceForm.model || !deviceForm.location) {
                    toast({
                      variant: "destructive",
                      title: "Missing required fields",
                      description: "Please fill in all required fields (Asset Tag, Serial Number, Device Type, Brand, Model, Location).",
                    })
                    return
                  }

                  setAddDeviceSubmitting(true)
                  try {
                    // Prepare device payload
                    const devicePayload: any = {
                      asset_tag: deviceForm.asset_tag,
                      serial_number: deviceForm.serial_number,
                      device_type: deviceForm.device_type,
                      brand: deviceForm.brand,
                      model: deviceForm.model,
                      condition: deviceForm.condition,
                      status: deviceForm.status,
                      location: deviceForm.location,
                      notes: deviceForm.notes || null,
                    }

                    // Add specs if provided
                    if (deviceForm.cpu || deviceForm.ram_gb || deviceForm.storage_gb || deviceForm.os) {
                      devicePayload.specs = {
                        cpu: deviceForm.cpu || null,
                        ram_gb: deviceForm.ram_gb ? parseInt(deviceForm.ram_gb) : null,
                        storage_gb: deviceForm.storage_gb ? parseInt(deviceForm.storage_gb) : null,
                        os: deviceForm.os || null,
                      }
                    }

                    // Add dates if provided
                    if (deviceForm.purchase_date) {
                      devicePayload.purchase_date = deviceForm.purchase_date
                    }
                    if (deviceForm.warranty_expiry) {
                      devicePayload.warranty_expiry = deviceForm.warranty_expiry
                    }

                    // Save to database
                    const response = await fetch("/api/devices", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(devicePayload),
                    })

                    const json = await response.json()
                    if (!response.ok || json.success === false) {
                      // Check if it's a duplicate error (409 status)
                      if (response.status === 409 || json.error?.toLowerCase().includes('duplicate')) {
                        throw new Error(`DUPLICATE_ASSET_TAG: ${json.error || "Asset tag already exists"}`)
                      }
                      throw new Error(json.error || "Failed to create device")
                    }

                    toast({
                      title: "Device added",
                      description: "Device has been successfully added to the inventory.",
                    })

                    // Reset form and close modal
                    setAddDeviceOpen(false)
                    setDeviceForm({
                      asset_tag: "",
                      serial_number: "",
                      device_type: "",
                      brand: "",
                      model: "",
                      cpu: "",
                      ram_gb: "",
                      storage_gb: "",
                      os: "",
                      purchase_date: "",
                      warranty_expiry: "",
                      condition: "Excellent",
                      status: "available",
                  location: "storage",
                  notes: "",
                })
                setQrCodeValue("")
                setQrScannerError(null)
                setDeviceFormErrors({})

                    // Refresh inventory
                    await loadInventory()
                  } catch (error) {
                    // Check if it's a duplicate asset tag error
                    const errorMessage = error instanceof Error ? error.message : "Please try again."
                    const isDuplicateError = 
                      errorMessage.includes('DUPLICATE_ASSET_TAG') ||
                      errorMessage.toLowerCase().includes('duplicate') ||
                      errorMessage.toLowerCase().includes('asset_tag') ||
                      errorMessage.toLowerCase().includes('already exists')
                    
                    if (isDuplicateError) {
                      // Extract the actual error message if it's a DUPLICATE_ASSET_TAG error
                      const cleanMessage = errorMessage.replace('DUPLICATE_ASSET_TAG: ', '')
                      toast({
                        variant: "destructive",
                        title: "Asset Tag Already Exists",
                        description: `The asset tag "${deviceForm.asset_tag}" is already in use. Please use a different asset tag.`,
                      })
                      // Highlight the asset tag field
                      setDeviceFormErrors({
                        ...deviceFormErrors,
                        asset_tag: "This asset tag already exists. Please use a different one.",
                      })
                    } else {
                      toast({
                        variant: "destructive",
                        title: "Failed to add device",
                        description: errorMessage,
                      })
                    }
                  } finally {
                    setAddDeviceSubmitting(false)
                  }
                }}
                disabled={addDeviceSubmitting}
              >
                {addDeviceSubmitting ? "Saving..." : "Save Device"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Device Modal */}
        <Dialog 
          open={assignDeviceOpen} 
          onOpenChange={(open) => {
            setAssignDeviceOpen(open)
            if (!open) {
              // Reset form when dialog closes
              setAssignDeviceForm({
                deviceId: "",
                employeeId: "",
                purpose: "",
                expectedReturnDate: "",
              })
              setAssignDeviceErrors({})
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <UserPlus className="h-5 w-5" />
                Assign Device
              </DialogTitle>
              <DialogDescription>
                Assign an available device to an employee
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assign_device">Available Device *</Label>
                <Select
                  value={assignDeviceForm.deviceId}
                  onValueChange={(value) => {
                    setAssignDeviceForm({ ...assignDeviceForm, deviceId: value })
                    setAssignDeviceErrors({ ...assignDeviceErrors, deviceId: "" })
                  }}
                >
                  <SelectTrigger className={assignDeviceErrors.deviceId ? "border-destructive focus-visible:ring-destructive/40" : ""}>
                    <SelectValue placeholder={availableDevicesLoading ? "Loading devices..." : availableDevicesForAssign.length === 0 ? "No available devices" : "Select a device"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDevicesForAssign.map((device) => {
                      const identifier = device.asset_tag || device.serial_number || device.id
                      const deviceName = `${device.brand || ""} ${device.model || ""} ${device.device_type || ""}`.trim() || "Device"
                      return (
                        <SelectItem key={device.id} value={device.id}>
                          {identifier} • {deviceName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {assignDeviceErrors.deviceId && (
                  <p className="text-xs text-destructive">{assignDeviceErrors.deviceId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign_employee_id">Employee *</Label>
                <Select
                  value={assignDeviceForm.employeeId}
                  onValueChange={(value) => {
                    setAssignDeviceForm({ ...assignDeviceForm, employeeId: value })
                    setAssignDeviceErrors({ ...assignDeviceErrors, employeeId: "" })
                  }}
                  disabled={employeesLoading}
                >
                  <SelectTrigger className={assignDeviceErrors.employeeId ? "border-destructive focus-visible:ring-destructive/40" : ""}>
                    <SelectValue placeholder={employeesLoading ? "Loading employees..." : employeesList.length === 0 ? "No employees available" : "Select an employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesList.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No employees found</div>
                    ) : (
                      employeesList.map((employee) => {
                        const displayName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Unknown'
                        const employeeId = employee.employee_id || employee.id || ''
                        return (
                          <SelectItem key={employee.id} value={employee.id}>
                            {displayName} ({employeeId})
                          </SelectItem>
                        )
                      })
                    )}
                  </SelectContent>
                </Select>
                {assignDeviceErrors.employeeId && (
                  <p className="text-xs text-destructive">{assignDeviceErrors.employeeId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign_purpose">Purpose *</Label>
                <Textarea
                  id="assign_purpose"
                  value={assignDeviceForm.purpose}
                  onChange={(e) => {
                    setAssignDeviceForm({ ...assignDeviceForm, purpose: e.target.value })
                    setAssignDeviceErrors({ ...assignDeviceErrors, purpose: "" })
                  }}
                  placeholder="Reason for assignment..."
                  rows={3}
                  className={assignDeviceErrors.purpose ? "border-destructive focus-visible:ring-destructive/40" : ""}
                />
                {assignDeviceErrors.purpose && (
                  <p className="text-xs text-destructive">{assignDeviceErrors.purpose}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign_return_date">Expected Return Date</Label>
                <Input
                  id="assign_return_date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={assignDeviceForm.expectedReturnDate}
                  onChange={(e) => {
                    setAssignDeviceForm({ ...assignDeviceForm, expectedReturnDate: e.target.value })
                    setAssignDeviceErrors({ ...assignDeviceErrors, expectedReturnDate: "" })
                  }}
                  className={assignDeviceErrors.expectedReturnDate ? "border-destructive focus-visible:ring-destructive/40" : ""}
                />
                {assignDeviceErrors.expectedReturnDate && (
                  <p className="text-xs text-destructive">{assignDeviceErrors.expectedReturnDate}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAssignDeviceOpen(false)
                setAssignDeviceForm({
                  deviceId: "",
                  employeeId: "",
                  purpose: "",
                  expectedReturnDate: "",
                })
                setAssignDeviceErrors({})
              }}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (assignDeviceSubmitting) return
                  
                  const errors: Record<string, string> = {}

                  if (!assignDeviceForm.deviceId) {
                    errors.deviceId = "Please select a device."
                  }

                  if (!assignDeviceForm.employeeId || assignDeviceForm.employeeId.trim() === "") {
                    errors.employeeId = "Please select an employee."
                  }

                  if (!assignDeviceForm.purpose || assignDeviceForm.purpose.trim() === "") {
                    errors.purpose = "Purpose is required."
                  }

                  if (assignDeviceForm.expectedReturnDate) {
                    const returnDate = new Date(assignDeviceForm.expectedReturnDate)
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    if (returnDate < today) {
                      errors.expectedReturnDate = "Expected return date cannot be in the past."
                    }
                    // Check if weekend
                    const dayOfWeek = returnDate.getDay()
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                      errors.expectedReturnDate = "Expected return date cannot be on a weekend."
                    }
                  }

                  setAssignDeviceErrors(errors)

                  if (Object.keys(errors).length > 0) {
                    toast({
                      variant: "destructive",
                      title: "Validation errors",
                      description: "Please fix the errors in the form before submitting.",
                    })
                    return
                  }

                  setAssignDeviceSubmitting(true)
                  try {
                    // Call API to assign device
                    const response = await fetch("/api/assigned-devices", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        device_id: assignDeviceForm.deviceId,
                        employee_id: assignDeviceForm.employeeId,
                        purpose: assignDeviceForm.purpose,
                        expected_return_date: assignDeviceForm.expectedReturnDate || null,
                        assignment_type: "temporary",
                        status: "pending",
                      }),
                    })

                    const json = await response.json()
                    if (!response.ok || json.success === false) {
                      throw new Error(json.error || "Failed to assign device")
                    }

                    toast({
                      title: "Device assigned",
                      description: "Device assignment request has been submitted successfully.",
                    })

                    setAssignDeviceOpen(false)
                    setAssignDeviceForm({
                      deviceId: "",
                      employeeId: "",
                      purpose: "",
                      expectedReturnDate: "",
                    })
                    setAssignDeviceErrors({})

                    // Refresh inventory
                    await loadInventory()
                  } catch (error) {
                    toast({
                      variant: "destructive",
                      title: "Failed to assign device",
                      description: error instanceof Error ? error.message : "Please try again.",
                    })
                  } finally {
                    setAssignDeviceSubmitting(false)
                  }
                }}
                disabled={assignDeviceSubmitting}
              >
                {assignDeviceSubmitting ? "Assigning..." : "Assign Device"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Collect & Scan Device Modal */}
        <CollectScanDeviceModal
          open={collectScanModalOpen}
          onOpenChange={setCollectScanModalOpen}
          mode={collectScanMode}
          borrowId={collectScanBorrowId}
          deviceId={collectScanDeviceId}
          onScanSuccess={handleScanSuccess}
          onError={(error) => {
            toast({
              variant: "destructive",
              title: "Scan failed",
              description: error,
            })
          }}
        />

        {/* Device Condition Check Modal (Supervisor) */}
        <DeviceConditionCheckModal
          open={conditionCheckModalOpen}
          onOpenChange={setConditionCheckModalOpen}
          borrowId={pendingReturnBorrowId}
          onConfirm={async (condition) => {
            if (pendingReturnBorrowId && pendingReturnScannedCode) {
              await completeReturnScan(pendingReturnBorrowId, pendingReturnScannedCode)
              setPendingReturnBorrowId(undefined)
              setPendingReturnScannedCode(undefined)
            }
          }}
        />
        </div>
      </div>
    </AMSDashboardLayout>
  )
}


