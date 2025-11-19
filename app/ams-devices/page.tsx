"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import Link from "next/link"
import { Package, Trash2, Camera, Sparkles, Laptop, Monitor, Smartphone, Tablet, Headphones, PenLine } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { DEVICE_HISTORY_UPDATED_EVENT } from "@/lib/storage/device-history"

const deviceCatalog = [
  { assetTag: "LAP-001", name: "MacBook Pro 14\"", type: "Laptop" },
  { assetTag: "LAP-002", name: "Dell XPS 13\"", type: "Laptop" },
  { assetTag: "TAB-001", name: "iPad Pro 12.9\"", type: "Tablet" },
  { assetTag: "PHN-001", name: "iPhone 15 Pro", type: "Phone" },
  { assetTag: "PHN-002", name: "Samsung Galaxy S24", type: "Phone" },
  { assetTag: "HDP-001", name: "Logitech Headset", type: "Accessories" },
  { assetTag: "MON-001", name: "Dell UltraSharp 27\"", type: "Monitor" },
]

type DeviceActionType = "Borrow" | "Return" | "Incident"
type DeviceHistoryStatus = "Pending" | "Borrowed" | "Awaiting Return" | "Awaiting Review" | "Returned"

type DeviceHistoryRow = {
  recordId: string
  deviceId: string
  deviceName: string
  deviceType: string
  borrowDate: string
  expectedReturnDate?: string
  returnDate?: string
  status: DeviceHistoryStatus
  action: DeviceActionType
  notes?: string
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
}

const toTitleCase = (value?: string): string => {
  if (!value) return "Unknown"
  return value
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const formatDeviceStatusLabel = (status?: string | null) => {
  if (!status) return "Status unknown"
  return status.toLowerCase().includes("pending") ? "Pending Borrow" : toTitleCase(status)
}

const allowedStatuses: DeviceHistoryStatus[] = ["Pending", "Borrowed", "Awaiting Return", "Awaiting Review", "Returned"]
const editableStatusSet = new Set(["pending", "awaiting review", "awaiting return"])

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
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  borrowed: "bg-amber-100 text-amber-800 border-amber-200",
  awaiting_return: "bg-rose-100 text-rose-800 border-rose-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  returned: "bg-slate-200 text-slate-600 border-slate-300",
  cancelled: "bg-slate-50 text-slate-400 border-slate-100",
  rejected: "bg-rose-50 text-rose-500 border-rose-100",
}

const normalizeHistoryEntry = (entry: any): DeviceHistoryRow => {
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
      deviceName: entry.deviceName ?? "Unknown Device",
      deviceType: entry.deviceType ?? "Device",
      borrowDate: entry.borrowDate ?? new Date().toISOString().split("T")[0],
      expectedReturnDate: entry.expectedReturnDate ?? undefined,
      returnDate: entry.returnDate ?? undefined,
      status: sanitizedStatus,
      action: deriveAction(entry.action, sanitizedStatus),
      notes: entry.notes ?? undefined,
    }
  }

  const sanitizedStatus = sanitizeStatus(entry?.status)
  return {
    recordId: entry?.id ?? crypto.randomUUID(),
    deviceId: entry?.deviceId ?? entry?.asset_tag ?? `LEGACY-${crypto.randomUUID()}`,
    deviceName: entry?.deviceName ?? entry?.deviceName ?? entry?.model ?? entry?.name ?? "Unknown Device",
    deviceType: entry?.deviceType ? toTitleCase(entry.deviceType) : toTitleCase(entry?.type ?? "Device"),
    borrowDate: entry?.borrowDate ?? entry?.date ?? new Date().toISOString().split("T")[0],
    expectedReturnDate: entry?.expectedReturnDate ?? entry?.returnDate ?? undefined,
    returnDate: entry?.returnDate ?? undefined,
    status: sanitizedStatus,
    action: deriveAction(entry?.action, sanitizedStatus),
    notes: entry?.notes ?? undefined,
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
  const [history, setHistory] = useState<DeviceHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  type FilterOption = "All" | DeviceHistoryStatus
  const [filter, setFilter] = useState<FilterOption>("All")

  const storageKey = userIdentity ? `ams_device_history_${userIdentity}` : null

  const updateHistory = (updater: (prev: DeviceHistoryRow[]) => DeviceHistoryRow[]) => {
    setHistory((prev) => {
      const next = updater(prev)
      if (storageKey && typeof window !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify(next))
      }
      return next
    })
  }

  // Borrow modal state
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [borrowType, setBorrowType] = useState("")
  const [borrowId, setBorrowId] = useState("")
  const [borrowDate, setBorrowDate] = useState("")
  const [borrowReturnDate, setBorrowReturnDate] = useState("")
  const [borrowPurpose, setBorrowPurpose] = useState("")
  const [borrowDateDisplay, setBorrowDateDisplay] = useState("")
  const [borrowReturnError, setBorrowReturnError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [borrowReceipt, setBorrowReceipt] = useState<BorrowReceipt | null>(null)
  const [borrowConfirmOpen, setBorrowConfirmOpen] = useState(false)

  // Return modal state
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnDeviceId, setReturnDeviceId] = useState("")
  const [returnCondition, setReturnCondition] = useState("")
  const [returnFileName, setReturnFileName] = useState<string | null>(null)
  const [returnReceipt, setReturnReceipt] = useState<ReturnReceipt | null>(null)
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false)
  const [lastBorrowRecordId, setLastBorrowRecordId] = useState<string | null>(null)

  // Incident modal state
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [incidentType, setIncidentType] = useState("")
  const [incidentDeviceType, setIncidentDeviceType] = useState("")
  const [incidentDeviceName, setIncidentDeviceName] = useState("")
  const [incidentNotes, setIncidentNotes] = useState("")
  const [incidentSummaryOpen, setIncidentSummaryOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<DeviceHistoryRow | null>(null)
  const [editStatus, setEditStatus] = useState<DeviceHistoryStatus>("Pending")
  const [editNotes, setEditNotes] = useState("")
  if (!user) return null

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

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString()
  }

  const visibleAssignments = useMemo(() => {
    return assignedDevices.filter((assignment) => {
      const status = (assignment.status ?? "").toLowerCase()
      return status !== "cancelled"
    })
  }, [assignedDevices])

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
    if (!returnOpen || !returnDeviceId) return
    updateHistory((prev) =>
      prev.map((entry) =>
        entry.recordId === returnDeviceId && entry.status !== "Returned"
          ? {
              ...entry,
              status: "Awaiting Return",
              action: entry.action === "Incident" ? entry.action : "Borrow",
            }
          : entry
      )
    )
  }, [returnOpen, returnDeviceId])

  useEffect(() => {
    if (!borrowOpen || typeof window === "undefined") return

    const updateNow = () => {
      const now = new Date()
      setBorrowDate(now.toISOString())
      setBorrowDateDisplay(now.toLocaleString())
    }

    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)
    return () => window.clearInterval(intervalId)
  }, [borrowOpen])

  useEffect(() => {
    if (!borrowOpen) {
      setBorrowReturnError(null)
    }
  }, [borrowOpen])

  const handleDelete = (recordId: string) => {
    updateHistory((prev) => prev.filter((entry) => entry.recordId !== recordId))
    if (editRecord?.recordId === recordId) {
      setEditDialogOpen(false)
      setEditRecord(null)
      setEditNotes("")
    }
    setBannerMessage("Entry removed from your device history.")
    setTimeout(() => setBannerMessage(null), 4000)
  }

  const filteredHistory = useMemo(() => {
    if (filter === "All") return history
    return history.filter((entry) => entry.status === filter)
  }, [history, filter])

  // Borrow handlers
  const parseDateOnly = (value: string) => {
    if (!value) return null
    const [year, month, day] = value.split("-").map(Number)
    if ([year, month, day].some((part) => Number.isNaN(part))) return null
    return new Date(year, month - 1, day)
  }

  const isReturnDateValid = (value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return parsed > today
  }

  const handleBorrowReturnDateChange = (value: string) => {
    setBorrowReturnDate(value)
    if (!value) {
      setBorrowReturnError(null)
      return
    }
    if (!isReturnDateValid(value)) {
      setBorrowReturnError("Return date must be after today.")
      toast({
        variant: "destructive",
        title: "Invalid return date",
        description: "Please choose a return date that is in the future.",
      })
    } else {
      setBorrowReturnError(null)
    }
  }

  const submitBorrow = () => {
    if (!borrowId) {
      setBannerMessage("Select a device to borrow.")
      setTimeout(() => setBannerMessage(null), 3000)
      return
    }

    const catalogDevice = deviceCatalog.find((device) => device.assetTag === borrowId)
    if (!catalogDevice) {
      setBannerMessage("Selected device is no longer available.")
      setTimeout(() => setBannerMessage(null), 3000)
      return
    }

    if (borrowReturnDate && !isReturnDateValid(borrowReturnDate)) {
      setBorrowReturnError("Return date must be after today.")
      toast({
        variant: "destructive",
        title: "Invalid return date",
        description: "Please choose a return date that is in the future.",
      })
      return
    }

    const borrowDateValue = borrowDate || new Date().toISOString()
    const recordId = crypto.randomUUID()
    const newEntry: DeviceHistoryRow = {
      recordId,
      deviceId: catalogDevice.assetTag,
      deviceName: catalogDevice.name,
      deviceType: catalogDevice.type,
      borrowDate: borrowDateValue,
      expectedReturnDate: borrowReturnDate || undefined,
      status: "Pending",
      action: "Borrow",
      notes: borrowPurpose || undefined,
    }

    updateHistory((prev) => [newEntry, ...prev])
    setLastBorrowRecordId(recordId)

    setBorrowReceipt({
      deviceId: catalogDevice.assetTag,
      deviceName: catalogDevice.name,
      deviceType: catalogDevice.type,
      borrowDate: borrowDateValue,
      expectedReturnDate: borrowReturnDate || undefined,
      status: 'Pending',
    })
    setBorrowConfirmOpen(true)
    setBorrowOpen(false)
    setBannerMessage(`${catalogDevice.name} added to your borrowing history.`)
    setTimeout(() => setBannerMessage(null), 6000)

    setBorrowType("")
    setBorrowId("")
    setBorrowReturnDate("")
    setBorrowPurpose("")
    setBorrowReturnError(null)
  }

  // Return handlers
  const borrowableDevices = useMemo(
    () => history.filter((entry) => entry.status === "Borrowed" || entry.status === "Awaiting Return"),
    [history]
  )
  const selectedReturnEntry = useMemo(
    () => history.find((entry) => entry.recordId === returnDeviceId),
    [history, returnDeviceId]
  )
  const submitReturn = () => {
    if (!returnDeviceId) {
      setBannerMessage("Select a device to return.")
      setTimeout(() => setBannerMessage(null), 3000)
      return
    }

    const returningEntry = history.find((entry) => entry.recordId === returnDeviceId)
    if (!returningEntry) {
      setBannerMessage("We couldn't find that borrowing record.")
      setTimeout(() => setBannerMessage(null), 3000)
      return
    }

    const today = new Date().toISOString().split("T")[0]
    updateHistory((prev) =>
      prev.map((entry) =>
        entry.recordId === returnDeviceId
          ? {
              ...entry,
              status: "Returned",
              returnDate: today,
              action: entry.action === "Incident" ? entry.action : "Return",
            }
          : entry
      )
    )

    setReturnReceipt({
      deviceId: returningEntry.deviceId,
      deviceName: returningEntry.deviceName,
      deviceType: returningEntry.deviceType,
      returnDate: today,
      status: "Returned",
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
  }

  // Incident handlers
  const submitIncident = () => {
    const catalogDevice = deviceCatalog.find((device) => device.name === incidentDeviceName)
    const today = new Date().toISOString().split("T")[0]

    const newEntry: DeviceHistoryRow = {
      recordId: crypto.randomUUID(),
      deviceId: catalogDevice?.assetTag ?? `TEMP-${Date.now()}`,
      deviceName: incidentDeviceName || catalogDevice?.name || "Unknown Device",
      deviceType: incidentDeviceType || catalogDevice?.type || "Device",
      borrowDate: today,
      status: "Awaiting Review",
      action: "Incident",
      notes: incidentNotes || undefined,
    }

    updateHistory((prev) => [newEntry, ...prev])
    setIncidentOpen(false)
    setIncidentSummaryOpen(true)
    setBannerMessage("Incident captured. We'll follow up soon.")
    setTimeout(() => setBannerMessage(null), 6000)
  }

  const resolveActionFromStatus = (status: DeviceHistoryStatus, previousAction: DeviceActionType): DeviceActionType => {
    if (previousAction === "Incident") return "Incident"
    if (status === "Returned") return "Return"
    if (status === "Awaiting Review") return "Incident"
    return "Borrow"
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
    setEditStatus(entry.status)
    setEditNotes(entry.notes ?? "")
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!editRecord) return

    const trimmedNotes = editNotes.trim()
    updateHistory((prev) =>
      prev.map((entry) => {
        if (entry.recordId !== editRecord.recordId) return entry
        const nextStatus = editStatus
        const nextAction = resolveActionFromStatus(nextStatus, entry.action)

        return {
          ...entry,
          status: nextStatus,
          action: nextAction,
          notes: trimmedNotes ? trimmedNotes : undefined,
        }
      })
    )

    setEditDialogOpen(false)
    setEditRecord(null)
    setEditNotes("")
    toast({
      title: "History updated",
      description: "Device record updated successfully.",
    })
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Device Management</h1>
          <p className="text-muted-foreground mt-2">Manage your devices and view device information</p>
          {bannerMessage && (
            <div className="mt-2 flex items-center justify-end gap-2 rounded-md border border-[#E6D9FF] bg-[#F6F1FF] px-3 py-2 text-sm text-[#3F3D56] shadow-sm">
              <Sparkles className="h-4 w-4 text-[#92278F]" />
              <span>{bannerMessage}</span>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Device Management History
              </CardTitle>
              <CardDescription>Your recent device-related actions</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:block mr-4">
                <Label className="mr-2 text-sm">Filter by</Label>
                <Select value={filter} onValueChange={(value) => setFilter(value as FilterOption)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Borrowed">Borrowed</SelectItem>
                    <SelectItem value="Awaiting Return">Awaiting Return</SelectItem>
                    <SelectItem value="Awaiting Review">Awaiting Review</SelectItem>
                    <SelectItem value="Returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={borrowOpen} onOpenChange={setBorrowOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white">Borrow Device</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg rounded-xl shadow-xl">
                  <DialogHeader className="space-y-2 mb-4">
                    <DialogTitle>Borrow Device</DialogTitle>
                    <DialogDescription className="mt-1">Fill in the borrowing details below</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Device</Label>
                      <Select
                        value={borrowId}
                        onValueChange={(value) => {
                          setBorrowId(value)
                          const selected = deviceCatalog.find((device) => device.assetTag === value)
                          setBorrowType(selected?.type ?? "")
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a device" />
                        </SelectTrigger>
                        <SelectContent>
                          {deviceCatalog.map((device) => (
                            <SelectItem key={device.assetTag} value={device.assetTag}>
                              {device.name} ({device.assetTag})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <Label>Device Type</Label>
                        <Input value={borrowType} readOnly placeholder="Select a device first" className="bg-muted/40 text-sm" />
                    </div>
                    <div>
                        <Label>Asset Tag</Label>
                        <Input value={borrowId} readOnly placeholder="Select a device first" className="bg-muted/40 text-sm" />
                      </div>
                    </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Borrow date</Label>
                    <Input
                      value={borrowDateDisplay || "Populating..."}
                      readOnly
                      className="bg-muted/40 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Captured automatically in real-time.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Return date</Label>
                    <Input
                      type="date"
                      value={borrowReturnDate}
                      onChange={(e) => handleBorrowReturnDateChange(e.target.value)}
                      aria-invalid={Boolean(borrowReturnError) || undefined}
                      className={`text-sm ${borrowReturnError ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {borrowReturnError && <p className="text-xs text-destructive">{borrowReturnError}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Textarea rows={4} placeholder="Provide a brief purpose for borrowing" value={borrowPurpose} onChange={(e) => setBorrowPurpose(e.target.value)} />
                </div>
                    <div className="flex items-center justify-between pt-2">
                      <DialogClose asChild>
                        <Button variant="outline" className="w-40">Cancel</Button>
                      </DialogClose>
                      <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40" onClick={submitBorrow}>Borrow Device</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
              <DialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
                <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                  <DialogTitle>Borrow Summary</DialogTitle>
                  <DialogDescription>Quick confirmation of your borrow request.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-[#1F2937] rounded-lg bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Device</span>
                    <span className="font-medium">{borrowReceipt?.deviceName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{borrowReceipt?.deviceType ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Asset Tag</span>
                    <span className="font-medium">{borrowReceipt?.deviceId ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Borrowed On</span>
                    <span className="font-medium">
                      {borrowReceipt ? new Date(borrowReceipt.borrowDate).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Return Date</span>
                    <span className="font-medium">
                      {borrowReceipt?.expectedReturnDate
                        ? new Date(borrowReceipt.expectedReturnDate).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-[#111827]">{borrowReceipt?.status ?? "—"}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                    onClick={() => {
                      setBorrowConfirmOpen(false)
                      setBorrowReceipt(null)
                    }}
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

              <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white">Return Device</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg rounded-xl shadow-xl">
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
                          {borrowableDevices.map((entry) => (
                            <SelectItem key={entry.recordId} value={entry.recordId}>
                              {entry.deviceName} ({entry.deviceId})
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
                    <div>
                      <Label>Upload Picture</Label>
                      <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-dashed p-3 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Camera className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Please upload a clear picture of the device</span>
                        </div>
                        <Input className="w-60" type="file" accept="image/*" onChange={(e) => setReturnFileName(e.target.files?.[0]?.name || null)} />
                      </div>
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
                      <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40" disabled={!returnDeviceId} onClick={submitReturn}>Return Device</Button>
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
              <DialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
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

              <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white">Report Incident</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg rounded-xl shadow-xl">
                  <DialogHeader className="space-y-2 mb-4">
                    <DialogTitle>Incident Report</DialogTitle>
                    <DialogDescription className="mt-1">Provide the incident details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Device Type</Label>
                      <Select value={incidentDeviceType} onValueChange={setIncidentDeviceType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Laptop">Laptop</SelectItem>
                          <SelectItem value="Phone">Phone</SelectItem>
                          <SelectItem value="Tablet">Tablet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Device Name</Label>
                      <Select value={incidentDeviceName} onValueChange={setIncidentDeviceName}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dell XPS 13">Dell XPS 13</SelectItem>
                          <SelectItem value="MacBook Pro 14">MacBook Pro 14</SelectItem>
                          <SelectItem value="iPhone 13">iPhone 13</SelectItem>
                          <SelectItem value="iPad Air">iPad Air</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Type of Incident</Label>
                      <Select value={incidentType} onValueChange={setIncidentType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Damage">Damage</SelectItem>
                          <SelectItem value="Loss">Loss</SelectItem>
                          <SelectItem value="Malfunction">Malfunction</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Explanation</Label>
                      <Textarea rows={5} placeholder="Describe what happened" value={incidentNotes} onChange={(e) => setIncidentNotes(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <DialogClose asChild>
                        <Button variant="outline" className="w-40">Cancel</Button>
                      </DialogClose>
                      <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40" disabled={!incidentDeviceType || !incidentDeviceName || !incidentType || !incidentNotes} onClick={submitIncident}>Submit Report</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

            {/* Report Summary Modal */}
            <Dialog open={incidentSummaryOpen} onOpenChange={setIncidentSummaryOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Incident Summary</DialogTitle>
                  <DialogDescription>Details of the submitted incident.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-[#1F2937]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Device</span>
                    <span className="font-medium">{incidentDeviceName || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{incidentDeviceType || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Incident</span>
                    <span className="font-medium">{incidentType || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reported On</span>
                    <span className="font-medium">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-[#111827]">Awaiting Review</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setIncidentSummaryOpen(false)
                      setIncidentType("")
                      setIncidentDeviceType("")
                      setIncidentDeviceName("")
                      setIncidentNotes("")
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {historyError && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {historyError}
              </div>
            )}
            {loadingHistory && history.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading your device history...</div>
            ) : null}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gradient-to-r from-[#92278F]/10 to-[#BE1E2D]/10">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Device Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Device Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Action</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-navy">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 && !loadingHistory ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No device records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((entry) => {
                      const statusLabel = formatDeviceStatusLabel(entry.status)
                      const canEdit = canEditEntry(entry)

                      return (
                        <TableRow key={`${entry.recordId}-${entry.status}-${entry.borrowDate}`}>
                          <TableCell className="max-w-xs truncate">{entry.deviceName}</TableCell>
                          <TableCell className="capitalize">{entry.deviceType}</TableCell>
                          <TableCell>{formatDateTime(entry.borrowDate)}</TableCell>
                          <TableCell>{entry.action}</TableCell>
                          <TableCell>{statusLabel}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit"
                                onClick={() => handleEditEntry(entry)}
                                disabled={!canEdit}
                                className="hover:text-primary disabled:opacity-40"
                                title={canEdit ? "Edit record" : "This record cannot be edited"}
                              >
                                <PenLine className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete"
                                onClick={() => handleDelete(entry.recordId)}
                                className="hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) {
              setEditRecord(null)
              setEditNotes("")
            }
          }}
        >
          <DialogContent className="sm:max-w-md rounded-xl shadow-xl">
            <DialogHeader className="mb-2">
              <DialogTitle>Edit Device Record</DialogTitle>
              <DialogDescription>Update the status or add additional notes for this history item.</DialogDescription>
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
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={(value) => setEditStatus(value as DeviceHistoryStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action</Label>
                    <Input value={editRecord.action} readOnly className="bg-muted/40 text-sm" />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes about this action..."
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
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AMSDashboardLayout>
  )
}


