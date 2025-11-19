"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import {
  Calendar as CalendarIcon,
  Package,
  Building2,
  Bell,
  Laptop,
  Monitor,
  Smartphone,
  Wrench,
  Tablet,
  Headphones,
  CheckCircle2,
  UserCheck,
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { addRoomBooking, hasBookingConflict, loadRoomBookings, RoomBookingRecord, ROOM_BOOKINGS_STORAGE_KEY, ROOM_BOOKINGS_UPDATED_EVENT, updateRoomBooking } from "@/lib/storage/room-bookings"
import {
  appendDeviceHistoryEntry,
  addBorrowRequestRecord,
  BORROW_REQUESTS_UPDATED_EVENT,
  type BorrowRequestRecord,
} from "@/lib/storage/device-history"
import { addMaintenanceRequestRecord, getMaintenanceRequestRecords, MAINTENANCE_REQUESTS_UPDATED_EVENT, type MaintenanceRequestRecord } from "@/lib/storage/maintenance-requests"
import { cn } from "@/lib/utils"
import {
  BUSINESS_START_TIME,
  BUSINESS_END_TIME,
  BUSINESS_START_MINUTES,
  BUSINESS_END_MINUTES,
  BUSINESS_TIME_PATTERN,
  isWithinBusinessHours as isBusinessTime,
  timeStringToMinutes,
} from "@/lib/utils/business-hours"

type DeviceRecord = {
  id?: string
  asset_tag?: string | null
  serial_number?: string | null
  device_type?: string | null
  brand?: string | null
  model?: string | null
  condition?: string | null
  status?: string | null
  assigned_to?: string | null
  location?: string | null
  notes?: string | null
  purchase_date?: string | null
  warranty_expiry?: string | null
  created_at?: string | null
  updated_at?: string | null
  assignment_id?: string
  assignment_status?: string | null
  assignment_type?: string | null
  assignment_assigned_date?: string | null
  assignment_expected_return_date?: string | null
  assignment_actual_return_date?: string | null
  assignment_notes?: string | null
}

type AssignmentRecord = {
  id: string
  device_id: string
  employee_id?: string | null
  status: string | null
  assignment_type?: string | null
  assigned_date?: string | null
  expected_return_date?: string | null
  actual_return_date?: string | null
  purpose?: string | null
  assignment_notes?: string | null
}

type ScheduleItem = {
  id: string
  title: string
  details: string
  date: Date
  category: 'booking' | 'return' | 'approval'
}

type DeviceSummaryCardKey = 'total' | 'available' | 'assigned' | 'maintenance'
type DeviceCardDetailType = 'total' | 'available' | 'assigned'
type DeviceSummaryCard = {
  key: DeviceSummaryCardKey
  label: string
  Icon: React.ComponentType<{ className?: string }>
  value: string
  accent: string
}
type AssignedDeviceDetails = {
  name: string
  serial: string
  assignedDate: string
  assignedBy: string
  status: string
  condition: string
}

type BookingErrors = {
  date?: string
  startTime?: string
  endTime?: string
  range?: string
}

const deviceTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  desktop: Monitor,
  phone: Smartphone,
  tablet: Tablet,
  monitor: Monitor,
  headphones: Headphones,
}

const toTitleCase = (value?: string | null) => {
  if (!value) return "Unknown"
  return value
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const getDeviceIdentifier = (device?: DeviceRecord | null) => {
  if (!device) return "—"
  return device.asset_tag || device.serial_number || device.id || "—"
}

const formatDateDisplay = (value?: string | null, withTime = false) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return withTime ? parsed.toLocaleString() : parsed.toLocaleDateString()
}

const formatRelativeTime = (targetDate: Date) => {
  const now = new Date()
  const diffMs = targetDate.getTime() - now.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (Math.abs(diffMinutes) < 60) {
    if (Math.abs(diffMinutes) < 1) return "in under a minute"
    return diffMinutes > 0 ? `in ${diffMinutes} min` : `${Math.abs(diffMinutes)} min ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours} hr` : `${Math.abs(diffHours)} hr ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`
}

const formatCompactDate = (value?: string | null) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = String(parsed.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

const formatDeviceStatusLabel = (status?: string | null) => {
  if (!status) return 'Status unknown'
  const normalized = status.toLowerCase()
  if (normalized.includes('pending')) return 'Pending Borrow'
  return toTitleCase(status)
}

const parseBookingTimeWindow = (booking: RoomBookingRecord) => {
  if (!booking.date) return { startDate: null as Date | null, endDate: null as Date | null }
  const [rangeStart, rangeEnd] = (booking.time || '').split('-')
  const startTime = booking.startTime || (rangeStart ? rangeStart.trim() : null) || BUSINESS_START_TIME
  const endTime =
    booking.endTime ||
    (rangeEnd ? rangeEnd.trim() : null) ||
    (startTime ? startTime : BUSINESS_END_TIME)

  const startDate = new Date(`${booking.date}T${startTime}:00`)
  if (Number.isNaN(startDate.getTime())) return { startDate: null as Date | null, endDate: null as Date | null }
  const endDate = new Date(
    endTime ? `${booking.date}T${endTime}:00` : startDate.getTime() + 60 * 60000,
  )

  if (Number.isNaN(endDate.getTime())) {
    return { startDate, endDate: new Date(startDate.getTime() + 60 * 60000) }
  }

  return { startDate, endDate }
}

const getBookingStatusLabel = (booking: RoomBookingRecord, referenceDate = new Date()) => {
  const normalized = (booking.status || '').toLowerCase()
  if (normalized.includes('cancel')) return 'Cancelled'
  if (normalized.includes('resched')) return 'Rescheduled'
  if (normalized.includes('miss')) return 'Missed'
  if (normalized.includes('attend')) return 'Attended'
  if (booking.checkedInAt) return 'Attended'

  const { startDate, endDate } = parseBookingTimeWindow(booking)
  if (!startDate || !endDate) return 'Upcoming'

  if (referenceDate < startDate) return 'Upcoming'

  const graceThreshold = new Date(startDate.getTime() + 10 * 60 * 1000)
  if (!booking.checkedInAt && referenceDate >= graceThreshold) {
    return 'Missed'
  }

  if (referenceDate <= endDate) return 'In Progress'
  return booking.checkedInAt ? 'Attended' : 'Missed'
}

const minutesUntilStart = (booking: RoomBookingRecord, referenceDate = new Date()) => {
  const { startDate } = parseBookingTimeWindow(booking)
  if (!startDate) return null
  return Math.round((startDate.getTime() - referenceDate.getTime()) / 60000)
}

export default function AmsDashboardPage() {
  const router = useRouter()
  const [currentUser] = useState(() => getCurrentUser())
  const user = currentUser
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], [])
  const { toast } = useToast()
  const userIdentifier = user?.id || user?.email || "guest"
  const [deviceData, setDeviceData] = useState<DeviceRecord[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [deviceStats, setDeviceStats] = useState({ total: 0, available: 0, borrowed: 0, maintenance: 0 })
  const [employeeRecord, setEmployeeRecord] = useState<any>(null)
  
  // Device modals
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [reportIssueOpen, setReportIssueOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null)
  
  // Quick Actions modals
  const [borrowDeviceOpen, setBorrowDeviceOpen] = useState(false)
  const [requestMaintenanceOpen, setRequestMaintenanceOpen] = useState(false)
  const [bookRoomOpen, setBookRoomOpen] = useState(false)
  const [bookingSummaryOpen, setBookingSummaryOpen] = useState(false)
  const [roomBookings, setRoomBookings] = useState<RoomBookingRecord[]>([])
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRecord[]>([])
  const [borrowRequestsState, setBorrowRequestsState] = useState<BorrowRequestRecord[]>([])
  const [deviceAvailabilityOpen, setDeviceAvailabilityOpen] = useState(false)
  const [checkInSummary, setCheckInSummary] = useState<{ booking: RoomBookingRecord; timestamp: string } | null>(null)
  const [checkInSummaryOpen, setCheckInSummaryOpen] = useState(false)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [deviceCardDetail, setDeviceCardDetail] = useState<DeviceCardDetailType | null>(null)
  
  // Form states
  const [borrowForm, setBorrowForm] = useState({
    type: "",
    name: "",
    date: "",
    dateTime: "",
    returnDate: "",
    purpose: "",
  })
  const [maintenanceForm, setMaintenanceForm] = useState({ deviceId: "", deviceName: "", category: "", description: "", priority: "Medium" })
  const [bookingForm, setBookingForm] = useState({ room: "", category: "", date: "", startTime: "12:00", endTime: "13:00", agenda: "" })
  const [bookingErrors, setBookingErrors] = useState<BookingErrors>({})
  const [issueForm, setIssueForm] = useState({ deviceName: "", issueType: "", description: "" })
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [maintenanceMediaPrompt, setMaintenanceMediaPrompt] = useState<{ open: boolean; deviceName?: string }>({ open: false })
  const [maintenanceMediaFileName, setMaintenanceMediaFileName] = useState<string | null>(null)
  const [bookingConflictDetected, setBookingConflictDetected] = useState(false)

  const parseDateOnly = (value: string) => {
    if (!value) return null
    const [year, month, day] = value.split("-").map(Number)
    if ([year, month, day].some((part) => Number.isNaN(part))) return null
    return new Date(year, month - 1, day)
  }

  const isPastDate = (value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    parsed.setHours(0, 0, 0, 0)
    return parsed < today
  }

  const isValidTimeFormat = (value: string) => {
    if (!value || !BUSINESS_TIME_PATTERN.test(value)) return false
    const [hoursString, minutesString] = value.split(":")
    const hours = Number(hoursString)
    const minutes = Number(minutesString)
    if ([hours, minutes].some((part) => Number.isNaN(part))) return false
    return true
  }

  const isAwaitingBorrowApproval = (...statuses: Array<string | null | undefined>) => {
    return statuses.some((status) => {
      const normalized = status?.toLowerCase().trim()
      if (!normalized) return false
      if (normalized === 'pending') return true
      const mentionsApproval = normalized.includes('approval')
      if (mentionsApproval && (normalized.includes('pending') || normalized.includes('awaiting') || normalized.includes('request'))) {
        return true
      }
      if (normalized.includes('awaiting approval') || normalized.includes('pending approval')) {
        return true
      }
      return false
    })
  }

  const compareTimes = (start: string, end: string) => {
    const startMinutes = timeStringToMinutes(start)
    const endMinutes = timeStringToMinutes(end)
    if (startMinutes === null || endMinutes === null) return null
    return startMinutes - endMinutes
  }

  const findAvailableDeviceByIdentifier = (identifier: string) => {
    return availableBorrowDevices.find((device) => {
      return getDeviceIdentifier(device) === identifier
    })
  }

  const validateBooking = (form: typeof bookingForm): BookingErrors => {
    const errors: BookingErrors = {}

    if (!form.date) {
      errors.date = "Select a booking date."
    } else if (isPastDate(form.date)) {
      errors.date = "Booking date cannot be in the past."
    }

    if (!form.startTime) {
      errors.startTime = "Select a start time."
    } else if (!isValidTimeFormat(form.startTime)) {
      errors.startTime = "Enter time in HH:MM format."
    } else if (!isBusinessTime(form.startTime)) {
      errors.startTime = "Not a business hour"
    }

    if (!form.endTime) {
      errors.endTime = "Select an end time."
    } else if (!isValidTimeFormat(form.endTime)) {
      errors.endTime = "Enter time in HH:MM format."
    } else if (!isBusinessTime(form.endTime)) {
      errors.endTime = "Not a business hour"
    }

    if (form.startTime && form.endTime) {
      const diff = compareTimes(form.startTime, form.endTime)
      if (diff !== null && diff >= 0) {
        errors.range = "Start time must be earlier than end time."
      }

      if (!errors.date && form.date) {
        const bookingStart = new Date(`${form.date}T${form.startTime}:00`)
        if (!Number.isNaN(bookingStart.getTime())) {
          const now = new Date()
          const isSameDay = bookingStart.toDateString() === now.toDateString()
          if (isSameDay && bookingStart <= now) {
            errors.startTime = "Invalid selection: meeting time must be in the future."
          }
        }
      }
    }

    return errors
  }

  const pushBookingErrors = (errors: BookingErrors, context: "date" | "start" | "end" | "submit") => {
    if ((context === "date" || context === "submit") && errors.date && !bookingErrors.date) {
      toast({
        variant: "destructive",
        title: "Invalid booking date",
        description: errors.date,
      })
    }
    if ((context === "start" || context === "submit") && errors.startTime && !bookingErrors.startTime) {
      toast({
        variant: "destructive",
        title: "Start time issue",
        description: errors.startTime,
      })
    }
    if ((context === "end" || context === "submit") && errors.endTime && !bookingErrors.endTime) {
      toast({
        variant: "destructive",
        title: "End time issue",
        description: errors.endTime,
      })
    }
    if ((context === "start" || context === "end" || context === "submit") && errors.range && !bookingErrors.range) {
      toast({
        variant: "destructive",
        title: "Time conflict",
        description: errors.range,
      })
    }
    setBookingErrors(errors)
  }

  const handleBookingDateChange = (value: string) => {
    const nextForm = { ...bookingForm, date: value }
    setBookingForm(nextForm)
    const errors = validateBooking(nextForm)
    pushBookingErrors(errors, "date")
  }

  const handleBookingStartTimeChange = (value: string) => {
    const nextForm = { ...bookingForm, startTime: value }
    setBookingForm(nextForm)
    const errors = validateBooking(nextForm)
    pushBookingErrors(errors, "start")
  }

  const handleBookingEndTimeChange = (value: string) => {
    const nextForm = { ...bookingForm, endTime: value }
    setBookingForm(nextForm)
    const errors = validateBooking(nextForm)
    pushBookingErrors(errors, "end")
  }

  const handleBookRoomSubmit = () => {
    const errors = validateBooking(bookingForm)
    const hadAllErrors =
      Object.keys(errors).length > 0 &&
      Object.keys(errors).every((key) => bookingErrors[key as keyof BookingErrors])
    pushBookingErrors(errors, "submit")

    if (Object.keys(errors).length > 0) {
      if (hadAllErrors) {
        toast({
          variant: "destructive",
          title: "Cannot book room yet",
          description: "Please resolve the highlighted issues before submitting.",
        })
      }
      return
    }

    setBookingErrors({})
    const bookingRecord: RoomBookingRecord = {
      id: `BK-${Date.now()}`,
      employeeId: userIdentifier,
      employeeName: user?.name || "Employee",
      room: bookingForm.room,
      meetingCategory: bookingForm.category,
      editableSections: "Quick Action",
      meetingAgenda: bookingForm.agenda,
      date: bookingForm.date,
      time: `${bookingForm.startTime}-${bookingForm.endTime}`,
      startTime: bookingForm.startTime,
      endTime: bookingForm.endTime,
      status: "Booked",
      createdAt: new Date().toISOString(),
    }
    const conflict = hasBookingConflict(bookingRecord, roomBookings)
    setBookingConflictDetected(conflict)
    const updated = addRoomBooking(bookingRecord)
    setRoomBookings(updated)
    setBookRoomOpen(false)
    setBookingSummaryOpen(true)
  }

  const handleQuickBorrowSubmit = () => {
    if (!quickBorrowReady) {
      toast({
        variant: "destructive",
        title: "Missing details",
        description: "Please complete the borrow form before submitting.",
      })
      return
    }

    const borrowDateValue = borrowForm.date || todayIso
    if (borrowForm.returnDate) {
      const borrowDateObj = new Date(borrowDateValue)
      const returnDateObj = new Date(borrowForm.returnDate)
      if (returnDateObj <= borrowDateObj) {
        toast({
          variant: "destructive",
          title: "Return date issue",
          description: "Return date must be later than the borrow date.",
        })
        return
      }
    }

    const deviceIdentifier = borrowForm.name
    const resolvedDevice = findAvailableDeviceByIdentifier(deviceIdentifier)
    const deviceName =
      resolvedDevice?.model ||
      resolvedDevice?.brand ||
      toTitleCase(resolvedDevice?.device_type) ||
      deviceIdentifier
    const deviceType = toTitleCase(resolvedDevice?.device_type) || borrowForm.type || "Device"
    const recordId = `BR-${Date.now()}`

    const nowIso = new Date().toISOString()

    addBorrowRequestRecord({
      id: recordId,
      employeeName: user?.name || "Employee",
      employeeId: user?.employeeId || user?.email || "Unassigned",
      deviceName,
      assetTag: deviceIdentifier,
      borrowDate: nowIso,
      purpose: borrowForm.purpose,
      status: "Pending Approval",
    })

    appendDeviceHistoryEntry(userIdentifier, {
      recordId,
      deviceId: deviceIdentifier,
      deviceName,
      deviceType,
      borrowDate: nowIso,
      expectedReturnDate: borrowForm.returnDate || undefined,
      status: "Pending",
      action: "Borrow",
      notes: borrowForm.purpose || undefined,
    })

    toast({
      title: "Borrow request submitted",
      description: `${deviceName} is awaiting supervisor approval.`,
    })

    setBorrowDeviceOpen(false)
    setBorrowForm((prev) => {
      const freshNow = new Date()
      const freshDate = freshNow.toISOString().split("T")[0]
      const freshDateTime = freshNow.toISOString()
      return {
        type: "",
        name: "",
        date: freshDate,
        dateTime: freshDateTime,
        returnDate: "",
        purpose: "",
      }
    })
  }

  const handleQuickMaintenanceSubmit = () => {
    if (!quickMaintenanceReady) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Select a device and describe the issue before submitting.",
      })
      return
    }

    const timestamp = new Date().toISOString()
    const requestId = `MT-${Date.now()}`
    addMaintenanceRequestRecord(userIdentifier, {
      id: requestId,
      deviceName: maintenanceForm.deviceName || maintenanceForm.deviceId,
      assetTag: maintenanceForm.deviceId,
      issueType: maintenanceForm.category,
      description: maintenanceForm.description,
      priority: maintenanceForm.priority as "Low" | "Medium" | "High",
      status: "Pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    toast({
      title: "Maintenance request submitted",
      description: `${maintenanceForm.deviceName || maintenanceForm.deviceId} has been logged.`,
    })

    setRequestMaintenanceOpen(false)
    setMaintenanceForm({ deviceId: "", deviceName: "", category: "", description: "", priority: "Medium" })
    setMaintenanceMediaFileName(null)
    setMaintenanceMediaPrompt({
      open: true,
      deviceName: maintenanceForm.deviceName || maintenanceForm.deviceId,
    })
  }
  useEffect(() => {
    const now = new Date()
    const isoDate = now.toISOString().split("T")[0]
    const isoDateTime = now.toISOString()
    setBorrowForm(prev => ({ ...prev, date: isoDate, dateTime: isoDateTime }))
    setBookingForm(prev => ({
      ...prev,
      date: prev.date || todayIso,
      startTime: prev.startTime || "12:00",
      endTime: prev.endTime || "13:00",
    }))
  }, [todayIso])

  useEffect(() => {
    if (typeof window === "undefined") return
    const loadBookings = () => {
      setRoomBookings(loadRoomBookings())
    }
    loadBookings()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ROOM_BOOKINGS_STORAGE_KEY) {
        loadBookings()
      }
    }
    const handleCustom = () => loadBookings()

    window.addEventListener("storage", handleStorage)
    window.addEventListener(ROOM_BOOKINGS_UPDATED_EVENT, handleCustom)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(ROOM_BOOKINGS_UPDATED_EVENT, handleCustom)
    }
  }, [])


  useEffect(() => {
    if (!userIdentifier || typeof window === "undefined") return
    const storageKey = `maintenance_requests_${userIdentifier}`

    const loadRequests = () => {
      setMaintenanceRequests(getMaintenanceRequestRecords(userIdentifier))
    }
    loadRequests()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        loadRequests()
      }
    }

    const handleCustom = (event: Event) => {
      const custom = event as CustomEvent<{ key?: string }>
      if (!custom.detail?.key || custom.detail.key === storageKey) {
        loadRequests()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(MAINTENANCE_REQUESTS_UPDATED_EVENT, handleCustom)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(MAINTENANCE_REQUESTS_UPDATED_EVENT, handleCustom)
    }
  }, [userIdentifier])

  useEffect(() => {
    if (typeof window === "undefined") return

    const loadBorrowRequests = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("borrowRequests") || "[]") as BorrowRequestRecord[]
        setBorrowRequestsState(stored)
      } catch (error) {
        console.error("Failed to load borrow requests", error)
        setBorrowRequestsState([])
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "borrowRequests") {
        loadBorrowRequests()
      }
    }

    const handleCustom = (() => loadBorrowRequests()) as EventListener

    loadBorrowRequests()
    window.addEventListener("storage", handleStorage)
    window.addEventListener(BORROW_REQUESTS_UPDATED_EVENT, handleCustom)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(BORROW_REQUESTS_UPDATED_EVENT, handleCustom)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedEmployee = localStorage.getItem('xspark_employee')
    if (storedEmployee) {
      try {
        setEmployeeRecord(JSON.parse(storedEmployee))
      } catch (error) {
        console.error('Failed to parse stored employee record:', error)
      }
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    let isActive = true

    const now = new Date()
    const isoDate = now.toISOString().split("T")[0]
    const isoDateTime = now.toISOString()
    setBorrowForm((prev) => ({ ...prev, date: isoDate, dateTime: isoDateTime }))

    setDevicesLoading(true)
    setAssignmentsLoading(true)
    setDevicesError(null)
    setScheduleError(null)

    const loadDashboardData = async () => {
      try {
        const [devicesApiResponse, assignmentsResp] = await Promise.all([
          fetch('/api/devices?limit=50', { cache: 'no-store' })
            .then(async (response) => {
              if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}))
                throw new Error(errorBody?.error || `Failed to load devices (${response.status})`)
              }
              return response.json() as Promise<{
                success: boolean
                data: DeviceRecord[]
                meta?: { count?: number; limit?: number; offset?: number }
                error?: string
              }>
            }),
          supabase
            .from('assigned_devices')
            .select('id, device_id, employee_id, status, assignment_type, assigned_date, expected_return_date, actual_return_date, purpose, assignment_notes')
            .is('deleted_at', null),
        ])

        if (!isActive) return

        // Devices
        if (!devicesApiResponse.success) {
          setDevicesError(devicesApiResponse.error || 'Unable to load devices')
          setDeviceData([])
          setDeviceStats({ total: 0, available: 0, borrowed: 0, maintenance: 0 })
        } else {
          const deviceRows = devicesApiResponse.data ?? []
          const total = devicesApiResponse.meta?.count ?? deviceRows.length
          const available = deviceRows.filter((device) => {
            const status = device.status?.toLowerCase()
            if (status === 'available') return true
            return isAwaitingBorrowApproval(device.status, device.assignment_status)
          }).length
          const borrowed = deviceRows.filter((device) => device.status?.toLowerCase() === 'borrowed').length
          const maintenance = deviceRows.filter((device) => device.status?.toLowerCase()?.includes('maintenance')).length

          setDeviceData(deviceRows)
          setDeviceStats({ total, available, borrowed, maintenance })
        }

        // Assignments
        if (assignmentsResp.error) {
          console.error('Failed to load assignments', assignmentsResp.error)
          setAssignments([])
          setScheduleError((prev) => prev ?? 'Unable to load upcoming device returns')
        } else {
          setAssignments((assignmentsResp.data as AssignmentRecord[]) ?? [])
        }

      } catch (error) {
        if (!isActive) return
        console.error('Failed to load dashboard data', error)
        setDevicesError('Unable to load devices')
        setDeviceData([])
        setDeviceStats({ total: 0, available: 0, borrowed: 0, maintenance: 0 })
        setAssignments([])
        setScheduleError((prev) => prev ?? 'Unable to load dashboard data')
      } finally {
        if (!isActive) return
        setDevicesLoading(false)
        setAssignmentsLoading(false)
      }
    }

    loadDashboardData()

    return () => {
      isActive = false
    }
  }, [user])

  if (!user) return null

  const normalizedRole = ((user.role as string | undefined) ?? '').toLowerCase()
  const isSupervisor = normalizedRole === 'supervisor'

  // Don't render if supervisor (will redirect)
  if (isSupervisor) return null

  const employeeId = useMemo(() => {
    const candidate =
      employeeRecord?.id ??
      employeeRecord?.employee_id ??
      employeeRecord?.employeeId ??
      user.employeeId ??
      null

    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate
      : null
  }, [employeeRecord?.employeeId, employeeRecord?.employee_id, employeeRecord?.id, user.employeeId])

  const deviceMap = useMemo(() => {
    const map = new Map<string, DeviceRecord>()
    deviceData.forEach((device) => {
      if (device.id) {
        map.set(device.id, device)
      }
    })
    return map
  }, [deviceData])

  const myDevices = useMemo(() => {
    if (!employeeId) return []

    const relevantAssignments = assignments.filter((assignment) => {
      if (assignment.employee_id !== employeeId) return false
      const statusLower = assignment.status?.toLowerCase()
      return statusLower !== 'returned' && statusLower !== 'cancelled'
    })

    const resolveDate = (record: DeviceRecord) =>
      record.assignment_assigned_date || record.updated_at || record.created_at || record.purchase_date || null

    const getTimeValue = (value: string | null | undefined) => {
      if (!value) return 0
      const ms = new Date(value).getTime()
      return Number.isNaN(ms) ? 0 : ms
    }

    const enriched = relevantAssignments.map((assignment) => {
      const deviceInfo = deviceMap.get(assignment.device_id)
      const mergedStatus = assignment.status ?? deviceInfo?.status ?? 'assigned'
      const mergedNotes = assignment.assignment_notes ?? assignment.purpose ?? deviceInfo?.notes ?? null

      const merged: DeviceRecord = {
        ...(deviceInfo ?? {}),
        id: deviceInfo?.id ?? assignment.device_id,
        status: mergedStatus,
        assignment_id: assignment.id,
        assignment_status: mergedStatus,
        assignment_type: assignment.assignment_type ?? null,
        assignment_assigned_date: assignment.assigned_date ?? null,
        assignment_expected_return_date: assignment.expected_return_date ?? null,
        assignment_actual_return_date: assignment.actual_return_date ?? null,
        assignment_notes: mergedNotes,
      }

      if (!merged.asset_tag && deviceInfo?.asset_tag) merged.asset_tag = deviceInfo.asset_tag
      if (!merged.device_type && deviceInfo?.device_type) merged.device_type = deviceInfo.device_type
      if (!merged.brand && deviceInfo?.brand) merged.brand = deviceInfo.brand
      if (!merged.model && deviceInfo?.model) merged.model = deviceInfo.model
      if (!merged.condition && deviceInfo?.condition) merged.condition = deviceInfo.condition
      if (!merged.location && deviceInfo?.location) merged.location = deviceInfo.location
      merged.notes = mergedNotes ?? merged.notes ?? null

      return merged
    })

    return enriched
      .sort((a, b) => getTimeValue(resolveDate(b)) - getTimeValue(resolveDate(a)))
      .slice(0, 3)
  }, [assignments, deviceMap, employeeId])

  const primaryAssignedDevice = myDevices[0] ?? null
  const assignedDeviceFallback: AssignedDeviceDetails = {
    name: 'iMac',
    serial: 'C02LQ0ABF8J9',
    assignedDate: '20-10-25',
    assignedBy: 'Supervisor',
    status: 'Active',
    condition: 'New',
  }
  const assignedDeviceDetails = useMemo<AssignedDeviceDetails>(() => {
    if (primaryAssignedDevice) {
      return {
        name:
          primaryAssignedDevice.model ||
          primaryAssignedDevice.brand ||
          primaryAssignedDevice.asset_tag ||
          toTitleCase(primaryAssignedDevice.device_type) ||
          'Assigned device',
        serial:
          primaryAssignedDevice.serial_number ||
          primaryAssignedDevice.asset_tag ||
          primaryAssignedDevice.id ||
          '—',
        assignedDate:
          formatCompactDate(primaryAssignedDevice.assignment_assigned_date) || '—',
        assignedBy:
          primaryAssignedDevice.assignment_type
            ? toTitleCase(primaryAssignedDevice.assignment_type)
            : '—',
        status: primaryAssignedDevice.status ? toTitleCase(primaryAssignedDevice.status) : '—',
        condition: primaryAssignedDevice.condition
          ? toTitleCase(primaryAssignedDevice.condition)
          : '—',
      }
    }
    return assignedDeviceFallback
  }, [primaryAssignedDevice])

  const totalDevicesDisplay = devicesLoading ? '—' : deviceStats.total || deviceData.length
  const availableDevicesDisplay = devicesLoading ? '—' : deviceStats.available
  const availableBorrowDevices = useMemo(
    () =>
      deviceData.filter((device) => {
        const status = device.status?.toLowerCase()
        if (status === 'available') return true
        return isAwaitingBorrowApproval(device.status, device.assignment_status)
      }),
    [deviceData]
  )
  const deviceSummaryCards: DeviceSummaryCard[] = [
    {
      key: 'total',
      label: 'Total Devices',
      Icon: Package,
      value: devicesLoading ? '—' : String(deviceStats.total || deviceData.length || 0),
      accent: '#3B4370',
    },
    {
      key: 'available',
      label: 'Available Devices',
      Icon: CheckCircle2,
      value: devicesLoading ? '—' : String(deviceStats.available ?? 0),
      accent: '#6D6E70',
    },
    {
      key: 'assigned',
      label: 'Assigned Devices',
      Icon: UserCheck,
      value: '1',
      accent: '#D6343A',
    },
    {
      key: 'maintenance',
      label: 'Under Maintenance',
      Icon: Wrench,
      value: devicesLoading ? '—' : String(deviceStats.maintenance ?? 0),
      accent: '#A14FB5',
    },
  ]
  const isDeviceDetailKey = (key: DeviceSummaryCardKey): key is DeviceCardDetailType =>
    key === 'total' || key === 'available' || key === 'assigned'
  const handleDeviceCardDetail = (key: DeviceCardDetailType) => {
    setDeviceCardDetail(key)
  }
  const activeDeviceCardMeta = deviceCardDetail
    ? deviceSummaryCards.find((card) => card.key === deviceCardDetail)
    : null
  const deviceDetailDevices = useMemo(() => {
    if (deviceCardDetail === 'available') return availableBorrowDevices
    if (deviceCardDetail === 'assigned') return primaryAssignedDevice ? [primaryAssignedDevice] : []
    if (deviceCardDetail === 'total') return deviceData
    return []
  }, [deviceCardDetail, availableBorrowDevices, primaryAssignedDevice, deviceData])
  const deviceDetailPreview = useMemo(() => deviceDetailDevices.slice(0, 6), [deviceDetailDevices])
  const deviceDetailEmptyMessage =
    deviceCardDetail === 'assigned'
      ? 'No assigned device information is currently available.'
      : 'No device data found for this category.'
  const borrowDeviceTypeOptions = useMemo(
    () => Array.from(new Set(availableBorrowDevices.map((device) => toTitleCase(device.device_type)))).sort(),
    [availableBorrowDevices]
  )
  const borrowDeviceOptions = useMemo(
    () =>
      availableBorrowDevices.filter((device) => {
        if (!borrowForm.type) return true
        return toTitleCase(device.device_type) === borrowForm.type
      }),
    [availableBorrowDevices, borrowForm.type]
  )

  const reportableDevices = useMemo(
    () => deviceData.filter((device) => (device.status ?? "").toLowerCase() !== "borrowed"),
    [deviceData]
  )

  const scheduleLoading = assignmentsLoading
  const quickBorrowReady = Boolean(
    borrowForm.type && borrowForm.name && borrowForm.date && borrowForm.returnDate && borrowForm.purpose
  )
  const quickMaintenanceReady = Boolean(
    maintenanceForm.deviceId && maintenanceForm.category && maintenanceForm.priority && maintenanceForm.description
  )

  const upcomingCheckInBooking = useMemo(() => {
    if (!userIdentifier) return null
    const now = new Date()
    const candidates = roomBookings
      .filter((booking) => booking.employeeId === userIdentifier)
      .map((booking) => {
        const { startDate } = parseBookingTimeWindow(booking)
        if (!startDate) return null
        const minutes = minutesUntilStart(booking, now)
        if (minutes === null || minutes < 0 || minutes > 60) return null
        const statusLabel = getBookingStatusLabel(booking, now)
        if (['Cancelled', 'Missed', 'Attended'].includes(statusLabel)) return null
        return { booking, minutes, startDate, statusLabel }
      })
      .filter(
        (candidate): candidate is { booking: RoomBookingRecord; minutes: number; startDate: Date; statusLabel: string } =>
          Boolean(candidate && candidate.startDate),
      )
      .sort((a, b) => a.minutes - b.minutes)

    return candidates[0] ?? null
  }, [roomBookings, userIdentifier])

  const handleCheckIn = () => {
    if (!upcomingCheckInBooking) return
    setCheckInLoading(true)
    try {
    const timestamp = new Date().toISOString()
    const updated = updateRoomBooking(upcomingCheckInBooking.booking.id, {
      status: 'Attended',
      checkedInAt: timestamp,
    })
      setRoomBookings(updated)
      toast({
        title: 'Checked in',
        description: `Meeting in ${upcomingCheckInBooking.booking.room || 'the room'} marked as attended.`,
      })
    setCheckInSummary({
      booking: { ...upcomingCheckInBooking.booking, checkedInAt: timestamp, status: 'Attended' },
      timestamp,
    })
    setCheckInSummaryOpen(true)
    } finally {
      setCheckInLoading(false)
    }
  }

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = []
    const now = new Date()
    const currentEmployeeId = employeeId ?? userIdentifier

    roomBookings.forEach((booking) => {
      const { startDate } = parseBookingTimeWindow(booking)
      if (!startDate || startDate < now) return
      const statusLabel = getBookingStatusLabel(booking, now)
      items.push({
        id: `booking-${booking.id}`,
        title: booking.room ? `Booking · ${booking.room}` : 'Room booking',
        details: statusLabel,
        date: startDate,
        category: 'booking',
      })
    })

    assignments.forEach((assignment) => {
      if (assignment.employee_id !== employeeId) return
      if (!assignment.expected_return_date) return
      const dueDate = new Date(assignment.expected_return_date)
      if (Number.isNaN(dueDate.getTime()) || dueDate < now) return
      const deviceInfo = deviceMap.get(assignment.device_id)
      const deviceName =
        deviceInfo?.model ||
        deviceInfo?.brand ||
        deviceInfo?.asset_tag ||
        toTitleCase(deviceInfo?.device_type) ||
        'Assigned device'
      items.push({
        id: `return-${assignment.id}`,
        title: `Return ${deviceName}`,
        details: assignment.status ? toTitleCase(assignment.status) : 'Awaiting return',
        date: dueDate,
        category: 'return',
      })
    })

    borrowRequestsState
      .filter((request) => {
        if (!currentEmployeeId) return false
        return request.employeeId === currentEmployeeId && request.status?.toLowerCase().includes('pending')
      })
      .forEach((request) => {
        const requestDate = request.borrowDate ? new Date(request.borrowDate) : now
        if (Number.isNaN(requestDate.getTime()) || requestDate < now) return
        items.push({
          id: `approval-${request.id}`,
          title: `Approval · ${request.deviceName}`,
          details: 'Awaiting device approval',
          date: requestDate,
          category: 'approval',
        })
      })

    return items
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
  }, [roomBookings, assignments, borrowRequestsState, deviceMap, employeeId, userIdentifier])

  const scheduleIconMap: Record<ScheduleItem['category'], React.ComponentType<{ className?: string }>> = {
    booking: CalendarIcon,
    return: Laptop,
    approval: CheckCircle2,
  }

  const quickActions = [
    {
      key: 'borrow-device',
      label: 'Borrow a device',
      icon: Laptop,
      background: 'from-white via-[#F6ECFF] to-[#FFF7FB]',
      accent: '#92278F',
    },
    {
      key: 'book-room',
      label: 'Book a room',
      icon: CalendarIcon,
      background: 'from-white via-[#E8F1FF] to-[#F5ECFF]',
      accent: '#25294B',
    },
    {
      key: 'check-device-availability',
      label: 'Check device availability',
      icon: Monitor,
      background: 'from-white via-[#EEF4FF] to-[#F9EEFF]',
      accent: '#58595B',
    },
    {
      key: 'check-room-availability',
      label: 'Check room availability',
      icon: Building2,
      background: 'from-white via-[#FFEFEF] to-[#FFF7F0]',
      accent: '#BE1E2D',
    },
  ]

  const handleQuickActionClick = (key: string) => {
    switch (key) {
      case 'borrow-device':
        setBorrowDeviceOpen(true)
        break
      case 'book-room':
        setBookRoomOpen(true)
        break
      case 'check-device-availability':
      setDeviceAvailabilityOpen(true)
        break
      case 'check-room-availability':
        router.push('/ams-bookings/availability')
        break
    }
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <Card className="gradient-primary text-white border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-1">
                  {isSupervisor ? 'Good Afternoon, Supervisor User!' : `Welcome back, ${user.name}!`}
                </h2>
                <p className="text-white/85">You're now on the Asset Management System.</p>
              </div>
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">AMS Dashboard</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Device Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {deviceSummaryCards.map((card) => {
            const detailKey = isDeviceDetailKey(card.key) ? card.key : null
            const isInteractive = Boolean(detailKey)

            const handleActivation = () => {
              if (detailKey) {
                handleDeviceCardDetail(detailKey)
              }
            }

            const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (!isInteractive) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleActivation()
              }
            }

            return (
            <Card
                key={card.key}
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                onClick={isInteractive ? handleActivation : undefined}
                onKeyDown={handleKeyDown}
                className={cn(
                  "rounded-[10px] border border-[#808285]/15 bg-white/90 shadow-sm transition-colors hover:shadow-md",
                  isInteractive && "cursor-pointer focus-visible:ring-2 focus-visible:ring-[#92278F]/30 focus-visible:outline-none",
                )}
              >
                <CardContent className="flex h-full flex-col items-start justify-between gap-4 p-4">
                  <span
                    className="rounded-full bg-[#F5F5F5] p-2 shadow-sm"
                    style={{ color: card.accent }}
                    aria-hidden="true"
                  >
                    <card.Icon className="h-5 w-5" />
                  </span>
                  <p className="text-3xl font-semibold text-[#25294B]">{card.value}</p>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#58595B]">
                    {card.label}
                  </span>
                  {isInteractive && (
                    <span className="text-[11px] font-medium text-[#92278F]">Tap to view details</span>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                type="button"
                aria-label={action.label}
                onClick={() => handleQuickActionClick(action.key)}
                className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-[#808285]/20 bg-gradient-to-br ${action.background} px-3 py-4 text-center text-[#25294B] shadow-sm transition-all duration-150 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92278F]/40`}
              >
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm"
                  style={{ color: action.accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-[#25294B]">{action.label}</span>
              </button>
            )
          })}
        </div>
        {/* Employee Dashboard Enhancements */}
        {!isSupervisor && (
          <>
            {/* Upcoming Events */}
            <Card className="hover:shadow-lg transition-shadow border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
          <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#25294B]">
                  <CalendarIcon className="h-5 w-5 text-[#92278F]" />
                  Upcoming events
                </CardTitle>
                <CardDescription className="text-[#58595B]">
                  Bookings, returns, approvals, and maintenance
                </CardDescription>
          </CardHeader>
          <CardContent>
                {scheduleLoading ? (
                  <p className="text-sm text-muted-foreground">Loading your timeline…</p>
                ) : scheduleItems.length > 0 ? (
                  <div className="space-y-3">
                    {scheduleItems.map((item) => {
                      const Icon = scheduleIconMap[item.category]
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border border-[#808285]/20 bg-white/80 p-3 transition-colors hover:bg-gradient-to-r hover:from-[#92278F]/5 hover:to-[#BE1E2D]/5"
                        >
                          <Icon className="h-5 w-5 text-[#92278F]" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#25294B]">{item.title}</p>
                            <p className="text-xs text-[#6B6E8A]">
                              {item.details} · {formatRelativeTime(item.date)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {item.date.toLocaleDateString()}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming events yet.</p>
                )}
                {scheduleError && (
                  <p className="mt-3 text-xs text-destructive">{scheduleError}</p>
                )}
              </CardContent>
            </Card>

            {/* Meeting Check-In */}
            <div className="grid gap-4">
              <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#dfeaff] to-[#f5ecff]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#25294B]">
                    <CalendarIcon className="h-5 w-5 text-[#92278F]" />
                    Meeting Check-In
                  </CardTitle>
                  <CardDescription className="text-[#58595B]">
                    {upcomingCheckInBooking
                      ? `Starts in ${Math.max(upcomingCheckInBooking.minutes, 0)} min · ${
                          upcomingCheckInBooking.booking.room || "Room TBD"
                        }`
                      : "No upcoming meetings within the next hour."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-[#25294B]">
                  {upcomingCheckInBooking ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-white px-3 py-2">
                        <div>
                          <p className="font-semibold">
                            {upcomingCheckInBooking.booking.meetingAgenda || "Room booking"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {upcomingCheckInBooking.startDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            • {upcomingCheckInBooking.booking.meetingCategory || "Internal"}
                          </p>
                          <p className="text-xs font-semibold text-[#A0AEC0]">
                            Status: {getBookingStatusLabel(upcomingCheckInBooking.booking)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs text-[#25294B]">
                          {getBookingStatusLabel(upcomingCheckInBooking.booking)}
                        </Badge>
                      </div>
                      <Button
                        className="w-full bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                        onClick={handleCheckIn}
                        disabled={checkInLoading}
                      >
                        {checkInLoading ? "Checking in…" : "Check-In"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Checking in logs the current time and marks the meeting as attended.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You’ll be able to check in when you have a meeting within the next hour.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Admin View */}
            {(user.role === "hr_manager" || user.role === "super_admin") && (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">1,247</div>
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        +12 this month
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

          </>
        )}

        {/* Events (removed for employees) */}
        {isSupervisor && (
          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#25294B]">
                <Bell className="h-5 w-5 text-[#92278F]" />
                Events
              </CardTitle>
              <CardDescription className="text-[#58595B]">Upcoming device returns and meeting bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Team Standup</TableCell>
                    <TableCell>Oct 25</TableCell>
                    <TableCell>10:00 AM</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Laptop #LAP-001 Return</TableCell>
                    <TableCell>Oct 26</TableCell>
                    <TableCell>2:00 PM</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Project Review</TableCell>
                    <TableCell>Oct 30</TableCell>
                    <TableCell>11:30 AM</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Supervisor-only panels */}
        {isSupervisor && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
              <CardHeader>
                <CardTitle className="text-[#25294B]">Booking Conflict Alerts</CardTitle>
                <CardDescription className="text-[#58595B]">Conflicts escalated by employees</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-[#58595B]">No conflicts pending.</div>
                <div className="mt-3">
                  <Link href="/ams-supervisor/pending-approvals">
                    <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90">Review Conflicts</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
              <CardHeader>
                <CardTitle className="text-[#25294B]">Device Condition Approvals</CardTitle>
                <CardDescription className="text-[#58595B]">Confirm returned device status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-[#58595B]">No approvals required.</div>
                <div className="mt-3">
                  <Link href="/ams-devices/reports">
                    <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90">Open Reports</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      {/* View Details Modal */}
      {!isSupervisor && (
        <UIDialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
          <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
            <UIDialogHeader className="space-y-1">
              <UIDialogTitle>Device Details</UIDialogTitle>
              <DialogDescription>
                View information about {selectedDevice?.model || selectedDevice?.brand || selectedDevice?.device_type || selectedDevice?.asset_tag || "this device"}
              </DialogDescription>
            </UIDialogHeader>
            {selectedDevice && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Asset Tag:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.asset_tag || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Serial Number:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.serial_number || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Device Type:</span>
                  <span className="font-medium text-[#25294B]">{toTitleCase(selectedDevice.device_type)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#58595B]">Status:</span>
                  <Badge variant="outline" className="text-xs">
                    {toTitleCase(selectedDevice.status)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Condition:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.condition || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Location:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.location || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Last Updated:</span>
                  <span className="font-medium text-[#25294B]">{(selectedDevice.updated_at || selectedDevice.created_at) ? new Date(selectedDevice.updated_at || selectedDevice.created_at as string).toLocaleString() : '—'}</span>
                </div>
                {selectedDevice.notes && (
                  <div>
                    <span className="text-[#58595B]">Notes:</span>
                    <p className="font-medium text-[#25294B] mt-1">{selectedDevice.notes}</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <DialogClose asChild>
                <Button variant="outline" className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90">Close</Button>
              </DialogClose>
            </div>
          </UIDialogContent>
        </UIDialog>
      )}

      {/* Report Issue Modal */}
      {!isSupervisor && (
        <UIDialog open={reportIssueOpen} onOpenChange={setReportIssueOpen}>
          <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
            <UIDialogHeader className="space-y-1">
              <UIDialogTitle>Report Issue</UIDialogTitle>
              <DialogDescription>
                Report a problem with {selectedDevice?.model || selectedDevice?.brand || selectedDevice?.device_type || selectedDevice?.asset_tag || 'this device'}
              </DialogDescription>
            </UIDialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Device Name</Label>
                <Input
                  value={issueForm.deviceName || selectedDevice?.model || selectedDevice?.brand || ''}
                  onChange={(e) => setIssueForm({ ...issueForm, deviceName: e.target.value })}
                  placeholder="Device name"
                />
              </div>
              <div className="space-y-2">
                <Label>Issue Type</Label>
                <Select value={issueForm.issueType} onValueChange={(v) => setIssueForm({ ...issueForm, issueType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Damage">Damage</SelectItem>
                    <SelectItem value="Malfunction">Malfunction</SelectItem>
                    <SelectItem value="Loss">Loss</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} placeholder="Describe the issue in detail..." rows={4} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                  onClick={() => {
                    // Handle submit
                    setReportIssueOpen(false)
                    setIssueForm({ deviceName: "", issueType: "", description: "" })
                  }}
                >
                  Submit Report
                </Button>
              </div>
            </div>
          </UIDialogContent>
        </UIDialog>
      )}

      {/* Borrow Device Modal */}
      {!isSupervisor && (
        <UIDialog open={borrowDeviceOpen} onOpenChange={setBorrowDeviceOpen}>
          <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
            <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
              <UIDialogTitle>Borrow a Device</UIDialogTitle>
              <DialogDescription>Request to borrow a device</DialogDescription>
            </UIDialogHeader>
            <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select
                  value={borrowForm.type}
                  onValueChange={(v) => setBorrowForm({ ...borrowForm, type: v, name: '' })}
                  disabled={borrowDeviceTypeOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={borrowDeviceTypeOptions.length === 0 ? "No available types" : "Select device type"} />
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
                <Label>Device Name</Label>
                <Select
                  value={borrowForm.name}
                  onValueChange={(v) => setBorrowForm({ ...borrowForm, name: v })}
                  disabled={borrowDeviceOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={borrowDeviceOptions.length === 0 ? "No devices available" : "Select device"} />
                  </SelectTrigger>
                  <SelectContent>
                    {borrowDeviceOptions.map((device) => {
                      const identifier = getDeviceIdentifier(device)
                      const awaitingApproval = isAwaitingBorrowApproval(device.status, device.assignment_status)
                      const deviceName = device.model || device.brand || toTitleCase(device.device_type)
                      const label = `${identifier} • ${deviceName}${awaitingApproval ? ' • Awaiting approval' : ''}`
                      return (
                        <SelectItem key={identifier} value={identifier}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Borrow Date</Label>
                  <Input
                    type="date"
                    value={borrowForm.date}
                    readOnly
                    disabled
                    className="bg-muted/60 text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Borrow date is captured automatically.</p>
                </div>
                <div className="space-y-2">
                  <Label>Return Date</Label>
                  <Input
                    type="date"
                    min={borrowForm.date || todayIso}
                    value={borrowForm.returnDate}
                    onChange={(e) => setBorrowForm({ ...borrowForm, returnDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Textarea value={borrowForm.purpose} onChange={(e) => setBorrowForm({ ...borrowForm, purpose: e.target.value })} placeholder="Reason for borrowing..." rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                  onClick={handleQuickBorrowSubmit}
                  disabled={!quickBorrowReady}
                >
                  Submit Request
                </Button>
              </div>
            </div>
          </UIDialogContent>
        </UIDialog>
      )}

      {/* Request Maintenance Modal */}
      {!isSupervisor && (
        <UIDialog open={requestMaintenanceOpen} onOpenChange={setRequestMaintenanceOpen}>
          <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
            <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
              <UIDialogTitle>Request Maintenance</UIDialogTitle>
              <DialogDescription>Report a maintenance issue</DialogDescription>
            </UIDialogHeader>
            <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
              <div className="space-y-2">
                <Label>Device ID</Label>
                <Select
                  value={maintenanceForm.deviceId}
                  onValueChange={(v) => {
                    const selected = reportableDevices.find((device) => getDeviceIdentifier(device) === v)
                    setMaintenanceForm({
                      ...maintenanceForm,
                      deviceId: v,
                      deviceName:
                        selected?.model ||
                        selected?.brand ||
                        toTitleCase(selected?.device_type) ||
                        v,
                    })
                  }}
                  disabled={reportableDevices.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        reportableDevices.length === 0 ? "No devices available" : "Select device"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {reportableDevices.map((device) => {
                      const identifier = getDeviceIdentifier(device)
                      const name =
                        device.model ||
                        device.brand ||
                        toTitleCase(device.device_type) ||
                        identifier
                      return (
                        <SelectItem key={identifier} value={identifier}>
                          {identifier} · {name}
                        </SelectItem>
                      )
                    })}
                    {reportableDevices.length === 0 && (
                      <SelectItem value="none" disabled>
                        No devices available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue Category</Label>
                <Select value={maintenanceForm.category} onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Battery">Battery</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={maintenanceForm.priority} onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={maintenanceForm.description} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} placeholder="Describe the issue..." rows={4} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                  onClick={handleQuickMaintenanceSubmit}
                  disabled={!quickMaintenanceReady}
                >
                  Submit Request
                </Button>
              </div>
            </div>
          </UIDialogContent>
        </UIDialog>
      )}

      <UIDialog
        open={maintenanceMediaPrompt.open}
        onOpenChange={(open) => {
          setMaintenanceMediaPrompt((prev) => ({ ...prev, open }))
          if (!open) {
            setMaintenanceMediaFileName(null)
          }
        }}
      >
        <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>Upload Supporting Media</UIDialogTitle>
            <DialogDescription>
              Add a picture or video of {maintenanceMediaPrompt.deviceName || "the device"} to help the support
              team diagnose the issue.
            </DialogDescription>
          </UIDialogHeader>
          <div className="space-y-3">
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setMaintenanceMediaFileName(file ? file.name : null)
              }}
            />
            {maintenanceMediaFileName && (
              <p className="text-xs text-muted-foreground">Selected file: {maintenanceMediaFileName}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMaintenanceMediaPrompt({ open: false })}>
              Skip
            </Button>
            <Button onClick={() => setMaintenanceMediaPrompt({ open: false })}>
              Upload Later
            </Button>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Book Room Modal */}
      {!isSupervisor && (
        <>
          <UIDialog
            open={bookRoomOpen}
            onOpenChange={(open) => {
              setBookRoomOpen(open)
              if (!open) {
                setBookingErrors({})
              }
            }}
          >
            <UIDialogContent className="sm:max-w-xl border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
              <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                <UIDialogTitle>Book a Room</UIDialogTitle>
                <DialogDescription>Reserve a meeting room</DialogDescription>
              </UIDialogHeader>
              <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select value={bookingForm.room} onValueChange={(v) => setBookingForm({ ...bookingForm, room: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ThinkTank1">ThinkTank1</SelectItem>
                      <SelectItem value="ThinkTank2">ThinkTank2</SelectItem>
                      <SelectItem value="Boardroom">Boardroom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meeting Category</Label>
                  <Select value={bookingForm.category} onValueChange={(v) => setBookingForm({ ...bookingForm, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="External">External</SelectItem>
                      <SelectItem value="Internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={bookingForm.date}
                      onChange={(e) => handleBookingDateChange(e.target.value)}
                      aria-invalid={Boolean(bookingErrors.date) || undefined}
                      min={todayIso}
                      className={bookingErrors.date ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                    />
                    {bookingErrors.date && <p className="text-xs text-destructive">{bookingErrors.date}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      min={BUSINESS_START_TIME}
                      max={BUSINESS_END_TIME}
                      value={bookingForm.startTime}
                      onChange={(e) => handleBookingStartTimeChange(e.target.value)}
                      aria-invalid={Boolean(bookingErrors.startTime) || undefined}
                      className={bookingErrors.startTime ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                    />
                    {bookingErrors.startTime && <p className="text-xs text-destructive">{bookingErrors.startTime}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      min={BUSINESS_START_TIME}
                      max={BUSINESS_END_TIME}
                      value={bookingForm.endTime}
                      onChange={(e) => handleBookingEndTimeChange(e.target.value)}
                      aria-invalid={Boolean(bookingErrors.endTime || bookingErrors.range) || undefined}
                      className={
                        bookingErrors.endTime || bookingErrors.range
                          ? "border-destructive focus-visible:ring-destructive/40"
                          : undefined
                      }
                    />
                    {bookingErrors.endTime && <p className="text-xs text-destructive">{bookingErrors.endTime}</p>}
                  </div>
                  {bookingErrors.range && (
                    <div className="md:col-span-2 -mt-1">
                      <p className="text-xs text-destructive">{bookingErrors.range}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Meeting Agenda</Label>
                  <Textarea value={bookingForm.agenda} onChange={(e) => setBookingForm({ ...bookingForm, agenda: e.target.value })} placeholder="Enter meeting agenda..." rows={3} />
                </div>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                    onClick={handleBookRoomSubmit}
                  >
                    Book Room
                  </Button>
                </div>
              </div>
            </UIDialogContent>
          </UIDialog>

          {/* Booking Summary Modal */}
          <UIDialog open={bookingSummaryOpen} onOpenChange={setBookingSummaryOpen}>
            <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
              <UIDialogHeader className="space-y-1">
                <UIDialogTitle>Booking Summary</UIDialogTitle>
                <DialogDescription>Your room booking confirmation</DialogDescription>
              </UIDialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Room:</span>
                  <span className="font-medium text-[#25294B]">{bookingForm.room}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Category:</span>
                  <span className="font-medium text-[#25294B]">{bookingForm.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Date:</span>
                  <span className="font-medium text-[#25294B]">{bookingForm.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Time:</span>
                  <span className="font-medium text-[#25294B]">
                    {bookingForm.startTime} - {bookingForm.endTime}
                  </span>
                </div>
                {bookingForm.agenda && (
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Agenda:</span>
                    <span className="font-medium text-[#25294B]">{bookingForm.agenda}</span>
                  </div>
                )}
                <div className="flex justify-between mt-4">
                  <span className="text-[#58595B]">Employee ID:</span>
                  <span className="font-medium text-[#25294B]">{user.employeeId || 'XSP25/01/002'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#808285]/20 flex items-center justify-between">
                  <span className="text-[#58595B] text-xs">Status</span>
                  <Badge variant={bookingConflictDetected ? "destructive" : "secondary"} className="text-xs">
                    {bookingConflictDetected ? "Pending" : "Booked"}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button 
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                  onClick={() => {
                    setBookingSummaryOpen(false)
                    setBookingForm({
                      room: "",
                      category: "",
                      date: todayIso,
                      startTime: "12:00",
                      endTime: "13:00",
                      agenda: "",
                    })
                    setBookingErrors({})
                  }}
                >
                  Close
                </Button>
              </div>
            </UIDialogContent>
          </UIDialog>

      <UIDialog open={deviceCardDetail !== null} onOpenChange={(open) => (!open ? setDeviceCardDetail(null) : null)}>
        <UIDialogContent className="sm:max-w-lg space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>{activeDeviceCardMeta?.label ?? 'Devices'}</UIDialogTitle>
            <DialogDescription>
              {deviceCardDetail === 'assigned'
                ? 'Details about your current assigned device.'
                : 'Snapshot of devices in this category.'}
            </DialogDescription>
          </UIDialogHeader>
          <div className="flex items-center gap-3 rounded-2xl border border-[#F1E9FF] bg-[#F8F5FF] px-4 py-3">
            {activeDeviceCardMeta ? (
              <>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
                  style={{ color: activeDeviceCardMeta.accent }}
                >
                  <activeDeviceCardMeta.Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#25294B]">{activeDeviceCardMeta.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeDeviceCardMeta.value} {activeDeviceCardMeta.key === 'available' ? 'ready to deploy' : 'devices tracked'}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Device overview</p>
            )}
          </div>
          {deviceCardDetail === 'assigned' ? (
            <div className="space-y-3 text-sm text-[#25294B]">
              {[
                ['Device Name', assignedDeviceDetails.name],
                ['Serial Number', assignedDeviceDetails.serial],
                ['Date Assigned', assignedDeviceDetails.assignedDate],
                ['Assigned by', assignedDeviceDetails.assignedBy],
                ['Status', assignedDeviceDetails.status],
                ['Device', assignedDeviceDetails.condition],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between gap-4">
                  <span className="text-[#58595B]">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {deviceDetailPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">{deviceDetailEmptyMessage}</p>
              ) : (
                deviceDetailPreview.map((device, index) => {
                  const typeKey = device.device_type?.toLowerCase() ?? 'laptop'
                  const IconComponent = deviceTypeIcons[typeKey] || Laptop
                  const identifier = device.id || device.asset_tag || `${device.device_type ?? 'device'}-${index}`
                  const pending = isAwaitingBorrowApproval(device.status, device.assignment_status)
                  const statusLabel = pending ? 'Pending Borrow' : formatDeviceStatusLabel(device.status)
                  return (
                    <div
                      key={identifier}
                      className="flex items-center gap-3 rounded-xl border border-[#E4E4E7] px-3 py-2"
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5]">
                        <IconComponent className="h-4 w-4 text-[#25294B]" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#25294B]">
                          {device.model || device.brand || toTitleCase(device.device_type) || 'Device'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(device.serial_number || device.asset_tag || 'No serial').toString()} • {statusLabel}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </UIDialogContent>
      </UIDialog>

      <UIDialog open={deviceAvailabilityOpen} onOpenChange={setDeviceAvailabilityOpen}>
        <UIDialogContent className="sm:max-w-3xl border border-[#25294B]/20 bg-gradient-to-br from-white via-[#EEF4FF] to-[#F9EEFF] space-y-4">
          <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
            <UIDialogTitle>Device Availability</UIDialogTitle>
            <DialogDescription>Quick view of devices ready to be borrowed.</DialogDescription>
            </UIDialogHeader>
          <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm space-y-3">
            {availableBorrowDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices are currently available to borrow.</p>
            ) : (
              availableBorrowDevices.map((device) => {
                const typeKey = device.device_type?.toLowerCase() ?? 'laptop'
                const IconComponent = deviceTypeIcons[typeKey] || Laptop
                const identifier = getDeviceIdentifier(device)
                const pendingBorrow = isAwaitingBorrowApproval(device.status, device.assignment_status)
                const statusLabel = pendingBorrow ? 'Pending Borrow' : formatDeviceStatusLabel(device.status)
                return (
                  <div
                    key={identifier}
                    className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white/80 p-3 md:flex-row md:items-center"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#F5F5F5]">
                      <IconComponent className="h-5 w-5 text-[#25294B]" />
              </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#25294B]">
                        {device.model || device.brand || toTitleCase(device.device_type) || 'Device'}
                      </p>
                      <p className="text-xs text-muted-foreground">{identifier}</p>
              </div>
                    <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground md:items-end">
                      <span className="font-medium text-[#25294B]">{statusLabel}</span>
                      {device.assignment_expected_return_date && (
                        <span>
                          Return by {formatCompactDate(device.assignment_expected_return_date)}
                        </span>
                      )}
              </div>
                  </div>
                )
              })
            )}
          </div>
        </UIDialogContent>
      </UIDialog>
      <UIDialog open={checkInSummaryOpen && Boolean(checkInSummary)} onOpenChange={(open) => {
        setCheckInSummaryOpen(open)
        if (!open) {
          setCheckInSummary(null)
        }
      }}>
        <UIDialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>Check-In Summary</UIDialogTitle>
            <DialogDescription>Your meeting check-in details</DialogDescription>
          </UIDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#58595B]">Room:</span>
              <span className="font-medium text-[#25294B]">{checkInSummary?.booking.room ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Date:</span>
              <span className="font-medium text-[#25294B]">{checkInSummary?.booking.date ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Time:</span>
              <span className="font-medium text-[#25294B]">
                {checkInSummary?.booking.startTime ?? checkInSummary?.booking.time?.split('-')[0] ?? '—'} -{' '}
                {checkInSummary?.booking.endTime ?? checkInSummary?.booking.time?.split('-')[1] ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Checked In:</span>
              <span className="font-medium text-[#25294B]">
                {checkInSummary ? new Date(checkInSummary.timestamp).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Status:</span>
              <Badge variant="secondary" className="text-xs">
                Attended
              </Badge>
            </div>
          </div>
          <div className="flex justify-end">
                <Button 
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                  onClick={() => {
                setCheckInSummaryOpen(false)
                setCheckInSummary(null)
                  }}
                >
              Close
                </Button>
            </div>
          </UIDialogContent>
        </UIDialog>
        </>
      )}

    </AMSDashboardLayout>
  )
}
