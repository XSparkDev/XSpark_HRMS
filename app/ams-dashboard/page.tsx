"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
  ChevronRight,
  CheckCircle,
  User,
  X,
  ChevronDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { Room } from "@/lib/services/rooms-service"
import { RoomAvailabilityModal } from "@/components/room-availability-modal"
import {
  appendDeviceHistoryEntry,
  addBorrowRequestRecord,
  BORROW_REQUESTS_UPDATED_EVENT,
  type BorrowRequestRecord,
  type DeviceHistoryEntry,
} from "@/lib/storage/device-history"
import { addMaintenanceRequestRecord, getMaintenanceRequestRecords, MAINTENANCE_REQUESTS_UPDATED_EVENT, type MaintenanceRequestRecord } from "@/lib/storage/maintenance-requests"
import { ROOM_BOOKINGS_STORAGE_KEY, ROOM_BOOKINGS_UPDATED_EVENT } from "@/lib/storage/room-bookings"
import { cn } from "@/lib/utils"
import {
  BUSINESS_START_TIME,
  BUSINESS_END_TIME,
  BUSINESS_START_MINUTES,
  BUSINESS_END_MINUTES,
  timeStringToMinutes,
  validateBusinessHourSelection,
} from "@/lib/utils/business-hours"

type DeviceRecord = {
  id?: string
  device_id?: string
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
  category: 'booking' | 'return' | 'approval' | 'device-booking'
  daysRemaining?: number
}

type DeviceSummaryCardKey = 'resources' | 'available' | 'assigned' | 'maintenance'
type DeviceCardDetailType = 'resources' | 'available' | 'assigned'
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
type QuickBorrowReceipt = {
  deviceName: string
  deviceType: string
  deviceId: string
  borrowDate: string
  expectedReturnDate?: string
  status: string
}

// Simple animated count-up hook for comparative cards
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(end) || end <= 0) {
      setCount(end || 0)
      return
    }

    let startTime: number | null = null
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      // Ease-out quart for smooth finish
      const eased = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(eased * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration])

  return count
}

type DeviceSummaryCardProps = {
  card: DeviceSummaryCard
}

function DeviceSummaryStatCard({ card }: DeviceSummaryCardProps) {
  // Try to derive a numeric value for animation; fall back to raw string
  const numericTarget = useMemo(() => {
    const raw = card.value
    if (typeof raw === "number") return raw
    const cleaned = String(raw).replace(/[^\d.-]/g, "")
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }, [card.value])

  const animatedValue = useCountUp(numericTarget ?? 0, 1800)
  const displayValue =
    numericTarget === null
      ? card.value
      : animatedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })

  return (
    <Card
      className={cn(
        "rounded-[10px] border border-[#808285]/15 bg-white/90 shadow-sm transition-transform duration-300",
        "cursor-default hover:shadow-md hover:-translate-y-0.5",
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
        <p className="text-3xl font-semibold text-[#25294B] tabular-nums">{displayValue}</p>
        <span className="text-xs font-semibold uppercase tracking-wide text-[#58595B]">
          {card.label}
        </span>
      </CardContent>
    </Card>
  )

}

type BorrowHistoryRecord = {
  borrow_id: string
  device_id: string
  asset_tag?: string | null
  serial_number?: string | null
  borrowed_by: string
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean | null
  notes?: string | null
}

type BookingErrors = {
  date?: string
  startTime?: string
  endTime?: string
  range?: string
  room?: string
  category?: string
  meetingType?: string
  agenda?: string
}

type RoomBookingRecord = {
  id: string
  room_id?: string | null
  room?: string | null
  room_name?: string | null
  booking_date?: string | null
  date?: string | null
  start_time?: string | null
  startTime?: string | null
  end_time?: string | null
  endTime?: string | null
  time?: string | null
  status?: string | null
  checked_in_at?: string | null
  checkedInAt?: string | null
  roomLabel?: string | null
  meeting_category?: string | null
  meetingCategory?: string | null
  meetingAgenda?: string | null
}

type RoomSummary = {
  id: string
  room_name: string
  room_code?: string | null
  location?: string | null
  floor?: string | null
}

type DashboardRoomBooking = {
  id: string
  booking_id?: string | null
  roomId: string
  room: string
  roomLabel: string
  employeeId: string
  date: string
  booking_date?: string | null
  startTime: string
  endTime: string
  time: string
  status: string
  meetingCategory?: string
  meetingAgenda?: string
  checkedInAt?: string | null
  roomDetails?: RoomSummary | null
}

type CheckInCandidate = {
  booking: DashboardRoomBooking
  minutes: number | null
  startDate: Date
  endDate: Date
  statusLabel: string
  isInProgress: boolean
}

const deviceTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  desktop: Monitor,
  phone: Smartphone,
  tablet: Tablet,
  monitor: Monitor,
  headphones: Headphones,
}

const MAX_BORROW_DURATION_DAYS = 30

const meetingTypes = [
  { value: "Online", label: "Online" },
  { value: "Offline", label: "Offline" },
]

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
  // Check for postponed bookings first
  if ((booking as any).is_postponed === true) return 'Rescheduled'
  
  // Check for cancellation via rejection_reason or status
  const rejectionReason = (booking as any).rejection_reason || (booking as any).rejectionReason || ''
  if (rejectionReason.toLowerCase().includes('cancelled')) return 'Cancelled'
  
  const normalized = (booking.status || '').toLowerCase()
  if (normalized.includes('cancel')) return 'Cancelled'
  if (normalized.includes('resched')) return 'Rescheduled'
  
  const { startDate, endDate } = parseBookingTimeWindow(booking)
  if (!startDate || !endDate) return 'Upcoming'

  const hasCheckedIn = Boolean(booking.checkedInAt || booking.checked_in_at)
  const meetingHasStarted = referenceDate >= startDate
  const meetingHasEnded = referenceDate > endDate
  const meetingInProgress = referenceDate >= startDate && referenceDate <= endDate

  // If meeting has ended
  if (meetingHasEnded) {
    // Only show "Attended" if check-in was clicked AND meeting time has passed
    if (hasCheckedIn && meetingHasStarted) {
      return 'Attended'
    }
    // If no check-in and meeting ended, it's Missed
    return 'Missed'
  }

  // If meeting is in progress
  if (meetingInProgress) {
    // Only show "Attended" if check-in was clicked AND meeting time has passed
    if (hasCheckedIn && meetingHasStarted) {
      return 'Attended'
    }
    // If meeting in progress and no check-in, show "Awaiting Check-In"
    return 'Awaiting Check-In'
  }

  // Before meeting starts
  if (referenceDate < startDate) {
    // Even if checked in before start, don't show as "Attended" until meeting starts
    if (hasCheckedIn) {
      return 'Upcoming' // Check-in clicked but meeting hasn't started yet
    }
    return 'Upcoming'
  }

  return 'Upcoming'
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
  const userIdentifier = user?.employeeId || user?.email || user?.id || "guest"
  const [deviceData, setDeviceData] = useState<DeviceRecord[]>([])
  const [availableDeviceData, setAvailableDeviceData] = useState<DeviceRecord[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [deviceStats, setDeviceStats] = useState({ total: 0, available: 0, borrowed: 0, maintenance: 0 })
  const [totalDevicesCount, setTotalDevicesCount] = useState<number | null>(null)
  const [totalDevicesCountLoading, setTotalDevicesCountLoading] = useState(false)
const [resourceCount, setResourceCount] = useState<number | null>(null)
const [resourceCountLoading, setResourceCountLoading] = useState(false)
const [maintenanceRequestsCount, setMaintenanceRequestsCount] = useState<number | null>(null)
const [maintenanceRequestsLoading, setMaintenanceRequestsLoading] = useState(false)
const [assignedBorrowDevices, setAssignedBorrowDevices] = useState<DeviceRecord[]>([])
const [assignedBorrowHistory, setAssignedBorrowHistory] = useState<BorrowHistoryRecord[]>([])
const [assignedDevicesLoading, setAssignedDevicesLoading] = useState(false)
const [assignedDevicesError, setAssignedDevicesError] = useState<string | null>(null)
  const [borrowHistoryCount, setBorrowHistoryCount] = useState<number | null>(null)
  const [borrowHistoryLoading, setBorrowHistoryLoading] = useState(false)
  const [assignedDevicesCount, setAssignedDevicesCount] = useState<number | null>(null)
  const [assignedDevicesCountLoading, setAssignedDevicesCountLoading] = useState(false)
  const [employeeRecord, setEmployeeRecord] = useState<any>(null)
  const identityCandidates = useMemo(() => {
    const ids = new Set<string>()
    if (userIdentifier) ids.add(userIdentifier)
    if (user?.employeeId) ids.add(user.employeeId)
    if (user?.id) ids.add(user.id)
    if (user?.email) ids.add(user.email)
    if (employeeRecord?.employee_id) ids.add(employeeRecord.employee_id)
    if (employeeRecord?.id) ids.add(employeeRecord.id)
    return ids
  }, [employeeRecord?.employee_id, employeeRecord?.id, user?.email, user?.employeeId, user?.id, userIdentifier])
  
  // Device modals
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [reportIssueOpen, setReportIssueOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null)
  
  // Quick Actions modals
  const [borrowDeviceOpen, setBorrowDeviceOpen] = useState(false)
  const [requestMaintenanceOpen, setRequestMaintenanceOpen] = useState(false)
  const [bookRoomOpen, setBookRoomOpen] = useState(false)
  const [bookingSummaryOpen, setBookingSummaryOpen] = useState(false)
  const [roomBookings, setRoomBookings] = useState<DashboardRoomBooking[]>([])
  const [roomBookingsLoading, setRoomBookingsLoading] = useState(true)
  const [roomBookingsError, setRoomBookingsError] = useState<string | null>(null)
  const [roomsLookup, setRoomsLookup] = useState<Record<string, Room>>({})
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [availableRoomsLoading, setAvailableRoomsLoading] = useState(false)
  const [availableRoomsError, setAvailableRoomsError] = useState<string | null>(null)
  const [bookingSummaryData, setBookingSummaryData] = useState<any>(null)
  const roomsLookupRef = useRef<Record<string, Room>>({})
  const roomsList = useMemo(
    () =>
      Object.values(roomsLookup)
        .slice()
        .sort((a, b) => a.room_name.localeCompare(b.room_name)),
    [roomsLookup],
  )
  const [postponeDialog, setPostponeDialog] = useState<{ open: boolean; booking: DashboardRoomBooking | null }>({
    open: false,
    booking: null,
  })
  const [postponeForm, setPostponeForm] = useState({ date: "", startTime: "", endTime: "", notes: "" })
  const [postponeFormErrors, setPostponeFormErrors] = useState<Record<string, string>>({})
  const [isPostponing, setIsPostponing] = useState(false)
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; booking: DashboardRoomBooking | null }>({
    open: false,
    booking: null,
  })
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRecord[]>([])
  const [borrowRequestsState, setBorrowRequestsState] = useState<BorrowRequestRecord[]>([])
  const [deviceAvailabilityOpen, setDeviceAvailabilityOpen] = useState(false)
  const [deviceAvailabilitySearch, setDeviceAvailabilitySearch] = useState('')
const [roomAvailabilityOpen, setRoomAvailabilityOpen] = useState(false)
  const [checkInSummary, setCheckInSummary] = useState<{ booking: RoomBookingRecord; timestamp: string } | null>(null)
  const [checkInSummaryOpen, setCheckInSummaryOpen] = useState(false)
  const [checkInLoading, setCheckInLoading] = useState(false)
const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null)
  const [deviceCardDetail, setDeviceCardDetail] = useState<DeviceCardDetailType | null>(null)
  const [quickBorrowSummaryOpen, setQuickBorrowSummaryOpen] = useState(false)
  const [quickBorrowReceipt, setQuickBorrowReceipt] = useState<QuickBorrowReceipt | null>(null)
  const [bookingSummaryMode, setBookingSummaryMode] = useState<"result" | null>(null)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [quickBorrowSummaryMode, setQuickBorrowSummaryMode] = useState<"preview" | "result" | null>(null)
  const [pendingQuickBorrow, setPendingQuickBorrow] = useState<{
    apiPayload: {
      device_id: string
      borrowed_by: string
      borrow_date: string
      return_date: string | null
      notes?: string
    }
    historyEntry: DeviceHistoryEntry
    requestRecord: BorrowRequestRecord
    deviceSupabaseId: string
  } | null>(null)
  const [quickBorrowSubmitting, setQuickBorrowSubmitting] = useState(false)
  const [pendingCheckInCandidate, setPendingCheckInCandidate] = useState<CheckInCandidate | null>(null)
  const [checkInSummaryMode, setCheckInSummaryMode] = useState<"preview" | "result" | null>(null)
  const [checkInConfirmOpen, setCheckInConfirmOpen] = useState(false)
  const [postponeConfirmOpen, setPostponeConfirmOpen] = useState(false)

  const persistRoomBookingsToStorage = useCallback(
    (records?: DashboardRoomBooking[] | null) => {
      if (typeof window === "undefined") return
      const list = Array.isArray(records) ? records : []
      const storagePayload: RoomBookingRecord[] = list.map((booking) => {
        const roomDetail = booking.roomDetails ?? roomsLookupRef.current[booking.roomId]
        const [rangeStart, rangeEnd] = (booking.time || "").split("-").map((value) => value?.trim() ?? "")
        const start = booking.startTime || rangeStart || ""
        const end = booking.endTime || rangeEnd || ""
        const time = booking.time || (start && end ? `${start}-${end}` : start || end || "")

        return {
          id: booking.id,
          employeeId: booking.employeeId || userIdentifier || "",
          employeeName: user?.name || "Employee",
          room: roomDetail?.room_name || booking.room || booking.roomId || "Room",
          meetingCategory: booking.meetingCategory ?? "Internal",
          meetingAgenda: booking.meetingAgenda ?? "",
          date: booking.date || "",
          time,
          startTime: start || undefined,
          endTime: end || undefined,
          status: booking.status ?? "Pending",
          createdAt: new Date().toISOString(),
          updatedAt: booking.checkedInAt ?? undefined,
          checkedInAt: booking.checkedInAt ?? undefined,
        }
      })

      window.localStorage.setItem(ROOM_BOOKINGS_STORAGE_KEY, JSON.stringify(storagePayload))
      window.dispatchEvent(new CustomEvent(ROOM_BOOKINGS_UPDATED_EVENT))
    },
    [user?.name, userIdentifier],
  )

  useEffect(() => {
    let isMounted = true
    const loadResourceCount = async () => {
      setResourceCountLoading(true)
      try {
        const response = await fetch("/api/resources?limit=1")
        const json = await response.json().catch(() => ({}))
        if (!response.ok || json.success === false) {
          throw new Error(json?.error || "Failed to fetch resources")
        }
        const total =
          (typeof json?.meta?.count === "number" ? json.meta.count : Array.isArray(json.data) ? json.data.length : 0) ??
          0
        if (isMounted) {
          setResourceCount(total)
        }
      } catch (error) {
        console.error("[dashboard] failed to load resource count", error)
        if (isMounted) {
          setResourceCount(0)
        }
      } finally {
        if (isMounted) {
          setResourceCountLoading(false)
        }
      }
    }

    loadResourceCount()

    return () => {
      isMounted = false
    }
  }, [])

  // Load total devices count from /api/devices endpoint
  // This directly fetches the count using devices-service.ts
  useEffect(() => {
    let isMounted = true

    const loadTotalDevicesCount = async () => {
      setTotalDevicesCountLoading(true)
      try {
        // Fetch devices count from /api/devices endpoint
        // This uses devicesService.listDevices() which queries the database
        const response = await fetch('/api/devices?limit=1&offset=0', {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        })
        
        const json = await response.json().catch(() => ({}))
        if (!response.ok || json.success === false) {
          throw new Error(json?.error || 'Failed to fetch devices count')
        }

        if (isMounted) {
          // Get count from meta.count (accurate database count from devices-service)
          // This is the total count from: SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL
          const count = json.meta?.count ?? 
                        (typeof json.count === 'number' ? json.count : (Array.isArray(json.data) ? json.data.length : 0))
          setTotalDevicesCount(count)
        }
      } catch (error) {
        console.error('[dashboard] failed to load total devices count', error)
        if (isMounted) {
          setTotalDevicesCount(0)
        }
      } finally {
        if (isMounted) {
          setTotalDevicesCountLoading(false)
        }
      }
    }

    loadTotalDevicesCount()

    return () => {
      isMounted = false
    }
  }, [])

  // Load maintenance requests count from database
  useEffect(() => {
    let isMounted = true

    const loadMaintenanceRequestsCount = async () => {
      setMaintenanceRequestsLoading(true)
      try {
        // Fetch active maintenance requests from database
        // Count only requests that are not Completed or Resolved
        const { data, error, count } = await supabase
          .from('maintenance_requests')
          .select('*', { count: 'exact', head: false })
          .neq('status', 'Completed')
          .neq('status', 'Resolved')
          .is('deleted_at', null)

        if (error) {
          // If table doesn't exist, fall back to counting devices with maintenance status
          console.warn('[dashboard] Maintenance requests table not available, using device status count:', error.message)
          if (isMounted) {
            setMaintenanceRequestsCount(null) // Will fall back to deviceStats.maintenance
          }
        } else {
          const activeCount = count ?? (data?.length ?? 0)
          if (isMounted) {
            setMaintenanceRequestsCount(activeCount)
          }
        }
      } catch (error) {
        console.error('[dashboard] failed to load maintenance requests count', error)
        if (isMounted) {
          setMaintenanceRequestsCount(null) // Will fall back to deviceStats.maintenance
        }
      } finally {
        if (isMounted) {
          setMaintenanceRequestsLoading(false)
        }
      }
    }

    loadMaintenanceRequestsCount()

    return () => {
      isMounted = false
    }
  }, [])
  
  // Form states
  const [borrowForm, setBorrowForm] = useState({
    type: "",
    name: "",
    identifier: "", // Identifier field for searching devices using getDeviceByIdentifier
    date: "",
    dateTime: "",
    returnDate: "",
    purpose: "",
  })
  const [identifierSearchLoading, setIdentifierSearchLoading] = useState(false)
  const [identifierSearchResult, setIdentifierSearchResult] = useState<DeviceRecord | null>(null)
  const [maintenanceForm, setMaintenanceForm] = useState({ deviceId: "", deviceName: "", category: "", description: "", priority: "Medium" })
  const [bookingForm, setBookingForm] = useState({ room: "", category: "", meetingType: "", date: "", startTime: "12:00", endTime: "13:00", agenda: "" })
  const [bookingErrors, setBookingErrors] = useState<BookingErrors>({})
  const [issueForm, setIssueForm] = useState({ deviceName: "", issueType: "", description: "" })
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  // Activity Center state
  const [activities, setActivities] = useState<Array<{
    id: string
    type: string
    title: string
    description: string
    created_at: string
    status: string
    related_id: string | null
  }>>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)
  const [activitiesPage, setActivitiesPage] = useState(1)
  const [hasMoreActivities, setHasMoreActivities] = useState(true)
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

  const isWeekend = (value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const dayOfWeek = parsed.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // 0 = Sunday, 6 = Saturday
  }

const calculateDayDiff = (start: Date | null, end: Date | null) => {
  if (!start || !end) return null
  const msPerDay = 1000 * 60 * 60 * 24
  return (end.getTime() - start.getTime()) / msPerDay
}

const getReturnDateUpperBound = (start: Date | null) => {
  if (!start) return undefined
  const limit = new Date(start)
  limit.setDate(limit.getDate() + MAX_BORROW_DURATION_DAYS)
  return limit.toISOString().split("T")[0]
}

  const borrowReturnLimitIso = useMemo(() => getReturnDateUpperBound(parseDateOnly(borrowForm.date || todayIso)), [borrowForm.date, todayIso])

  const ensureReturnDateIsValid = useCallback(
    (returnDate: string | undefined, context: "change" | "submit" = "submit") => {
      if (!returnDate) return true
      const borrowDateValue = borrowForm.date || todayIso
      const borrowDateObj = parseDateOnly(borrowDateValue)
      const returnDateObj = parseDateOnly(returnDate)
      if (!borrowDateObj || !returnDateObj) return true
      if (returnDateObj <= borrowDateObj) {
        toast({
          variant: "destructive",
          title: "Return date issue",
          description: "Return date must be after the borrow date.",
        })
        return false
      }
      if (isWeekend(returnDate)) {
        toast({
          variant: "destructive",
          title: "Weekend not allowed",
          description: "Device returns are not allowed on weekends. Please pick a weekday.",
        })
        return false
      }
      const diff = calculateDayDiff(borrowDateObj, returnDateObj)
      if (diff !== null && diff > MAX_BORROW_DURATION_DAYS) {
        toast({
          variant: "destructive",
          title: "Return date too far",
          description: `Return date can be at most ${MAX_BORROW_DURATION_DAYS} days after the borrow date.`,
        })
        return false
      }
      return true
    },
    [borrowForm.date, todayIso, toast],
  )

  const handleBorrowReturnDateChange = useCallback(
    (value: string) => {
      if (!value) {
        setBorrowForm((prev) => ({ ...prev, returnDate: "" }))
        return
      }
      if (!ensureReturnDateIsValid(value, "change")) {
        return
      }
      setBorrowForm((prev) => ({ ...prev, returnDate: value }))
    },
    [ensureReturnDateIsValid],
  )

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

  // Search for device using getDeviceByIdentifier from devices-service.ts
  // This uses the API endpoint /api/devices/[deviceId] which calls getDeviceByIdentifier()
  // It tries multiple lookup strategies: device_id, id, asset_tag, serial_number
  // Note: The route parameter is [deviceId] but accepts any identifier (device_id, UUID, asset_tag, serial_number)
  const handleIdentifierSearch = async (identifier: string) => {
    if (!identifier.trim()) {
      setIdentifierSearchResult(null)
      return
    }

    setIdentifierSearchLoading(true)
    setIdentifierSearchResult(null)

    try {
      // Call API endpoint /api/devices/[deviceId] that uses getDeviceByIdentifier from devices-service.ts
      // The deviceId parameter accepts flexible identifiers (device_id, UUID, asset_tag, serial_number)
      const response = await fetch(`/api/devices/${encodeURIComponent(identifier)}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })

      const json = await response.json()

      if (response.ok && json.success && json.data) {
        // Device found using getDeviceByIdentifier
        setIdentifierSearchResult(json.data)
        
        // Auto-populate form if device is available
        const foundDevice = json.data
        if (foundDevice.device_type) {
          setBorrowForm((prev) => ({
            ...prev,
            type: toTitleCase(foundDevice.device_type),
            identifier: identifier,
          }))
        }
      } else {
        // Device not found
        setIdentifierSearchResult(null)
        toast({
          variant: 'destructive',
          title: 'Device not found',
          description: `No device found with identifier: ${identifier}`,
        })
      }
    } catch (error) {
      console.error('[dashboard] Error searching device by identifier:', error)
      setIdentifierSearchResult(null)
      toast({
        variant: 'destructive',
        title: 'Search failed',
        description: 'Unable to search for device. Please try again.',
      })
    } finally {
      setIdentifierSearchLoading(false)
    }
  }

  const validateBooking = (form: typeof bookingForm): BookingErrors => {
    const errors: BookingErrors = {}

    if (!form.room) {
      errors.room = "Select a room."
    }

    if (!form.category) {
      errors.category = "Select a meeting category."
    }

  if (!form.meetingType) {
    errors.meetingType = "Select a meeting type."
  }

    if (!form.date) {
      errors.date = "Select a booking date."
    } else if (isPastDate(form.date)) {
      errors.date = "Booking date cannot be in the past."
    } else if (isWeekend(form.date)) {
      errors.date = "Room bookings are not allowed on weekends."
    }

    const startValidation = validateBusinessHourSelection(form.startTime)
    if (startValidation) {
      errors.startTime = startValidation === "Time is required." ? "Select a start time." : startValidation
    }

    const endValidation = validateBusinessHourSelection(form.endTime)
    if (endValidation) {
      errors.endTime = endValidation === "Time is required." ? "Select an end time." : endValidation
    }

    if (!form.agenda || form.agenda.trim() === "") {
      errors.agenda = "Enter a meeting agenda."
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
    if (context === "submit" && errors.room && !bookingErrors.room) {
      toast({
        variant: "destructive",
        title: "Room selection required",
        description: errors.room,
      })
    }
    if (context === "submit" && errors.category && !bookingErrors.category) {
      toast({
        variant: "destructive",
        title: "Meeting category required",
        description: errors.category,
      })
    }
    if (context === "submit" && errors.meetingType && !bookingErrors.meetingType) {
      toast({
        variant: "destructive",
        title: "Meeting type required",
        description: errors.meetingType,
      })
    }
    if (context === "submit" && errors.agenda && !bookingErrors.agenda) {
      toast({
        variant: "destructive",
        title: "Meeting agenda required",
        description: errors.agenda,
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

  const handleBookRoomSubmit = async () => {
    const errors = validateBooking(bookingForm)
    pushBookingErrors(errors, "submit")

    if (Object.keys(errors).length > 0) {
      toast({
        variant: "destructive",
        title: "Cannot book room",
        description: "Please fill in all required fields before submitting.",
      })
      return
    }

    if (!userIdentifier) {
      toast({
        variant: "destructive",
        title: "Missing user details",
        description: "We couldn't identify your profile. Please sign in again.",
      })
      return
    }

    setBookingErrors({})

    const payload = {
      room_id: bookingForm.room,
      booked_by: userIdentifier,
      date: bookingForm.date,
      start_time: bookingForm.startTime,
      end_time: bookingForm.endTime,
      meeting_category: bookingForm.category,
      meeting_type: bookingForm.meetingType,
      meeting_agenda: bookingForm.agenda,
      status: "Booked",
    }

    await submitDashboardBooking(payload)
  }

  const submitDashboardBooking = async (payload: Record<string, any>) => {
    if (bookingSubmitting) return
    try {
      setBookingSubmitting(true)
      const response = await fetch('/api/room-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      
      if (response.status === 409) {
        const errorMessage = json?.error || 'Room unavailable'
        if (errorMessage.includes('already have a booking')) {
          toast({
            variant: "destructive",
            title: "Time slot unavailable",
            description: "You already have a booking at this time on this date. You cannot book multiple rooms simultaneously.",
          })
        } else {
          toast({
            variant: "destructive",
            title: "Room unavailable",
            description: "The selected room is already booked for that time window.",
          })
        }
        return
      }
      
      if (!response.ok || json.success === false) {
        throw new Error(json.error || 'Failed to book room')
      }

      const booking = json.data
      setBookingConflictDetected(false)
      setBookingSummaryData(booking)
      setBookingSummaryMode("result")
      setBookingSummaryOpen(true)
      setBookRoomOpen(false)
      setBookingForm((prev) => ({
        ...prev,
        room: "",
      }))
      await Promise.all([fetchRoomBookings(), refreshDashboardData()])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to book room'
      if (message.toLowerCase().includes('already have a booking')) {
        toast({
          variant: "destructive",
          title: "Time slot unavailable",
          description: "You already have a booking at this time on this date. You cannot book multiple rooms simultaneously.",
        })
      } else if (message.toLowerCase().includes('already booked') || message.toLowerCase().includes('unavailable')) {
        setBookingConflictDetected(true)
        toast({
          variant: "destructive",
          title: "Room unavailable",
          description: "The selected room is already booked for that time window.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Unable to book room",
          description: message,
        })
      }
    } finally {
      setBookingSubmitting(false)
    }
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

    const trimmedPurpose = borrowForm.purpose.trim()
    if (!ensureReturnDateIsValid(borrowForm.returnDate, "submit")) {
      return
    }

    const deviceIdentifier = borrowForm.name?.trim()
    if (!deviceIdentifier) {
      toast({
        variant: "destructive",
        title: "Device missing",
        description: "Select a device before submitting your request.",
      })
      return
    }
    const resolvedDevice = findAvailableDeviceByIdentifier(deviceIdentifier)
    const deviceName =
      resolvedDevice?.model ||
      resolvedDevice?.brand ||
      toTitleCase(resolvedDevice?.device_type) ||
      deviceIdentifier
    const deviceType = toTitleCase(resolvedDevice?.device_type) || borrowForm.type || "Device"
    const recordId = `BR-${Date.now()}`
    const nowIso = new Date().toISOString()
    const borrowDateValue = borrowForm.dateTime || nowIso
    const borrowerIdentifier =
      employeeRecord?.id ||
      employeeRecord?.employee_id ||
      user?.employeeId ||
      user?.id ||
      user?.email ||
      userIdentifier

    if (!borrowerIdentifier) {
      toast({
        variant: "destructive",
        title: "Missing profile data",
        description: "We couldn't resolve your employee record. Please refresh and try again.",
      })
      return
    }
    if (!resolvedDevice?.id) {
      toast({
        variant: "destructive",
        title: "Device details incomplete",
        description: "Please refresh the device list and try again.",
      })
      return
    }

    const requestRecord: BorrowRequestRecord = {
      id: recordId,
      employeeName: user?.name || "Employee",
      employeeId: user?.employeeId || user?.email || "Unassigned",
      deviceName,
      assetTag: deviceIdentifier,
      borrowDate: nowIso,
      purpose: trimmedPurpose,
      status: "Pending Approval",
    }

    const historyEntry: DeviceHistoryEntry = {
      recordId,
      deviceId: deviceIdentifier,
      deviceName,
      deviceType,
      borrowDate: nowIso,
      expectedReturnDate: borrowForm.returnDate || undefined,
      status: "Pending",
      action: "Borrow",
      notes: trimmedPurpose || undefined,
    }

    const apiPayload = {
      device_id: resolvedDevice.id,
      borrowed_by: borrowerIdentifier,
      borrow_date: borrowDateValue,
      return_date: borrowForm.returnDate || null,
      notes: trimmedPurpose || undefined,
    }

    const receipt: QuickBorrowReceipt = {
      deviceId: deviceIdentifier,
      deviceName,
      deviceType,
      borrowDate: nowIso,
      expectedReturnDate: borrowForm.returnDate || undefined,
      status: 'Pending',
    }

    setPendingQuickBorrow({
      apiPayload,
      historyEntry,
      requestRecord,
      deviceSupabaseId: resolvedDevice.id,
    })
    setQuickBorrowReceipt(receipt)
    setQuickBorrowSummaryMode("preview")
    setQuickBorrowSummaryOpen(true)
    setBorrowDeviceOpen(false)
  }

  const confirmQuickBorrow = async () => {
    if (!pendingQuickBorrow || quickBorrowSubmitting) return
    try {
      setQuickBorrowSubmitting(true)
      const borrowResponse = await fetch('/api/borrows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingQuickBorrow.apiPayload),
      })
      const borrowJson = await borrowResponse.json()
      if (!borrowResponse.ok || borrowJson.success === false) {
        throw new Error(borrowJson.error || 'Failed to submit borrow request')
      }

      addBorrowRequestRecord(pendingQuickBorrow.requestRecord)
      appendDeviceHistoryEntry(userIdentifier, pendingQuickBorrow.historyEntry)

      toast({
        title: "Borrow request submitted",
        description: `${pendingQuickBorrow.requestRecord.deviceName} is awaiting supervisor approval.`,
      })

      setBorrowForm((prev) => {
        const freshNow = new Date()
        const freshDate = freshNow.toISOString().split("T")[0]
        const freshDateTime = freshNow.toISOString()
        return {
          type: "",
          name: "",
          identifier: prev.identifier ?? "",
          date: freshDate,
          dateTime: freshDateTime,
          returnDate: "",
          purpose: "",
        }
      })

      setQuickBorrowSummaryMode("result")
      setQuickBorrowReceipt((prev) =>
        prev ? { ...prev, status: 'Pending' } : prev,
      )
      setPendingQuickBorrow(null)

      try {
        const response = await fetch('/api/devices', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: pendingQuickBorrow.deviceSupabaseId, status: 'pending borrow' }),
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to update device status')
        }
        await refreshDashboardData()
      } catch (statusError) {
        console.error('Failed to update device status', statusError)
        toast({
          variant: 'destructive',
          title: 'Inventory not updated',
          description: 'Your request is saved but the device status could not refresh automatically.',
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to submit borrow",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setQuickBorrowSubmitting(false)
    }
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

  const handlePostponeChange = (field: keyof typeof postponeForm, value: string) => {
    const updatedForm = { ...postponeForm, [field]: value }
    setPostponeForm(updatedForm)
    // Validate in real-time
    const errors = validatePostponeFormWithData(updatedForm)
    setPostponeFormErrors(errors)
  }

  const validatePostponeFormWithData = useCallback((form: typeof postponeForm): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!postponeDialog.booking) return errors

    // Fix: Prefer 'date' over deprecated 'booking_date', but fallback if necessary
    let originalDate = ""
    if ('date' in postponeDialog.booking && postponeDialog.booking.date) {
      originalDate = postponeDialog.booking.date
    } else if ('booking_date' in postponeDialog.booking && postponeDialog.booking.booking_date) {
      originalDate = postponeDialog.booking.booking_date
    }

    const [rangeStart, rangeEnd] = (postponeDialog.booking.time || "").split("-").map((value) => value?.trim() ?? "")
    const originalStart = postponeDialog.booking.startTime || rangeStart || ""
    const originalEnd = postponeDialog.booking.endTime || rangeEnd || ""
    const nextDate = form.date || originalDate
    const nextStart = form.startTime || originalStart
    const nextEnd = form.endTime || originalEnd

    // Validate date
    if (!form.date) {
      errors.date = "Select a new date for the meeting."
    } else if (isPastDate(form.date)) {
      errors.date = "Cannot select a date in the past."
    } else if (isWeekend(form.date)) {
      errors.date = "Room bookings are not allowed on weekends."
    }

    // Validate start time
    if (!form.startTime) {
      errors.startTime = "Select a start time."
    } else {
      const startValidation = validateBusinessHourSelection(form.startTime)
      if (startValidation) {
        errors.startTime = startValidation === "Time is required." ? "Select a start time." : startValidation
      }
    }

    // Validate end time
    if (!form.endTime) {
      errors.endTime = "Select an end time."
    } else {
      const endValidation = validateBusinessHourSelection(form.endTime)
      if (endValidation) {
        errors.endTime = endValidation === "Time is required." ? "Select an end time." : endValidation
      }
    }

    // Validate end time is after start time
    if (form.startTime && form.endTime && !errors.startTime && !errors.endTime) {
      const diff = compareTimes(form.startTime, form.endTime)
      if (diff !== null && diff >= 0) {
        errors.endTime = "End time must be after start time."
      }
    }

    // Validate that new date/time is not the same as current date/time
    if (
      originalDate &&
      originalStart &&
      originalEnd &&
      nextDate === originalDate &&
      nextStart === originalStart &&
      nextEnd === originalEnd
    ) {
      errors.date = "Cannot postpone to the same date and time. Please select a different date or time."
      errors.startTime = "Cannot postpone to the same date and time. Please select a different date or time."
      errors.endTime = "Cannot postpone to the same date and time. Please select a different date or time."
    }

    // Validate that the new date/time is in the future
    if (form.date && form.startTime && !errors.date && !errors.startTime) {
      const bookingStart = new Date(`${form.date}T${form.startTime}:00`)
      if (!Number.isNaN(bookingStart.getTime())) {
        const now = new Date()
        const isSameDay = bookingStart.toDateString() === now.toDateString()
        if (isSameDay && bookingStart <= now) {
          errors.startTime = "Invalid selection: meeting time must be in the future."
        }
      }
    }

    return errors
  }, [postponeDialog.booking, isPastDate, isWeekend, compareTimes])

  const validatePostponeForm = useCallback((): Record<string, string> => {
    return validatePostponeFormWithData(postponeForm)
  }, [postponeForm, validatePostponeFormWithData])

  const combineDateTime = (date: string, time: string) => {
    const normalizedTime = time.length === 5 ? `${time}:00` : time
    const candidate = new Date(`${date}T${normalizedTime}`)
    return Number.isNaN(candidate.getTime()) ? new Date(date).toISOString() : candidate.toISOString()
  }

  const handleSubmitPostpone = async () => {
    if (!postponeDialog.booking) return

    // Validate form
    const errors = validatePostponeForm()
    if (Object.keys(errors).length > 0) {
      setPostponeFormErrors(errors)
      const firstError = Object.values(errors)[0]
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: firstError,
      })
      return
    }

    setPostponeFormErrors({})

    const originalDate = postponeDialog.booking.date || postponeDialog.booking.booking_date || ""
    const [rangeStart, rangeEnd] = (postponeDialog.booking.time || "").split("-").map((value) => value?.trim() ?? "")
    const originalStart = postponeDialog.booking.startTime || rangeStart || ""
    const originalEnd = postponeDialog.booking.endTime || rangeEnd || ""
    const nextDate = postponeForm.date || originalDate
    const nextStart = postponeForm.startTime || originalStart
    const nextEnd = postponeForm.endTime || originalEnd

    setIsPostponing(true)
    try {
      // Use booking_id if available, otherwise fall back to id
      const bookingId = postponeDialog.booking.booking_id || postponeDialog.booking.id
      if (!bookingId) {
        throw new Error('Booking ID is required')
      }

      const newStartTimeISO = combineDateTime(nextDate, nextStart)
      const newEndTimeISO = combineDateTime(nextDate, nextEnd)

      console.log('[Postpone] Sending request:', {
        booking_id: bookingId,
        new_start_time: newStartTimeISO,
        new_end_time: newEndTimeISO,
      })

      const response = await fetch('/api/room-bookings/postpone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          new_start_time: newStartTimeISO,
          new_end_time: newEndTimeISO,
        }),
      })
      
      console.log('[Postpone] Response status:', response.status)
      const json = await response.json()
      console.log('[Postpone] Response data:', json)
      
      if (!response.ok || json.success === false) {
        const errorMsg = json.error || json.message || 'Unable to postpone booking'
        console.error('[Postpone] Error response:', errorMsg, json)
        throw new Error(errorMsg)
      }
      
      // Format the new date and time for the success message
      const newDate = new Date(newStartTimeISO)
      const formattedDate = newDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
      const formattedStartTime = newDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
      const formattedEndTime = new Date(newEndTimeISO).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
      
      toast({
        title: '✅ Meeting Successfully Postponed',
        description: `Your meeting has been rescheduled to ${formattedDate} from ${formattedStartTime} to ${formattedEndTime}. The status has been updated to Rescheduled.`,
        duration: 5000,
      })
      
      setPostponeDialog({ open: false, booking: null })
      setPostponeForm({ date: "", startTime: "", endTime: "", notes: "" })
      setPostponeFormErrors({})
      await fetchRoomBookings()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Please try again.'
      if (errorMessage.includes('unavailable') || errorMessage.includes('Conflict')) {
        toast({
          variant: 'destructive',
          title: 'Room unavailable',
          description: 'The room is already booked for that time window. Please choose a different time.',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Unable to postpone',
          description: errorMessage,
        })
      }
    } finally {
      setIsPostponing(false)
    }
  }

  const handleConfirmCancelBooking = async () => {
    if (!cancelDialog.booking) return
    try {
      const response = await fetch(`/api/room-bookings/${cancelDialog.booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || 'Unable to cancel booking')
      }
      toast({
        title: 'Booking cancelled',
        description: 'This meeting has been cancelled.',
      })
      setCancelDialog({ open: false, booking: null })
      setPostponeDialog({ open: false, booking: null })
      await fetchRoomBookings()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to cancel',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
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

  const refreshDashboardData = useCallback(async () => {
    if (!user) return
    setDevicesLoading(true)
    setAssignmentsLoading(true)
    setDevicesError(null)
    setScheduleError(null)

    const fetchDevicesFromApi = async (query: string) => {
      const response = await fetch(`/api/devices${query}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || 'Failed to fetch devices')
      }
      // Return both data and meta.count for accurate counting
      // meta.count is the total count from the database query
      return json as { 
        data: DeviceRecord[]; 
        meta?: { count?: number; limit?: number; offset?: number };
        count?: number; // Fallback count field
      }
    }

    const fetchAllDevices = async (options?: { availableOnly?: boolean }) => {
      const pageSize = 200
      let offset = 0
      let totalCount: number | null = null
      const aggregated: DeviceRecord[] = []

      // Keep paging until we've retrieved everything (or the API runs out of data)
      while (true) {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
        })
        if (options?.availableOnly) {
          params.set('availableOnly', 'true')
        }

        const result = await fetchDevicesFromApi(`?${params.toString()}`)
        const chunk = Array.isArray(result.data) ? result.data : []
        aggregated.push(...chunk)

        // Get total count from API response
        // meta.count is the accurate total count from database (even with pagination)
        if (typeof result.meta?.count === 'number') {
          totalCount = result.meta.count
        } else if (typeof result.count === 'number') {
          // Fallback to result.count if meta.count is not available
          totalCount = result.count
        }

        if (chunk.length < pageSize) {
          break
        }

        offset += pageSize
        if (totalCount !== null && aggregated.length >= totalCount) {
          break
        }
      }

      // Return aggregated data and total count from devices-service
      // totalCount comes from meta.count in the API response (accurate database count)
      // This count is from devicesService.listDevices() which queries:
      // SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL
      return {
        data: aggregated,
        count: totalCount !== null ? totalCount : aggregated.length,
        meta: totalCount !== null ? { count: totalCount } : undefined,
      }
    }

    // CRITICAL: Clear device state before fetching to ensure fresh data
    setDeviceData([])
    setAvailableDeviceData([])
    
    try {
      const [allDevicesJson, availableDevicesJson, assignmentsResp] = await Promise.all([
        fetchAllDevices(),
        fetchAllDevices({ availableOnly: true }),
        supabase
          .from('assigned_devices')
          .select('id, device_id, employee_id, status, assignment_type, assigned_date, expected_return_date, actual_return_date, purpose, assignment_notes')
          .is('deleted_at', null),
      ])

      const allDevices = allDevicesJson.data ?? []
      const availableDevices = availableDevicesJson.data ?? []
      // Calculate total count: Use meta.count from devices-service GET request
      // This is the accurate count from devicesService.listDevices() which queries:
      // SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL
      // Prefer meta.count (accurate database count), then count field, then data length
      const total = allDevicesJson.meta?.count ?? 
                    (typeof allDevicesJson.count === 'number' ? allDevicesJson.count : allDevices.length)
      
      // Log for debugging if count is 0 but we have devices
      if (total === 0 && allDevices.length > 0) {
        console.warn('[dashboard] Total count is 0 but devices exist. Using data length as count.', {
          metaCount: allDevicesJson.meta?.count,
          count: allDevicesJson.count,
          dataLength: allDevices.length,
        })
      }
      const borrowedCount = allDevices.filter((device) => {
        const statusChunk = `${device.status ?? ''}`.toLowerCase()
        return (
          statusChunk.includes('borrow') ||
          statusChunk === 'borrowed' ||
          statusChunk === 'assigned'
        )
      }).length
      const maintenanceCount = allDevices.filter((device) => {
        const statusChunk = `${device.status ?? ''}`.toLowerCase()
        return statusChunk.includes('maintenance') || statusChunk.includes('repair') || statusChunk.includes('service')
      }).length
      const useAllAsAvailable = borrowedCount === 0 && availableDevices.length === 0 && allDevices.length > 0
      const normalizedAvailableDevices = useAllAsAvailable ? allDevices : availableDevices
      // Calculate available count: prefer meta.count from API, fallback to data length
      const availableCount = useAllAsAvailable
        ? total
        : availableDevicesJson.meta?.count ?? 
          (typeof availableDevicesJson.count === 'number' ? availableDevicesJson.count : normalizedAvailableDevices.length)

      setDeviceData(allDevices)
      setAvailableDeviceData(normalizedAvailableDevices)
      setDeviceStats({ total, available: availableCount, borrowed: borrowedCount, maintenance: maintenanceCount })
      setDevicesError(null)

      if (assignmentsResp.error) {
        console.error('Failed to load assignments', assignmentsResp.error)
        setAssignments([])
        setScheduleError((prev) => prev ?? 'Unable to load upcoming device returns')
      } else {
        setAssignments((assignmentsResp.data as AssignmentRecord[]) ?? [])
      }
    } catch (error) {
      console.error('Failed to load dashboard data', error)
      setDevicesError(error instanceof Error ? error.message : 'Unable to load devices')
      setDeviceData([])
      setAvailableDeviceData([])
      setDeviceStats({ total: 0, available: 0, borrowed: 0, maintenance: 0 })
      setAssignments([])
      setScheduleError((prev) => prev ?? 'Unable to load dashboard data')
    } finally {
      setDevicesLoading(false)
      setAssignmentsLoading(false)
    }
  }, [user])

  const fetchRoomsDirectory = useCallback(async () => {
    try {
      const response = await fetch('/api/rooms?limit=200', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || 'Failed to load rooms')
      }
      const records: Room[] = json.data ?? []
      setRoomsLookup((prev) => {
        const next = { ...prev }
        records.forEach((room) => {
          next[room.id] = room
        })
        return next
      })
    } catch (error) {
      console.error('Failed to load rooms directory', error)
    }
  }, [])

  const fetchRoomBookings = useCallback(async () => {
    if (!userIdentifier) {
      setRoomBookings([])
      setRoomBookingsLoading(false)
      persistRoomBookingsToStorage([])
      return []
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const upcomingEnd = new Date(todayStart)
    upcomingEnd.setDate(upcomingEnd.getDate() + 7)
    upcomingEnd.setHours(23, 59, 59, 999)

    setRoomBookingsLoading(true)
    let normalized: DashboardRoomBooking[] = []
    try {
      const params = new URLSearchParams({
        bookedBy: userIdentifier,
        scope: 'dashboard',
        fromDate: todayStart.toISOString(),
        toDate: upcomingEnd.toISOString(),
      })
      const response = await fetch(`/api/room-bookings?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || 'Failed to load bookings')
      }
      const rows: any[] = Array.isArray(json.data) ? json.data : []
      normalized = rows.map((booking) => {
        const date = booking.date ?? booking.booking_date ?? booking.bookingDate ?? ''
        const start = booking.start_time ?? booking.startTime ?? ''
        const end = booking.end_time ?? booking.endTime ?? ''
        const roomId = booking.room_id ?? booking.roomId ?? booking.room ?? ''
        const roomDetails = booking.room_details ?? roomsLookupRef.current[roomId] ?? null
        const label = roomDetails?.room_name ?? roomId
        return {
          id: booking.id ?? booking.booking_id ?? '',
          booking_id: booking.booking_id ?? booking.id ?? null,
          roomId,
          room: label,
          roomLabel: label,
          roomDetails,
          employeeId: booking.booked_by ?? booking.employee_id ?? userIdentifier,
          date,
          startTime: start,
          endTime: end,
          time: start && end ? `${start}-${end}` : booking.time ?? '',
          status: booking.status ?? 'Pending',
          meetingCategory: booking.meeting_category ?? booking.meetingCategory ?? 'Internal',
          meetingAgenda: booking.meeting_agenda ?? booking.meetingAgenda ?? '',
          checkedInAt: booking.checked_in_at ?? booking.checkedInAt ?? null,
        }
      })
      // Sort bookings by date and time in descending order (newest first)
      const sortedBookings = normalized.sort((a, b) => {
        const dateA = a.date || a.booking_date || ''
        const dateB = b.date || b.booking_date || ''
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA) // Descending date order
        }
        // If same date, sort by start time (newest first)
        const timeA = a.startTime || ''
        const timeB = b.startTime || ''
        return timeB.localeCompare(timeA) // Descending time order
      })
      
      setRoomBookings(sortedBookings)
      setRoomBookingsError(null)
      setScheduleError((prev) => (prev && prev.toLowerCase().includes('room bookings') ? null : prev))
      persistRoomBookingsToStorage(sortedBookings)
      return sortedBookings
    } catch (error) {
      console.error('Failed to load room bookings', error)
      setRoomBookings([])
      persistRoomBookingsToStorage([])
      const message = error instanceof Error ? error.message : 'Unable to load room bookings'
      setRoomBookingsError(message)
      setScheduleError((prev) => prev ?? 'Unable to load room bookings')
      return []
    } finally {
      setRoomBookingsLoading(false)
    }
  }, [persistRoomBookingsToStorage, userIdentifier])

  const fetchAvailableRooms = useCallback(async () => {
    if (!bookRoomOpen) {
      setAvailableRooms([])
      setAvailableRoomsError(null)
      setAvailableRoomsLoading(false)
      return
    }
    if (!bookingForm.date || !bookingForm.startTime || !bookingForm.endTime) {
      setAvailableRooms([])
      setAvailableRoomsLoading(false)
      return
    }

    setAvailableRoomsLoading(true)
    setAvailableRoomsError(null)
    try {
      const params = new URLSearchParams({
        limit: '200',
        bookingDate: bookingForm.date,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        isAvailable: 'true',
      })
      const response = await fetch(`/api/rooms?${params.toString()}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || 'Failed to load available rooms')
      }
      const records: Room[] = json.data ?? []
      setAvailableRooms(records)
      setRoomsLookup((prev) => {
        const next = { ...prev }
        records.forEach((room) => {
          next[room.id] = room
        })
        return next
      })
    } catch (error) {
      setAvailableRooms([])
      setAvailableRoomsError(error instanceof Error ? error.message : 'Unable to load available rooms')
    } finally {
      setAvailableRoomsLoading(false)
    }
  }, [bookRoomOpen, bookingForm.date, bookingForm.startTime, bookingForm.endTime])

  useEffect(() => {
    roomsLookupRef.current = roomsLookup
  }, [roomsLookup])

  useEffect(() => {
    setRoomBookings((prev) =>
      prev.map((booking) => {
        const roomDetail = roomsLookup[booking.roomId]
        if (!roomDetail) {
          return booking
        }
        if (booking.roomDetails?.room_name === roomDetail.room_name && booking.room === roomDetail.room_name) {
          return booking
        }
        return { ...booking, room: roomDetail.room_name, roomLabel: roomDetail.room_name, roomDetails: roomDetail }
      }),
    )
  }, [roomsLookup])

  useEffect(() => {
    persistRoomBookingsToStorage(roomBookings)
  }, [roomBookings, persistRoomBookingsToStorage])


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

  // Fetch employee record to get employee UUID for assigned devices queries
  useEffect(() => {
    if (typeof window === "undefined" || !user) return

    // Try to load from localStorage first
    const storedEmployee = localStorage.getItem('xspark_employee')
    if (storedEmployee) {
      try {
        const parsed = JSON.parse(storedEmployee)
        setEmployeeRecord(parsed)
        return // If found in localStorage, don't fetch from API
      } catch (error) {
        console.error('Failed to parse stored employee record:', error)
      }
    }

    // Fetch from API if not in localStorage
    let isMounted = true
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
        if (!isMounted) return
        if (response.ok && json.success && json.data?.employee) {
          setEmployeeRecord(json.data.employee)
          try {
            localStorage.setItem("xspark_employee", JSON.stringify(json.data.employee))
          } catch {
            // ignore storage errors
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch employee profile", error)
        }
      }
    }

    fetchEmployee()

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const now = new Date()
    const isoDate = now.toISOString().split("T")[0]
    const isoDateTime = now.toISOString()
    setBorrowForm((prev) => ({ ...prev, date: isoDate, dateTime: isoDateTime }))

    refreshDashboardData()
  }, [user, refreshDashboardData])

  useEffect(() => {
    fetchRoomsDirectory()
  }, [fetchRoomsDirectory])

  // Fetch devices from /api/devices when borrow modal opens
  // This ensures device types are available in the dropdown
  // Uses devices-service.ts listDevices() method via the API endpoint
  useEffect(() => {
    if (!borrowDeviceOpen || !user) return

    let isMounted = true

    const fetchDevicesForBorrow = async () => {
      try {
        // Fetch all devices from /api/devices endpoint
        // This uses devicesService.listDevices() which queries the database
        const response = await fetch('/api/devices?limit=1000&offset=0', {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        })

        if (!isMounted) return

        const json = await response.json()
        
        if (response.ok && json.success && Array.isArray(json.data)) {
          // Update deviceData and availableDeviceData to ensure device types are populated
          const devices = json.data
          
          // Filter for available devices
          const available = devices.filter((device: DeviceRecord) => {
            const status = (device.status ?? '').toLowerCase()
            return status === 'available' || status === 'ready' || 
                   (status === 'assigned' && !device.assigned_to) ||
                   status === ''
          })

          // Update state to populate device types dropdown
          if (available.length > 0) {
            setAvailableDeviceData(available)
          }
          if (devices.length > 0 && deviceData.length === 0) {
            setDeviceData(devices)
          }
        }
      } catch (error) {
        console.error('[dashboard] Error fetching devices for borrow modal:', error)
      }
    }

    fetchDevicesForBorrow()

    return () => {
      isMounted = false
    }
  }, [borrowDeviceOpen, user])

  useEffect(() => {
    fetchRoomBookings()
  }, [fetchRoomBookings])

  // Auto-update meeting statuses: "Missed" if past end time without check-in, "Awaiting" during meeting without check-in
  useEffect(() => {
    if (!userIdentifier || roomBookings.length === 0) return

    const updateStatuses = async () => {
      const now = new Date()
      const updates: Array<{ id: string; status: string }> = []

      for (const booking of roomBookings) {
        if (!booking.employeeId || booking.employeeId !== userIdentifier) continue
        if (booking.checkedInAt) continue // Already checked in

        const { startDate, endDate } = parseBookingTimeWindow(booking)
        if (!startDate || !endDate) continue

        const normalizedStatus = (booking.status || '').toLowerCase()
        if (normalizedStatus.includes('cancel') || normalizedStatus.includes('attend') || normalizedStatus.includes('miss')) continue

        // If meeting has ended and no check-in, set to "Missed"
        if (now > endDate && !normalizedStatus.includes('miss')) {
          updates.push({ id: booking.id, status: 'missed' })
          continue
        }

        // If meeting is in progress and no check-in, set to "Awaiting"
        if (now >= startDate && now <= endDate && normalizedStatus !== 'awaiting') {
          updates.push({ id: booking.id, status: 'awaiting' })
        }
      }

      // Update statuses in batch
      if (updates.length > 0) {
        await Promise.all(
          updates.map(async (update) => {
            try {
              await fetch(`/api/room-bookings/${update.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: update.status }),
              })
            } catch (error) {
              console.error(`Failed to update booking ${update.id}:`, error)
            }
          })
        )
        await fetchRoomBookings()
      }
    }

    updateStatuses()
    // Check every minute for status updates
    const interval = setInterval(updateStatuses, 60000)
    return () => clearInterval(interval)
  }, [roomBookings, userIdentifier, fetchRoomBookings])

  useEffect(() => {
    if (!bookRoomOpen) return
    fetchRoomsDirectory()
    fetchAvailableRooms()
  }, [bookRoomOpen, bookingForm.date, bookingForm.startTime, bookingForm.endTime, fetchAvailableRooms, fetchRoomsDirectory])

  const handleOpenPostponeModal = (booking: DashboardRoomBooking) => {
    openPostponeDialog(booking)
  }

  const handleQuickPostpone = (candidate: CheckInCandidate) => {
    if (!candidate) return
    setPendingCheckInCandidate(candidate)
    setPostponeConfirmOpen(true)
  }

  function openPostponeDialog(booking: DashboardRoomBooking) {
    setPostponeDialog({ open: true, booking })
    setPostponeForm({
      date: booking.date || todayIso,
      startTime: booking.startTime || "08:30",
      endTime: booking.endTime || "09:30",
      notes: "",
    })
    setPostponeFormErrors({})
  }

  if (!user) return null

  const normalizedRole = ((user.role as string | undefined) ?? '').toLowerCase()
  const isSupervisor = normalizedRole === 'supervisor'

  // Redirect supervisors to their dashboard
  useEffect(() => {
    if (isSupervisor) {
      router.replace('/ams-supervisor')
    }
  }, [isSupervisor, router])

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

  useEffect(() => {
    if (!employeeId) {
      setBorrowHistoryCount(null)
      setBorrowHistoryLoading(false)
      return
    }

    let isMounted = true
    setBorrowHistoryLoading(true)

    const fetchBorrowHistory = async () => {
      try {
        const response = await fetch(`/api/borrows/borrower/${encodeURIComponent(employeeId)}`, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok || json.success === false) {
          throw new Error(json?.error || 'Failed to fetch borrow history')
        }
        if (!isMounted) return
        const records = Array.isArray(json.data) ? json.data : []
        setBorrowHistoryCount(records.length)
      } catch (error) {
        console.error('[dashboard] failed to fetch borrow history count', error)
        if (isMounted) {
          setBorrowHistoryCount(0)
        }
      } finally {
        if (isMounted) {
          setBorrowHistoryLoading(false)
        }
      }
    }

    fetchBorrowHistory()
    return () => {
      isMounted = false
    }
  }, [employeeId])

  // Fetch count of devices assigned to the current user
  // Uses /api/devices?assigned_to=USER_UUID to get count
  // The employee UUID is from employeeRecord.id (the UUID field, not employee_id string)
  // This UUID matches the devices.assigned_to foreign key which references employees(id)
  useEffect(() => {
    // Get employee UUID from employeeRecord.id
    // This is the UUID that matches devices.assigned_to field in the database
    // Note: employeeRecord.employee_id is a string like "XSP24/001", but we need the UUID (id field)
    const employeeUuid = employeeRecord?.id
    
    if (!employeeUuid) {
      // If employee UUID not available, set count to 0 (not null) to show "0" instead of "—"
      setAssignedDevicesCount(0)
      setAssignedDevicesCountLoading(false)
      return
    }

    let isMounted = true
    setAssignedDevicesCountLoading(true)

    const fetchAssignedCount = async () => {
      try {
        // Fetch devices assigned to this employee UUID using assigned_to filter
        // Query: SELECT COUNT(*) FROM devices WHERE assigned_to = employeeUuid AND deleted_at IS NULL
        // This uses the devices-service.ts listDevices method with assigned_to filter
        const response = await fetch(`/api/devices?assigned_to=${encodeURIComponent(employeeUuid)}&limit=1&offset=0`, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        })
        
        const json = await response.json().catch(() => ({}))
        if (!response.ok || json.success === false) {
          throw new Error(json?.error || 'Failed to load assigned devices count.')
        }

        if (isMounted) {
          // Get count from meta.count (total count from database query)
          // This counts devices where assigned_to = employeeUuid AND deleted_at IS NULL
          // Only devices assigned to the logged-in user are counted
          // Prefer meta.count as it's the accurate total from database
          const count = json.meta?.count ?? 
                        (typeof json.count === 'number' ? json.count : (Array.isArray(json.data) ? json.data.length : 0))
          setAssignedDevicesCount(count)
        }
      } catch (error) {
        console.error('[dashboard] failed to load assigned devices count', error)
        if (isMounted) {
          setAssignedDevicesCount(0) // Show 0 on error instead of null
        }
      } finally {
        if (isMounted) {
          setAssignedDevicesCountLoading(false)
        }
      }
    }

    fetchAssignedCount()

    return () => {
      isMounted = false
    }
  }, [employeeRecord?.id])

  // Fetch devices assigned to the current user (from devices.assigned_to field)
  // This replaces the old borrow-based logic to use the actual device assignment
  const fetchAssignedDevices = useCallback(async () => {
    // Get employee UUID (not employee_id string)
    const employeeUuid = employeeRecord?.id
    
    if (!employeeUuid) {
      setAssignedDevicesError('Unable to determine employee UUID. Please refresh the page.')
      setAssignedBorrowDevices([])
      return
    }

    setAssignedDevicesLoading(true)
    setAssignedDevicesError(null)

    try {
      // Fetch devices assigned to this employee UUID
      // Uses the new /api/devices/assigned endpoint which filters by assigned_to
      const response = await fetch(`/api/devices/assigned?employee_id=${encodeURIComponent(employeeUuid)}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
      
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || 'Failed to load assigned devices.')
      }

      // The API returns devices with only the required fields:
      // asset_tag, device_type, brand, model, status, condition, location
      const devices: DeviceRecord[] = Array.isArray(json.data) ? json.data : []
      setAssignedBorrowDevices(devices)
    } catch (error) {
      console.error('[dashboard] failed to load assigned devices', error)
      setAssignedDevicesError(error instanceof Error ? error.message : 'Unable to load assigned devices.')
      setAssignedBorrowDevices([])
    } finally {
      setAssignedDevicesLoading(false)
    }
  }, [employeeRecord?.id])

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
  const assignedDeviceDetails = useMemo<AssignedDeviceDetails | null>(() => {
    if (!primaryAssignedDevice) {
      return null
    }
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
  }, [primaryAssignedDevice])

  // Available devices for borrowing
  // Uses devices fetched from /api/devices endpoint via refreshDashboardData()
  // Falls back to filtering deviceData if availableDeviceData is empty
  // This ensures device types are populated even if availableDeviceData is empty
  const availableBorrowDevices = useMemo(() => {
    if (availableDeviceData.length > 0) {
      return availableDeviceData
    }
    // Fallback: filter deviceData for available devices
    // This ensures we have devices even if availableDeviceData is empty
    // This fixes the "No available types" issue
    const available = deviceData.filter((device) => {
      const status = (device.status ?? '').toLowerCase()
      return status === 'available' || status === 'ready' || (status === 'assigned' && !device.assigned_to)
    })
    return available
  }, [availableDeviceData, deviceData])

  const deviceAvailabilityPanel = useMemo(() => {
    // Show ALL devices from the database, filtered by search term
    if (deviceData.length === 0) return []
    
    if (!deviceAvailabilitySearch.trim()) {
      return deviceData
    }
    
    const searchTerm = deviceAvailabilitySearch.toLowerCase().trim()
    return deviceData.filter((device) => {
      const assetTag = (device.asset_tag || '').toLowerCase()
      const serialNumber = (device.serial_number || '').toLowerCase()
      const model = (device.model || '').toLowerCase()
      const brand = (device.brand || '').toLowerCase()
      const deviceType = (device.device_type || '').toLowerCase()
      
      return (
        assetTag.includes(searchTerm) ||
        serialNumber.includes(searchTerm) ||
        model.includes(searchTerm) ||
        brand.includes(searchTerm) ||
        deviceType.includes(searchTerm)
      )
    })
  }, [deviceData, deviceAvailabilitySearch])
  const deviceCount = deviceStats.total ?? deviceData.length ?? 0
  // Total Resources should only count resources (devices are excluded via API)
  // The /api/resources endpoint now automatically excludes devices
  const totalResourceValue =
    resourceCountLoading || resourceCount === null
      ? "—"
      : String(resourceCount ?? 0)
  // Assigned Devices card count: Show devices assigned to the logged-in user
  // Uses assigned_to field from devices table (not borrows)
  // Only counts devices where assigned_to = current user's employee UUID
  const assignedDeviceCardValue =
    assignedDevicesCountLoading || devicesLoading
      ? '—'
      : String(assignedDevicesCount ?? 0)
  const deviceSummaryCards: DeviceSummaryCard[] = [
    {
      key: 'resources',
      label: 'Total Resources',
      Icon: Package,
      value: totalResourceValue,
      accent: '#3B4370',
    },
    {
      key: 'available',
      label: 'Total Devices',
      Icon: CheckCircle2,
      // Total Devices count: Fetch directly from /api/devices endpoint
      // Uses devicesService.listDevices() which queries: SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL
      // Prefer totalDevicesCount (from direct API call), fallback to deviceStats.total
      value: totalDevicesCountLoading || devicesLoading 
        ? '—' 
        : String(totalDevicesCount ?? deviceStats.total ?? 0),
      accent: '#6D6E70',
    },
    {
      key: 'assigned',
      label: 'Assigned Devices',
      Icon: UserCheck,
      value: assignedDeviceCardValue,
      accent: '#D6343A',
    },
    {
      key: 'maintenance',
      label: 'Under Maintenance',
      Icon: Wrench,
      // Use real maintenance requests count from database if available,
      // otherwise fall back to device status count
      value: maintenanceRequestsLoading 
        ? '—' 
        : String(maintenanceRequestsCount !== null ? maintenanceRequestsCount : (deviceStats.maintenance ?? 0)),
      accent: '#A14FB5',
    },
  ]
  const isDeviceDetailKey = (key: DeviceSummaryCardKey): key is DeviceCardDetailType =>
    key === 'resources' || key === 'available' || key === 'assigned'
  const handleDeviceCardDetail = useCallback(
    (key: DeviceCardDetailType) => {
      setDeviceCardDetail(key)
      if (key === 'assigned') {
        fetchAssignedDevices()
      }
    },
    [fetchAssignedDevices],
  )
  const activeDeviceCardMeta = deviceCardDetail
    ? deviceSummaryCards.find((card) => card.key === deviceCardDetail)
    : null
  // Device detail view: Show devices based on selected card
  // For 'assigned': Show only devices assigned to the logged-in user (from assignedBorrowDevices)
  // This is populated by fetchAssignedDevices() which filters by assigned_to = employee UUID
  const deviceDetailDevices = useMemo(() => {
    if (deviceCardDetail === 'available') return availableBorrowDevices
    if (deviceCardDetail === 'assigned') return assignedBorrowDevices // Devices assigned to current user
    if (deviceCardDetail === 'resources') return deviceData
    return []
  }, [deviceCardDetail, availableBorrowDevices, assignedBorrowDevices, deviceData])
  const deviceDetailPreview = useMemo(() => deviceDetailDevices.slice(0, 6), [deviceDetailDevices])
  // Empty state message for assigned devices
  // Shows when user has no devices assigned to them (assigned_to IS NULL or different employee)
  const deviceDetailEmptyMessage =
    deviceCardDetail === 'assigned'
      ? 'No devices currently assigned to you.'
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

  const summaryRoomName = useMemo(() => {
    if (!bookingSummaryData) return "—"
    const roomId = bookingSummaryData.room_id ?? bookingSummaryData.room ?? ""
    if (!roomId) return "—"
    return roomsLookup[roomId]?.room_name ?? roomId
  }, [bookingSummaryData, roomsLookup])

  const reportableDevices = useMemo(
    () => deviceData.filter((device) => (device.status ?? "").toLowerCase() !== "borrowed"),
    [deviceData]
  )

  const scheduleLoading = assignmentsLoading || roomBookingsLoading
  const quickBorrowReady = Boolean(
    borrowForm.type && borrowForm.name && borrowForm.date && borrowForm.returnDate && borrowForm.purpose.trim()
  )
  const quickMaintenanceReady = Boolean(
    maintenanceForm.deviceId && maintenanceForm.category && maintenanceForm.priority && maintenanceForm.description
  )

  const deriveDeviceAvailabilityStatus = useCallback((device: DeviceRecord): 'Available' | 'Pending Borrow' | 'Borrowed' | 'Maintenance' => {
    // CRITICAL: Trust the API-provided status as it's calculated from actual borrow records
    const statusChunk = `${device.status ?? ''}`.toLowerCase()
    const assignmentChunk = `${device.assignment_status ?? ''}`.toLowerCase()
    
    // Check for maintenance status first
    if (statusChunk.includes('maintenance') || statusChunk.includes('repair') || statusChunk.includes('service') || statusChunk === 'in_maintenance') {
      return 'Maintenance'
    }
    
    // Only mark as Borrowed if status explicitly indicates borrowing AND we have evidence of active borrow
    // Don't default to Borrowed - default to Available if uncertain
    if (statusChunk === 'borrowed' || statusChunk === 'assigned') {
      // Double-check: if status is 'assigned' but no active borrow indicators, it might be stale
      return 'Borrowed'
    }
    
    if (statusChunk.includes('pending') || assignmentChunk.includes('pending') || statusChunk === 'pending borrow') {
      return 'Pending Borrow'
    }
    
    // Default to Available - don't assume Borrowed
    return 'Available'
  }, [])

  const getAvailabilityTone = useCallback((status: 'Available' | 'Pending Borrow' | 'Borrowed' | 'Maintenance') => {
    switch (status) {
      case 'Pending Borrow':
        return 'text-white border-transparent'
      case 'Borrowed':
        return 'text-white border-transparent'
      case 'Maintenance':
        return 'text-white border-transparent'
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    }
  }, [])
  
  const getAvailabilityBadgeColor = useCallback((status: 'Available' | 'Pending Borrow' | 'Borrowed' | 'Maintenance') => {
    switch (status) {
      case 'Pending Borrow':
        return '#2563EB'
      case 'Borrowed':
        return '#BE1E2D'
      case 'Maintenance':
        return '#BE1E2D' // Brand red for maintenance
      default:
        return undefined
    }
  }, [])

  const getStatusBadgeColor = useCallback((status: string) => {
    const statusLower = status.toLowerCase().trim()
    if (statusLower === "missed") return "#DC2626"
    if (statusLower === "upcoming") return "#2563EB"
    if (statusLower === "checked-in") return "#6B7280"
    if (statusLower === "in progress") return "#92278F"
    if (statusLower === "in progress-awaiting check-in" || statusLower.includes("awaiting check-in")) {
      return "#92278F"
    }
    if (statusLower === "attended") return "#16A34A"
    if (statusLower === "rescheduled" || statusLower.includes("rescheduled")) return "#FF9800"
    if (statusLower === "cancelled" || statusLower.includes("cancelled") || statusLower.includes("canceled")) return "#F44336"
    if (statusLower === "confirmed" || statusLower === "booked") return "#2563EB"
    if (statusLower === "pending") return "#25294B"
    if (statusLower === "completed" || statusLower === "attended") return "#16A34A"
    return undefined
  }, [])

  const checkInCandidates = useMemo<CheckInCandidate[]>(() => {
    if (identityCandidates.size === 0) return []
    const now = new Date()
    return roomBookings
      .filter((booking) => booking.employeeId && identityCandidates.has(booking.employeeId))
      .map((booking) => {
        const { startDate, endDate } = parseBookingTimeWindow(booking)
        if (!startDate || !endDate) return null
        if (startDate.toDateString() !== now.toDateString()) return null
        if (now > endDate) return null
        
        // Remove meetings that have been checked in (immediately remove from card after check-in)
        const hasCheckedIn = Boolean(booking.checkedInAt || (booking as any).checked_in_at)
        if (hasCheckedIn) return null
        
        // Remove check-in button when meeting is in progress (even if not checked in)
        const isInProgress = now >= startDate && now <= endDate
        if (isInProgress) return null
        
        const statusLabel = getBookingStatusLabel(booking, now)
        if (['Cancelled'].includes(statusLabel)) return null
        const minutes = minutesUntilStart(booking, now)
        return {
          booking,
          minutes,
          startDate,
          endDate,
          statusLabel,
          isInProgress: false, // This will always be false now since we filter it out above
        }
      })
      .filter((candidate): candidate is CheckInCandidate => Boolean(candidate && candidate.startDate))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  }, [identityCandidates, roomBookings])

  useEffect(() => {
    if (checkInCandidates.length === 0) {
      if (selectedCheckInId !== null) {
        setSelectedCheckInId(null)
      }
      return
    }
    if (!selectedCheckInId || !checkInCandidates.some((candidate) => candidate.booking.id === selectedCheckInId)) {
      setSelectedCheckInId(checkInCandidates[0].booking.id)
    }
  }, [checkInCandidates, selectedCheckInId])

  const activeCheckInBooking =
    checkInCandidates.find((candidate) => candidate.booking.id === selectedCheckInId) ??
    checkInCandidates[0] ??
    null
  const checkInButtonClass =
    "flex-1 min-w-[140px] rounded-full border border-[#A855F7]/40 bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white shadow-sm hover:opacity-95"

  const openCheckInSummaryPreview = (candidate: CheckInCandidate) => {
    setPendingCheckInCandidate(candidate)
    setCheckInSummaryMode("preview")
    setCheckInSummaryOpen(true)
  }

  const handleOpenCheckInConfirm = (candidate: CheckInCandidate) => {
    setPendingCheckInCandidate(candidate)
    setCheckInConfirmOpen(true)
  }

  const handleConfirmCheckIn = () => {
    if (pendingCheckInCandidate) {
      openCheckInSummaryPreview(pendingCheckInCandidate)
    }
    setCheckInConfirmOpen(false)
  }

  const handleConfirmPostpone = () => {
    if (pendingCheckInCandidate) {
      openPostponeDialog(pendingCheckInCandidate.booking)
    }
    setPostponeConfirmOpen(false)
  }

  const handleCheckIn = async (target: CheckInCandidate) => {
    const now = new Date()

    if (now > target.endDate) {
      toast({
        variant: 'destructive',
        title: 'Meeting ended',
        description: 'This meeting has already ended.',
      })
      return
    }
    
    setCheckInLoading(true)
    try {
      const verificationResponse = await fetch(`/api/room-bookings/${target.booking.id}`, {
        cache: 'no-store',
      })
      const verificationJson = await verificationResponse.json().catch(() => ({}))
      if (!verificationResponse.ok || verificationJson.success === false) {
        throw new Error(verificationJson.error || 'Unable to verify meeting details')
      }
      const serverBooking = verificationJson.data
      if (!serverBooking) {
        throw new Error('Meeting could not be located.')
      }
      if (serverBooking.checked_in_at) {
        throw new Error('This meeting has already been checked in.')
      }
      const latestStatus = (serverBooking.status ?? '').toLowerCase()
      if (latestStatus.includes('cancel')) {
        throw new Error('This meeting was cancelled.')
      }
      if (latestStatus.includes('miss')) {
        throw new Error('Meeting already marked as missed.')
      }

      const timestamp = new Date().toISOString()
      const meetingHasStarted = now >= target.startDate
      
      const response = await fetch('/api/room-bookings/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: target.booking.id || target.booking.booking_id,
        }),
      })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || 'Failed to check in to meeting')
      }

      // Only update status to "Attended" if meeting time has already passed
      // If check-in is clicked before meeting start, don't change status
      if (meetingHasStarted) {
        try {
          const updateResponse = await fetch(`/api/room-bookings/${target.booking.id || target.booking.booking_id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'attended' }),
          })
          const updateJson = await updateResponse.json().catch(() => ({}))
          if (!updateResponse.ok || updateJson.success === false) {
            console.warn('Failed to update status to attended:', updateJson?.error)
          }
        } catch (updateError) {
          console.warn('Failed to update booking status:', updateError)
        }
      }

      // Calculate when to remove the toaster (10 minutes after meeting ends)
      const removeToastTime = new Date(target.endDate.getTime() + 10 * 60 * 1000)
      const delayMs = removeToastTime.getTime() - now.getTime()

      const toastResult = toast({
        title: 'Checked in',
        description: `Meeting in ${target.booking.room || 'the room'} marked as attended.`,
      })

      // Auto-remove toaster 10 minutes after meeting ends
      if (delayMs > 0 && toastResult.dismiss) {
        setTimeout(() => {
          toastResult.dismiss()
        }, delayMs)
      }

      const checkedInBooking = json.data?.booking || json.data || serverBooking
      const checkInTimestamp =
        checkedInBooking?.check_in_time ||
        (checkedInBooking as any)?.checked_in_at ||
        checkedInBooking?.checkInTime ||
        timestamp

      // Ensure room information is included
      const roomId = checkedInBooking?.room_id || target.booking.roomId || target.booking.room
      let roomName =
        checkedInBooking?.room_name ||
        checkedInBooking?.room ||
        target.booking.room ||
        (target.booking as any).roomLabel
      
      // If room name is missing, try to get it from roomsLookup
      if (!roomName && roomId && roomsLookup[roomId]) {
        roomName = roomsLookup[roomId].room_name
      }

      // Create enhanced booking object with room information
      const enhancedBooking = {
        ...checkedInBooking,
        room: roomName || checkedInBooking?.room || target.booking.room,
        room_name: roomName || checkedInBooking?.room_name,
        roomLabel: roomName || target.booking.roomLabel,
        roomId: roomId || target.booking.roomId,
        date: checkedInBooking?.date || checkedInBooking?.booking_date || target.booking.date,
        startTime: checkedInBooking?.start_time || checkedInBooking?.startTime || target.booking.startTime,
        endTime: checkedInBooking?.end_time || checkedInBooking?.endTime || target.booking.endTime,
        time: checkedInBooking?.time || target.booking.time,
        status: checkedInBooking?.status || target.booking.status || 'Attended',
      }

      setCheckInSummary({
        booking: enhancedBooking,
        timestamp: checkInTimestamp || timestamp || new Date().toISOString(),
      })
      setCheckInSummaryMode("result")
      setPendingCheckInCandidate(null)
      setCheckInSummaryOpen(true)
      await fetchRoomBookings()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to check in',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setCheckInLoading(false)
    }
  }

  const confirmCheckIn = () => {
    if (!pendingCheckInCandidate || checkInLoading) return
    handleCheckIn(pendingCheckInCandidate)
  }

  // Fetch activities from Activity Center API
  const fetchActivities = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!userIdentifier) {
      setActivitiesLoading(false)
      return
    }

    setActivitiesLoading(true)
    setActivitiesError(null)
    try {
      const limit = 20
      const offset = (page - 1) * limit
      const response = await fetch(`/api/activity-center?limit=${limit}&offset=${offset}&userId=${encodeURIComponent(userIdentifier)}`)
      const json = await response.json().catch(() => ({}))
      
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || 'Failed to fetch activities')
      }
      
      const newActivities = Array.isArray(json.data) ? json.data : []
      if (append) {
        setActivities(prev => [...prev, ...newActivities])
      } else {
        setActivities(newActivities)
      }
      
      setHasMoreActivities(json.meta?.hasMore ?? (newActivities.length === limit))
    } catch (error) {
      console.error('Failed to fetch activities', error)
      setActivitiesError(error instanceof Error ? error.message : 'Failed to load activities')
    } finally {
      setActivitiesLoading(false)
    }
  }, [userIdentifier])

  useEffect(() => {
    fetchActivities(1, false)
  }, [fetchActivities])

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = []
    const now = new Date()
    const currentEmployeeId = employeeId ?? userIdentifier

    roomBookings.forEach((booking, index) => {
      const { startDate } = parseBookingTimeWindow(booking)
      // Remove meetings from "Today's Schedule" if the scheduled time has passed
      if (!startDate || startDate < now) return
      const statusLabel = getBookingStatusLabel(booking, now)
      const fallbackKey = `${booking.room ?? "room"}-${booking.date ?? "date"}-${booking.startTime ?? booking.time ?? index}`
      items.push({
        id: `booking-${booking.id || fallbackKey}`,
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
      
      // Filter to only show device returns within 5 days
      const daysUntilReturn = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilReturn > 5) return
      
      const deviceInfo = deviceMap.get(assignment.device_id)
      const deviceName =
        deviceInfo?.model ||
        deviceInfo?.brand ||
        deviceInfo?.asset_tag ||
        toTitleCase(deviceInfo?.device_type) ||
        'Assigned device'
      items.push({
        id: `return-${assignment.id}`,
        title: `Device Return · ${deviceName}`,
        details: daysUntilReturn === 0 
          ? 'Due today' 
          : daysUntilReturn === 1 
          ? 'Due tomorrow' 
          : `${daysUntilReturn} days remaining`,
        date: dueDate,
        category: 'return',
        daysRemaining: daysUntilReturn,
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

    // Add device bookings from borrow history
    assignedBorrowHistory.forEach((borrow) => {
      if (!borrow.borrow_date) return
      const borrowDate = new Date(borrow.borrow_date)
      if (Number.isNaN(borrowDate.getTime()) || borrowDate < now) return
      
      // Only show upcoming device borrows (within next 7 days)
      const daysUntilBorrow = Math.ceil((borrowDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilBorrow > 7) return
      
      // Find device name from device data
      const device = deviceData.find((d) => d.id === borrow.device_id)
      const deviceName = device?.model || device?.brand || device?.asset_tag || toTitleCase(device?.device_type) || 'Device'
      
      items.push({
        id: `device-booking-${borrow.borrow_id}`,
        title: `Device Booking · ${deviceName}`,
        details: daysUntilBorrow === 0 
          ? 'Scheduled for today' 
          : daysUntilBorrow === 1 
          ? 'Scheduled for tomorrow' 
          : `In ${daysUntilBorrow} days`,
        date: borrowDate,
        category: 'device-booking',
        daysRemaining: daysUntilBorrow,
      })
    })

    return items
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10) // Increased limit to show more items
  }, [roomBookings, assignments, borrowRequestsState, deviceMap, employeeId, userIdentifier, assignedBorrowHistory, deviceData])

  const scheduleIconMap: Record<ScheduleItem['category'], React.ComponentType<{ className?: string }>> = {
    booking: CalendarIcon,
    'device-booking': Laptop,
    return: Laptop,
    approval: CheckCircle2,
  }

  // Activity Center icon mapping
  const activityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'room_booking': CalendarIcon,
    'device_borrow': Laptop,
    'device_return': Laptop,
    'incident_update': AlertTriangle,
    'Meeting Booked': CalendarIcon,
    'Meeting Cancelled': CalendarIcon,
    'Device Request Approved': CheckCircle2,
    'Device Request Rejected': X,
    'Device Returned': Laptop,
    'Incident Resolved': CheckCircle2,
    'Incident Closed': CheckCircle2,
    'Incident In Progress': AlertTriangle,
  }

  // Get status badge color
  const getActivityStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('approved') || statusLower.includes('completed') || statusLower.includes('resolved')) {
      return '#16A34A' // Green
    }
    if (statusLower.includes('rejected') || statusLower.includes('due today')) {
      return '#BE1E2D' // Red
    }
    if (statusLower.includes('due soon') || statusLower.includes('in progress')) {
      return '#F59E0B' // Orange/Amber
    }
    if (statusLower.includes('reviewed') || statusLower.includes('replied')) {
      return '#2563EB' // Blue
    }
    return '#6B7280' // Gray (default)
  }

  // Format relative time for activities
  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMinutes = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMinutes / 60)
    const diffDays = Math.round(diffHours / 24)

    if (Math.abs(diffMinutes) < 60) {
      if (Math.abs(diffMinutes) < 1) return 'Just now'
      return diffMinutes > 0 ? `in ${diffMinutes} min` : `${Math.abs(diffMinutes)} min ago`
    }
    if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `in ${diffHours} hr` : `${Math.abs(diffHours)} hr ago`
    }
    if (Math.abs(diffDays) < 7) {
      return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`
    }
    return date.toLocaleDateString()
  }

  const quickActions = [
    {
      key: 'borrow-device',
      label: 'Book a device',
      description: 'Request a device and set the expected return date.',
      icon: Laptop,
      background: 'from-white via-[#F6ECFF] to-[#FFF7FB]',
      accent: '#92278F',
    },
    {
      key: 'book-room',
      label: 'Book a room',
      description: 'Reserve collaboration spaces for your meetings.',
      icon: CalendarIcon,
      background: 'from-white via-[#E8F1FF] to-[#F5ECFF]',
      accent: '#25294B',
    },
    {
      key: 'check-device-availability',
      label: 'Check device availability',
      description: 'Preview which devices are available or borrowed.',
      icon: Monitor,
      background: 'from-white via-[#EEF4FF] to-[#F9EEFF]',
      accent: '#58595B',
    },
    {
      key: 'check-room-availability',
      label: 'Check room availability',
      description: 'Jump to the live room availability board.',
      icon: Building2,
      background: 'from-white via-[#FFEFEF] to-[#FFF7F0]',
      accent: '#BE1E2D',
    },
  ]

  const handleQuickActionClick = useCallback(
    async (key: string) => {
      switch (key) {
        case 'borrow-device':
          setBorrowDeviceOpen(true)
          break
        case 'book-room': {
          setBookRoomOpen(true)
          const today = new Date().toISOString().split("T")[0]
          setBookingForm((prev) => ({
            room: "",
            category: prev.category || "",
            meetingType: prev.meetingType || "",
            date: prev.date || today,
            startTime: prev.startTime || "12:00",
            endTime: prev.endTime || "13:00",
            agenda: prev.agenda || "",
          }))
          setBookingErrors({})
          break
        }
        case 'check-device-availability': {
          setDeviceAvailabilityOpen(true)
          // Fetch all devices from the API when opening the modal
          setDevicesLoading(true)
          setDevicesError(null)
          try {
            const response = await fetch('/api/devices', {
              cache: 'no-store',
              headers: {
                Accept: 'application/json',
              },
            })
            const json = await response.json()
            if (!response.ok || json.success === false) {
              throw new Error(json?.error || 'Failed to fetch devices')
            }
            if (Array.isArray(json.data)) {
              setDeviceData(json.data)
            } else {
              setDeviceData([])
            }
          } catch (error) {
            console.error('[dashboard] Failed to fetch devices for availability:', error)
            setDevicesError(error instanceof Error ? error.message : 'Failed to load devices')
            setDeviceData([])
          } finally {
            setDevicesLoading(false)
          }
          break
        }
        case 'check-room-availability': {
          if (roomBookings.length === 0) {
            await fetchRoomBookings()
          }
          setRoomAvailabilityOpen(true)
          break
        }
      }
    },
    [fetchRoomBookings, roomBookings],
  )

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

        {/* Device Summary Cards (display-only, animated counters) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {deviceSummaryCards.map((card) => (
            <DeviceSummaryStatCard key={card.key} card={card} />
          ))}
        </div>
        {devicesError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
            {devicesError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                type="button"
                aria-label={action.label}
                onClick={() => handleQuickActionClick(action.key)}
                className={`group flex min-h-[112px] flex-col items-start justify-between gap-4 rounded-2xl border border-[#808285]/20 bg-gradient-to-br ${action.background} px-4 py-4 text-left text-[#25294B] shadow-sm transition-all duration-150 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92278F]/40`}
              >
                <div className="flex w-full items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm"
                  style={{ color: action.accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#25294B]/50 transition-transform group-hover:translate-x-0.5" />
                </div>
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
                    {activeCheckInBooking
                      ? `Starts in ${activeCheckInBooking.minutes ?? 0} min · ${
                          activeCheckInBooking.booking.room || "Room TBD"
                        }`
                      : "No upcoming meetings within the next hour."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-[#25294B]">
                  {activeCheckInBooking ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-white px-3 py-2">
                        <div>
                          <p className="font-semibold">
                            {activeCheckInBooking.booking.meetingAgenda || "Room booking"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activeCheckInBooking.startDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            • {activeCheckInBooking.booking.meetingCategory || "Internal"}
                          </p>
                          <p className="text-xs font-semibold text-[#A0AEC0]">
                            Status: {getBookingStatusLabel(activeCheckInBooking.booking)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs text-[#25294B]">
                          {getBookingStatusLabel(activeCheckInBooking.booking)}
                        </Badge>
                      </div>
                      <Button
                        className="w-full bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                        onClick={() => handleOpenCheckInConfirm(activeCheckInBooking)}
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
          <UIDialogContent className="sm:max-w-lg space-y-4">
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
          <UIDialogContent className="sm:max-w-lg space-y-4">
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

      {/* Book a Device Modal */}
      {!isSupervisor && (
        <UIDialog open={borrowDeviceOpen} onOpenChange={setBorrowDeviceOpen}>
          <UIDialogContent className="sm:max-w-lg space-y-4">
            <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
              <UIDialogTitle>Book a Device</UIDialogTitle>
              <DialogDescription>Request to book a device</DialogDescription>
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
                    <SelectValue placeholder={borrowDeviceOptions.length === 0 ? "Select a device type first" : "Select device"} />
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
              <div className="space-y-2">
                <Label>Identifier</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter device ID, asset tag, or serial number"
                    value={borrowForm.identifier}
                    onChange={(e) => setBorrowForm({ ...borrowForm, identifier: e.target.value })}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && borrowForm.identifier.trim()) {
                        await handleIdentifierSearch(borrowForm.identifier.trim())
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleIdentifierSearch(borrowForm.identifier.trim())}
                    disabled={identifierSearchLoading || !borrowForm.identifier.trim()}
                  >
                    {identifierSearchLoading ? "Searching..." : "Search"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses getDeviceByIdentifier from devices-service.ts (searches by device_id, asset_tag, or serial_number)
                </p>
                {identifierSearchResult && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                    <p className="font-medium text-green-800">Device Found:</p>
                    <p className="text-green-700">
                      {identifierSearchResult.asset_tag || identifierSearchResult.serial_number} • {identifierSearchResult.model || identifierSearchResult.brand || identifierSearchResult.device_type}
                    </p>
                  </div>
                )}
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
                    max={borrowReturnLimitIso}
                    value={borrowForm.returnDate}
                    onChange={(e) => handleBorrowReturnDateChange(e.target.value)}
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
                  Book a Device
                </Button>
              </div>
            </div>
          </UIDialogContent>
        </UIDialog>
      )}

      {/* Quick Borrow Summary */}
      <UIDialog
        open={quickBorrowSummaryOpen}
        onOpenChange={(open) => {
          setQuickBorrowSummaryOpen(open)
          if (!open) {
            if (quickBorrowSummaryMode === "preview") {
              setBorrowDeviceOpen(true)
            }
            setQuickBorrowSummaryMode(null)
            setPendingQuickBorrow(null)
            setQuickBorrowReceipt(null)
          }
        }}
      >
        <UIDialogContent className="sm:max-w-lg space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>Borrow Summary</UIDialogTitle>
            <DialogDescription>Quick confirmation of your borrow request.</DialogDescription>
          </UIDialogHeader>
          <div className="space-y-3 text-sm text-[#1F2937] rounded-lg bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Device</span>
              <span className="font-medium">{quickBorrowReceipt?.deviceName ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{quickBorrowReceipt?.deviceType ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Asset Tag</span>
              <span className="font-medium">{quickBorrowReceipt?.deviceId ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Borrowed On</span>
              <span className="font-medium">
                {quickBorrowReceipt ? new Date(quickBorrowReceipt.borrowDate).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Return Date</span>
              <span className="font-medium">
                {quickBorrowReceipt?.expectedReturnDate
                  ? new Date(quickBorrowReceipt.expectedReturnDate).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold text-[#111827]">{quickBorrowReceipt?.status ?? '—'}</span>
            </div>
          </div>
          {quickBorrowSummaryMode === "result" && (
            <p className="text-xs text-[#2563EB]">
              Borrow request saved successfully. Track it from your borrow history.
            </p>
          )}
          {quickBorrowSummaryMode === "preview" ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setQuickBorrowSummaryOpen(false)}>
                Back
              </Button>
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                onClick={confirmQuickBorrow}
                disabled={quickBorrowSubmitting}
              >
                {quickBorrowSubmitting ? 'Submitting…' : 'Confirm Borrow'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                onClick={() => {
                  setQuickBorrowSummaryOpen(false)
                  setQuickBorrowReceipt(null)
                }}
              >
                Close
              </Button>
            </div>
          )}
        </UIDialogContent>
      </UIDialog>

      {/* Postpone Meeting Modal */}
      <UIDialog
        open={postponeDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setPostponeForm({ date: "", startTime: "", endTime: "", notes: "" })
            setPostponeFormErrors({})
          } else if (open && postponeDialog.booking) {
            // Ensure form is initialized when dialog opens
            setPostponeForm({
              date: postponeDialog.booking.date || todayIso,
              startTime: postponeDialog.booking.startTime || "08:30",
              endTime: postponeDialog.booking.endTime || "09:30",
              notes: "",
            })
            setPostponeFormErrors({})
          }
          setPostponeDialog((prev) => ({ open, booking: open ? prev.booking : null }))
        }}
      >
        <UIDialogContent className="sm:max-w-lg space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>Postpone Meeting</UIDialogTitle>
            <DialogDescription>Adjust the booking details or capture a postponement reason.</DialogDescription>
          </UIDialogHeader>
          {postponeDialog.booking ? (
            <>
              <div className="rounded-lg border border-[#E4E4E7] bg-white/90 p-3 text-sm">
                <p className="font-semibold text-[#25294B]">
                  {postponeDialog.booking.roomLabel || postponeDialog.booking.room || 'Room booking'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {postponeDialog.booking.date} · {postponeDialog.booking.startTime} - {postponeDialog.booking.endTime}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>New Date</Label>
                  <Input
                    type="date"
                    value={postponeForm.date}
                    min={todayIso}
                    onChange={(event) => handlePostponeChange('date', event.target.value)}
                    className={postponeFormErrors.date ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                  />
                  {postponeFormErrors.date && (
                    <p className="text-xs text-destructive">{postponeFormErrors.date}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    min={BUSINESS_START_TIME}
                    max={BUSINESS_END_TIME}
                    value={postponeForm.startTime}
                    onChange={(event) => handlePostponeChange('startTime', event.target.value)}
                    className={postponeFormErrors.startTime ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                  />
                  {postponeFormErrors.startTime && (
                    <p className="text-xs text-destructive">{postponeFormErrors.startTime}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    min={BUSINESS_START_TIME}
                    max={BUSINESS_END_TIME}
                    value={postponeForm.endTime}
                    onChange={(event) => handlePostponeChange('endTime', event.target.value)}
                    className={postponeFormErrors.endTime ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                  />
                  {postponeFormErrors.endTime && (
                    <p className="text-xs text-destructive">{postponeFormErrors.endTime}</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Reason</Label>
                  <Textarea
                    rows={4}
                    value={postponeForm.notes}
                    onChange={(event) => handlePostponeChange('notes', event.target.value)}
                    placeholder="Provide a short explanation so the team knows why the meeting moved."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPostponeDialog({ open: false, booking: null })
                    setPostponeForm({ date: "", startTime: "", endTime: "", notes: "" })
                    setPostponeFormErrors({})
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSubmitPostpone}
                  disabled={isPostponing}
                >
                  {isPostponing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Postponing…
                    </>
                  ) : (
                    'Postpone'
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </UIDialogContent>
      </UIDialog>

      <AlertDialog
        open={cancelDialog.open}
        onOpenChange={(open) => {
          setCancelDialog((prev) => ({ open, booking: open ? prev.booking : null }))
        }}
      >
        <AlertDialogContent className="sm:max-w-md space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the booking? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
              onClick={handleConfirmCancelBooking}
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Check-In Confirmation */}
      <AlertDialog open={checkInConfirmOpen} onOpenChange={setCheckInConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Check-in confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark your meeting as attended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB]">No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-[#8B2A6C] to-[#B02A5C] text-white hover:opacity-90"
              onClick={handleConfirmCheckIn}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Postpone Confirmation */}
      <AlertDialog open={postponeConfirmOpen} onOpenChange={setPostponeConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Postpone meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to postpone this meeting?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB]">No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-[#8B2A6C] to-[#B02A5C] text-white hover:opacity-90"
              onClick={handleConfirmPostpone}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request Maintenance Modal */}
      {!isSupervisor && (
        <UIDialog open={requestMaintenanceOpen} onOpenChange={setRequestMaintenanceOpen}>
          <UIDialogContent className="sm:max-w-lg space-y-4">
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
                  <SelectTrigger className="h-12 text-base">
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
          <UIDialogContent className="sm:max-w-lg space-y-4">
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
          <UIDialogContent className="sm:max-w-lg space-y-4">
            <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
              <UIDialogTitle>Book a Room</UIDialogTitle>
              <DialogDescription>Provide booking details</DialogDescription>
            </UIDialogHeader>
            <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
              <div>
                <Label>Room Selection</Label>
                <Select
                  value={bookingForm.room}
                  onValueChange={(v) => setBookingForm({ ...bookingForm, room: v })}
                  disabled={availableRoomsLoading || (availableRooms.length === 0 && !availableRoomsLoading)}
                >
                  <SelectTrigger className={bookingErrors.room ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                    <SelectValue placeholder="Choose a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoomsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading rooms...
                      </SelectItem>
                    )}
                    {!availableRoomsLoading && availableRooms.length === 0 && (
                      <SelectItem value="none" disabled>
                        No rooms available for this time range
                      </SelectItem>
                    )}
                    {!availableRoomsLoading &&
                      availableRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.room_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {bookingErrors.room && <p className="text-xs text-destructive mt-1">{bookingErrors.room}</p>}
                {availableRoomsError && (
                  <p className="text-xs text-destructive mt-1">
                    {availableRoomsError}
                  </p>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Meeting Type</Label>
                  <Select value={bookingForm.meetingType} onValueChange={(v) => setBookingForm({ ...bookingForm, meetingType: v })}>
                    <SelectTrigger className={bookingErrors.meetingType ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {bookingErrors.meetingType && <p className="text-xs text-destructive mt-1">{bookingErrors.meetingType}</p>}
                </div>
                <div>
                  <Label>Meeting Category</Label>
                  <Select value={bookingForm.category} onValueChange={(v) => setBookingForm({ ...bookingForm, category: v })}>
                    <SelectTrigger className={bookingErrors.category ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="External">External</SelectItem>
                    </SelectContent>
                  </Select>
                  {bookingErrors.category && <p className="text-xs text-destructive mt-1">{bookingErrors.category}</p>}
                </div>
              </div>
              <div>
                <Label>Agenda</Label>
                <Textarea
                  rows={3}
                  placeholder="Meeting agenda"
                  value={bookingForm.agenda}
                  onChange={(e) => setBookingForm({ ...bookingForm, agenda: e.target.value })}
                  className={bookingErrors.agenda ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                />
                {bookingErrors.agenda && <p className="text-xs text-destructive mt-1">{bookingErrors.agenda}</p>}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={bookingForm.date}
                    onChange={(e) => handleBookingDateChange(e.target.value)}
                    min={todayIso}
                    className={bookingErrors.date ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                  />
                  {bookingErrors.date && <p className="text-xs text-destructive mt-1">{bookingErrors.date}</p>}
                </div>
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    min={BUSINESS_START_TIME}
                    max={BUSINESS_END_TIME}
                    value={bookingForm.startTime}
                    onChange={(e) => handleBookingStartTimeChange(e.target.value)}
                    className={bookingErrors.startTime ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                  />
                  {bookingErrors.startTime && <p className="text-xs text-destructive mt-1">{bookingErrors.startTime}</p>}
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    min={BUSINESS_START_TIME}
                    max={BUSINESS_END_TIME}
                    value={bookingForm.endTime}
                    onChange={(e) => handleBookingEndTimeChange(e.target.value)}
                    className={
                      bookingErrors.endTime || bookingErrors.range
                        ? "border-destructive focus-visible:ring-destructive/40"
                        : undefined
                    }
                  />
                  {bookingErrors.endTime && <p className="text-xs text-destructive mt-1">{bookingErrors.endTime}</p>}
                </div>
                {bookingErrors.range && (
                  <div className="md:col-span-3 -mt-1">
                    <p className="text-xs text-destructive">{bookingErrors.range}</p>
                  </div>
                )}
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
        <UIDialog
          open={bookingSummaryOpen}
          onOpenChange={(open) => {
            setBookingSummaryOpen(open)
            if (!open) {
              setBookingSummaryData(null)
              setBookingSummaryMode(null)
            }
          }}
        >
          <UIDialogContent className="sm:max-w-lg space-y-4 rounded-xl">
              <UIDialogHeader className="space-y-1">
                <UIDialogTitle>Booking Summary</UIDialogTitle>
                <DialogDescription>Your room booking confirmation</DialogDescription>
              </UIDialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Room:</span>
                <span className="font-medium text-[#25294B]">{summaryRoomName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Category:</span>
                  <span className="font-medium text-[#25294B]">
                    {toTitleCase(
                      bookingSummaryData?.meeting_category ??
                        bookingSummaryData?.meetingCategory ??
                        bookingForm.category ??
                        "—",
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Meeting Type:</span>
                  <span className="font-medium text-[#25294B]">
                    {bookingSummaryData?.meeting_type ?? bookingSummaryData?.meetingType ?? bookingForm.meetingType ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Date:</span>
                <span className="font-medium text-[#25294B]">
                  {bookingSummaryData?.date ?? bookingSummaryData?.booking_date ?? bookingForm.date ?? "—"}
                </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Time:</span>
                  <span className="font-medium text-[#25294B]">
                  {bookingSummaryData?.start_time ?? bookingForm.startTime} -{" "}
                  {bookingSummaryData?.end_time ?? bookingForm.endTime}
                  </span>
                </div>
              {(bookingSummaryData?.meeting_agenda || bookingForm.agenda) && (
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Agenda:</span>
                  <span className="font-medium text-[#25294B]">
                    {bookingSummaryData?.meeting_agenda ?? bookingForm.agenda}
                  </span>
                  </div>
                )}
                <div className="flex justify-between mt-4">
                  <span className="text-[#58595B]">Employee ID:</span>
                  <span className="font-medium text-[#25294B]">{user.employeeId || 'XSP25/01/002'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#808285]/20 flex items-center justify-between">
                  <span className="text-[#58595B] text-xs">Status</span>
                  <Badge variant={bookingConflictDetected ? "destructive" : "secondary"} className="text-xs">
                  {bookingSummaryData?.status
                    ? toTitleCase(bookingSummaryData.status)
                    : bookingConflictDetected
                      ? "Pending"
                      : "Booked"}
                  </Badge>
                </div>
              </div>
              {bookingSummaryMode === "result" && (
                <p className="text-xs text-[#2563EB]">
                  Booking saved successfully. You can track it from your bookings list.
                </p>
              )}
            </UIDialogContent>
          </UIDialog>

      <UIDialog open={deviceCardDetail !== null} onOpenChange={(open) => (!open ? setDeviceCardDetail(null) : null)}>
        <UIDialogContent className="sm:max-w-lg space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>{activeDeviceCardMeta?.label ?? 'Devices'}</UIDialogTitle>
            <DialogDescription>
              {deviceCardDetail === 'assigned'
                ? 'Devices currently assigned to you (from devices.assigned_to field).'
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
                {assignedDevicesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading assigned devices…</p>
                ) : assignedDevicesError ? (
                  <p className="text-sm text-destructive">{assignedDevicesError}</p>
                ) : assignedBorrowDevices.length > 0 ? (
                  // Display devices assigned to the current user (from devices.assigned_to field)
                  // Shows required fields: asset_tag, device_type, brand, model, status, condition, location
                  // Ordered by updated_at DESC (most recently updated first)
                  assignedBorrowDevices.map((device) => {
                    return (
                      <div
                        key={device.device_id ?? device.asset_tag ?? device.serial_number ?? Math.random()}
                        className="rounded-xl border border-[#E4E4E7] bg-white/80 p-3 shadow-sm"
                      >
                        <p className="text-base font-semibold text-[#25294B]">
                          {device.model || device.brand || toTitleCase(device.device_type) || 'Device'}
                        </p>
                        <dl className="grid grid-cols-2 gap-2 text-xs mt-2">
                          <div>
                            <dt className="text-[#58595B]">Asset Tag</dt>
                            <dd className="font-medium">{device.asset_tag || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[#58595B]">Device Type</dt>
                            <dd className="font-medium">{toTitleCase(device.device_type) || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[#58595B]">Brand</dt>
                            <dd className="font-medium">{device.brand || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[#58595B]">Model</dt>
                            <dd className="font-medium">{device.model || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[#58595B]">Status</dt>
                            <dd className="font-medium">{toTitleCase(device.status) || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[#58595B]">Condition</dt>
                            <dd className="font-medium">{toTitleCase(device.condition) || '—'}</dd>
                          </div>
                          {device.location && (
                            <div className="col-span-2">
                              <dt className="text-[#58595B]">Location</dt>
                              <dd className="font-medium">{device.location}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">{deviceDetailEmptyMessage}</p>
                )}
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
                    const typeLabel = toTitleCase(device.device_type) || 'Device'
                    const availabilityStatus = deriveDeviceAvailabilityStatus(device)
                    const tone = getAvailabilityTone(availabilityStatus)
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
                          <p className="text-xs text-muted-foreground">{typeLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {(device.serial_number || device.asset_tag || 'No serial').toString()}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn('px-2 py-0.5 text-[11px]', tone)}
                          style={getAvailabilityBadgeColor(availabilityStatus) ? { backgroundColor: getAvailabilityBadgeColor(availabilityStatus), color: "white", borderColor: getAvailabilityBadgeColor(availabilityStatus) } : undefined}
                        >
                          {availabilityStatus}
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
            )}
        </UIDialogContent>
      </UIDialog>

      <UIDialog open={deviceAvailabilityOpen} onOpenChange={(open) => {
        setDeviceAvailabilityOpen(open)
        if (!open) {
          setDeviceAvailabilitySearch('') // Clear search when closing
        }
      }}>
        <UIDialogContent className="sm:max-w-3xl space-y-4">
          <UIDialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
            <UIDialogTitle>Device Availability</UIDialogTitle>
            <DialogDescription>Quick view of device inventory and current status.</DialogDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="inline-flex items-center justify-center gap-1 rounded-full border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 py-1 text-xs font-medium text-[#16A34A]">
                Available: {devicesLoading ? "—" : deviceAvailabilityPanel.filter((device) => deriveDeviceAvailabilityStatus(device) === 'Available').length}
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-full border border-[#BE1E2D]/30 bg-[#BE1E2D]/10 px-3 py-1 text-xs font-medium text-[#BE1E2D]">
                Borrowed: {devicesLoading ? "—" : deviceAvailabilityPanel.filter((device) => deriveDeviceAvailabilityStatus(device) === 'Borrowed').length}
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-full border border-[#808285]/30 bg-[#808285]/10 px-3 py-1 text-xs font-medium text-[#808285]">
                Maintenance: {devicesLoading ? "—" : deviceAvailabilityPanel.filter((device) => deriveDeviceAvailabilityStatus(device) === 'Maintenance').length}
              </span>
              {deviceAvailabilityPanel.filter((device) => deriveDeviceAvailabilityStatus(device) === 'Pending Borrow').length > 0 && (
                <span className="inline-flex items-center justify-center gap-1 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-3 py-1 text-xs font-medium text-[#2563EB]">
                  Pending: {deviceAvailabilityPanel.filter((device) => deriveDeviceAvailabilityStatus(device) === 'Pending Borrow').length}
                </span>
              )}
            </div>
            </UIDialogHeader>
          <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by name, asset tag, model, brand, or device type..."
                value={deviceAvailabilitySearch}
                onChange={(e) => setDeviceAvailabilitySearch(e.target.value)}
                className="w-full pr-10"
              />
              {deviceAvailabilitySearch && (
                <button
                  type="button"
                  onClick={() => setDeviceAvailabilitySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
            {deviceAvailabilityPanel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices are currently listed in inventory.</p>
            ) : (
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {deviceAvailabilityPanel.map((device) => {
                  const typeKey = device.device_type?.toLowerCase() ?? 'laptop'
                  const IconComponent = deviceTypeIcons[typeKey] || Laptop
                  const identifier = getDeviceIdentifier(device)
                  const deviceKey = device.id || identifier
                  const typeLabel = toTitleCase(device.device_type) || 'Device'
                  const availabilityStatus = deriveDeviceAvailabilityStatus(device)
                  const badgeTone = getAvailabilityTone(availabilityStatus)
                  return (
                    <div
                      key={deviceKey}
                      className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-white p-3 md:flex-row md:items-center"
                    >
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#F5F5F5]">
                        <IconComponent className="h-5 w-5 text-[#25294B]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#25294B]">
                          {device.model || device.brand || toTitleCase(device.device_type) || 'Device'}
                        </p>
                        <p className="text-xs text-muted-foreground">{typeLabel}</p>
                        <p className="text-xs text-muted-foreground">{identifier}</p>
                        {device.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{device.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground md:items-end">
                        <Badge 
                          variant="outline" 
                          className={cn('px-2 py-0.5 text-[11px]', badgeTone)}
                          style={getAvailabilityBadgeColor(availabilityStatus) ? { backgroundColor: getAvailabilityBadgeColor(availabilityStatus), color: "white", borderColor: getAvailabilityBadgeColor(availabilityStatus) } : undefined}
                        >
                          {availabilityStatus}
                        </Badge>
                        {device.assignment_expected_return_date && availabilityStatus === 'Borrowed' && (
                          <span>Return by {formatCompactDate(device.assignment_expected_return_date)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </UIDialogContent>
      </UIDialog>
      <UIDialog open={checkInSummaryOpen} onOpenChange={(open) => {
        setCheckInSummaryOpen(open)
        if (!open) {
          if (checkInSummaryMode === "preview") {
            setPendingCheckInCandidate(null)
          } else {
            setCheckInSummary(null)
          }
          setCheckInSummaryMode(null)
        }
      }}>
        <UIDialogContent className="sm:max-w-lg space-y-4">
          <UIDialogHeader className="space-y-1">
            <UIDialogTitle>Check-In Summary</UIDialogTitle>
            <DialogDescription>Your meeting check-in details</DialogDescription>
          </UIDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#58595B]">Room:</span>
              <span className="font-medium text-[#25294B]">
                {checkInSummaryMode === "preview"
                  ? pendingCheckInCandidate?.booking.room || pendingCheckInCandidate?.booking.roomLabel || '—'
                  : (() => {
                      const booking = checkInSummary?.booking
                      if (!booking) return '—'
                      // Try multiple sources for room name
                      const roomName = booking.room || 
                                     booking.room_name || 
                                     booking.roomLabel ||
                                     (booking.room_id && roomsLookup[booking.room_id]?.room_name) ||
                                     booking.room_id ||
                                     '—'
                      return roomName
                    })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Date:</span>
              <span className="font-medium text-[#25294B]">
                {checkInSummaryMode === "preview"
                  ? pendingCheckInCandidate?.booking.date ?? '—'
                  : checkInSummary?.booking.date ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Time:</span>
              <span className="font-medium text-[#25294B]">
                {checkInSummaryMode === "preview"
                  ? `${pendingCheckInCandidate?.startDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }) ?? '—'} - ${
                      pendingCheckInCandidate?.endDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      }) ?? '—'
                    }`
                  : (() => {
                      const booking = checkInSummary?.booking
                      if (!booking) return '—'
                      const startTime = booking.start_time ?? booking.startTime ?? booking.time?.split('-')[0]?.trim()
                      const endTime = booking.end_time ?? booking.endTime ?? booking.time?.split('-')[1]?.trim()
                      // Format time strings properly (remove timestamps)
                      const formatTime = (timeStr?: string | null) => {
                        if (!timeStr) return null
                        // If it's already in HH:MM format, return as is
                        if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr
                        // If it's a timestamp, extract time part
                        try {
                          const date = new Date(timeStr)
                          if (!Number.isNaN(date.getTime())) {
                            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                          }
                        } catch {}
                        return timeStr
                      }
                      const formattedStart = formatTime(startTime) ?? '—'
                      const formattedEnd = formatTime(endTime) ?? '—'
                      return `${formattedStart} - ${formattedEnd}`
                    })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Status:</span>
              <Badge variant="secondary" className="text-xs">
                {checkInSummaryMode === "preview"
                  ? pendingCheckInCandidate
                    ? getBookingStatusLabel(pendingCheckInCandidate.booking as any, new Date())
                    : 'Scheduled'
                  : toTitleCase(checkInSummary?.booking.status ?? 'Attended')}
              </Badge>
            </div>
          </div>
          {checkInSummaryMode === "result" && (
            <p className="text-xs text-[#2563EB]">
              Meeting marked as attended successfully.
            </p>
          )}
        </UIDialogContent>
      </UIDialog>
        </>
      )}

      <RoomAvailabilityModal open={roomAvailabilityOpen} onOpenChange={setRoomAvailabilityOpen} />

    </AMSDashboardLayout>
  )
}

