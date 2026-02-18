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
import { Building2, Calendar, Search, ListChecks, MoreVertical, Filter, Pencil, RotateCcw, X, Trash2, Check, Repeat, Loader2, DoorOpen, Clock, AlertTriangle, Plus, Eye } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { isBookingInProgress, resolveBookingRuntimeStatus } from "@/lib/utils/room-bookings"
import { BUSINESS_START_TIME, BUSINESS_END_TIME, BUSINESS_TIME_PATTERN, isWithinBusinessHours as isBusinessTime, timeStringToMinutes } from "@/lib/utils/business-hours"
import { ROOM_BOOKINGS_STORAGE_KEY, ROOM_BOOKINGS_UPDATED_EVENT } from "@/lib/storage/room-bookings"

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
  checked_in_at?: string | null
  check_in_status?: string | null
  check_in_time?: string | null
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
  checkedInAt?: string | null
  checkInStatus?: string | null
  checkInTime?: string | null
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
  onCheckOut?: () => void
  showCheckOut?: boolean
  onExtendTime?: () => void
  showExtendTime?: boolean
}

const RowActionsMenu = ({
  disabledEdit,
  disabledCancel,
  disabledDelete,
  disabledRebook = false,
  onEdit,
  onReturn,
  onCancel,
  onDelete,
  onCheckOut,
  showCheckOut = false,
  onExtendTime,
  showExtendTime = false,
}: RowActionsMenuProps) => {
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
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
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
            onClick={(event: React.MouseEvent<HTMLDivElement>) => {
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
        {showExtendTime && onExtendTime && (
          <DropdownMenuItem
            onClick={(event: React.MouseEvent<HTMLDivElement>) => {
              event.preventDefault()
              onExtendTime()
            }}
            className="text-slate-700 hover:bg-slate-50"
          >
            <Clock className="mr-2 h-4 w-4" />
            Extend time
          </DropdownMenuItem>
        )}
        {showCheckOut && onCheckOut && (
          <DropdownMenuItem
            onClick={(event: React.MouseEvent<HTMLDivElement>) => {
              event.preventDefault()
              onCheckOut()
            }}
            className="text-emerald-700 hover:bg-emerald-50"
          >
            <DoorOpen className="mr-2 h-4 w-4" />
            Check-out
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
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
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
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
  const [statusFilter, setStatusFilter] = useState<"All" | "Upcoming" | "In Progress" | "Check-out" | "Missed" | "Rescheduled" | "Cancelled" | "Attended">("All")
  const [searchTerm, setSearchTerm] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null)
  const [bookRoomOpen, setBookRoomOpen] = useState(false)
  const [bookingSummaryOpen, setBookingSummaryOpen] = useState(false)
  const [bookingSummaryData, setBookingSummaryData] = useState<Booking | null>(null)
  const [bookingSummaryPending, setBookingSummaryPending] = useState(false)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [rebookingBookingId, setRebookingBookingId] = useState<string | null>(null)
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
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false)
  const [bookingToCheckOut, setBookingToCheckOut] = useState<Booking | null>(null)
  const [checkOutSubmitting, setCheckOutSubmitting] = useState(false)
  const [extendTimeDialogOpen, setExtendTimeDialogOpen] = useState(false)
  const [bookingToExtend, setBookingToExtend] = useState<Booking | null>(null)
  const [extendTimeSubmitting, setExtendTimeSubmitting] = useState(false)
  const [newEndTime, setNewEndTime] = useState("")
  const [extensionConflict, setExtensionConflict] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<{
    roomName: string
    date: string
    time: string
    bookedBy: string
  } | null>(null)
  const [addRoomDialogOpen, setAddRoomDialogOpen] = useState(false)
  const [viewRoomsDialogOpen, setViewRoomsDialogOpen] = useState(false)
  const [allRooms, setAllRooms] = useState<RoomRecord[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [editingRoom, setEditingRoom] = useState<RoomRecord | null>(null)
  const [roomForm, setRoomForm] = useState({
    room_name: "",
    room_code: "",
    location: "",
    floor: "",
    capacity: "",
    description: "",
    is_available: true,
    features: [] as string[],
    booking_notes: "",
  })
  const [roomFormErrors, setRoomFormErrors] = useState<Record<string, string>>({})
  const [submittingRoom, setSubmittingRoom] = useState(false)
  const [editingRoomForm, setEditingRoomForm] = useState<{
    room_name: string
    room_code: string
    location: string
    floor: string
    capacity: string
    description: string
    is_available: boolean
    features: string[]
    booking_notes: string
  }>({
    room_name: "",
    room_code: "",
    location: "",
    floor: "",
    capacity: "",
    description: "",
    is_available: true,
    features: [],
    booking_notes: "",
  })
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
        // Sort by date first (descending - latest first)
        const aDate = a.date ?? a.booking_date ?? ''
        const bDate = b.date ?? b.booking_date ?? ''
        if (aDate !== bDate) {
          return bDate.localeCompare(aDate)
        }
        // If same date, sort by start time (descending - latest first)
        const aTime = a.original_start_time ? new Date(a.original_start_time).getTime() : 0
        const bTime = b.original_start_time ? new Date(b.original_start_time).getTime() : 0
        return bTime - aTime
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

  const loadAllRooms = useCallback(async () => {
    setRoomsLoading(true)
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
      setAllRooms(records)
      // Also update room lookup
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
    } finally {
      setRoomsLoading(false)
    }
  }, [toast])

  const validateRoomForm = () => {
    const errors: Record<string, string> = {}
    if (!roomForm.room_name.trim()) {
      errors.room_name = "Room name is required"
    }
    if (roomForm.capacity && (isNaN(Number(roomForm.capacity)) || Number(roomForm.capacity) < 0)) {
      errors.capacity = "Capacity must be a positive number"
    }
    return errors
  }

  const handleAddRoomSubmit = async () => {
    const errors = validateRoomForm()
    setRoomFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      toast({
        variant: "destructive",
        title: "Cannot add room",
        description: "Please resolve the highlighted fields.",
      })
      return
    }

    setSubmittingRoom(true)
    try {
      const payload: any = {
        room_name: roomForm.room_name.trim(),
        is_available: roomForm.is_available,
      }
      
      if (roomForm.room_code.trim()) payload.room_code = roomForm.room_code.trim()
      if (roomForm.location.trim()) payload.location = roomForm.location.trim()
      if (roomForm.floor.trim()) payload.floor = roomForm.floor.trim()
      if (roomForm.capacity) payload.capacity = Number(roomForm.capacity)
      if (roomForm.description.trim()) payload.description = roomForm.description.trim()
      if (roomForm.features.length > 0) payload.features = roomForm.features
      if (roomForm.booking_notes.trim()) payload.booking_notes = roomForm.booking_notes.trim()

      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = await response.json().catch(() => ({}))
      
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to create room")
      }

      toast({
        title: "Room added successfully",
        description: `${roomForm.room_name} has been added to the system.`,
      })

      // Reset form
      setRoomForm({
        room_name: "",
        room_code: "",
        location: "",
        floor: "",
        capacity: "",
        description: "",
        is_available: true,
        features: [],
        booking_notes: "",
      })
      setRoomFormErrors({})
      setAddRoomDialogOpen(false)
      
      // Reload rooms
      await loadRooms()
      await loadAllRooms()
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Unable to add room",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setSubmittingRoom(false)
    }
  }

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
        setRoomLookup((prev: Record<string, RoomRecord>) => {
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
    setBookingForm((prev: typeof bookingForm) => ({
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
      meetingCategory: booking.meeting_category || "",
      agenda: booking.booking_reason || booking.meeting_agenda || booking.purpose || "",
      date: booking.date ?? booking.booking_date ?? "",
      startTime: booking.start_time || toHHMM(booking.original_start_time),
      endTime: booking.end_time || toHHMM(booking.original_end_time),
    })
    setEditingBookingId(booking.id)
    setRebookingBookingId(null)
    setBookingErrors({})
    setBookRoomOpen(true)
  }

  const handleReBookBooking = (booking: Booking) => {
    setBookingForm({
      room: booking.room_id,
      meetingType: "",
      meetingCategory: booking.meeting_category || "",
      agenda: booking.booking_reason || booking.meeting_agenda || booking.purpose || "",
      date: booking.date ?? booking.booking_date ?? "",
      startTime: booking.start_time || toHHMM(booking.original_start_time),
      endTime: booking.end_time || toHHMM(booking.original_end_time),
    })
    setRebookingBookingId(booking.id)
    setEditingBookingId(booking.id)
    setBookingErrors({})
    setBookRoomOpen(true)
  }

  const handleExtendTime = (booking: Booking) => {
    if (!booking) return
    setBookingToExtend(booking)
    const currentEndTime = booking.end_time || toHHMM(booking.original_end_time)
    setNewEndTime(currentEndTime)
    setExtensionConflict(null)
    setExtendTimeDialogOpen(true)
  }

  const handleQuickExtension = (minutes: number) => {
    if (!bookingToExtend) return
    const currentEndTime = bookingToExtend.end_time || toHHMM(bookingToExtend.original_end_time)
    const [hours, mins] = currentEndTime.split(":").map(Number)
    const currentTotalMinutes = hours * 60 + mins
    const newTotalMinutes = currentTotalMinutes + minutes
    const newHours = Math.floor(newTotalMinutes / 60)
    const newMins = newTotalMinutes % 60
    const newTime = `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
    setNewEndTime(newTime)
    checkExtensionConflict(newTime)
  }

  const checkExtensionConflict = async (endTime: string) => {
    if (!bookingToExtend) {
      setExtensionConflict(null)
      return
    }
    // Check if the new end time conflicts with other bookings in the same room
    const bookingDate = bookingToExtend.date ?? bookingToExtend.booking_date
    const startTime = bookingToExtend.start_time || toHHMM(bookingToExtend.original_start_time)
    
    // Check if new end time is after current end time
    const currentEndTime = bookingToExtend.end_time || toHHMM(bookingToExtend.original_end_time)
    const [currentHours, currentMins] = currentEndTime.split(":").map(Number)
    const [newHours, newMins] = endTime.split(":").map(Number)
    const currentTotal = currentHours * 60 + currentMins
    const newTotal = newHours * 60 + newMins
    
    if (newTotal <= currentTotal) {
      setExtensionConflict("New end time must be after current end time")
      return
    }

    // Check for conflicts with other bookings
    try {
      const response = await fetch(`/api/room-bookings?room_id=${bookingToExtend.room_id}&date=${bookingDate}`)
      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        const conflictingBooking = json.data.find((b: any) => {
          if (b.id === bookingToExtend.id || b.booking_id === bookingToExtend.id) return false
          const otherStart = b.start_time || (b.original_start_time ? toHHMM(b.original_start_time) : "")
          const otherEnd = b.end_time || (b.original_end_time ? toHHMM(b.original_end_time) : "")
          if (!otherStart || !otherEnd) return false
          const [otherStartH, otherStartM] = otherStart.split(":").map(Number)
          const [otherEndH, otherEndM] = otherEnd.split(":").map(Number)
          const otherStartTotal = otherStartH * 60 + otherStartM
          const otherEndTotal = otherEndH * 60 + otherEndM
          const newEndTotal = newHours * 60 + newMins
          // Check if new end time overlaps with another booking
          return newEndTotal > otherStartTotal && newEndTotal <= otherEndTotal
        })
        if (conflictingBooking) {
          setExtensionConflict(`Conflicts with another booking in this room`)
        } else {
          setExtensionConflict(null)
        }
      }
    } catch (error) {
      console.error("Failed to check extension conflict:", error)
      setExtensionConflict(null)
    }
  }

  const handleConfirmExtendTime = async () => {
    if (!bookingToExtend || !newEndTime) return
    if (extensionConflict) return
    
    const currentEndTime = bookingToExtend.end_time || toHHMM(bookingToExtend.original_end_time)
    if (newEndTime === currentEndTime) return

    setExtendTimeSubmitting(true)
    try {
      const response = await fetch(`/api/room-bookings/${bookingToExtend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end_time: newEndTime }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to extend booking time")
      }

      await loadUserBookings()
      
      // Notify dashboard to refresh room bookings
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ROOM_BOOKINGS_STORAGE_KEY)
        window.dispatchEvent(new CustomEvent(ROOM_BOOKINGS_UPDATED_EVENT))
      }
      
      setExtendTimeDialogOpen(false)
      setBookingToExtend(null)
      setNewEndTime("")
      setExtensionConflict(null)
      
      toast({
        title: "Booking extended",
        description: "The meeting time has been extended successfully.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to extend booking",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setExtendTimeSubmitting(false)
    }
  }

  const openCheckInDialog = (booking: Booking) => {
    setBookingToCheckIn(booking)
    setCheckInDialogOpen(true)
  }

  const handleConfirmCheckIn = async () => {
    if (!bookingToCheckIn) return
    setCheckInSubmitting(true)
    try {
      const now = new Date()
      
      // Check if meeting has ended
      const bookingDate = bookingToCheckIn.date ?? bookingToCheckIn.booking_date
      const endTime = bookingToCheckIn.end_time || toHHMM(bookingToCheckIn.original_end_time)
      if (bookingDate && endTime) {
        const [hours, minutes] = endTime.split(":").map(Number)
        const meetingEnd = new Date(`${bookingDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
        if (now > meetingEnd) {
          toast({
            variant: 'destructive',
            title: 'Meeting ended',
            description: 'This meeting has already ended.',
          })
          setCheckInDialogOpen(false)
          setBookingToCheckIn(null)
          return
        }
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

      // Update status to "Confirmed" after check-in
      const updateResponse = await fetch(`/api/room-bookings/${bookingToCheckIn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      })
      const updateJson = await updateResponse.json().catch(() => ({}))
      if (!updateResponse.ok || updateJson.success === false) {
        console.warn("Failed to update status to confirmed:", updateJson?.error)
      }

      // Reload bookings to get updated data
      await loadUserBookings()
      
      // Get the updated booking data
      const updatedBooking = checkInJson.data?.booking ? normalizeBookingRecord(checkInJson.data.booking as BookingRecord) : bookingToCheckIn
      
      // Ensure status is set to "Confirmed" in the booking object
      const confirmedBooking = {
        ...updatedBooking,
        status: "confirmed",
      }
      
      // Notify dashboard to refresh room bookings (remove from meeting check-in section)
      if (typeof window !== 'undefined') {
        // Clear localStorage cache for room bookings so dashboard fetches fresh data
        window.localStorage.removeItem(ROOM_BOOKINGS_STORAGE_KEY)
        // Dispatch event to notify dashboard (if open) to refresh
        window.dispatchEvent(new CustomEvent(ROOM_BOOKINGS_UPDATED_EVENT))
      }
      
      // Close confirmation dialog and show summary
      setCheckInDialogOpen(false)
      setCheckInSummaryData(confirmedBooking)
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

  const handleCheckOut = (booking: Booking) => {
    if (!booking) {
      toast({
        variant: "destructive",
        title: "Cannot check out",
        description: "Booking information is missing.",
      })
      return
    }
    setBookingToCheckOut(booking)
    setCheckOutDialogOpen(true)
  }

  const handleConfirmCheckOut = async () => {
    if (!bookingToCheckOut) return
    setCheckOutSubmitting(true)
    try {
      const timestamp = new Date().toISOString()
      const response = await fetch(`/api/room-bookings/${bookingToCheckOut.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "Checked out",
          checked_out_at: timestamp,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to check out")
      }

      await loadUserBookings()
      
      // Notify dashboard to refresh room bookings
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ROOM_BOOKINGS_STORAGE_KEY)
        window.dispatchEvent(new CustomEvent(ROOM_BOOKINGS_UPDATED_EVENT))
      }
      
      setCheckOutDialogOpen(false)
      setBookingToCheckOut(null)
      
      toast({
        title: "Checked out",
        description: "You have successfully checked out of the meeting.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to check out",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setCheckOutSubmitting(false)
    }
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

  const toTitleCase = (str?: string | null) => {
    if (!str) return ""
    return str
      .toLowerCase()
      .split(/\s+|_/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  type BookingRow = {
    id: string
    room: string
    category: string
    type: string
    agenda: string
    date: string
    start: string
    end: string
    status: string
  }

  // Map bookings to rows format for display
  const rows = bookings.map((booking: Booking) => {
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

  const filtered = rows.filter((r: BookingRow) => {
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
    if (statusFilter === "Check-out") {
      return statusLower.includes("in progress")
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

  const checkForBookingConflict = async (): Promise<boolean> => {
    if (!bookingForm.room || !bookingForm.date || !bookingForm.startTime || !bookingForm.endTime) {
      return false
    }

    try {
      // Check for existing bookings in the same room at the same time
      // Use roomId parameter (not room_id) as per API
      const params = new URLSearchParams({
        roomId: bookingForm.room,
        date: bookingForm.date,
      })

      const response = await fetch(`/api/room-bookings?${params.toString()}`)
      if (!response.ok) {
        console.error("Failed to fetch bookings for conflict check:", response.statusText)
        return false
      }

      const json = await response.json()
      console.log("[Conflict Check] API Response:", json)
      
      if (json.success && Array.isArray(json.data)) {
        const [startHours, startMins] = bookingForm.startTime.split(":").map(Number)
        const [endHours, endMins] = bookingForm.endTime.split(":").map(Number)
        const newStartTotal = startHours * 60 + startMins
        const newEndTotal = endHours * 60 + endMins

        console.log("[Conflict Check] Checking bookings:", json.data.length, "bookings found")
        console.log("[Conflict Check] New booking time:", bookingForm.startTime, "-", bookingForm.endTime)

        const conflictingBooking = json.data.find((b: any) => {
          // Skip if this is the booking being edited
          if (editingBookingId && (b.booking_id === editingBookingId || b.id === editingBookingId)) {
            return false
          }
          
          // Get start and end times from the booking
          const otherStart = b.start_time || ""
          const otherEnd = b.end_time || ""
          
          if (!otherStart || !otherEnd) {
            console.log("[Conflict Check] Booking missing times:", b.booking_id)
            return false
          }
          
          const [otherStartH, otherStartM] = otherStart.split(":").map(Number)
          const [otherEndH, otherEndM] = otherEnd.split(":").map(Number)
          
          if (isNaN(otherStartH) || isNaN(otherStartM) || isNaN(otherEndH) || isNaN(otherEndM)) {
            console.log("[Conflict Check] Invalid time format:", otherStart, otherEnd)
            return false
          }
          
          const otherStartTotal = otherStartH * 60 + otherStartM
          const otherEndTotal = otherEndH * 60 + otherEndM
          
          // Check if time ranges overlap
          // Two ranges overlap if: newStart < otherEnd AND newEnd > otherStart
          const overlaps = newStartTotal < otherEndTotal && newEndTotal > otherStartTotal
          
          if (overlaps) {
            console.log("[Conflict Check] CONFLICT FOUND:", {
              bookingId: b.booking_id,
              otherTime: `${otherStart} - ${otherEnd}`,
              newTime: `${bookingForm.startTime} - ${bookingForm.endTime}`
            })
          }
          
          return overlaps
        })

        if (conflictingBooking) {
          const roomName = roomLookup[bookingForm.room]?.room_name || "this room"
          const bookedByName = conflictingBooking.employee_name || 
                               conflictingBooking.booked_by_name || 
                               "Another user"
          const conflictStart = conflictingBooking.start_time || ""
          const conflictEnd = conflictingBooking.end_time || ""
          const conflictTime = conflictStart && conflictEnd ? `${conflictStart} - ${conflictEnd}` : "—"

          console.log("[Conflict Check] Setting conflict details:", {
            roomName,
            date: bookingForm.date,
            time: conflictTime,
            bookedBy: bookedByName,
          })

          setConflictDetails({
            roomName,
            date: bookingForm.date,
            time: conflictTime,
            bookedBy: bookedByName,
          })
          setConflictDialogOpen(true)
          return true
        } else {
          console.log("[Conflict Check] No conflicts found")
        }
      } else {
        console.error("[Conflict Check] Invalid API response:", json)
      }
    } catch (error) {
      console.error("[Conflict Check] Error checking for booking conflict:", error)
    }
    
    return false
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

    // Check for conflicts before submitting
    console.log("[Booking Submit] Starting conflict check...")
    const hasConflict = await checkForBookingConflict()
    console.log("[Booking Submit] Conflict check result:", hasConflict)
    if (hasConflict) {
      console.log("[Booking Submit] Conflict detected, showing dialog and stopping submission")
      setSubmitting(false) // Make sure submitting is false so user can try again
      return // Conflict dialog will be shown
    }
    console.log("[Booking Submit] No conflict, proceeding with submission")

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
        console.log("[Booking Submit] 409 Conflict Error:", errorMessage)
        
        // Parse error message to extract conflict details
        const conflictMatch = errorMessage.match(/booked by (.+?) from (.+?) to (.+?)/i)
        if (conflictMatch) {
          const [, bookedByName, conflictStart, conflictEnd] = conflictMatch
          console.log("[Booking Submit] Parsed conflict details:", { bookedByName, conflictStart, conflictEnd })
          setConflictDetails({
            roomName: roomLookup[bookingForm.room]?.room_name || "this room",
            date: bookingForm.date,
            time: `${conflictStart} - ${conflictEnd}`,
            bookedBy: bookedByName,
          })
          setConflictDialogOpen(true)
          console.log("[Booking Submit] Conflict dialog should now be open")
        } else {
          // Even if we can't parse the details, show the conflict dialog with available info
          console.log("[Booking Submit] Could not parse conflict details, showing generic conflict dialog")
          setConflictDetails({
            roomName: roomLookup[bookingForm.room]?.room_name || "this room",
            date: bookingForm.date,
            time: `${bookingForm.startTime} - ${bookingForm.endTime}`,
            bookedBy: errorMessage.includes("already have a booking") ? "You" : "Another user",
          })
          setConflictDialogOpen(true)
        }
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
      setRebookingBookingId(null)
      toast({
        title: rebookingBookingId ? "Meeting re-booked" : isEditing ? "Booking updated" : "Room booked",
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

  // Check-out dialog variables
  const checkOutRoomName = bookingToCheckOut
    ? roomLookup[bookingToCheckOut.room_id]?.room_name ?? bookingToCheckOut.room_id
    : "—"
  const checkOutDate = bookingToCheckOut?.date ?? bookingToCheckOut?.booking_date ?? "—"
  const checkOutTime = formatBookingTimeRange(bookingToCheckOut)
  const checkOutAgenda =
    bookingToCheckOut?.booking_reason ||
    bookingToCheckOut?.meeting_agenda ||
    bookingToCheckOut?.purpose ||
    "Not provided"
  const checkOutCheckedInTime = bookingToCheckOut?.checked_in_at 
    ? new Date(bookingToCheckOut.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : "—"
  const checkOutOrganizer = (bookingToCheckOut as any)?.booked_by_name || (bookingToCheckOut as any)?.employee_name || "—"
  const checkOutStatus = bookingToCheckOut?.status || "Checked in"

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Room Booking</h1>
          <p className="text-muted-foreground mt-1">Review upcoming meetings, manage reservations, and check in when you arrive.</p>
        </div>

        {/* Actions Button */}
        <div className="space-y-4">
          <div className="flex flex-row items-center justify-end gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 h-10 px-4"
                >
                  Actions
                  <MoreVertical className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                  {normalizedRole === "supervisor" && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setActiveAction("add-room")
                          setAddRoomDialogOpen(true)
                        }}
                        className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          activeAction === "add-room"
                            ? "bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Room
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setActiveAction("view-rooms")
                          setViewRoomsDialogOpen(true)
                          loadAllRooms()
                        }}
                        className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          activeAction === "view-rooms"
                            ? "bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Rooms
                      </DropdownMenuItem>
                    </>
                  )}
              {!isEmployee && (
                <>
                  {normalizedRole === "supervisor" ? (
                        <DropdownMenuItem
                          onClick={() => {
                            setActiveAction("booking-history")
                            window.location.href = "/ams-supervisor/booking-history"
                          }}
                          className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            activeAction === "booking-history"
                              ? "bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                      >
                        <ListChecks className="h-4 w-4 mr-2" />
                        Room Booking History
                        </DropdownMenuItem>
                  ) : (
                        <DropdownMenuItem
                          onClick={() => {
                            setActiveAction("booking-history")
                            setShowHistory(!showHistory)
                          }}
                          className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            activeAction === "booking-history" || showHistory
                              ? "bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                    >
                      <ListChecks className="h-4 w-4 mr-2" />
                      Room Booking History
                        </DropdownMenuItem>
                  )}
                </>
              )}
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveAction("book-room")
                      setBookRoomOpen(true)
                    }}
                    className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      activeAction === "book-room"
                        ? "bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Book a Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>

              <Dialog
                open={bookRoomOpen}
            onOpenChange={(open: boolean) => {
                  setBookRoomOpen(open)
              if (!open) {
                setActiveAction(null)
              }
                  if (open) {
                    if (!editingBookingId) {
                  setBookingForm((prev: typeof bookingForm) => ({
                        ...prev,
                        date: prev.date || new Date().toISOString().split("T")[0],
                        startTime: prev.startTime || "12:00",
                        endTime: prev.endTime || "13:00",
                      }))
                    }
                  } else {
                    setBookingErrors({})
                    setEditingBookingId(null)
                    setRebookingBookingId(null)
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
              <DialogContent className="sm:max-w-lg space-y-4">
                <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
                  <DialogTitle>{rebookingBookingId ? "Re-Book Meeting" : editingBookingId ? "Edit Booking" : "Book a Room"}</DialogTitle>
                  <DialogDescription>{rebookingBookingId ? "Reschedule your meeting by updating the date, time, or room." : "Provide booking details"}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
                  <div>
                    <Label>Room Selection</Label>
                    <Select
                      value={bookingForm.room}
                      onValueChange={(value: string) => updateFormWithValidation({ room: value })}
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
                          availableRooms.map((room: RoomRecord) => (
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
                      <Select value={bookingForm.meetingType} onValueChange={(value: string) => updateFormWithValidation({ meetingType: value })}>
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
                        onValueChange={(value: string) => updateFormWithValidation({ meetingCategory: value as "Internal" | "External" })}
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
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBookingForm((prev: typeof bookingForm) => ({ ...prev, agenda: e.target.value }))}
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={bookingForm.date}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormWithValidation({ date: e.target.value })}
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
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormWithValidation({ startTime: e.target.value })}
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
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormWithValidation({ endTime: e.target.value })}
                        className={bookingErrors.endTime ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                      />
                      {bookingErrors.endTime && <p className="text-xs text-destructive mt-1">{bookingErrors.endTime}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="outline" disabled={submitting}>Cancel</Button>
                    </DialogClose>
                    <Button
                      type="button"
                      className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleBookingFormSubmit}
                      disabled={submitting || !bookingFormReady}
                    >
                      {submitting ? "Saving..." : rebookingBookingId ? "Re-Book Meeting" : editingBookingId ? "Update Booking" : "Book Room"}
                    </Button>
                  </div>
                </div>
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
                      placeholder="Search bookings..."
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      className="pl-8 uniform-input"
                    />
                  </div>
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value: string) => setStatusFilter(value as "All" | "Upcoming" | "In Progress" | "Check-out" | "Missed" | "Rescheduled" | "Cancelled" | "Attended")}
                >
                  <SelectTrigger className="w-full md:w-48 uniform-input">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All bookings</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Check-out">Check-out</SelectItem>
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
                    {filtered.map((r: BookingRow, index: number) => {
                      const booking = bookings.find((b: Booking) => b.id === r.id || b.booking_id === r.id)
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
                      
                      const isMissed = statusLower.includes('missed')
                      const canCancel = Boolean(
                        booking && 
                        !isAttended && 
                        !isMissed && 
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

                      const canExtendTime = Boolean(
                        booking &&
                        (isUpcoming || isInProgress) &&
                        !isAttended &&
                        !isMissed &&
                        !statusLower.includes('cancelled')
                      )
                      
                      const deleteDisabled = !canDelete
                      const showCheckInButton = booking ? canCheckInBooking(booking, r.status) : false
                      
                      // Check if booking is checked in
                      const isCheckedIn = booking ? Boolean(
                        booking.checked_in_at || 
                        booking.check_in_time ||
                        booking.check_in_status === 'Checked-In'
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
                                onReturn={() => booking && handleReBookBooking(booking)}
                                onCancel={() => booking && handleCancelClick(booking)}
                                onDelete={() => booking && handleDeleteClick(booking)}
                                onCheckOut={() => booking && handleCheckOut(booking)}
                                showCheckOut={isInProgress}
                                onExtendTime={() => booking && handleExtendTime(booking)}
                                showExtendTime={canExtendTime}
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
          onOpenChange={(open: boolean) => {
            setCheckInDialogOpen(open)
            if (!open) {
              setBookingToCheckIn(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>Check in confirmation</DialogTitle>
              <DialogDescription>Are you sure you want to check in?</DialogDescription>
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

        {/* Check-out Confirmation Dialog */}
        <Dialog
          open={checkOutDialogOpen}
          onOpenChange={(open: boolean) => {
            setCheckOutDialogOpen(open)
            if (!open) {
              setBookingToCheckOut(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>Check out confirmation</DialogTitle>
              <DialogDescription>Are you sure you want to check-out?</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Room</span>
                <span className="font-medium text-[#25294B]">{checkOutRoomName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Meeting title / Purpose</span>
                <span className="font-medium text-[#25294B]">{checkOutAgenda}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-[#25294B]">{checkOutDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Start time – End time</span>
                <span className="font-medium text-[#25294B]">{checkOutTime}</span>
              </div>
              {checkOutCheckedInTime !== "—" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Checked-in time</span>
                  <span className="font-medium text-[#25294B]">{checkOutCheckedInTime}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Organizer / Booker</span>
                <span className="font-medium text-[#25294B]">{checkOutOrganizer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-[#25294B]">{checkOutStatus}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setCheckOutDialogOpen(false)} disabled={checkOutSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white disabled:opacity-60"
                onClick={handleConfirmCheckOut}
                disabled={checkOutSubmitting || !bookingToCheckOut}
              >
                {checkOutSubmitting ? "Checking Out…" : "Confirm"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Extend Time Dialog */}
        <Dialog
          open={extendTimeDialogOpen}
          onOpenChange={(open: boolean) => {
            setExtendTimeDialogOpen(open)
            if (!open) {
              setBookingToExtend(null)
              setNewEndTime("")
              setExtensionConflict(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>Extend booking time</DialogTitle>
              <DialogDescription>Select how much additional time you need</DialogDescription>
            </DialogHeader>
            
            {bookingToExtend && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#E4E4E7] bg-white p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current end time</span>
                    <span className="font-medium text-[#25294B]">
                      {bookingToExtend.end_time || toHHMM(bookingToExtend.original_end_time)}
                    </span>
                  </div>
                </div>

                {/* Quick Extension Buttons */}
                <div className="space-y-2">
                  <Label>Quick extension</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickExtension(15)}
                      className="flex-1"
                    >
                      +15 minutes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickExtension(30)}
                      className="flex-1"
                    >
                      +30 minutes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickExtension(60)}
                      className="flex-1"
                    >
                      +1 hour
                    </Button>
                  </div>
                </div>

                {/* New End Time Selector */}
                <div className="space-y-2">
                  <Label htmlFor="newEndTime">New end time</Label>
                  <Input
                    id="newEndTime"
                    type="time"
                    value={newEndTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setNewEndTime(e.target.value)
                      checkExtensionConflict(e.target.value)
                    }}
                    className="w-full"
                  />
                  {extensionConflict && (
                    <p className="text-xs text-destructive">{extensionConflict}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setExtendTimeDialogOpen(false)} disabled={extendTimeSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white disabled:opacity-60"
                onClick={handleConfirmExtendTime}
                disabled={
                  extendTimeSubmitting ||
                  !bookingToExtend ||
                  !newEndTime ||
                  newEndTime === (bookingToExtend.end_time || toHHMM(bookingToExtend.original_end_time)) ||
                  !!extensionConflict
                }
              >
                {extendTimeSubmitting ? "Extending…" : "Confirm extension"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog 
          open={cancelDialogOpen} 
          onOpenChange={(open: boolean) => {
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
          onOpenChange={(open: boolean) => {
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
                  style={(() => {
                    const status = bookingSummaryData?.status 
                      ? bookingSummaryData.status 
                      : bookingSummaryPending 
                        ? "Pending" 
                        : "Booked"
                    const color = getStatusBadgeColor(status)
                    return color ? {
                      backgroundColor: color,
                      color: "white",
                      borderColor: color,
                    } : undefined
                  })()}
                >
                  {bookingSummaryPending ? "Pending" : (bookingSummaryData?.status ? toTitleCase(bookingSummaryData.status) : "Booked")}
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

        {/* Booking Conflict Alert Dialog */}
        <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <AlertDialogTitle className="text-xl font-semibold text-[#25294B]">
                    Room Already Booked
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-[#58595B] mt-1">
                    This room is already booked for the selected time slot.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            
            {conflictDetails && (
              <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-[#58595B]">Room:</span>
                  <span className="text-sm font-semibold text-[#25294B] text-right">{conflictDetails.roomName}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-[#58595B]">Date:</span>
                  <span className="text-sm font-semibold text-[#25294B] text-right">
                    {new Date(conflictDetails.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-[#58595B]">Time:</span>
                  <span className="text-sm font-semibold text-[#25294B] text-right">{conflictDetails.time}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-[#58595B]">Booked by:</span>
                  <span className="text-sm font-semibold text-[#25294B] text-right">{conflictDetails.bookedBy}</span>
                </div>
              </div>
            )}

            <div className="mt-4 text-sm text-[#58595B]">
              Please select a different time slot or choose another room.
            </div>

            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel 
                onClick={() => {
                  setConflictDialogOpen(false)
                  setConflictDetails(null)
                }}
                className="border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB]"
              >
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Room Dialog */}
        <Dialog open={addRoomDialogOpen} onOpenChange={(open) => {
          setAddRoomDialogOpen(open)
          if (!open) {
            setActiveAction(null)
          }
        }}>
          <DialogContent className="sm:max-w-lg space-y-4">
            <DialogHeader>
              <DialogTitle>Add New Room</DialogTitle>
              <DialogDescription>Enter the details for the new room</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="room_name">Room Name *</Label>
                <Input
                  id="room_name"
                  value={roomForm.room_name}
                  onChange={(e) => {
                    setRoomForm({ ...roomForm, room_name: e.target.value })
                    if (roomFormErrors.room_name) {
                      setRoomFormErrors({ ...roomFormErrors, room_name: "" })
                    }
                  }}
                  className={roomFormErrors.room_name ? "border-destructive" : ""}
                  placeholder="e.g., Conference Room A"
                />
                {roomFormErrors.room_name && (
                  <p className="text-xs text-destructive mt-1">{roomFormErrors.room_name}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="room_code">Room Code</Label>
                  <Input
                    id="room_code"
                    value={roomForm.room_code}
                    onChange={(e) => setRoomForm({ ...roomForm, room_code: e.target.value })}
                    placeholder="e.g., CR-A"
                  />
                </div>
                <div>
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="0"
                    value={roomForm.capacity}
                    onChange={(e) => {
                      setRoomForm({ ...roomForm, capacity: e.target.value })
                      if (roomFormErrors.capacity) {
                        setRoomFormErrors({ ...roomFormErrors, capacity: "" })
                      }
                    }}
                    className={roomFormErrors.capacity ? "border-destructive" : ""}
                    placeholder="e.g., 10"
                  />
                  {roomFormErrors.capacity && (
                    <p className="text-xs text-destructive mt-1">{roomFormErrors.capacity}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={roomForm.location}
                    onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })}
                    placeholder="e.g., Building A"
                  />
                </div>
                <div>
                  <Label htmlFor="floor">Floor</Label>
                  <Input
                    id="floor"
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                    placeholder="e.g., 2nd Floor"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  placeholder="Room description or features"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={roomForm.is_available}
                  onChange={(e) => setRoomForm({ ...roomForm, is_available: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_available" className="text-sm font-normal cursor-pointer">
                  Room is available for booking
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddRoomDialogOpen(false)
                  setRoomForm({
                    room_name: "",
                    room_code: "",
                    location: "",
                    floor: "",
                    capacity: "",
                    description: "",
                    is_available: true,
                    features: [],
                    booking_notes: "",
                  })
                  setRoomFormErrors({})
                }}
                disabled={submittingRoom}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddRoomSubmit}
                disabled={submittingRoom || !roomForm.room_name.trim()}
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
              >
                {submittingRoom ? "Adding..." : "Add Room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Rooms Dialog - Editable for Supervisors */}
        <Dialog open={viewRoomsDialogOpen} onOpenChange={(open) => {
          setViewRoomsDialogOpen(open)
          if (!open) {
            setActiveAction(null)
            setEditingRoom(null)
            setEditingRoomForm({
              room_name: "",
              room_code: "",
              location: "",
              floor: "",
              capacity: "",
              description: "",
              is_available: true,
              features: [],
              booking_notes: "",
            })
          }
        }}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>View & Manage Rooms</DialogTitle>
              <DialogDescription>
                {normalizedRole === "supervisor" 
                  ? "View and edit room details. All fields are editable for supervisors."
                  : "View all available rooms"}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {roomsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#92278F] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading rooms...</p>
                </div>
              ) : allRooms.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No rooms found</p>
                </div>
              ) : editingRoom ? (
                <div className="space-y-6">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-[#25294B]">Edit Room: {editingRoom.room_name}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="edit_room_name">Room Name / Room Number *</Label>
                      <Input
                        id="edit_room_name"
                        value={editingRoomForm.room_name}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, room_name: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., Conference Room A"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_room_code">Room Code</Label>
                      <Input
                        id="edit_room_code"
                        value={editingRoomForm.room_code}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, room_code: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., CR-A"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_capacity">Capacity</Label>
                      <Input
                        id="edit_capacity"
                        type="number"
                        min="0"
                        value={editingRoomForm.capacity}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, capacity: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_location">Location</Label>
                      <Input
                        id="edit_location"
                        value={editingRoomForm.location}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, location: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., Building A"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_floor">Floor</Label>
                      <Input
                        id="edit_floor"
                        value={editingRoomForm.floor}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, floor: e.target.value })}
                        className="mt-1"
                        placeholder="e.g., 2nd Floor"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_availability">Availability Status</Label>
                      <div className="mt-2 flex items-center space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="availability"
                            checked={editingRoomForm.is_available}
                            onChange={() => setEditingRoomForm({ ...editingRoomForm, is_available: true })}
                            className="h-4 w-4 text-[#92278F]"
                          />
                          <span className="text-sm">Available</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="availability"
                            checked={!editingRoomForm.is_available}
                            onChange={() => setEditingRoomForm({ ...editingRoomForm, is_available: false })}
                            className="h-4 w-4 text-[#92278F]"
                          />
                          <span className="text-sm">Unavailable</span>
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit_features">Equipment / Features</Label>
                      <Textarea
                        id="edit_features"
                        value={editingRoomForm.features.join(", ")}
                        onChange={(e) => {
                          const features = e.target.value.split(",").map(f => f.trim()).filter(f => f)
                          setEditingRoomForm({ ...editingRoomForm, features })
                        }}
                        className="mt-1"
                        placeholder="e.g., Projector, Whiteboard, Video Conference, WiFi (comma-separated)"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Enter features separated by commas</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit_description">Description</Label>
                      <Textarea
                        id="edit_description"
                        value={editingRoomForm.description}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, description: e.target.value })}
                        className="mt-1"
                        placeholder="Room description"
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit_booking_notes">Booking / Restriction Notes</Label>
                      <Textarea
                        id="edit_booking_notes"
                        value={editingRoomForm.booking_notes}
                        onChange={(e) => setEditingRoomForm({ ...editingRoomForm, booking_notes: e.target.value })}
                        className="mt-1"
                        placeholder="Any special booking restrictions, notes, or requirements"
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingRoom(null)
                        setEditingRoomForm({
                          room_name: "",
                          room_code: "",
                          location: "",
                          floor: "",
                          capacity: "",
                          description: "",
                          is_available: true,
                          features: [],
                          booking_notes: "",
                        })
                      }}
                      disabled={submittingRoom}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!editingRoom) return
                        setSubmittingRoom(true)
                        try {
                          const payload: any = {
                            id: editingRoom.id,
                            room_name: editingRoomForm.room_name.trim(),
                            is_available: editingRoomForm.is_available,
                          }
                          if (editingRoomForm.room_code.trim()) payload.room_code = editingRoomForm.room_code.trim()
                          if (editingRoomForm.location.trim()) payload.location = editingRoomForm.location.trim()
                          if (editingRoomForm.floor.trim()) payload.floor = editingRoomForm.floor.trim()
                          if (editingRoomForm.capacity) payload.capacity = Number(editingRoomForm.capacity)
                          if (editingRoomForm.description.trim()) payload.description = editingRoomForm.description.trim()
                          if (editingRoomForm.features.length > 0) payload.features = editingRoomForm.features
                          if (editingRoomForm.booking_notes.trim()) payload.booking_notes = editingRoomForm.booking_notes.trim()

                          const response = await fetch("/api/rooms", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          })

                          const json = await response.json()
                          if (!response.ok || json.success === false) {
                            throw new Error(json?.error || "Failed to update room")
                          }

                          toast({
                            title: "Room updated successfully",
                            description: `${editingRoomForm.room_name} has been updated.`,
                          })

                          setEditingRoom(null)
                          setEditingRoomForm({
                            room_name: "",
                            room_code: "",
                            location: "",
                            floor: "",
                            capacity: "",
                            description: "",
                            is_available: true,
                            features: [],
                            booking_notes: "",
                          })
                          await loadAllRooms()
                          await loadRooms()
                        } catch (error) {
                          toast({
                            variant: "destructive",
                            title: "Unable to update room",
                            description: error instanceof Error ? error.message : "Please try again later.",
                          })
                        } finally {
                          setSubmittingRoom(false)
                        }
                      }}
                      disabled={submittingRoom || !editingRoomForm.room_name.trim()}
                      className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                    >
                      {submittingRoom ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#92278F]/5">
                        <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">Room Name</TableHead>
                        <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">Room Code</TableHead>
                        <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">Location</TableHead>
                        <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">Floor</TableHead>
                        <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">Capacity</TableHead>
                        <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">Status</TableHead>
                        {normalizedRole === "supervisor" && (
                          <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4 text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allRooms.map((room) => (
                        <TableRow key={room.id} className="hover:bg-[#92278F]/5">
                          <TableCell className="font-medium text-[#25294B] text-sm py-3 px-4">
                            {room.room_name}
                          </TableCell>
                          <TableCell className="text-[#58595B] text-sm py-3 px-4">
                            {room.room_code || "—"}
                          </TableCell>
                          <TableCell className="text-[#58595B] text-sm py-3 px-4">
                            {room.location || "—"}
                          </TableCell>
                          <TableCell className="text-[#58595B] text-sm py-3 px-4">
                            {room.floor || "—"}
                          </TableCell>
                          <TableCell className="text-[#58595B] text-sm py-3 px-4">
                            {room.capacity || "—"}
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Available
                            </Badge>
                          </TableCell>
                          {normalizedRole === "supervisor" && (
                            <TableCell className="py-3 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const roomData = allRooms.find(r => r.id === room.id)
                                  if (roomData) {
                                    setEditingRoom(roomData)
                                    setEditingRoomForm({
                                      room_name: roomData.room_name || "",
                                      room_code: roomData.room_code || "",
                                      location: roomData.location || "",
                                      floor: roomData.floor || "",
                                      capacity: roomData.capacity?.toString() || "",
                                      description: (roomData as any).description || "",
                                      is_available: true,
                                      features: Array.isArray((roomData as any).features) ? (roomData as any).features : [],
                                      booking_notes: (roomData as any).booking_notes || "",
                                    })
                                  }
                                }}
                                className="text-[#92278F] border-[#92278F] hover:bg-[#92278F] hover:text-white"
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            {!editingRoom && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewRoomsDialogOpen(false)
                    setActiveAction(null)
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AMSDashboardLayout>
  )
}
