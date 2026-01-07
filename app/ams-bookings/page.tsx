"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getCurrentUser } from "@/lib/auth"
import { Building2, Calendar, Search, ListChecks, MoreVertical, Filter, Pencil, RotateCcw, X, Trash2, Check, Repeat, Loader2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { isBookingInProgress, resolveBookingRuntimeStatus } from "@/lib/utils/room-bookings"
import { BUSINESS_START_TIME, BUSINESS_END_TIME, BUSINESS_TIME_PATTERN, isWithinBusinessHours as isBusinessTime, timeStringToMinutes } from "@/lib/utils/business-hours"

type RoomRecord = {
  id: string
  room_name: string
  room_code?: string | null
  location?: string | null
  floor?: string | null
  capacity?: number | null
}

type BookingRecord = {
  booking_id: string
  room_id: string
  booked_by: string
  booking_reason?: string | null
  start_time: string
  end_time: string
  status?: string | null
  is_recurring?: boolean | null
  recurrence_pattern?: string | null
  recurrence_end_date?: string | null
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  created_at?: string | null
  updated_at?: string | null
  date?: string | null
  booking_date?: string | null
  time?: string | null
  meeting_category?: string | null
  meeting_agenda?: string | null
  purpose?: string | null
}

type Booking = BookingRecord & {
  id: string
  booking_date?: string | null
  date?: string | null
  time?: string | null
  original_start_time?: string | null
  original_end_time?: string | null
}

const formatBookingTimeRange = (booking?: Booking | null) => {
  if (!booking) return "—"
  const startLabel = booking.start_time || (booking.original_start_time ? toHHMM(booking.original_start_time) : "")
  const endLabel = booking.end_time || (booking.original_end_time ? toHHMM(booking.original_end_time) : "")
  if (!startLabel && !endLabel) return "—"
  if (!endLabel) return startLabel
  if (!startLabel) return endLabel
  return `${startLabel} - ${endLabel}`
}

const isSameDayBooking = (booking: Booking) => {
  const date = booking.date ?? booking.booking_date
  if (!date) return false
  const today = new Date().toISOString().split("T")[0]
  return date === today
}

const canCheckInBooking = (booking: Booking, runtimeStatus: string) => {
  const normalizedStatus = runtimeStatus.toLowerCase().replace(/[–—]/g, '-')
  if (['attended', 'cancelled', 'missed', 'completed'].includes(normalizedStatus)) {
    return false
  }
  if (!isSameDayBooking(booking)) {
    return false
  }
  // Remove check-in button when meeting is "In Progress" (even if unconfirmed)
  if (normalizedStatus.includes('in progress')) {
    return false
  }
  // Allow check-in for: Upcoming, Confirmed only
  return normalizedStatus === 'upcoming' || normalizedStatus === 'confirmed'
}

const isTimeString = (value?: string | null) => Boolean(value && /^\d{2}:\d{2}$/.test(value))

const toHHMM = (value?: string | null) => {
  if (!value) return ''
  if (isTimeString(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16) || ''
  }
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

type RowActionsMenuProps = {
  disabledEdit: boolean
  disabledCancel: boolean
  disabledDelete: boolean
  disabledRebook?: boolean
  onEdit?: () => void
  onReturn?: () => void
  onCancel?: () => void
  onDelete?: () => void
}

const RowActionsMenu: React.FC<RowActionsMenuProps> = ({ disabledEdit, disabledCancel, disabledDelete, disabledRebook = false, onEdit, onReturn, onCancel, onDelete }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Booking actions"
          className="hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#92278F]/30"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={(event) => {
            event.preventDefault()
            if (!disabledEdit && onEdit) {
              onEdit()
            }
          }}
          disabled={disabledEdit}
          className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {onReturn && (
          <DropdownMenuItem
            onClick={(event) => {
              event.preventDefault()
              if (!disabledRebook && onReturn) {
                onReturn()
              }
            }}
            disabled={disabledRebook}
            className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Repeat className="mr-2 h-4 w-4" />
            Re-book
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(event) => {
            event.preventDefault()
            if (!disabledCancel && onCancel) {
              onCancel()
            }
          }}
          disabled={disabledCancel}
          className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.preventDefault()
            if (!disabledDelete && onDelete) {
              onDelete()
            }
          }}
          disabled={disabledDelete}
          className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const toDateOnly = (value?: string | null) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.split('T')[0] ?? ''
  }
  return date.toISOString().split('T')[0]
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value?: string | null): value is string => Boolean(value && UUID_REGEX.test(value))

const normalizeBookingRecord = (record: BookingRecord): Booking => {
  const date = record.date ?? record.booking_date ?? toDateOnly(record.start_time)
  const startDisplay = record.start_time ? toHHMM(record.start_time) : ''
  const endDisplay = record.end_time ? toHHMM(record.end_time) : ''

  return {
    ...record,
    id: record.booking_id,
    booking_date: date,
    date,
    time: record.time ?? (startDisplay && endDisplay ? `${startDisplay}-${endDisplay}` : null),
    original_start_time: record.start_time,
    original_end_time: record.end_time,
    start_time: startDisplay,
    end_time: endDisplay,
  }
}

export default function AMSBookingsPage() {
  const user = getCurrentUser()
  const [employeeProfile, setEmployeeProfile] = useState<any>(() => {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem("xspark_employee")
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"All" | "Upcoming" | "In Progress" | "Missed" | "Rescheduled" | "Cancelled" | "Attended">("All")
  const [searchTerm, setSearchTerm] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null)
  const [bookRoomOpen, setBookRoomOpen] = useState(false)
  const [bookingSummaryOpen, setBookingSummaryOpen] = useState(false)
  const [bookingSummaryData, setBookingSummaryData] = useState<Booking | null>(null)
  const [bookingSummaryPending, setBookingSummaryPending] = useState(false)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [availableRooms, setAvailableRooms] = useState<RoomRecord[]>([])
  const [availableRoomsLoading, setAvailableRoomsLoading] = useState(false)
  const [roomLookup, setRoomLookup] = useState<Record<string, RoomRecord>>({})
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [bookingToCheckIn, setBookingToCheckIn] = useState<Booking | null>(null)
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)
  const [checkInSummaryOpen, setCheckInSummaryOpen] = useState(false)
  const [checkInSummaryData, setCheckInSummaryData] = useState<Booking | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const { toast } = useToast()

  const [bookingForm, setBookingForm] = useState({
    room: "",
    meetingType: "",
    meetingCategory: "",
    agenda: "",
    date: "",
    startTime: "",
    endTime: "",
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleStorage = () => {
      const stored = localStorage.getItem("xspark_employee")
      if (!stored) {
        setEmployeeProfile(null)
        return
      }
      try {
        setEmployeeProfile(JSON.parse(stored))
      } catch {
        setEmployeeProfile(null)
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  if (!user) return null

  const normalizedRole = ((user.role as string | undefined) ?? '').toLowerCase()
  const isEmployee = normalizedRole === 'employee' || (!normalizedRole || normalizedRole === '')

  const bookingOwnerId = useMemo(() => {
    const candidates = [
      employeeProfile?.id,
      employeeProfile?.employee_id,
      user?.employeeId,
      user?.id,
      user?.email,
    ]
    return candidates.find((candidate) => isUuid(candidate)) ?? null
  }, [employeeProfile, user])

  const loadUserBookings = useCallback(async () => {
    if (!bookingOwnerId || !isUuid(bookingOwnerId)) {
      setBookings([])
      setBookingsError("Missing employee identifier")
      setBookingsLoading(false)
      return
    }
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      const params = new URLSearchParams({
        bookedBy: bookingOwnerId,
      })
      const response = await fetch(`/api/room-bookings?${params.toString()}`)
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || 'Failed to fetch bookings')
      }
      const records = Array.isArray(json.data) ? (json.data as BookingRecord[]) : []
      const normalized = records.map(normalizeBookingRecord)
      const sorted = normalized.sort((a, b) => {
        // Sort by date first (ascending - earliest first)
        const aDate = a.date ?? a.booking_date ?? ''
        const bDate = b.date ?? b.booking_date ?? ''
        if (aDate !== bDate) {
          return aDate.localeCompare(bDate)
        }
        // If same date, sort by start time (ascending - earliest first)
        const aTime = a.original_start_time ? new Date(a.original_start_time).getTime() : 0
        const bTime = b.original_start_time ? new Date(b.original_start_time).getTime() : 0
        return aTime - bTime
      })
      setBookings(sorted)
    } catch (error) {
      console.error(error)
      setBookingsError("Unable to load your bookings")
    } finally {
      setBookingsLoading(false)
    }
  }, [bookingOwnerId])

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms?limit=200`)
      if (!response.ok) {
        throw new Error('Failed to load rooms')
      }
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error || 'Failed to load rooms')
      }
      const records = Array.isArray(json.data) ? (json.data as RoomRecord[]) : []
      setRoomLookup(
        records.reduce((acc, room) => {
          acc[room.id] = room
          return acc
        }, {} as Record<string, RoomRecord>),
      )
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Unable to load rooms",
        description: "Please try again in a moment.",
      })
    }
  }, [toast])

  const fetchAvailableRooms = useCallback(async () => {
    if (!bookRoomOpen) return
    if (!bookingForm.date || !bookingForm.startTime || !bookingForm.endTime) return
    setAvailableRoomsLoading(true)
    try {
      const params = new URLSearchParams({
        bookingDate: bookingForm.date,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        isAvailable: "true",
      })
      if (editingBookingId) {
        params.set("excludeBookingId", editingBookingId)
      }
      const response = await fetch(`/api/rooms?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch available rooms')
      }
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch available rooms')
      }
      const records = Array.isArray(json.data) ? (json.data as RoomRecord[]) : []
      setAvailableRooms(records)
      if (records.length > 0) {
        setRoomLookup((prev) => {
          const next = { ...prev }
          records.forEach((room) => {
            next[room.id] = room
          })
          return next
        })
      }
    } catch (error) {
      console.error(error)
      setAvailableRooms([])
    } finally {
      setAvailableRoomsLoading(false)
    }
  }, [bookRoomOpen, bookingForm.date, bookingForm.startTime, bookingForm.endTime, editingBookingId])

  useEffect(() => {
    loadUserBookings()
  }, [loadUserBookings])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  useEffect(() => {
    fetchAvailableRooms()
  }, [fetchAvailableRooms])

  useEffect(() => {
    if (!bookRoomOpen) {
      setAvailableRooms([])
      setAvailableRoomsLoading(false)
    }
  }, [bookRoomOpen])

  useEffect(() => {
    const today = new Date()
    const dateStr = today.toISOString().split("T")[0]
    setBookingForm((prev) => ({
      ...prev,
      date: prev.date || dateStr,
      startTime: prev.startTime || "12:00",
      endTime: prev.endTime || "13:00",
    }))
  }, [])

  const handleDeleteClick = (booking: Booking) => {
    if (!booking) {
      toast({
        variant: "destructive",
        title: "Cannot delete booking",
        description: "Booking information is missing.",
      })
      return
    }
    setBookingToDelete(booking)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!bookingToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/room-bookings/${bookingToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete booking")
      }

      await loadUserBookings()
      toast({
        title: "Booking deleted",
        description: `${roomLookup[bookingToDelete.room_id]?.room_name ?? "Room"} booking removed.`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete booking",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setBookingToDelete(null)
    }
  }

  const handleEditBooking = (booking: Booking) => {
    setBookingForm({
      room: booking.room_id,
      meetingType: "",
      meetingCategory: "",
      agenda: booking.booking_reason || booking.meeting_agenda || booking.purpose || "",
      date: booking.date ?? booking.booking_date ?? "",
      startTime: booking.start_time || toHHMM(booking.original_start_time),
      endTime: booking.end_time || toHHMM(booking.original_end_time),
    })
    setEditingBookingId(booking.id)
    setBookingErrors({})
    setBookRoomOpen(true)
  }

  const openCheckInDialog = (booking: Booking) => {
    setBookingToCheckIn(booking)
    setCheckInDialogOpen(true)
  }

  const handleConfirmCheckIn = async () => {
    if (!bookingToCheckIn) return
    setCheckInSubmitting(true)
    try {
      // Check if meeting has started
      const bookingDate = bookingToCheckIn.date ?? bookingToCheckIn.booking_date
      const startTime = bookingToCheckIn.start_time || toHHMM(bookingToCheckIn.original_start_time)
      
      let meetingHasStarted = false
      if (bookingDate && startTime) {
        const today = new Date().toISOString().split("T")[0]
        const [hours, minutes] = startTime.split(":").map(Number)
        const meetingStart = new Date(`${bookingDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
        const now = new Date()
        meetingHasStarted = now >= meetingStart
      }
      
      // First check in
      const checkInResponse = await fetch("/api/room-bookings/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingToCheckIn.id }),
      })
      const checkInJson = await checkInResponse.json().catch(() => ({}))
      if (!checkInResponse.ok || checkInJson.success === false) {
        throw new Error(checkInJson?.error || "Failed to check in to this meeting.")
      }
      
      // Only update status if meeting has started - set to "In Progress"
      // If clicked before meeting time, status remains "upcoming"
      if (meetingHasStarted) {
        const updateResponse = await fetch(`/api/room-bookings/${bookingToCheckIn.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in progress" }),
        })
        const updateJson = await updateResponse.json().catch(() => ({}))
        if (!updateResponse.ok || updateJson.success === false) {
          console.warn("Failed to update status to in progress:", updateJson?.error)
        }
      }
      
      // Reload bookings to get updated data
      await loadUserBookings()
      
      // Get the updated booking data
      const updatedBooking = checkInJson.data?.booking ? normalizeBookingRecord(checkInJson.data.booking as BookingRecord) : bookingToCheckIn
      
      // Close confirmation dialog and show summary
      setCheckInDialogOpen(false)
      setCheckInSummaryData(updatedBooking)
      setCheckInSummaryOpen(true)
      setBookingToCheckIn(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to check in",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setCheckInSubmitting(false)
    }
  }

  const handleCancelClick = (booking: Booking) => {
    if (!booking) {
      toast({
        variant: "destructive",
        title: "Cannot cancel booking",
        description: "Booking information is missing.",
      })
      return
    }
    setBookingToCancel(booking)
    setCancelDialogOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return

    setIsCancelling(true)
    try {
      const response = await fetch(`/api/room-bookings/${bookingToCancel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to cancel booking")
      }

      await loadUserBookings()
      
      // Close dialog first
      setCancelDialogOpen(false)
      setBookingToCancel(null)
      setIsCancelling(false)
      
      // Show success toast
      toast({
        title: "Meeting cancelled",
        description: "The meeting has been successfully cancelled.",
      })
    } catch (error) {
      setIsCancelling(false)
      toast({
        variant: "destructive",
        title: "Unable to cancel booking",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    const statusLower = status.toLowerCase().trim().replace(/[–—]/g, '-')
    
    // Confirmed → Green
    if (statusLower === "confirmed" || statusLower === "booked") return "#16A34A"
    
    // Attended → Green (same shade as confirmed)
    if (statusLower === "attended") return "#16A34A"
    
    // Upcoming → Blue
    if (statusLower === "upcoming") return "#2563EB"
    
    // Rescheduled → Orange
    if (statusLower.includes("rescheduled")) return "#FF9800"
    
    // Cancelled → Red
    if (statusLower.includes("cancelled") || statusLower.includes("canceled")) return "#DC2626"
    
    // Completed → Grey
    if (statusLower === "completed") return "#6B7280"
    
    // In Progress – Confirmed → Blue-Green (teal)
    if (statusLower.includes("in progress") && statusLower.includes("confirmed")) return "#14B8A6"
    
    // In Progress – Unconfirmed → Yellow
    if (statusLower.includes("in progress") && statusLower.includes("unconfirmed")) return "#EAB308"
    
    // Missed → Dark Red
    if (statusLower === "missed") return "#991B1B"
    
    return undefined
  }

  // Map bookings to rows format for display
  const rows = bookings.map((booking) => {
    const runtimeStatus = resolveBookingRuntimeStatus(booking, bookings)
    const roomName = roomLookup[booking.room_id]?.room_name ?? booking.room_id
    const meetingCategory = booking.meeting_category || "Internal"
    return {
      id: booking.id || booking.booking_id || `booking-${Math.random()}`,
      room: roomName,
      category: meetingCategory,
      type: "Offline",
      agenda: booking.booking_reason || booking.meeting_agenda || booking.purpose || "",
      date: booking.date ?? booking.booking_date ?? "",
      start: booking.start_time || toHHMM(booking.original_start_time),
      end: booking.end_time || toHHMM(booking.original_end_time),
      status: runtimeStatus,
    }
  })

  const filtered = rows.filter(r => {
    // History filter - show all bookings when history is enabled, otherwise show upcoming/pending/current only
    if (!showHistory) {
      // Only show upcoming, in-progress, or today's bookings when not viewing history
      const bookingDate = r.date ? new Date(r.date + 'T00:00:00') : null
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      if (bookingDate) {
        const bookingDay = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate())
        const isPast = bookingDay < today
        const statusLower = r.status.toLowerCase().replace(/[–—]/g, '-')
        const isActive = statusLower === 'upcoming' || statusLower === 'confirmed' || statusLower.includes('in progress')
        
        // Hide past bookings that are not active when not viewing history
        if (isPast && !isActive) {
          return false
        }
      }
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        r.room.toLowerCase().includes(searchLower) ||
        r.category.toLowerCase().includes(searchLower) ||
        r.type.toLowerCase().includes(searchLower) ||
        r.agenda.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Status filter
    if (statusFilter === "All") return true
    
    const statusLower = r.status.toLowerCase().trim().replace(/[–—]/g, '-')
    
    // Map statuses to filter options
    if (statusFilter === "Upcoming") {
      return statusLower === "upcoming" || statusLower === "confirmed"
    }
    if (statusFilter === "In Progress") {
      return statusLower.includes("in progress") || (statusLower.includes("in progress") && statusLower.includes("confirmed"))
    }
    if (statusFilter === "Missed") {
      return statusLower === "missed" || statusLower.includes("awaiting check-in")
    }
    if (statusFilter === "Rescheduled") {
      return statusLower.includes("rescheduled")
    }
    if (statusFilter === "Cancelled") {
      return statusLower.includes("cancelled") || statusLower.includes("canceled")
    }
    if (statusFilter === "Attended") {
      return statusLower === "attended" || statusLower === "completed"
    }
    
    return false
  })

  const meetingTypes = [
    { value: "Online", label: "Online" },
    { value: "Offline", label: "Offline" },
  ]

  const meetingCategories = [
    { value: "Internal", label: "Internal" },
    { value: "External", label: "External" },
  ]

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

  const isValidTime = (value: string) => {
    if (!value || !BUSINESS_TIME_PATTERN.test(value)) return false
    const [hoursStr, minutesStr] = value.split(":")
    const hours = Number(hoursStr)
    const minutes = Number(minutesStr)
    if ([hours, minutes].some((part) => Number.isNaN(part))) return false
    return true
  }

  const toMinutes = (value: string) => {
    if (!isValidTime(value)) return null
    const [hours, minutes] = value.split(":").map(Number)
    return hours * 60 + minutes
  }

  const isFutureDateTime = (date: string, time: string) => {
    if (!date || !isValidTime(time)) return false
    const dateTime = new Date(`${date}T${time}:00`)
    if (Number.isNaN(dateTime.getTime())) return false
    const now = new Date()
    return dateTime.getTime() > now.getTime()
  }

  const validateBookingForm = (form = bookingForm) => {
    const errors: Record<string, string> = {}
    if (!form.room) errors.room = "Select a room."
    if (!form.meetingType) errors.meetingType = "Select a meeting type."
    if (!form.meetingCategory) errors.meetingCategory = "Select a category."
    if (!form.date) {
      errors.date = "Select a booking date."
    } else if (isPastDate(form.date)) {
      errors.date = "Booking date cannot be in the past."
    } else {
      // Check if date is a weekend
      const parsed = parseDateOnly(form.date)
      if (parsed) {
        const dayOfWeek = parsed.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          errors.date = "Room bookings are not allowed on weekends."
        }
      }
    }

    if (!form.startTime) {
      errors.startTime = "Select a start time."
    } else if (!isValidTime(form.startTime)) {
      errors.startTime = "Enter time in HH:MM format."
    } else if (!isBusinessTime(form.startTime)) {
      errors.startTime = "Not a business hour"
    }

    if (!form.endTime) {
      errors.endTime = "Select an end time."
    } else if (!isValidTime(form.endTime)) {
      errors.endTime = "Enter time in HH:MM format."
    } else if (!isBusinessTime(form.endTime)) {
      errors.endTime = "Not a business hour"
    }

    const startMinutes = timeStringToMinutes(form.startTime)
    const endMinutes = timeStringToMinutes(form.endTime)
    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      errors.endTime = "End time must be later than start time."
    }

    if (
      form.date &&
      isValidTime(form.startTime) &&
      !isPastDate(form.date) &&
      !isFutureDateTime(form.date, form.startTime)
    ) {
      errors.startTime = "Start time must be in the future."
    }

    return errors
  }

  const bookingFormReady = useMemo(() => Object.keys(validateBookingForm()).length === 0, [bookingForm])

  const updateFormWithValidation = (patch: Partial<typeof bookingForm>) => {
    const nextForm = { ...bookingForm, ...patch }
    setBookingForm(nextForm)
    setBookingErrors(validateBookingForm(nextForm))
  }

  const handleBookingFormSubmit = async () => {
    const errors = validateBookingForm()
    setBookingErrors(errors)

    if (Object.keys(errors).length > 0) {
      toast({
        variant: "destructive",
        title: "Cannot book room yet",
        description: "Please resolve the highlighted fields.",
      })
      return
    }

    if (!bookingOwnerId) {
      toast({
        variant: "destructive",
        title: "Missing employee ID",
        description: "We could not determine your employee record. Please try again once your profile has loaded.",
      })
      return
    }

    const payload = {
      room_id: bookingForm.room,
      booked_by: bookingOwnerId,
      date: bookingForm.date,
      start_time: bookingForm.startTime,
      end_time: bookingForm.endTime,
      meeting_category: bookingForm.meetingCategory || undefined,
      meeting_agenda: bookingForm.agenda || undefined,
      purpose: bookingForm.agenda || undefined,
    }

    const isEditing = Boolean(editingBookingId)
    const endpoint = isEditing ? `/api/room-bookings/${editingBookingId}` : "/api/room-bookings"
    const method = isEditing ? "PATCH" : "POST"

    setSubmitting(true)

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = await response.json().catch(() => ({}))
      
      if (response.status === 409) {
        const errorMessage = json?.error || "Room unavailable"
        toast({
          variant: "destructive",
          title: errorMessage.includes("already have a booking") ? "Time slot unavailable" : "Room unavailable",
          description: errorMessage.includes("already have a booking") 
            ? "You already have a booking at this time on this date. You cannot book multiple rooms simultaneously."
            : "The selected room is already booked for that time. Please pick another slot.",
        })
        return
      }

      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to save booking")
      }
      const booking = json.data as BookingRecord
      const normalizedBooking = normalizeBookingRecord(booking)

      await loadUserBookings()
      setBookingSummaryData(normalizedBooking)
      setBookingSummaryPending((normalizedBooking.status || "").toLowerCase().includes("pending"))
      setBookingSummaryOpen(true)
      setBookRoomOpen(false)
      setEditingBookingId(null)
      toast({
        title: isEditing ? "Booking updated" : "Room booked",
        description: `${roomLookup[normalizedBooking.room_id]?.room_name ?? "Room"} reserved for ${normalizedBooking.date ?? normalizedBooking.booking_date}.`,
      })

      setBookingErrors({})
      setBookingForm({
        room: "",
        meetingType: "",
        meetingCategory: "",
        agenda: "",
        date: new Date().toISOString().split("T")[0],
        startTime: "12:00",
        endTime: "13:00",
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Unable to save booking",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const checkInRoomName = bookingToCheckIn
    ? roomLookup[bookingToCheckIn.room_id]?.room_name ?? bookingToCheckIn.room_id
    : "—"
  const checkInDate = bookingToCheckIn?.date ?? bookingToCheckIn?.booking_date ?? "—"
  const checkInTime = formatBookingTimeRange(bookingToCheckIn)
  const checkInAgenda =
    bookingToCheckIn?.booking_reason ||
    bookingToCheckIn?.meeting_agenda ||
    bookingToCheckIn?.purpose ||
    "Not provided"

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Room Booking</h1>
          <p className="text-muted-foreground mt-1">Review upcoming meetings, manage reservations, and check in when you arrive.</p>
        </div>

        {/* Booking History Table and Book a Room Button */}
        <div className="space-y-4">
          <div className="flex flex-row items-start justify-between gap-4">
            <div></div>
            <div className="flex gap-2">
              {!isEmployee && (
                <Button
                  variant={showHistory ? "default" : "outline"}
                  className={showHistory ? "bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white" : ""}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <ListChecks className="h-4 w-4 mr-2" />
                  Room Booking History
                </Button>
              )}
              <Dialog
                open={bookRoomOpen}
                onOpenChange={(open) => {
                  setBookRoomOpen(open)
                  if (open) {
                    if (!editingBookingId) {
                      setBookingForm((prev) => ({
                        ...prev,
                        date: prev.date || new Date().toISOString().split("T")[0],
                        startTime: prev.startTime || "12:00",
                        endTime: prev.endTime || "13:00",
                      }))
                    }
                  } else {
                    setBookingErrors({})
                    setEditingBookingId(null)
                    setBookingForm({
                      room: "",
                      meetingType: "",
                      meetingCategory: "",
                      agenda: "",
                      date: new Date().toISOString().split("T")[0],
                      startTime: "12:00",
                      endTime: "13:00",
                    })
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white">Book a Room</Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-lg space-y-4">
                <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                  <DialogTitle>Book a Room</DialogTitle>
                  <DialogDescription>Provide booking details</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
                  <div>
                    <Label>Room Selection</Label>
                    <Select
                      value={bookingForm.room}
                      onValueChange={(value) => updateFormWithValidation({ room: value })}
                      disabled={availableRoomsLoading || (!availableRoomsLoading && availableRooms.length === 0)}
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
                    {!availableRoomsLoading && availableRooms.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Select a different time range to view available rooms.</p>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Meeting Type</Label>
                      <Select value={bookingForm.meetingType} onValueChange={(value) => updateFormWithValidation({ meetingType: value })}>
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
                      <Select
                        value={bookingForm.meetingCategory}
                        onValueChange={(value) => updateFormWithValidation({ meetingCategory: value as "Internal" | "External" })}
                      >
                        <SelectTrigger className={bookingErrors.meetingCategory ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {meetingCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {bookingErrors.meetingCategory && <p className="text-xs text-destructive mt-1">{bookingErrors.meetingCategory}</p>}
                    </div>
                  </div>
                  <div>
                    <Label>Agenda</Label>
                    <Textarea
                      rows={3}
                      placeholder="Meeting agenda"
                      value={bookingForm.agenda}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, agenda: e.target.value }))}
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={bookingForm.date}
                        onChange={(e) => updateFormWithValidation({ date: e.target.value })}
                        min={new Date().toISOString().split("T")[0]}
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
                        onChange={(e) => updateFormWithValidation({ startTime: e.target.value })}
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
                        onChange={(e) => updateFormWithValidation({ endTime: e.target.value })}
                        className={bookingErrors.endTime ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                      />
                      {bookingErrors.endTime && <p className="text-xs text-destructive mt-1">{bookingErrors.endTime}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                      onClick={handleBookingFormSubmit}
                      disabled={submitting || !bookingFormReady}
                    >
                      {submitting ? "Saving..." : "Book Room"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
          
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search bookings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 uniform-input"
                    />
                  </div>
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as "All" | "Upcoming" | "In Progress" | "Missed" | "Rescheduled" | "Cancelled" | "Attended")}
                >
                  <SelectTrigger className="w-full md:w-48 uniform-input">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All bookings</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Missed">Missed</SelectItem>
                    <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Attended">Attended</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("All")
                    setSearchTerm("")
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bookings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Bookings ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading your bookings...</div>
              ) : bookingsError ? (
                <div className="py-10 text-center text-sm text-destructive">{bookingsError}</div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No bookings found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead>Room</TableHead>
                      <TableHead>Meeting Category</TableHead>
                      <TableHead>Meeting Type</TableHead>
                      <TableHead>Agenda</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Check-in</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, index) => {
                      const booking = bookings.find((b) => b.id === r.id || b.booking_id === r.id)
                      const statusLower = r.status.toLowerCase().replace(/[–—]/g, '-')
                      const isUpcoming = statusLower === 'upcoming' || statusLower === 'confirmed'
                      const isAttended = statusLower === 'attended' || statusLower === 'completed'
                      const isInProgress = statusLower.includes('in progress')
                      const isRescheduled = statusLower.includes('rescheduled')
                      
                      // Status-based action disabling rules:
                      // - Upcoming: disable rebook only
                      // - Attended: disable edit and cancel
                      // - In Progress: disable edit, delete, cancel
                      // - Rescheduled: disable rebook
                      
                      const canEditBookingRow = Boolean(
                        booking && 
                        !isAttended && 
                        !isInProgress && 
                        !['cancelled', 'missed'].includes(statusLower)
                      )
                      
                      const canCancel = Boolean(
                        booking && 
                        !isAttended && 
                        !isInProgress && 
                        !statusLower.includes('cancelled')
                      )
                      
                      const canDelete = Boolean(
                        booking && 
                        !isInProgress
                      )
                      
                      const canRebook = Boolean(
                        booking && 
                        !isUpcoming && 
                        !isRescheduled &&
                        !isInProgress
                      )
                      
                      const deleteDisabled = !canDelete
                      const showCheckInButton = booking ? canCheckInBooking(booking, r.status) : false
                      
                      // Check if booking is checked in
                      const isCheckedIn = booking ? Boolean(
                        booking.checked_in_at || 
                        booking.checkedInAt ||
                        (booking as any).check_in_status === 'Checked-In' ||
                        (booking as any).checkInStatus === 'Checked-In'
                      ) : false
                      
                      const uniqueKey = r.id || booking?.booking_id || booking?.id || `booking-row-${index}`
                      return (
                        <TableRow key={uniqueKey}>
                          <TableCell>{r.room}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.type}</TableCell>
                          <TableCell>{r.agenda}</TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.start}</TableCell>
                          <TableCell>{r.end}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={statusLower === "pending" || statusLower.includes("unverified") ? "destructive" : "default"}
                              className="h-6 px-3 py-0.5 rounded-full text-xs font-medium"
                              style={getStatusBadgeColor(r.status) ? { backgroundColor: getStatusBadgeColor(r.status), color: "white" } : undefined}
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {isCheckedIn ? (
                              <Check className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {showCheckInButton && booking && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                  onClick={() => openCheckInDialog(booking)}
                                >
                                  <ListChecks className="mr-1.5 h-4 w-4" />
                                  Check-In
                                </Button>
                              )}
                              <RowActionsMenu
                                disabledEdit={!booking || !canEditBookingRow}
                                disabledCancel={!canCancel}
                                disabledDelete={deleteDisabled}
                                disabledRebook={!canRebook}
                                onEdit={() => booking && handleEditBooking(booking)}
                                onReturn={() => booking && openCheckInDialog(booking)}
                                onCancel={() => booking && handleCancelClick(booking)}
                                onDelete={() => booking && handleDeleteClick(booking)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={checkInDialogOpen}
          onOpenChange={(open) => {
            setCheckInDialogOpen(open)
            if (!open) {
              setBookingToCheckIn(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>Are you sure you want to check-in?</DialogTitle>
              <DialogDescription>Review the meeting details before confirming check-in.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Room</span>
                <span className="font-medium text-[#25294B]">{checkInRoomName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-[#25294B]">{checkInDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium text-[#25294B]">{checkInTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Agenda</span>
                <span className="font-medium text-[#25294B]">{checkInAgenda}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setCheckInDialogOpen(false)} disabled={checkInSubmitting}>
                Close
              </Button>
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white disabled:opacity-60"
                onClick={handleConfirmCheckIn}
                disabled={checkInSubmitting || !bookingToCheckIn}
              >
                {checkInSubmitting ? "Checking In…" : "Confirm"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog 
          open={cancelDialogOpen} 
          onOpenChange={(open) => {
            if (!isCancelling) {
              setCancelDialogOpen(open)
              if (!open) {
                setBookingToCancel(null)
              }
            }
          }}
        >
          <AlertDialogContent className="space-y-4">
            <AlertDialogHeader className="space-y-1">
              <AlertDialogTitle>
                {isCancelling ? "Canceling..." : "Confirm Cancellation"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isCancelling ? (
                  "Please wait while we cancel the meeting..."
                ) : (
                  <>
                    Are you sure you want to cancel the booking for{" "}
                    <strong>
                      {bookingToCancel
                        ? roomLookup?.[bookingToCancel.room_id]?.room_name ?? bookingToCancel.room_id
                        : "this room"}
                    </strong>{" "}
                    on{" "}
                    <strong>
                      {bookingToCancel?.date ?? bookingToCancel?.booking_date ?? "this date"}
                    </strong>
                    ? The booking status will be changed to cancelled.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {!isCancelling && (
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  setCancelDialogOpen(false)
                  setBookingToCancel(null)
                }}>
                  No, Keep Booking
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelConfirm}
                  className="bg-[#BE1E2D] text-white hover:bg-[#BE1E2D]/90"
                >
                  Yes, Cancel Booking
                </AlertDialogAction>
              </AlertDialogFooter>
            )}
            {isCancelling && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BE1E2D]"></div>
              </div>
            )}
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog 
          open={deleteDialogOpen} 
          onOpenChange={(open) => {
            if (!isDeleting) {
              setDeleteDialogOpen(open)
              if (!open) {
                setBookingToDelete(null)
              }
            }
          }}
        >
          <AlertDialogContent className="sm:max-w-md space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete booking?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this booking? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setBookingToDelete(null)
                }}
                disabled={isDeleting}
                className="border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-gradient-to-r from-[#8B2A6C] to-[#B02A5C] text-white hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Yes"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={bookingSummaryOpen} onOpenChange={setBookingSummaryOpen}>
          <DialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4 rounded-xl">
            <DialogHeader className="space-y-1">
              <DialogTitle>Booking Summary</DialogTitle>
              <DialogDescription>Your room booking confirmation</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#58595B]">Room:</span>
                <span className="font-medium text-[#25294B]">
                  {bookingSummaryData
                    ? roomLookup[bookingSummaryData.room_id]?.room_name ?? bookingSummaryData.room_id
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Category:</span>
                <span className="font-medium text-[#25294B]">{bookingSummaryData?.meeting_category ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Date:</span>
                <span className="font-medium text-[#25294B]">
                  {bookingSummaryData?.date ?? bookingSummaryData?.booking_date ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Time:</span>
                <span className="font-medium text-[#25294B]">
                  {bookingSummaryData?.start_time ?? "—"} - {bookingSummaryData?.end_time ?? "—"}
                </span>
              </div>
              {(bookingSummaryData?.booking_reason || bookingSummaryData?.meeting_agenda || bookingSummaryData?.purpose) && (
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Agenda:</span>
                  <span className="font-medium text-[#25294B]">
                    {bookingSummaryData?.booking_reason || bookingSummaryData?.meeting_agenda || bookingSummaryData?.purpose || "—"}
                  </span>
                </div>
              )}
              <div className="flex justify-between mt-4">
                <span className="text-[#58595B]">Employee ID:</span>
                <span className="font-medium text-[#25294B]">{user.employeeId || "—"}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#808285]/20 flex items-center justify-between">
                <span className="text-[#58595B] text-xs">Status</span>
                <Badge 
                  variant={bookingSummaryPending ? "destructive" : "secondary"} 
                  className="h-6 px-3 py-0.5 rounded-full text-xs font-medium"
                >
                  {bookingSummaryPending ? "Pending" : "Booked"}
                </Badge>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Check-In Summary Modal */}
        <Dialog open={checkInSummaryOpen} onOpenChange={setCheckInSummaryOpen}>
          <DialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>Check-In Summary</DialogTitle>
              <DialogDescription>Your check-in confirmation</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#58595B]">Room:</span>
                <span className="font-medium text-[#25294B]">
                  {checkInSummaryData
                    ? roomLookup[checkInSummaryData.room_id]?.room_name ?? checkInSummaryData.room_id
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Date:</span>
                <span className="font-medium text-[#25294B]">
                  {checkInSummaryData?.date ?? checkInSummaryData?.booking_date ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Time:</span>
                <span className="font-medium text-[#25294B]">
                  {checkInSummaryData ? formatBookingTimeRange(checkInSummaryData) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Checked In:</span>
                <span className="font-medium text-[#25294B]">
                  {checkInSummaryData?.checked_in_at 
                    ? new Date(checkInSummaryData.checked_in_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : checkInSummaryData?.check_in_time
                    ? new Date(checkInSummaryData.check_in_time).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : "—"}
                </span>
              </div>
              {(checkInSummaryData?.booking_reason || checkInSummaryData?.meeting_agenda || checkInSummaryData?.purpose) && (
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Agenda:</span>
                  <span className="font-medium text-[#25294B]">
                    {checkInSummaryData?.booking_reason || checkInSummaryData?.meeting_agenda || checkInSummaryData?.purpose || "—"}
                  </span>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-[#808285]/20 flex items-center justify-between">
                <span className="text-[#58595B] text-xs">Status</span>
                <Badge 
                  variant="secondary" 
                  className="h-6 px-3 py-0.5 rounded-full text-xs font-medium"
                  style={(() => {
                    if (!checkInSummaryData) return undefined
                    const runtimeStatus = resolveBookingRuntimeStatus(checkInSummaryData as any, bookings)
                    const statusColor = getStatusBadgeColor(runtimeStatus)
                    return statusColor ? { backgroundColor: statusColor, color: "white", borderColor: statusColor } : undefined
                  })()}
                >
                  {checkInSummaryData 
                    ? resolveBookingRuntimeStatus(checkInSummaryData as any, bookings)
                    : "Checked-In"}
                </Badge>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                onClick={() => {
                  setCheckInSummaryOpen(false)
                  setCheckInSummaryData(null)
                }}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AMSDashboardLayout>
  )
}
