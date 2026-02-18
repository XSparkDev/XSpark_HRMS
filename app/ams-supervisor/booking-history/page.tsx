"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import {
  MoreVertical,
  ArrowLeft,
  Calendar,
  Trash2,
  X,
  AlertTriangle,
  Phone,
  Mail,
  Loader2,
  Search,
  Filter,
} from "lucide-react"
import { resolveBookingRuntimeStatus } from "@/lib/utils/room-bookings"

type SupervisorBooking = {
  id: string
  booking_id: string
  room_id: string
  room_name: string
  booked_by: string
  employee_first_name: string | null
  employee_name: string | null
  employee_id: string | null
  employee_email: string | null
  employee_auth_user_id: string | null
  date: string
  start_time: string
  end_time: string
  time_slot: string
  status: string
  meeting_agenda: string | null
  meeting_category: string | null
  checked_in_at: string | null
  created_at: string
}

const getStatusBadgeColor = (status: string) => {
  const statusLower = status.toLowerCase().trim().replace(/[–—]/g, '-')
  
  // Cancelled → Gray
  if (statusLower.includes("cancelled") || statusLower.includes("canceled")) {
    return "#6B7280"
  }
  
  // Confirmed or Upcoming → Green/Blue
  if (statusLower === "confirmed") {
    return "#16A34A" // Green
  }
  if (statusLower === "upcoming") {
    return "#2563EB" // Blue
  }
  
  // In Progress → Blue-Green (teal)
  if (statusLower.includes("in progress")) {
    if (statusLower.includes("confirmed")) {
      return "#14B8A6" // Teal
    }
    return "#2563EB" // Blue
  }
  
  // Attended or Completed → Purple
  if (statusLower === "attended" || statusLower === "completed") {
    return "#92278F" // Purple
  }
  
  // Missed → Red
  if (statusLower === "missed") {
    return "#BE1E2D" // Red
  }
  
  // Rescheduled → Orange
  if (statusLower.includes("rescheduled")) {
    return "#F59E0B" // Orange
  }
  
  // Pending → Orange (fallback)
  if (statusLower === "pending") {
    return "#F59E0B" // Orange
  }
  
  return undefined
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—"
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

const formatTimeSlot = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime && !endTime) return "—"
  const start = startTime ? startTime.slice(0, 5) : "—"
  const end = endTime ? endTime.slice(0, 5) : "—"
  return `${start} – ${end}`
}

const calculateDuration = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime || !endTime) return "—"
  try {
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const minutes = diffMins % 60
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h`
    } else {
      return `${minutes}m`
    }
  } catch {
    return "—"
  }
}

export default function SupervisorBookingHistoryPage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<SupervisorBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<SupervisorBooking | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [supervisorEmployeeId, setSupervisorEmployeeId] = useState<string | null>(null)

  const isSupervisor = (user?.role ?? "").toString().toLowerCase() === "supervisor"

  // Fetch supervisor's employee ID for comparison
  useEffect(() => {
    const fetchSupervisorEmployeeId = async () => {
      if (!user?.id) return
      
      try {
        // Try to get employee record from localStorage first
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("xspark_employee")
          if (stored) {
            try {
              const employee = JSON.parse(stored)
              if (employee.id) {
                setSupervisorEmployeeId(employee.id)
                return
              }
            } catch (e) {
              // Continue to API fetch
            }
          }
        }

        // Fallback: fetch from API
        const response = await fetch("/api/auth/me")
        if (response.ok) {
          const json = await response.json()
          if (json.success && json.data?.employee?.id) {
            setSupervisorEmployeeId(json.data.employee.id)
          }
        }
      } catch (error) {
        console.error("Failed to fetch supervisor employee ID:", error)
      }
    }

    if (isSupervisor) {
      fetchSupervisorEmployeeId()
    }
  }, [user, isSupervisor])

  const loadAllBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch ALL bookings (no bookedBy filter for supervisors)
      const params = new URLSearchParams({
        limit: "1000", // Get a large number of bookings
      })
      const response = await fetch(`/api/room-bookings?${params.toString()}`, {
        cache: "no-store",
      })
      const json = await response.json()

      if (!response.ok || json.success === false) {
        throw new Error(json.error || "Failed to load bookings")
      }

      const rows: any[] = Array.isArray(json.data) ? json.data : []
      
      // Helper function to extract time in HH:MM format
      const extractTimeFromISO = (isoString?: string | null) => {
        if (!isoString) return null
        // If already in HH:MM format, return as is
        if (/^\d{2}:\d{2}$/.test(isoString)) return isoString
        // If ISO timestamp, extract time part
        try {
          const date = new Date(isoString)
          if (!Number.isNaN(date.getTime())) {
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            return `${hours}:${minutes}`
          }
        } catch (e) {
          // Fallback: try to extract from string
          const match = isoString.match(/(\d{2}):(\d{2})/)
          if (match) return `${match[1]}:${match[2]}`
        }
        return null
      }

      // Helper function to prepare booking rows for conflict checking
      const prepareBookingForConflictCheck = (r: any) => {
        const rStartTime = r.start_time || r.startTime || extractTimeFromISO(r.original_start_time) || ""
        const rEndTime = r.end_time || r.endTime || extractTimeFromISO(r.original_end_time) || ""
        return {
          id: r.id || r.booking_id || "",
          room_id: r.room_id || "",
          booking_date: r.date || r.booking_date || "",
          date: r.date || r.booking_date || "",
          start_time: rStartTime,
          startTime: rStartTime,
          end_time: rEndTime,
          endTime: rEndTime,
          time: rStartTime && rEndTime ? `${rStartTime}-${rEndTime}` : null,
        }
      }
      
      // First, normalize all bookings to calculate runtime status
      const normalized: SupervisorBooking[] = rows.map((item: any) => {
        // Get time strings in HH:MM format
        const startTimeStr = item.start_time || item.startTime || extractTimeFromISO(item.original_start_time) || ""
        const endTimeStr = item.end_time || item.endTime || extractTimeFromISO(item.original_end_time) || ""
        const timeSlot = formatTimeSlot(startTimeStr, endTimeStr)
        
        // Get employee first name - prefer from API, fallback to parsing full name
        let firstName = item.employee_first_name || null
        if (!firstName && item.employee_name) {
          // Extract first name from full name as fallback
          const nameParts = item.employee_name.trim().split(/\s+/)
          firstName = nameParts[0] || null
        }

        // Get checked_in_at - check multiple possible field names
        const checkedInAt = item.checked_in_at || item.checkedInAt || item.check_in_time || null
        
        // Prepare booking object for status calculation
        const bookingForStatus = {
          id: item.id || item.booking_id || "",
          booking_id: item.booking_id || item.id || "",
          room_id: item.room_id || "",
          date: item.date || item.booking_date || "",
          booking_date: item.date || item.booking_date || "",
          start_time: startTimeStr,
          startTime: startTimeStr,
          end_time: endTimeStr,
          endTime: endTimeStr,
          time: startTimeStr && endTimeStr ? `${startTimeStr}-${endTimeStr}` : null,
          status: item.status || null,
          checked_in_at: checkedInAt,
          checkedInAt: checkedInAt,
          check_in_status: item.check_in_status || item.checkInStatus || (checkedInAt ? 'Checked-In' : null),
          checkInStatus: item.check_in_status || item.checkInStatus || (checkedInAt ? 'Checked-In' : null),
          rejection_reason: item.rejection_reason || null,
          rejectionReason: item.rejection_reason || null,
          is_postponed: item.is_postponed || false,
        }

        // If status is already "Attended" in database, respect it
        const existingStatus = (item.status || '').toLowerCase().trim()
        let realStatus: string
        if (existingStatus === 'attended' || existingStatus.includes('attended')) {
          // Already attended, use that
          realStatus = 'Attended'
        } else if (checkedInAt) {
          // If checked in, verify if meeting has ended to show as "Attended"
          const bookingDate = item.date || item.booking_date || ""
          if (bookingDate && endTimeStr) {
            try {
              const [endHours, endMins] = endTimeStr.split(':').map(Number)
              if (!Number.isNaN(endHours) && !Number.isNaN(endMins)) {
                const bookingEndDateTime = new Date(`${bookingDate}T${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`)
                const now = new Date()
                
                // If meeting has ended and user checked in, it's "Attended"
                if (now > bookingEndDateTime) {
                  realStatus = 'Attended'
                } else {
                  // Meeting hasn't ended yet, calculate normal status
                  realStatus = resolveBookingRuntimeStatus(bookingForStatus as any, rows.map(prepareBookingForConflictCheck))
                }
              } else {
                realStatus = resolveBookingRuntimeStatus(bookingForStatus as any, rows.map(prepareBookingForConflictCheck))
              }
            } catch (e) {
              // Fallback to normal calculation if date parsing fails
              realStatus = resolveBookingRuntimeStatus(bookingForStatus as any, rows.map(prepareBookingForConflictCheck))
            }
          } else {
            // Can't determine, use normal calculation
            realStatus = resolveBookingRuntimeStatus(bookingForStatus as any, rows.map(prepareBookingForConflictCheck))
          }
        } else {
          // Calculate real runtime status based on dates, check-in, etc.
          realStatus = resolveBookingRuntimeStatus(bookingForStatus as any, rows.map(prepareBookingForConflictCheck))
        }

        return {
          id: item.id || item.booking_id || "",
          booking_id: item.booking_id || item.id || "",
          room_id: item.room_id || "",
          room_name: item.room_details?.room_name || item.room || item.room_name || "Unknown Room",
          booked_by: item.booked_by || "",
          employee_first_name: firstName,
          employee_name: item.employee_name || item.booked_by_name || null,
          employee_id: item.employee_id || null,
          employee_email: item.employee_email || null,
          employee_auth_user_id: item.employee_auth_user_id || null,
          date: item.date || item.booking_date || "",
          start_time: startTimeStr,
          end_time: endTimeStr,
          time_slot: timeSlot,
          status: realStatus, // Use calculated runtime status instead of default "Pending"
          meeting_agenda: item.meeting_agenda || item.booking_reason || item.purpose || null,
          meeting_category: item.meeting_category || "Internal",
          checked_in_at: item.checked_in_at || item.checkedInAt || null,
          created_at: item.created_at || new Date().toISOString(),
        }
      })

      // Sort by date (oldest first), then by start time (ascending)
      normalized.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return (a.start_time || "").localeCompare(b.start_time || "")
      })

      setBookings(normalized)
    } catch (err) {
      console.error("Failed to load bookings", err)
      setError(err instanceof Error ? err.message : "Unable to load bookings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isSupervisor) return
    loadAllBookings()
  }, [isSupervisor, loadAllBookings])

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
          booking.room_name.toLowerCase().includes(searchLower) ||
          (booking.employee_first_name || "").toLowerCase().includes(searchLower) ||
          (booking.employee_name || "").toLowerCase().includes(searchLower) ||
          (booking.meeting_agenda || "").toLowerCase().includes(searchLower) ||
          (booking.meeting_category || "").toLowerCase().includes(searchLower) ||
          booking.date.includes(searchTerm)
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== "All") {
        const statusLower = booking.status.toLowerCase().trim().replace(/[–—]/g, '-')
        if (statusFilter === "Upcoming") {
          return statusLower === "upcoming" || statusLower === "confirmed"
        }
        if (statusFilter === "In Progress") {
          return statusLower.includes("in progress")
        }
        if (statusFilter === "Cancelled") {
          return statusLower.includes("cancelled") || statusLower.includes("canceled")
        }
        if (statusFilter === "Attended") {
          return statusLower === "attended" || statusLower === "completed"
        }
        if (statusFilter === "Missed") {
          return statusLower === "missed"
        }
        if (statusFilter === "Pending") {
          return statusLower === "pending"
        }
      }

      return true
    })
  }, [bookings, searchTerm, statusFilter])

  const handleDelete = async () => {
    if (!selectedBooking) return
    setActionLoading("delete")
    try {
      const response = await fetch(`/api/room-bookings/${selectedBooking.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error || "Failed to delete booking")
      }

      toast({
        title: "Booking deleted",
        description: `Booking for ${selectedBooking.room_name} has been deleted.`,
      })

      await loadAllBookings()
      setDeleteDialogOpen(false)
      setSelectedBooking(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete booking",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!selectedBooking) return
    setActionLoading("cancel")
    try {
      const response = await fetch(`/api/room-bookings/${selectedBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Cancelled",
          rejection_reason: "Cancelled by supervisor",
        }),
      })

      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error || "Failed to cancel booking")
      }

      toast({
        title: "Booking cancelled",
        description: `Booking for ${selectedBooking.room_name} has been cancelled.`,
      })

      await loadAllBookings()
      setCancelDialogOpen(false)
      setSelectedBooking(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to cancel booking",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleResolveConflict = async () => {
    if (!selectedBooking) return
    setActionLoading("resolve")
    try {
      // For now, mark as resolved by updating status
      // In the future, this could open a conflict resolution dialog
      toast({
        title: "Conflict resolution",
        description: "Conflict resolution feature coming soon.",
      })
      setActionLoading(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to resolve conflict",
        description: error instanceof Error ? error.message : "Please try again later.",
      })
      setActionLoading(null)
    }
  }

  const handleContactBooker = (booking: SupervisorBooking) => {
    if (!booking.employee_email) {
      toast({
        variant: "destructive",
        title: "Email not available",
        description: "The booker's email address is not available.",
      })
      return
    }

    // Open mailto link with the booker's email
    const subject = encodeURIComponent(`Regarding your room booking: ${booking.room_name}`)
    const body = encodeURIComponent(
      `Hi ${booking.employee_first_name || booking.employee_name || "there"},\n\n` +
      `I wanted to reach out regarding your room booking:\n\n` +
      `Room: ${booking.room_name}\n` +
      `Date: ${formatDate(booking.date)}\n` +
      `Time: ${booking.time_slot}\n\n` +
      `Best regards`
    )
    window.location.href = `mailto:${booking.employee_email}?subject=${subject}&body=${body}`
  }

  const isSupervisorBooking = (booking: SupervisorBooking) => {
    if (!supervisorEmployeeId) return false
    // Compare booked_by (employee UUID) with supervisor's employee UUID
    return booking.booked_by === supervisorEmployeeId
  }

  if (!user) return null

  if (!isSupervisor) {
    return (
      <AMSDashboardLayout>
        <div className="space-y-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive mb-4">Only supervisors can view the booking history.</p>
              <Link href="/ams-supervisor">
                <Button variant="outline">Back to Supervisor Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AMSDashboardLayout>
    )
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/ams-supervisor">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Supervisor Dashboard
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#25294B]">Room Booking History</h1>
          <p className="text-muted-foreground mt-2">View and manage all room bookings across the system</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by room, employee name, agenda..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="All">All Status</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                  <option value="Attended">Attended</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Missed">Missed</option>
                </select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("All")
                    setSearchTerm("")
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#92278F]" />
              All Bookings ({filteredBookings.length})
            </CardTitle>
            <CardDescription>Complete history of room bookings from all users</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#92278F]" />
                <p className="text-sm text-muted-foreground">Loading bookings...</p>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                <p className="text-sm text-destructive mb-3">{error}</p>
                <Button variant="outline" onClick={loadAllBookings}>
                  Retry
                </Button>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="rounded-lg border border-muted/40 bg-muted/10 px-4 py-10 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No bookings found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="font-semibold">Room Name</TableHead>
                      <TableHead className="font-semibold">Booked By</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Time Slot</TableHead>
                      <TableHead className="font-semibold">Duration</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Purpose / Description</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => {
                      const statusColor = getStatusBadgeColor(booking.status)
                      const canDelete = booking.status.toLowerCase() !== "in progress"
                      const canCancel =
                        !["cancelled", "canceled", "attended", "completed"].includes(booking.status.toLowerCase())
                      const isSupervisorOwnBooking = isSupervisorBooking(booking)
                      const canContactBooker = !isSupervisorOwnBooking && !!booking.employee_email

                      return (
                        <TableRow key={booking.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium">{booking.room_name}</TableCell>
                          <TableCell>
                            {booking.employee_first_name || booking.employee_name || "Unknown"}
                          </TableCell>
                          <TableCell>{formatDate(booking.date)}</TableCell>
                          <TableCell>{booking.time_slot}</TableCell>
                          <TableCell>{calculateDuration(booking.start_time, booking.end_time)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs font-medium"
                              style={
                                statusColor
                                  ? {
                                      backgroundColor: `${statusColor}20`,
                                      borderColor: statusColor,
                                      color: statusColor,
                                    }
                                  : undefined
                              }
                            >
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {booking.meeting_agenda || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  aria-label="Booking actions"
                                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
                                  disabled={actionLoading !== null}
                                >
                                  Actions
                                  <MoreVertical className="h-4 w-4 ml-2" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setSelectedBooking(booking)
                                    setDeleteDialogOpen(true)
                                  }}
                                  disabled={!canDelete || actionLoading !== null}
                                  className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setSelectedBooking(booking)
                                    setCancelDialogOpen(true)
                                  }}
                                  disabled={!canCancel || actionLoading !== null}
                                  className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel Booking
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleResolveConflict()
                                  }}
                                  disabled={actionLoading !== null}
                                  className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  Resolve Conflict
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleContactBooker(booking)
                                  }}
                                  disabled={!canContactBooker || actionLoading !== null}
                                  className="text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Contact Booker
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
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete booking?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this booking for{" "}
                <strong>{selectedBooking?.room_name}</strong> on{" "}
                <strong>{selectedBooking ? formatDate(selectedBooking.date) : ""}</strong>? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={actionLoading !== null}
                className="bg-[#BE1E2D] text-white hover:bg-[#BE1E2D]/90"
              >
                {actionLoading === "delete" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel the booking for{" "}
                <strong>{selectedBooking?.room_name}</strong> on{" "}
                <strong>{selectedBooking ? formatDate(selectedBooking.date) : ""}</strong>? The booking status will be
                changed to cancelled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading !== null}>No, Keep Booking</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={actionLoading !== null}
                className="bg-[#BE1E2D] text-white hover:bg-[#BE1E2D]/90"
              >
                {actionLoading === "cancel" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Booking"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AMSDashboardLayout>
  )
}

