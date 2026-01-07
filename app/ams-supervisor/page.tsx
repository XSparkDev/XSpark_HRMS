"use client"

import React from "react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RoomAvailabilityModal } from "@/components/room-availability-modal"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { BORROW_REQUESTS_UPDATED_EVENT } from "@/lib/storage/device-history"
import { MAINTENANCE_REQUESTS_UPDATED_EVENT } from "@/lib/storage/maintenance-requests"
import { supervisorDashboardService, type DeviceStats as ServiceDeviceStats } from "@/lib/services/supervisor-dashboard-service"
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  Laptop,
  Monitor,
  RefreshCw,
  UserPlus,
  Wrench,
  QrCode,
  X,
  Package,
  Building2,
  Calendar as CalendarIcon,
  Clock,
  ChevronRight,
  Bell,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ROOM_BOOKINGS_STORAGE_KEY, ROOM_BOOKINGS_UPDATED_EVENT } from "@/lib/storage/room-bookings"
import {
  BUSINESS_START_TIME,
  BUSINESS_END_TIME,
  timeStringToMinutes,
  validateBusinessHourSelection,
} from "@/lib/utils/business-hours"

type BorrowRequest = {
  id: string
  employeeName: string
  employeeId: string
  deviceName: string
  assetTag: string
  borrowDate: string
  purpose: string
  status: string
}

type ReturnRequest = {
  id: string
  employeeName: string
  employeeId: string
  deviceName: string
  assetTag?: string
  returnDate: string
  deviceCondition: string
  status: string
}

type MaintenanceTicket = {
  id: string
  deviceName: string
  issueType: string
  reportedBy: string
  date: string
  status: string
}

type DeviceStats = {
  total: number
  borrowed: number
  maintenance: number
}

type DashboardRoomBooking = {
  id: string
  roomId: string
  room: string
  roomLabel: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  time: string
  status: string
  meetingCategory?: string
  meetingAgenda?: string
  checkedInAt?: string | null
}

type QuickAction = {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  background: string
  accent: string
  href?: string
}

type RoomBookingRecord = {
  id: string
  employeeId: string
  employeeName: string
  room: string
  meetingCategory?: string
  meetingAgenda?: string
  date: string
  time: string
  startTime?: string
  endTime?: string
  status: string
  createdAt?: string
  updatedAt?: string
  checkedInAt?: string | null
}

const parseBookingTimeWindow = (booking: DashboardRoomBooking | RoomBookingRecord) => {
  const dateStr = booking.date || ""
  const startTime = booking.startTime || (booking.time ? booking.time.split("-")[0]?.trim() : "")
  const endTime = booking.endTime || (booking.time ? booking.time.split("-")[1]?.trim() : "")

  if (!dateStr || !startTime || !endTime) {
    return { startDate: null, endDate: null }
  }

  const startDate = new Date(`${dateStr}T${startTime}:00`)
  const endDate = new Date(`${dateStr}T${endTime}:00`)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { startDate: null, endDate: null }
  }

  return { startDate, endDate }
}

const getBookingStatusLabel = (
  booking: RoomBookingRecord | DashboardRoomBooking,
  referenceDate = new Date(),
) => {
  const normalized = (booking.status || "").toLowerCase()
  if (normalized.includes("cancel")) return "Cancelled"
  if (normalized.includes("resched")) return "Rescheduled"
  if (normalized.includes("miss")) return "Missed"
  if (normalized.includes("attend")) return "Attended"
  if (normalized.includes("awaiting")) return "Awaiting"
  if (booking.checkedInAt) return "Attended"

  const { startDate, endDate } = parseBookingTimeWindow(booking)
  if (!startDate || !endDate) return "Upcoming"

  if (referenceDate < startDate) return "Upcoming"
  if (referenceDate > endDate) {
    return booking.checkedInAt ? "Attended" : "Missed"
  }
  if (referenceDate >= startDate && referenceDate <= endDate) {
    return booking.checkedInAt ? "Attended" : "Awaiting"
  }
  return "Upcoming"
}

const minutesUntilStart = (booking: RoomBookingRecord | DashboardRoomBooking, referenceDate = new Date()) => {
  const { startDate } = parseBookingTimeWindow(booking)
  if (!startDate) return null
  return Math.round((startDate.getTime() - referenceDate.getTime()) / 60000)
}

const MAX_BORROW_DURATION_DAYS = 30

const toTitleCase = (value?: string | null) => {
  if (!value) return "Unknown"
  return value
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default function SupervisorDashboardPage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const userIdentifier = user?.employeeId || user?.email || user?.id || "guest"
  const [deviceStats, setDeviceStats] = useState<DeviceStats>({ total: 0, borrowed: 0, maintenance: 0 })
  const [assignedDevicesCount, setAssignedDevicesCount] = useState(0)
  const [resourceCount, setResourceCount] = useState(0)
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([])
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([])
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([])
  const [pendingBorrowDevices, setPendingBorrowDevices] = useState<Array<{
    id: string
    device_id: string
    asset_tag: string | null
    serial_number: string | null
    device_type: string | null
    brand: string | null
    model: string | null
    status: string | null
    created_at: string | null
    updated_at: string | null
  }>>([])
  const [loadingBorrow, setLoadingBorrow] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [roomBookings, setRoomBookings] = useState<DashboardRoomBooking[]>([])
  const [roomBookingsLoading, setRoomBookingsLoading] = useState(true)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [isPostponingMeeting, setIsPostponingMeeting] = useState(false)
  const [databaseError, setDatabaseError] = useState<string | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)
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
  
  // Modal states
  const [borrowDeviceOpen, setBorrowDeviceOpen] = useState(false)
  const [bookRoomOpen, setBookRoomOpen] = useState(false)
const [roomAvailabilityOpen, setRoomAvailabilityOpen] = useState(false)
  
  // Form states
  const [borrowForm, setBorrowForm] = useState({
    type: "",
    name: "",
    date: "",
    returnDate: "",
    purpose: "",
  })
  const [bookingForm, setBookingForm] = useState({
    room: "",
    category: "",
    date: "",
    startTime: "12:00",
    endTime: "13:00",
    agenda: "",
  })
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({})
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [availableRoomsLoading, setAvailableRoomsLoading] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  
  // Device approval popup states
  const [showApprovalSelector, setShowApprovalSelector] = useState(false)
  const [showApprovalDetails, setShowApprovalDetails] = useState(false)
  const [selectedApprovalRequest, setSelectedApprovalRequest] = useState<BorrowRequest | null>(null)
  const [qrCodeValue, setQrCodeValue] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  
  // Device availability popup states
  const [showDeviceAvailability, setShowDeviceAvailability] = useState(false)
  const [availableDevicesList, setAvailableDevicesList] = useState<any[]>([])
  const [availableDevicesLoading, setAvailableDevicesLoading] = useState(false)
  
  // Approve borrow requests table state
  const [showBorrowRequestsTable, setShowBorrowRequestsTable] = useState(false)
  
  // Approve returns popup state
  const [showReturnsTable, setShowReturnsTable] = useState(false)

  const loadBorrowData = useCallback(async () => {
    if (typeof window === "undefined") return
    setLoadingBorrow(true)
    setDatabaseError(null)
    try {
      // Fetch from database using the service
      const [borrowData, returnData, pendingDevices] = await Promise.all([
        supervisorDashboardService.getPendingBorrowRequests(),
        supervisorDashboardService.getPendingReturnRequests(),
        supervisorDashboardService.getDevicesWithPendingBorrowStatus(),
      ])
      
      // Transform to match existing type structure
      setBorrowRequests(
        borrowData.map((item) => ({
          id: item.id,
          employeeName: item.employee_name,
          employeeId: item.employee_id,
          deviceName: item.device_name,
          assetTag: item.asset_tag,
          borrowDate: item.borrow_date,
          purpose: item.purpose,
          status: item.status,
        }))
      )
      
      setReturnRequests(
        returnData.map((item) => ({
          id: item.id,
          employeeName: item.employee_name,
          employeeId: item.employee_id,
          deviceName: item.device_name,
          returnDate: item.return_date,
          deviceCondition: item.device_condition,
          status: item.status,
        }))
      )
      
      // Set devices with pending borrow status
      setPendingBorrowDevices(pendingDevices)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load borrow/return requests"
      console.error("Failed to load borrow/return requests", error)
      setDatabaseError(errorMessage)
      // Fallback to localStorage if database fails
    try {
      const borrow = JSON.parse(localStorage.getItem("borrowRequests") || "[]") as BorrowRequest[]
      const returns = JSON.parse(localStorage.getItem("returnRequests") || "[]") as ReturnRequest[]
      setBorrowRequests(borrow)
      setReturnRequests(returns)
      } catch (fallbackError) {
        console.error("Fallback to localStorage also failed", fallbackError)
      }
    } finally {
      setLoadingBorrow(false)
    }
  }, [])

  const loadMaintenanceTickets = useCallback(async () => {
    if (typeof window === "undefined") return
    setDatabaseError(null)
    try {
      const tickets = await supervisorDashboardService.getActiveMaintenanceTickets()
      setMaintenanceTickets(
        tickets.map((ticket) => ({
          id: ticket.id,
          deviceName: ticket.device_name,
          issueType: ticket.issue_type,
          reportedBy: ticket.reported_by,
          date: ticket.created_at,
          status: ticket.status,
        }))
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load maintenance tickets"
      console.error("Failed to load maintenance tickets", error)
      setDatabaseError(errorMessage)
      // Fallback to localStorage
    const collected: MaintenanceTicket[] = []
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("maintenance_requests_")) {
        try {
          const entries = JSON.parse(localStorage.getItem(key) || "[]")
          entries.forEach((entry: any) => {
            if (entry?.deviceName) {
              collected.push({
                id: entry.id || `${key}-${entry.deviceName}`,
                deviceName: entry.deviceName,
                issueType: entry.issueType || entry.category || "General",
                reportedBy: entry.reportedBy || entry.employeeName || "Team Member",
                date: entry.createdAt || entry.updatedAt || new Date().toISOString(),
                status: entry.status || "Pending",
              })
            }
          })
          } catch (parseError) {
            console.error("Failed to parse maintenance tickets", parseError)
        }
      }
    })
    setMaintenanceTickets(collected.filter((ticket) => ticket.status !== "Completed"))
    }
  }, [])

  const fetchDeviceStats = useCallback(async () => {
    try {
      setDatabaseError(null)
      const devicesResponse = await fetch("/api/devices?limit=1000&offset=0", { cache: "no-store" })
      const devicesJson = await devicesResponse.json().catch(() => ({}))
      if (!devicesResponse.ok || devicesJson.success === false) {
        throw new Error(devicesJson?.error || "Failed to fetch devices")
      }

      const deviceList = Array.isArray(devicesJson.data) ? devicesJson.data : []
      const normalizedDevices = deviceList.filter((d: any) => Boolean(d))
      const totalDevices = normalizedDevices.length
      const borrowedDevices = normalizedDevices.filter((device: any) => {
        const status = (device?.status ?? "").toString().toLowerCase()
        return status === "borrowed"
      }).length
      const assignedDevices = normalizedDevices.filter((device: any) => Boolean(device?.assigned_to)).length
      setAssignedDevicesCount(assignedDevices)

      let maintenanceCount: number | null = null
      try {
        const stats = await supervisorDashboardService.getDeviceStats()
        maintenanceCount = stats.maintenance ?? null
      } catch (statsError) {
        console.warn("Failed to fetch maintenance stats", statsError)
      }

      setDeviceStats((prev) => ({
        total: totalDevices,
        borrowed: borrowedDevices,
        maintenance: maintenanceCount ?? prev.maintenance,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch device statistics"
      console.error("Failed to fetch device stats", error)
      setDatabaseError(errorMessage)
      toast({
        variant: "destructive",
        title: "Database Error",
        description: errorMessage,
      })
    }
  }, [toast])

  const fetchResourceCount = useCallback(async () => {
    try {
      const response = await fetch("/api/resources?limit=1&offset=0", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to fetch resources")
      }
      const totalResources = typeof json.meta?.count === "number"
        ? json.meta.count
        : Array.isArray(json.data)
        ? json.data.length
        : 0
      setResourceCount(totalResources)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch resources"
      console.error("Failed to fetch resources summary", error)
      toast({
        variant: "destructive",
        title: "Unable to load resources",
        description: errorMessage,
      })
    }
  }, [toast])

  const fetchRoomBookings = useCallback(async () => {
    if (!userIdentifier) {
      setRoomBookingsLoading(false)
      return
    }
    setRoomBookingsLoading(true)
    try {
      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const upcomingEnd = new Date(todayStart)
      upcomingEnd.setDate(upcomingEnd.getDate() + 7)
      upcomingEnd.setHours(23, 59, 59, 999)

      const response = await fetch(
        `/api/room-bookings?bookedBy=${encodeURIComponent(userIdentifier)}&scope=dashboard&fromDate=${todayStart.toISOString()}&toDate=${upcomingEnd.toISOString()}`,
      )
      const json = await response.json()
      if (response.ok && json.success && Array.isArray(json.data)) {
        const bookings: DashboardRoomBooking[] = json.data.map((item: any) => ({
          id: item.id || "",
          roomId: item.room_id || "",
          room: item.room || item.room_name || "",
          roomLabel: item.room_name || item.room || "",
          employeeId: item.booked_by || item.employee_id || userIdentifier,
          date: item.date || item.booking_date || "",
          startTime: item.start_time || item.startTime || "",
          endTime: item.end_time || item.endTime || "",
          time: item.time || (item.start_time && item.end_time ? `${item.start_time}-${item.end_time}` : ""),
          status: item.status || "Pending",
          meetingCategory: item.meeting_category || item.meetingCategory,
          meetingAgenda: item.meeting_agenda || item.meetingAgenda,
          checkedInAt: item.checked_in_at || item.checkedInAt || null,
        }))
        setRoomBookings(bookings)
      }
    } catch (error) {
      console.error("Failed to fetch room bookings", error)
    } finally {
      setRoomBookingsLoading(false)
    }
  }, [userIdentifier])

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
    // Initial data load
    setIsLoadingMetrics(true)
    Promise.all([
      loadBorrowData(),
      fetchDeviceStats(),
      fetchResourceCount(),
      fetchRoomBookings(),
      loadMaintenanceTickets(),
      fetchActivities(1, false),
    ])
      .catch((error) => {
        console.error("Failed to load initial dashboard data:", error)
        setDatabaseError("Failed to load dashboard data. Please refresh the page.")
      })
      .finally(() => {
        setIsLoadingMetrics(false)
      })

    // Set up real-time subscriptions
    const unsubscribeDevices = supervisorDashboardService.subscribeToDevices((payload) => {
      console.log("Device update:", payload)
    fetchDeviceStats()
    })

    const unsubscribeBorrows = supervisorDashboardService.subscribeToBorrowRequests((payload) => {
      console.log("Borrow request update:", payload)
      loadBorrowData()
    })

    const unsubscribeRoomBookings = supervisorDashboardService.subscribeToRoomBookings((payload) => {
      console.log("Room booking update:", payload)
    fetchRoomBookings()
    })

    // Legacy event listeners for backward compatibility
    const storageHandler = () => loadBorrowData()
    window.addEventListener("storage", storageHandler)
    window.addEventListener(BORROW_REQUESTS_UPDATED_EVENT, storageHandler as EventListener)
    window.addEventListener(ROOM_BOOKINGS_UPDATED_EVENT, () => fetchRoomBookings())

    // Polling fallback (less frequent now that we have real-time)
    const interval = setInterval(() => {
      fetchDeviceStats()
      fetchResourceCount()
      loadBorrowData()
    }, 60000) // Every minute instead of 8 seconds

    return () => {
      // Cleanup real-time subscriptions
      unsubscribeDevices()
      unsubscribeBorrows()
      unsubscribeRoomBookings()
      supervisorDashboardService.cleanup()
      
      // Cleanup event listeners
      window.removeEventListener("storage", storageHandler)
      window.removeEventListener(BORROW_REQUESTS_UPDATED_EVENT, storageHandler as EventListener)
      window.removeEventListener(ROOM_BOOKINGS_UPDATED_EVENT, () => fetchRoomBookings())
      clearInterval(interval)
    }
  }, [fetchDeviceStats, fetchResourceCount, loadBorrowData, fetchRoomBookings, loadMaintenanceTickets])

  // Combine borrow requests with devices that have pending borrow status
  const allPendingBorrowItems = useMemo(() => {
    const requests = borrowRequests.filter((r) => 
      r.status === "Pending" || 
      r.status === "Pending Approval" || 
      r.status === "Awaiting Approval"
    )
    
    // Add devices with pending borrow status that don't have a borrow request
    const deviceRequests = pendingBorrowDevices.map((device) => {
      // Check if this device already has a borrow request
      const existingRequest = requests.find((req) => req.assetTag === device.asset_tag)
      if (existingRequest) return null
      
      return {
        id: device.id || device.device_id,
        employeeName: "Pending Assignment",
        employeeId: "—",
        deviceName: device.model || device.brand || toTitleCase(device.device_type) || "Device",
        assetTag: device.asset_tag || device.serial_number || device.device_id || "—",
        borrowDate: device.updated_at ? new Date(device.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        purpose: "Device marked as pending borrow",
        status: device.status || "Pending Borrow",
      }
    }).filter((item): item is BorrowRequest => item !== null)
    
    return [...requests, ...deviceRequests]
  }, [borrowRequests, pendingBorrowDevices])
  
  const pendingBorrowRequests = useMemo(
    () => allPendingBorrowItems,
    [allPendingBorrowItems],
  )

  const todayKey = new Date().toDateString()
  const devicesBorrowedToday = borrowRequests.filter(
    (request) => new Date(request.borrowDate).toDateString() === todayKey,
  ).length
  const devicesReturnedToday = returnRequests.filter(
    (request) => request.status === "Returned" && new Date(request.returnDate).toDateString() === todayKey,
  ).length
  const overdueDevices = borrowRequests.filter((request) => {
    if (!request.borrowDate) return false
    const borrowedAt = new Date(request.borrowDate)
    const diffDays = (Date.now() - borrowedAt.getTime()) / (1000 * 60 * 60 * 24)
    return request.status === "Borrowed" && diffDays > 7
  }).length

  const upcomingCheckInBooking = useMemo(() => {
    if (!userIdentifier) return null
    const now = new Date()
    const candidates = roomBookings
      .filter((booking) => booking.employeeId === userIdentifier)
      .map((booking) => {
        const { startDate, endDate } = parseBookingTimeWindow(booking)
        if (!startDate || !endDate) return null
        const minutes = minutesUntilStart(booking, now)
        if (minutes === null || minutes > 60) return null
        if (now > endDate) return null
        
        // Remove check-in button when meeting is in progress (even if not checked in)
        const isInProgress = now >= startDate && now <= endDate
        if (isInProgress) return null
        
        const statusLabel = getBookingStatusLabel(booking, now)
        if (["Cancelled", "Attended"].includes(statusLabel)) return null
        return {
          booking,
          minutes,
          startDate,
          endDate,
          statusLabel,
          isInProgress: false, // This will always be false now since we filter it out above
        }
      })
      .filter(
        (
          candidate,
        ): candidate is {
          booking: DashboardRoomBooking
          minutes: number
          startDate: Date
          endDate: Date
          statusLabel: string
          isInProgress: boolean
        } => Boolean(candidate && candidate.startDate),
      )
      .sort((a, b) => (a?.minutes ?? 0) - (b?.minutes ?? 0))

    return candidates[0] ?? null
  }, [roomBookings, userIdentifier])

  const scheduleItems = useMemo(() => {
    const items: Array<{ id: string; title: string; details: string; date: Date; category: "booking" | "return" | "approval" }> = []
    const now = new Date()

    roomBookings.forEach((booking) => {
      const { startDate } = parseBookingTimeWindow(booking)
      if (!startDate || startDate < now) return
      const statusLabel = getBookingStatusLabel(booking, now)
      items.push({
        id: `booking-${booking.id}`,
        title: booking.room ? `Booking · ${booking.room}` : "Room booking",
        details: statusLabel,
        date: startDate,
        category: "booking",
      })
    })

    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5)
  }, [roomBookings])

  const scheduleIconMap: Record<"booking" | "return" | "approval", React.ComponentType<{ className?: string }>> = {
    booking: CalendarIcon,
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

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMins = Math.round(diffMs / 60000)
    if (diffMins < 0) return "Past"
    if (diffMins < 60) return `in ${diffMins} min`
    const diffHours = Math.round(diffMins / 60)
    if (diffHours < 24) return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`
    const diffDays = Math.round(diffHours / 24)
    return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`
  }

  const handleCheckIn = useCallback(async () => {
    if (!upcomingCheckInBooking) return
    const now = new Date()

    const oneHourBefore = new Date(upcomingCheckInBooking.startDate.getTime() - 60 * 60 * 1000)
    if (now < oneHourBefore) {
      toast({
        variant: "destructive",
        title: "Too early to check in",
        description: "Check-in is available starting 1 hour before the meeting.",
      })
      return
    }

    if (now > upcomingCheckInBooking.endDate) {
      toast({
        variant: "destructive",
        title: "Meeting ended",
        description: "This meeting has already ended.",
      })
      return
    }

    setCheckInLoading(true)
    try {
      const verificationResponse = await fetch(`/api/room-bookings/${upcomingCheckInBooking.booking.id}`, {
        cache: "no-store",
      })
      const verificationJson = await verificationResponse.json().catch(() => ({}))
      if (!verificationResponse.ok || verificationJson.success === false) {
        throw new Error(verificationJson.error || "Unable to verify meeting details")
      }
      const serverBooking = verificationJson.data
      if (!serverBooking) {
        throw new Error("Meeting could not be located.")
      }
      if (serverBooking.checked_in_at) {
        throw new Error("This meeting has already been checked in.")
      }
      const latestStatus = (serverBooking.status ?? "").toLowerCase()
      if (latestStatus.includes("cancel")) {
        throw new Error("This meeting was cancelled.")
      }
      if (latestStatus.includes("miss")) {
        throw new Error("Meeting already marked as missed.")
      }

      const timestamp = new Date().toISOString()
      const response = await fetch(`/api/room-bookings/${upcomingCheckInBooking.booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "attended",
          checked_in_at: timestamp,
        }),
      })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || "Failed to update booking")
      }

      toast({
        title: "Checked in",
        description: `Meeting in ${upcomingCheckInBooking.booking.room || "the room"} marked as attended.`,
      })

      await fetchRoomBookings()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to check in",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setCheckInLoading(false)
    }
  }, [upcomingCheckInBooking, fetchRoomBookings, toast])

  const handlePostponeMeeting = useCallback(async () => {
    if (!upcomingCheckInBooking) return
    try {
      setIsPostponingMeeting(true)
      toast({
        title: "Postpone requested",
        description: "Adjust this meeting in the booking schedule if needed.",
      })
    } finally {
      setIsPostponingMeeting(false)
    }
  }, [upcomingCheckInBooking, toast])

  const deviceOverviewCards: {
    label: string
    value: number
    Icon: React.ComponentType<{ className?: string }>
    accent: string
    meta?: string
  }[] = [
    {
      label: "Total Devices",
      value: deviceStats.total,
      Icon: Package,
      accent: "#25294B",
    },
    {
      label: "Borrowed Devices",
      value: deviceStats.borrowed,
      Icon: Laptop,
      accent: "#92278F",
    },
    {
      label: "Pending Borrow Requests",
      value: pendingBorrowRequests.length,
      Icon: Clock,
      accent: "#58595B",
    },
    {
      label: "Under Maintenance",
      value: deviceStats.maintenance,
      Icon: Wrench,
      accent: "#A14FB5",
    },
    {
      label: "Assigned Devices & Resources",
      value: assignedDevicesCount,
      Icon: UserPlus,
      accent: "#3B4370",
      meta: `${resourceCount} total resources`,
    },
  ]

  const persistRoomBookingsToStorage = useCallback(
    (records?: DashboardRoomBooking[] | null) => {
      if (typeof window === "undefined") return
      const list = Array.isArray(records) ? records : roomBookings
      const storagePayload: RoomBookingRecord[] = list.map((booking) => {
        const [rangeStart, rangeEnd] = (booking.time || "").split("-").map((value) => value?.trim() ?? "")
        const start = booking.startTime || rangeStart || ""
        const end = booking.endTime || rangeEnd || ""
        const time = booking.time || (start && end ? `${start}-${end}` : start || end || "")

        return {
          id: booking.id,
          employeeId: booking.employeeId || userIdentifier || "",
          employeeName: user?.name || "Employee",
          room: booking.room || booking.roomLabel || booking.roomId || "Room",
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
    [user?.name, userIdentifier, roomBookings],
  )

  const handleQuickActionClick = useCallback(
    async (key: string) => {
      switch (key) {
        case "borrow-device": {
          setBorrowDeviceOpen(true)
          const today = new Date().toISOString().split("T")[0]
          setBorrowForm({
            type: "",
            name: "",
            date: today,
            returnDate: "",
            purpose: "",
          })
          // Fetch available devices
          setDevicesLoading(true)
          try {
            const response = await fetch("/api/devices?availableOnly=true&limit=200", {
              cache: "no-store",
              credentials: "include",
              headers: {
                Accept: "application/json",
              },
            })
            const json = await response.json()
            if (response.ok && json.success && Array.isArray(json.data)) {
              setDevices(json.data)
            } else {
              throw new Error(json?.error || "Failed to fetch devices")
            }
          } catch (error) {
            console.error("Failed to fetch devices", error)
            toast({
              variant: "destructive",
              title: "Failed to load devices",
              description: error instanceof Error ? error.message : "Could not fetch devices from backend.",
            })
          } finally {
            setDevicesLoading(false)
          }
          break
        }
        case "book-room": {
          setBookRoomOpen(true)
          const today = new Date().toISOString().split("T")[0]
          setBookingForm({
            room: "",
            category: "",
            date: today,
            startTime: "12:00",
            endTime: "13:00",
            agenda: "",
          })
          setBookingErrors({})
          // Fetch available rooms
          setAvailableRoomsLoading(true)
          try {
            const response = await fetch("/api/rooms")
            const json = await response.json()
            if (response.ok && json.success && Array.isArray(json.data)) {
              setAvailableRooms(json.data)
            }
          } catch (error) {
            console.error("Failed to fetch rooms", error)
          } finally {
            setAvailableRoomsLoading(false)
          }
          break
        }
        case "check-device-availability": {
          setShowDeviceAvailability(true)
          setAvailableDevicesLoading(true)
          try {
            // Fetch ALL devices from the API (no availability filter)
            const response = await fetch("/api/devices?limit=200&offset=0", {
              cache: "no-store",
              credentials: "include",
              headers: {
                Accept: "application/json",
              },
            })
            const json = await response.json()
            if (response.ok && json.success && Array.isArray(json.data)) {
              setAvailableDevicesList(json.data)
            } else {
              throw new Error(json?.error || "Failed to fetch devices")
            }
          } catch (error) {
            console.error("Failed to fetch devices:", error)
            toast({
              variant: "destructive",
              title: "Failed to load devices",
              description: error instanceof Error ? error.message : "Could not fetch devices from backend.",
            })
          } finally {
            setAvailableDevicesLoading(false)
          }
          break
        }
        case "check-room-availability": {
          if (roomBookings.length === 0) {
            await fetchRoomBookings()
          }
          setRoomAvailabilityOpen(true)
          break
        }
        case "approve-borrow-requests": {
          setShowBorrowRequestsTable(true)
          await loadBorrowData()
          break
        }
        case "approve-returns": {
          setShowReturnsTable(true)
          await loadBorrowData()
          break
        }
      }
    },
    [roomBookings, fetchRoomBookings],
  )

  const handleBorrowDeviceSubmit = useCallback(async () => {
    if (!borrowForm.name || !borrowForm.returnDate || !borrowForm.purpose) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields.",
      })
      return
    }

    if (!ensureReturnDateIsValid(borrowForm.returnDate)) {
      return
    }

    try {
      const borrowRequest: BorrowRequest = {
        id: `borrow-${Date.now()}`,
        employeeName: user?.name || "Supervisor",
        employeeId: userIdentifier,
        deviceName: borrowForm.name,
        assetTag: borrowForm.name,
        borrowDate: borrowForm.date || new Date().toISOString().split("T")[0],
        purpose: borrowForm.purpose,
        status: "Pending Approval",
      }

      const existing = JSON.parse(localStorage.getItem("borrowRequests") || "[]")
      existing.push(borrowRequest)
      localStorage.setItem("borrowRequests", JSON.stringify(existing))
      window.dispatchEvent(new CustomEvent(BORROW_REQUESTS_UPDATED_EVENT))

      toast({
        title: "Request submitted",
        description: "Your borrow request has been submitted for approval.",
      })

      setBorrowDeviceOpen(false)
      setBorrowForm({
        type: "",
        name: "",
        date: "",
        returnDate: "",
        purpose: "",
      })
      loadBorrowData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to submit",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }, [borrowForm, user, userIdentifier, toast, loadBorrowData])

  // Date and time validation helpers
  const parseDateOnly = useCallback((value: string) => {
    if (!value) return null
    const [year, month, day] = value.split("-").map(Number)
    if ([year, month, day].some((part) => Number.isNaN(part))) return null
    return new Date(year, month - 1, day)
  }, [])

  const isPastDate = useCallback((value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    parsed.setHours(0, 0, 0, 0)
    return parsed < today
  }, [parseDateOnly])

  const isWeekend = useCallback((value: string) => {
    const parsed = parseDateOnly(value)
    if (!parsed) return false
    const dayOfWeek = parsed.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // 0 = Sunday, 6 = Saturday
  }, [parseDateOnly])

  const getReturnDateUpperBound = useCallback(
    (base: string) => {
      const start = parseDateOnly(base)
      if (!start) return undefined
      const limit = new Date(start)
      limit.setDate(limit.getDate() + MAX_BORROW_DURATION_DAYS)
      return limit.toISOString().split("T")[0]
    },
    [parseDateOnly],
  )

  const borrowReturnLimitIso = useMemo(
    () => getReturnDateUpperBound(borrowForm.date || new Date().toISOString().split("T")[0]),
    [borrowForm.date, getReturnDateUpperBound],
  )

  const ensureReturnDateIsValid = useCallback(
    (returnDate: string | undefined) => {
      if (!returnDate) return true
      const borrowDateValue = borrowForm.date || new Date().toISOString().split("T")[0]
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
      const diff = (returnDateObj.getTime() - borrowDateObj.getTime()) / (1000 * 60 * 60 * 24)
      if (diff > MAX_BORROW_DURATION_DAYS) {
        toast({
          variant: "destructive",
          title: "Return date too far",
          description: `Return date can be at most ${MAX_BORROW_DURATION_DAYS} days after the borrow date.`,
        })
        return false
      }
      return true
    },
    [borrowForm.date, isWeekend, parseDateOnly, toast],
  )

  const handleBorrowReturnDateChange = useCallback(
    (value: string) => {
      if (!value) {
        setBorrowForm((prev) => ({ ...prev, returnDate: "" }))
        return
      }
      if (!ensureReturnDateIsValid(value)) {
        return
      }
      setBorrowForm((prev) => ({ ...prev, returnDate: value }))
    },
    [ensureReturnDateIsValid],
  )

  const compareTimes = useCallback((start: string, end: string) => {
    const startMinutes = timeStringToMinutes(start)
    const endMinutes = timeStringToMinutes(end)
    if (startMinutes === null || endMinutes === null) return null
    return startMinutes - endMinutes
  }, [])

  const validateBooking = useCallback((form: typeof bookingForm): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!form.room) {
      errors.room = "Select a room."
    }

    if (!form.category) {
      errors.category = "Select a meeting category."
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
  }, [isPastDate, compareTimes])

  const handleBookingDateChange = useCallback((value: string) => {
    const nextForm = { ...bookingForm, date: value }
    setBookingForm(nextForm)
    const errors = validateBooking(nextForm)
    setBookingErrors(errors)
  }, [bookingForm, validateBooking])

  const handleBookingStartTimeChange = useCallback((value: string) => {
    const nextForm = { ...bookingForm, startTime: value }
    setBookingForm(nextForm)
    const errors = validateBooking(nextForm)
    setBookingErrors(errors)
  }, [bookingForm, validateBooking])

  const handleBookingEndTimeChange = useCallback((value: string) => {
    const nextForm = { ...bookingForm, endTime: value }
    setBookingForm(nextForm)
    const errors = validateBooking(nextForm)
    setBookingErrors(errors)
  }, [bookingForm, validateBooking])

  const handleBookRoomSubmit = useCallback(async () => {
    const errors = validateBooking(bookingForm)
    setBookingErrors(errors)

    if (Object.keys(errors).length > 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors before submitting.",
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

    try {
      const payload = {
        room_id: bookingForm.room,
        booked_by: userIdentifier,
        date: bookingForm.date,
        start_time: bookingForm.startTime,
        end_time: bookingForm.endTime,
        meeting_category: bookingForm.category,
        meeting_agenda: bookingForm.agenda,
      }

      const response = await fetch("/api/room-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await response.json()
      if (!response.ok || json.success === false) {
        throw new Error(json.error || "Failed to book room")
      }

      toast({
        title: "Room booked",
        description: "Your room booking has been confirmed.",
      })

      setBookRoomOpen(false)
      setBookingForm({
        room: "",
        category: "",
        date: new Date().toISOString().split("T")[0],
        startTime: "12:00",
        endTime: "13:00",
        agenda: "",
      })
      setBookingErrors({})
      await fetchRoomBookings()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to book room",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }, [bookingForm, userIdentifier, toast, fetchRoomBookings, validateBooking])

  const quickActions: QuickAction[] = [
    {
      key: "borrow-device",
      label: "Book a device",
      description: "Request a device and set the expected return date.",
      icon: Laptop,
      background: "from-white via-[#F6ECFF] to-[#FFF7FB]",
      accent: "#92278F",
    },
    {
      key: "book-room",
      label: "Book a room",
      description: "Reserve collaboration spaces for your meetings.",
      icon: CalendarIcon,
      background: "from-white via-[#E8F1FF] to-[#F5ECFF]",
      accent: "#25294B",
    },
    {
      key: "check-device-availability",
      label: "Check Device Availability",
      description: "Preview which devices are available or borrowed.",
      icon: Monitor,
      background: "from-white via-[#EEF4FF] to-[#F9EEFF]",
      accent: "#58595B",
    },
    {
      key: "check-room-availability",
      label: "Check room availability",
      description: "Jump to the live room availability board.",
      icon: Building2,
      background: "from-white via-[#FFEFEF] to-[#FFF7F0]",
      accent: "#BE1E2D",
    },
    {
      key: "approve-borrow-requests",
      label: "Approve Borrow Requests",
      description: "Review and approve device borrowing requests.",
      icon: CheckCircle2,
      background: "from-[#FEE4F2] via-[#F8E8FF] to-[#F2F8FF]",
      accent: "#BE1E2D",
    },
    {
      key: "approve-returns",
      label: "Approve Returns",
      description: "Review and approve device return requests.",
      icon: ClipboardList,
      background: "from-white via-[#E8F1FF] to-[#F5ECFF]",
      accent: "#25294B",
    },
    {
      key: "view-actions",
      label: "View Actions",
      description: "Open the action log for recent updates.",
      icon: Eye,
      background: "from-white via-[#EEF4FF] to-[#FDEBFF]",
      accent: "#3B4370",
      href: "/ams-actions",
    },
  ]

  const handleApprove = useCallback(
    async (id: string, type: "borrow" | "return") => {
      try {
      if (type === "borrow") {
          // Approve borrow request (this will also update device status)
          await supervisorDashboardService.approveBorrowRequest(id)
          toast({ 
            title: "Request approved", 
            description: "Borrow request approved and device status updated to 'borrowed'." 
          })
      } else {
          await supervisorDashboardService.approveReturnRequest(id)
        toast({ title: "Return approved", description: "Return request approved successfully." })
      }
        // Refresh data after approval
        await loadBorrowData()
        await fetchDeviceStats()
        if (showDeviceAvailability) {
          // Refresh available devices list
          try {
            const response = await fetch("/api/devices?status=available&limit=1000", { cache: "no-store" })
            const result = await response.json()
            if (result.success && Array.isArray(result.data)) {
              setAvailableDevicesList(result.data)
            } else {
              setAvailableDevicesList([])
            }
          } catch (error) {
            console.error("Failed to fetch available devices:", error)
            setAvailableDevicesList([])
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to approve request"
        toast({
          variant: "destructive",
          title: "Approval failed",
          description: errorMessage,
        })
      }
    },
    [loadBorrowData, fetchDeviceStats, toast, showDeviceAvailability],
  )

  const resetApprovalScannerState = useCallback(() => {
    setQrCodeValue("")
    setScanError(null)
    setIsScanning(false)
  }, [])

  const handleSelectRequestForApproval = useCallback(
    (request: BorrowRequest) => {
      setSelectedApprovalRequest(request)
      setShowApprovalDetails(true)
      setShowApprovalSelector(false)
      setIsDialogOpen(false)
      resetApprovalScannerState()
    },
    [resetApprovalScannerState],
  )

  const handleStartQRScan = useCallback(() => {
    setIsScanning(true)
    setScanError(null)
  }, [])

  const handleQRCodeInput = useCallback(
    (value: string) => {
      setQrCodeValue(value)
      if (!selectedApprovalRequest || !selectedApprovalRequest.assetTag) {
        setScanError(null)
        return
      }
      if (value && value !== selectedApprovalRequest.assetTag) {
        setScanError("Scanned code does not match the expected asset tag.")
      } else {
        setScanError(null)
      }
    },
    [selectedApprovalRequest],
  )

  const handleFinalApprove = useCallback(async () => {
    if (!selectedApprovalRequest) {
      toast({
        variant: "destructive",
        title: "No request selected",
        description: "Select a borrow request before approving.",
      })
      return
    }
    if (selectedApprovalRequest.assetTag && qrCodeValue !== selectedApprovalRequest.assetTag) {
      setScanError("Scan the device QR code before approving.")
      toast({
        variant: "destructive",
        title: "QR scan required",
        description: "The scanned code must match the device asset tag.",
      })
      return
    }
    await handleApprove(selectedApprovalRequest.id, "borrow")
    setShowApprovalDetails(false)
    setSelectedApprovalRequest(null)
    resetApprovalScannerState()
  }, [handleApprove, qrCodeValue, resetApprovalScannerState, selectedApprovalRequest, toast])

  const handleReject = useCallback(
    async (id: string, type: "borrow" | "return") => {
      try {
      if (type === "borrow") {
          await supervisorDashboardService.rejectBorrowRequest(id, "Rejected by supervisor")
      } else {
          await supervisorDashboardService.rejectReturnRequest(id, "Rejected by supervisor")
      }
      toast({ title: "Request rejected", description: "The request has been rejected." })
        await loadBorrowData()
      setIsDialogOpen(false)
      setSelectedRequest(null)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to reject request"
        toast({
          variant: "destructive",
          title: "Rejection failed",
          description: errorMessage,
        })
      }
    },
    [loadBorrowData, toast],
  )

  const handleRequestClick = useCallback((request: BorrowRequest) => {
    setSelectedRequest(request)
    setIsDialogOpen(true)
  }, [])

  const handleQrScannerClick = useCallback(() => {
    toast({
      title: "QR Scanner Not Available",
      description: "Not available for now",
      action: (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              if (selectedRequest) {
                handleApprove(selectedRequest.id, "borrow")
              }
            }}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (selectedRequest) {
                handleReject(selectedRequest.id, "borrow")
              }
            }}
          >
            Reject
          </Button>
        </div>
      ),
    })
  }, [selectedRequest, handleApprove, handleReject, toast])

  if (!user || user.role !== "supervisor") {
    return null
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Database Error Banner */}
        {databaseError && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">Database Connection Issue</p>
                    <p className="text-sm text-destructive/80">{databaseError}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDatabaseError(null)
                    setIsLoadingMetrics(true)
                    Promise.all([
                      loadBorrowData(),
                      fetchDeviceStats(),
                      fetchResourceCount(),
                      fetchRoomBookings(),
                      loadMaintenanceTickets(),
                    ])
                      .finally(() => setIsLoadingMetrics(false))
                  }}
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Indicator */}
        {isLoadingMetrics && (
          <Card className="border-[#808285]/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#92278F]" />
                <p className="text-sm text-muted-foreground">Loading dashboard metrics...</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="gradient-primary text-white border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-white/80">Supervisor Dashboard</p>
                <h2 className="text-3xl font-bold mb-1">{`Welcome back, ${user.name}!`}</h2>
                <p className="text-white/85">Monitor device usage, approvals, and maintenance activity.</p>
              </div>
              <Badge className="bg-white/15 text-white px-4 py-2 text-sm">Supervisor View</Badge>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {deviceOverviewCards.map((card) => (
            <Card
              key={card.label}
              className="rounded-[10px] border border-[#808285]/15 bg-white/90 shadow-sm transition-colors hover:shadow-md"
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
                {card.meta && <span className="text-xs text-[#6B6E8A]">{card.meta}</span>}
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            if (action.href) {
              return (
                <Link key={action.key || action.label} href={action.href}>
                  <button
                    type="button"
                    aria-label={action.label}
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
                        {action.description && <p className="text-xs text-muted-foreground">{action.description}</p>}
                      </div>
                    </div>
                  </button>
                </Link>
              )
            }
            return (
              <button
                key={action.key || action.label}
                type="button"
                aria-label={action.label}
                onClick={() => handleQuickActionClick(action.key || "")}
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
                    {action.description && <p className="text-xs text-muted-foreground">{action.description}</p>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Activity Center - Lightweight Summary */}
        <Card className="hover:shadow-lg transition-shadow border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#25294B]">
              <Bell className="h-5 w-5 text-[#92278F]" />
              Activity Center
            </CardTitle>
            <CardDescription className="text-[#58595B]">
              Recent activity across your bookings, devices, and incidents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading && activities.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-[#92278F]" />
              </div>
            ) : activitiesError ? (
              <div className="py-6 text-center">
                <p className="text-sm text-destructive">{activitiesError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fetchActivities(1, false)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <Bell className="h-12 w-12 text-[#92278F]/30" />
                <p className="text-sm text-[#58595B] text-center">
                  No recent activity to display
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity) => {
                  const Icon = activityIconMap[activity.type] || activityIconMap[activity.title] || Bell
                  const statusColor = getActivityStatusColor(activity.status)
                  const timeAgo = activity.created_at
                    ? (() => {
                        const date = new Date(activity.created_at)
                        const now = new Date()
                        const diffMs = now.getTime() - date.getTime()
                        const diffMins = Math.floor(diffMs / 60000)
                        const diffHours = Math.floor(diffMs / 3600000)
                        const diffDays = Math.floor(diffMs / 86400000)
                        
                        if (diffMins < 1) return 'Just now'
                        if (diffMins < 60) return `${diffMins}m ago`
                        if (diffHours < 24) return `${diffHours}h ago`
                        if (diffDays < 7) return `${diffDays}d ago`
                        return date.toLocaleDateString()
                      })()
                    : ''

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white transition-colors"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon className="h-5 w-5 text-[#92278F]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-[#1F2937]">{activity.title}</p>
                          {timeAgo && (
                            <span className="text-xs text-[#6B7280] whitespace-nowrap">{timeAgo}</span>
                          )}
                        </div>
                        <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{activity.description}</p>
                        {activity.status && (
                          <Badge
                            variant="outline"
                            className="mt-2 text-xs"
                            style={
                              statusColor
                                ? {
                                    backgroundColor: `${statusColor}15`,
                                    borderColor: statusColor,
                                    color: statusColor,
                                  }
                                : undefined
                            }
                          >
                            {activity.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
                {activities.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[#92278F] hover:text-[#BE1E2D]"
                    onClick={() => {
                      const nextPage = Math.floor(activities.length / 20) + 1
                      fetchActivities(nextPage, true)
                    }}
                    disabled={activitiesLoading || !hasMoreActivities}
                  >
                    {activitiesLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : hasMoreActivities ? (
                      <>
                        Load More ({activities.length} shown)
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      `Showing all ${activities.length} activities`
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meeting Check-In */}
        <Card className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#1F2937] font-semibold">Meeting Check-In</CardTitle>
            <CardDescription className="text-[#6B7280]">
              {upcomingCheckInBooking ? "Upcoming meeting" : "No meetings scheduled for today."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingCheckInBooking ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-base font-semibold text-[#1F2937]">
                        {upcomingCheckInBooking.booking.meetingAgenda || "Room booking"}
                      </p>
                      <p className="text-sm text-[#6B7280]">
                        {upcomingCheckInBooking.booking.meetingCategory || "Internal"}
                      </p>
                      <p className="text-sm text-[#6B7280]">
                        Room: {upcomingCheckInBooking.booking.room || "Room TBD"} ·{" "}
                        {upcomingCheckInBooking.startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {upcomingCheckInBooking.endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-sm text-[#6B7280]">
                        {upcomingCheckInBooking.isInProgress
                          ? `In progress · ends at ${upcomingCheckInBooking.endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : (() => {
                              const minutes = Math.max(upcomingCheckInBooking.minutes ?? 0, 0)
                              const hours = Math.floor(minutes / 60)
                              const mins = minutes % 60
                              const parts = []
                              if (hours > 0) parts.push(`${hours}h`)
                              parts.push(`${mins}m`)
                              return `Starts in ${parts.join(" ")}`
                            })()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs font-medium border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]"
                    >
                      Upcoming
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#E5E7EB]">
                  <Button
                    className="flex-1 min-w-[140px] h-10 rounded-md bg-gradient-to-r from-[#8B2A6C] to-[#B02A5C] text-white shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleCheckIn}
                    disabled={checkInLoading}
                  >
                    {checkInLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking in...
                      </>
                    ) : (
                      "Check In"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[140px] h-10 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] text-[#1F2937] shadow-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handlePostponeMeeting}
                    disabled={isPostponingMeeting}
                  >
                    {isPostponingMeeting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#6B7280]" />
                        Postponing...
                      </>
                    ) : (
                      "Postpone"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start space-y-1 py-4">
                <p className="text-sm font-semibold text-[#1F2937]">No upcoming meetings</p>
                <p className="text-xs text-[#6B7280]">You don't have any meetings scheduled for today.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Borrow Request Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-[#25294B]">Borrow Request Details</DialogTitle>
              <DialogDescription className="text-[#58595B]">
                Full details of the borrow request
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                {/* Request Information */}
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">Employee Name</Label>
                      <p className="text-sm font-medium">{selectedRequest.employeeName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">Employee ID</Label>
                      <p className="text-sm font-medium">{selectedRequest.employeeId}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">Device Name</Label>
                      <p className="text-sm font-medium">{selectedRequest.deviceName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">Asset Tag</Label>
                      <p className="text-sm font-medium">{selectedRequest.assetTag || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">Requested Date</Label>
                      <p className="text-sm font-medium">{new Date(selectedRequest.borrowDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {selectedRequest.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Purpose</Label>
                    <p className="text-sm mt-1">{selectedRequest.purpose || "—"}</p>
                  </div>
                </div>

                {/* QR Scanner Section */}
                <div className="space-y-2">
                  <Label htmlFor="qrScanner">QR Scanner</Label>
                  <div className="relative">
                    <div className="flex items-center gap-2 p-4 border-2 border-dashed border-muted rounded-lg bg-muted/50 opacity-60">
                      <QrCode className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">QR Scanner (Disabled)</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute right-2 top-2 opacity-60 cursor-pointer"
                      onClick={handleQrScannerClick}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      Scan
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Click the scan button to use QR scanner</p>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
              {selectedRequest && (
                <>
                  <Button
                    variant="default"
                    className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                    onClick={() => {
                      handleSelectRequestForApproval(selectedRequest)
                      setIsDialogOpen(false)
                    }}
                  >
                    Approve with QR Scan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleApprove(selectedRequest.id, "borrow")
                    }}
                  >
                    Approve Without Scan
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleReject(selectedRequest.id, "borrow")
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Book a Device Modal */}
        <Dialog open={borrowDeviceOpen} onOpenChange={setBorrowDeviceOpen}>
          <DialogContent className="sm:max-w-lg space-y-4">
            <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
              <DialogTitle>Book a Device</DialogTitle>
              <DialogDescription>Request to book a device</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select
                  value={borrowForm.type}
                  onValueChange={(v) => setBorrowForm({ ...borrowForm, type: v, name: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(devices.map((d) => toTitleCase(d.device_type)).filter((t) => t !== "Unknown"))).sort().map((type) => (
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
                  disabled={devicesLoading || devices.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        devicesLoading
                          ? "Loading devices..."
                          : devices.length === 0
                            ? "No devices available"
                            : "Select device"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {devices
                      .filter((d) => !borrowForm.type || toTitleCase(d.device_type) === borrowForm.type)
                      .map((device) => {
                        const identifier = device.asset_tag || device.device_id || device.id
                        const deviceName = device.model || device.brand || device.device_type || "Device"
                        return (
                          <SelectItem key={identifier} value={identifier}>
                            {identifier} • {deviceName}
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
                    min={borrowForm.date || new Date().toISOString().split("T")[0]}
                    max={borrowReturnLimitIso}
                    value={borrowForm.returnDate}
                    onChange={(e) => handleBorrowReturnDateChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Textarea
                  value={borrowForm.purpose}
                  onChange={(e) => setBorrowForm({ ...borrowForm, purpose: e.target.value })}
                  placeholder="Reason for borrowing..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                  onClick={handleBorrowDeviceSubmit}
                  disabled={!borrowForm.name || !borrowForm.returnDate || !borrowForm.purpose}
                >
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Book Room Modal */}
        <Dialog
          open={bookRoomOpen}
          onOpenChange={(open) => {
            setBookRoomOpen(open)
            if (!open) {
              setBookingErrors({})
            }
          }}
        >
          <DialogContent className="sm:max-w-lg space-y-4">
            <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
              <DialogTitle>Book a Room</DialogTitle>
              <DialogDescription>Reserve a meeting room</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
              <div className="space-y-2">
                <Label>Room</Label>
                <Select
                  value={bookingForm.room}
                  onValueChange={(v) => setBookingForm({ ...bookingForm, room: v })}
                  disabled={availableRoomsLoading || (availableRooms.length === 0 && !availableRoomsLoading)}
                >
                  <SelectTrigger className={bookingErrors.room ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                    <SelectValue
                      placeholder={
                        availableRoomsLoading
                          ? "Loading rooms..."
                          : availableRooms.length === 0
                            ? "No rooms available"
                            : "Select room"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoomsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading rooms...
                      </SelectItem>
                    )}
                    {!availableRoomsLoading && availableRooms.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No rooms available
                      </SelectItem>
                    ) : (
                      availableRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.room_name || room.name || room.id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {bookingErrors.room && <p className="text-xs text-destructive">{bookingErrors.room}</p>}
              </div>
              <div className="space-y-2">
                <Label>Meeting Category</Label>
                <Select
                  value={bookingForm.category}
                  onValueChange={(v) => setBookingForm({ ...bookingForm, category: v })}
                >
                  <SelectTrigger className={bookingErrors.category ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="External">External</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
                {bookingErrors.category && <p className="text-xs text-destructive">{bookingErrors.category}</p>}
              </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={bookingForm.date}
                    onChange={(e) => handleBookingDateChange(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
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
                    className={bookingErrors.startTime || bookingErrors.range ? "border-destructive focus-visible:ring-destructive/40" : undefined}
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
                    className={bookingErrors.endTime || bookingErrors.range ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                  />
                  {bookingErrors.endTime && <p className="text-xs text-destructive">{bookingErrors.endTime}</p>}
                  {bookingErrors.range && (
                    <p className="text-xs text-destructive">{bookingErrors.range}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meeting Agenda</Label>
                <Textarea
                  value={bookingForm.agenda}
                  onChange={(e) => setBookingForm({ ...bookingForm, agenda: e.target.value })}
                  placeholder="Enter meeting agenda..."
                  rows={3}
                  className={bookingErrors.agenda ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                />
                {bookingErrors.agenda && <p className="text-xs text-destructive">{bookingErrors.agenda}</p>}
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
          </DialogContent>
        </Dialog>

        {/* Device Approval Selector Popup - Now a Table */}
        <Dialog open={showApprovalSelector} onOpenChange={setShowApprovalSelector}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <CheckCircle2 className="h-5 w-5" />
                Select Request to Approve
              </DialogTitle>
              <DialogDescription>Choose a borrow request to approve</DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg">
              {pendingBorrowRequests.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">No pending requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#92278F]/5">
                      <TableHead className="font-semibold text-[#25294B]">Employee</TableHead>
                      <TableHead className="font-semibold text-[#25294B]">Device</TableHead>
                      <TableHead className="font-semibold text-[#25294B]">Asset Tag</TableHead>
                      <TableHead className="font-semibold text-[#25294B]">Borrow Date</TableHead>
                      <TableHead className="font-semibold text-[#25294B]">Purpose</TableHead>
                      <TableHead className="font-semibold text-[#25294B]">Status</TableHead>
                      <TableHead className="font-semibold text-[#25294B]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBorrowRequests.map((request) => (
                      <TableRow 
                        key={request.id} 
                        className="hover:bg-[#92278F]/5 cursor-pointer"
                        onClick={() => {
                          handleSelectRequestForApproval(request)
                          setShowApprovalSelector(false)
                        }}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium text-[#25294B]">{request.employeeName}</div>
                            <div className="text-sm text-muted-foreground">{request.employeeId}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-[#25294B]">{request.deviceName}</TableCell>
                        <TableCell className="text-[#58595B]">{request.assetTag}</TableCell>
                        <TableCell className="text-[#58595B]">{request.borrowDate}</TableCell>
                        <TableCell className="max-w-xs truncate text-[#58595B]">{request.purpose}</TableCell>
                        <TableCell>
                          <Badge className="bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30">
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApprovalSelector(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Device Approval Details Popup with QR Scanner */}
        <Dialog open={showApprovalDetails} onOpenChange={setShowApprovalDetails}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#92278F]" />
                Approve Device Request
              </DialogTitle>
              <DialogDescription>Review details and scan device QR code</DialogDescription>
            </DialogHeader>
            
            {selectedApprovalRequest && (
              <div className="space-y-4">
                {/* Autofilled Request Details */}
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <h4 className="font-semibold text-[#25294B]">Request Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Employee Name</Label>
                      <p className="font-medium">{selectedApprovalRequest.employeeName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Employee ID</Label>
                      <p className="font-medium">{selectedApprovalRequest.employeeId}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Device Name</Label>
                      <p className="font-medium">{selectedApprovalRequest.deviceName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Asset Tag</Label>
                      <p className="font-medium">{selectedApprovalRequest.assetTag}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Requested Date</Label>
                      <p className="font-medium">{new Date(selectedApprovalRequest.borrowDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {selectedApprovalRequest.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Purpose</Label>
                    <p className="text-sm mt-1">{selectedApprovalRequest.purpose || "—"}</p>
                  </div>
                </div>

                {/* QR Scanner Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="qrCode" className="text-sm font-semibold">
                      Scan Device QR Code
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleStartQRScan}
                      disabled={isScanning}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      {isScanning ? "Scanning..." : "Start Camera"}
                    </Button>
                  </div>
                  
                  {isScanning && (
                    <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white">
                          <QrCode className="h-16 w-16 mx-auto mb-2 animate-pulse" />
                          <p className="text-sm">Position QR code within frame</p>
                          <p className="text-xs text-gray-400 mt-1">Camera access granted</p>
                        </div>
                      </div>
                      <div className="absolute inset-0 border-2 border-white/50 rounded-lg m-8 pointer-events-none">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white"></div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Input
                      id="qrCode"
                      placeholder={isScanning ? "Scanning... or enter manually" : "Enter QR code or scan with camera"}
                      value={qrCodeValue}
                      onChange={(e) => handleQRCodeInput(e.target.value)}
                      className={scanError ? "border-destructive" : ""}
                    />
                    {scanError && (
                      <p className="text-xs text-destructive">{scanError}</p>
                    )}
                    {qrCodeValue && !scanError && qrCodeValue === selectedApprovalRequest.assetTag && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        QR code matches device asset tag
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Expected asset tag: <strong>{selectedApprovalRequest.assetTag}</strong>
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowApprovalDetails(false)
                      setSelectedApprovalRequest(null)
                      setQrCodeValue("")
                      setIsScanning(false)
                      setScanError(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedApprovalRequest) {
                        handleReject(selectedApprovalRequest.id, "borrow")
                        setShowApprovalDetails(false)
                        setSelectedApprovalRequest(null)
                      }
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                    onClick={handleFinalApprove}
                    disabled={!!scanError}
                  >
                    Approve Request
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Device Availability Popup */}
        <Dialog open={showDeviceAvailability} onOpenChange={setShowDeviceAvailability}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <Monitor className="h-5 w-5" />
                Available Devices
              </DialogTitle>
              <DialogDescription>
                View and manage available devices in the system
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {availableDevicesLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#92278F] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading available devices...</p>
                </div>
              ) : availableDevicesList.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No available devices found</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#92278F]/5">
                        <TableHead className="font-semibold text-[#25294B]">Asset Tag</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Device Type</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Brand</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Model</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableDevicesList.map((device) => (
                        <TableRow key={device.id || device.device_id} className="hover:bg-[#92278F]/5">
                          <TableCell className="font-medium text-[#25294B]">
                            {device.asset_tag || device.device_id || "—"}
                          </TableCell>
                          <TableCell className="text-[#58595B]">
                            {toTitleCase(device.device_type)}
                          </TableCell>
                          <TableCell className="text-[#58595B]">{device.brand || "—"}</TableCell>
                          <TableCell className="text-[#58595B]">{device.model || "—"}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              {device.status || "Available"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeviceAvailability(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Borrow Requests Table Dialog */}
        <Dialog open={showBorrowRequestsTable} onOpenChange={setShowBorrowRequestsTable}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <CheckCircle2 className="h-5 w-5" />
                Pending Borrow Requests
              </DialogTitle>
              <DialogDescription>
                Review and approve device borrowing requests
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingBorrow ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#92278F] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading requests...</p>
                </div>
              ) : pendingBorrowRequests.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">No pending borrow requests</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#92278F]/5">
                        <TableHead className="font-semibold text-[#25294B]">Employee</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Device</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Asset Tag</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Borrow Date</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Purpose</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Status</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingBorrowRequests.map((request) => (
                        <TableRow key={request.id} className="hover:bg-[#92278F]/5">
                          <TableCell>
                            <div>
                              <div className="font-medium text-[#25294B]">{request.employeeName}</div>
                              <div className="text-sm text-muted-foreground">{request.employeeId}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-[#25294B]">{request.deviceName}</TableCell>
                          <TableCell className="text-[#58595B]">{request.assetTag}</TableCell>
                          <TableCell className="text-[#58595B]">{request.borrowDate}</TableCell>
                          <TableCell className="max-w-xs truncate text-[#58595B]">{request.purpose}</TableCell>
                          <TableCell>
                            <Badge className="bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30">
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                                onClick={() => {
                                  handleSelectRequestForApproval(request)
                                  setShowBorrowRequestsTable(false)
                                }}
                              >
                                <QrCode className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  handleReject(request.id, "borrow")
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBorrowRequestsTable(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Returns Table Dialog */}
        <Dialog open={showReturnsTable} onOpenChange={setShowReturnsTable}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <ClipboardList className="h-5 w-5" />
                Pending Return Requests
              </DialogTitle>
              <DialogDescription>
                Review and approve device return requests
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingBorrow ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#92278F] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading requests...</p>
                </div>
              ) : returnRequests.filter((r) => r.status === "Pending Return Approval" || r.status === "Pending Approval").length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">No pending return requests</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#92278F]/5">
                        <TableHead className="font-semibold text-[#25294B]">Employee</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Device</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Asset Tag</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Return Date</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Condition</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Status</TableHead>
                        <TableHead className="font-semibold text-[#25294B]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnRequests
                        .filter((r) => r.status === "Pending Return Approval" || r.status === "Pending Approval")
                        .map((request) => (
                        <TableRow key={request.id} className="hover:bg-[#92278F]/5">
                          <TableCell>
                            <div>
                              <div className="font-medium text-[#25294B]">{request.employeeName}</div>
                              <div className="text-sm text-muted-foreground">{request.employeeId}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-[#25294B]">{request.deviceName}</TableCell>
                          <TableCell className="text-[#58595B]">{request.assetTag}</TableCell>
                          <TableCell className="text-[#58595B]">{request.returnDate}</TableCell>
                          <TableCell>
                            <Badge variant={
                              request.deviceCondition === 'Excellent' ? 'default' :
                              request.deviceCondition === 'Good' ? 'secondary' :
                              request.deviceCondition === 'Damaged' ? 'destructive' : 'outline'
                            }>
                              {request.deviceCondition}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30">
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                                onClick={() => {
                                  handleApprove(request.id, "return")
                                  setShowReturnsTable(false)
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  handleReject(request.id, "return")
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReturnsTable(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
      <RoomAvailabilityModal open={roomAvailabilityOpen} onOpenChange={setRoomAvailabilityOpen} />
    </AMSDashboardLayout>
  )
}
