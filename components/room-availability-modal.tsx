"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Calendar, Clock, Users } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import {
  getBookingTimeBounds,
  loadRoomBookings,
  resolveBookingRuntimeStatus,
  RoomBookingRecord,
  ROOM_BOOKINGS_STORAGE_KEY,
  ROOM_BOOKINGS_UPDATED_EVENT,
} from "@/lib/storage/room-bookings"
import { timeStringToMinutes } from "@/lib/utils/business-hours"

type RoomAvailabilityModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sanitizeEmployeeName = (value?: string | null) => {
  if (!value) return "Employee"
  const trimmed = value.trim()
  if (UUID_REGEX.test(trimmed)) {
    return "Employee"
  }
  return trimmed
}

export function RoomAvailabilityModal({ open, onOpenChange }: RoomAvailabilityModalProps) {
  const user = getCurrentUser()
  const [bookings, setBookings] = useState<RoomBookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [referenceTime, setReferenceTime] = useState(() => new Date())

  const persistBookings = useCallback((records: RoomBookingRecord[]) => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ROOM_BOOKINGS_STORAGE_KEY, JSON.stringify(records))
    window.dispatchEvent(new CustomEvent(ROOM_BOOKINGS_UPDATED_EVENT))
  }, [])

  const transformApiBooking = useCallback((row: any): RoomBookingRecord => {
    const date = row.date ?? row.booking_date ?? row.bookingDate ?? row.start_time?.split?.("T")?.[0] ?? ""
    const rawStart = row.start_time ?? row.startTime ?? ""
    const rawEnd = row.end_time ?? row.endTime ?? ""
    const start = rawStart ? rawStart.slice(0, 5) : ""
    const end = rawEnd ? rawEnd.slice(0, 5) : ""
    const time = row.time ?? (start && end ? `${start}-${end}` : start || end || "")

    return {
      id: row.id ?? row.booking_id ?? `${row.room_id ?? "room"}-${date}-${start || "start"}`,
      employeeId: row.booked_by ?? row.employee_id ?? row.employeeId ?? "",
      employeeName: sanitizeEmployeeName(row.employee_name ?? row.booked_by_name ?? row.booked_by ?? "Employee"),
      room: row.room_details?.room_name ?? row.room ?? row.room_id ?? "Room",
      meetingCategory: row.meeting_category ?? row.meetingCategory ?? "Internal",
      meetingAgenda: row.meeting_agenda ?? row.meetingAgenda ?? "",
      date,
      time,
      startTime: start || undefined,
      endTime: end || undefined,
      status: row.status ?? "Pending",
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? undefined,
      checkedInAt: row.checked_in_at ?? row.checkedInAt ?? undefined,
    }
  }, [])

  const refreshFromApi = useCallback(
    async (showSpinner = true) => {
      if (!open) return
      if (showSpinner) {
        setLoading(true)
      }
      setError(null)
      try {
        const params = new URLSearchParams({
          scope: "dashboard",
          daysAhead: "7",
        })
        const response = await fetch(`/api/room-bookings?${params.toString()}`, { cache: "no-store" })
        const json = await response.json()
        if (!response.ok || json.success === false) {
          throw new Error(json.error || "Failed to load room bookings")
        }
        const rows: any[] = Array.isArray(json.data) ? json.data : []
        const normalized = rows.map((row, index) => {
          const booking = transformApiBooking(row)
          // Preserve rejection_reason from raw data for cancellation check
          return {
            ...booking,
            ...(row.rejection_reason && { _rejection_reason: row.rejection_reason }),
          }
        })
        setBookings(normalized)
        persistBookings(normalized)
      } catch (err) {
        console.error("Failed to refresh room bookings", err)
        setError(err instanceof Error ? err.message : "Unable to load bookings")
      } finally {
        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    [open, persistBookings, transformApiBooking],
  )

  useEffect(() => {
    if (!open) return
    // Always fetch fresh data from the API so availability reflects all users,
    // not just what is cached locally for the current browser.
    setLoading(true)
    setError(null)
    refreshFromApi(true)
  }, [open, refreshFromApi])

  useEffect(() => {
    if (!open) return
    const interval = window.setInterval(() => {
      setReferenceTime(new Date())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [open])

  const todayIso = referenceTime.toISOString().split("T")[0]
  const todaysSchedule = useMemo(() => {
    const nowMinutes = referenceTime.getHours() * 60 + referenceTime.getMinutes()
    return bookings
      .filter((booking) => booking.date === todayIso)
      .map((booking) => {
        const { startMinutes, endMinutes } = getBookingTimeBounds(booking)
        const runtimeStatus = resolveBookingRuntimeStatus(booking, bookings, referenceTime)
        // Check for cancellation via multiple indicators
        const statusLower = (runtimeStatus || '').toLowerCase()
        const bookingStatusLower = (booking.status || '').toLowerCase()
        const rawBooking = booking as any
        const rejectionReason = (rawBooking._rejection_reason || rawBooking.rejection_reason || rawBooking.rejectionReason || '').toString()
        const isCancelled = 
          statusLower === 'cancelled' ||
          bookingStatusLower.includes('cancel') ||
          bookingStatusLower.includes('cancelled') ||
          rejectionReason.toLowerCase().includes('cancelled')
        return {
          booking,
          startMinutes,
          endMinutes,
          runtimeStatus,
          isCancelled,
        }
      })
      .filter(({ startMinutes, isCancelled }) => {
        // Filter out cancelled meetings
        if (isCancelled) return false
        // Filter out past meetings
        const isFuture = startMinutes === null || startMinutes > nowMinutes
        return isFuture
      })
      .sort((a, b) => {
        const aStart = a.startMinutes ?? Number.MAX_SAFE_INTEGER
        const bStart = b.startMinutes ?? Number.MAX_SAFE_INTEGER
        return aStart - bStart
      })
      .map(({ booking, runtimeStatus, startMinutes, endMinutes }) => ({
        ...booking,
        runtimeStatus,
        startMinutes,
        endMinutes,
      }))
  }, [bookings, referenceTime, todayIso])

  const activeBooking = todaysSchedule.find((entry) => entry.runtimeStatus === "In Progress") || todaysSchedule[0]
  const totalRooms = useMemo(() => {
    const rooms = new Set<string>()
    bookings.forEach((booking) => {
      if (booking.room) {
        rooms.add(booking.room)
      }
    })
    return rooms.size
  }, [bookings])

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—"
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
  }

  const formatTime = (iso?: string | null) => {
    if (!iso) return "—"
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  }

  const formatTimeRange = (booking?: RoomBookingRecord) => {
    if (!booking) return "—"
    const rawStart = booking.startTime || (booking.time ? booking.time.split("-")[0] : undefined)
    const rawEnd = booking.endTime || (booking.time ? booking.time.split("-")[1] : undefined)
    const start = rawStart ? rawStart.trim() : null
    const end = rawEnd ? rawEnd.trim() : null

    if (start && end) return `${start} – ${end}`
    if (start) return start
    if (end) return end
    return "—"
  }

  const statusBadge = (status?: string | null) => {
    const normalized = (status || "booked").toLowerCase()
    const variant: "default" | "secondary" | "outline" | "destructive" =
      normalized === "in progress"
        ? "default"
        : normalized === "pending"
        ? "destructive"
        : normalized === "completed"
        ? "secondary"
        : "outline"
    return <Badge variant={variant}>{toTitleCase(status)}</Badge>
  }

  const toTitleCase = (value?: string | null) => {
    if (!value) return "Unknown"
    return value
      .toLowerCase()
      .split(/\s+|_/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto bg-gradient-to-b from-white to-[#F8FAFF] space-y-6 rounded-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>Check Room Availability</DialogTitle>
          <DialogDescription>View upcoming room bookings across all rooms</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <Card className="border border-[#808285]/20 bg-gradient-to-br from-white to-[#F5F7FB]">
              <CardHeader>
                <CardTitle className="text-[#25294B]">Today's Schedule</CardTitle>
                <CardDescription className="text-[#58595B]">Room bookings grouped by time slot</CardDescription>
              </CardHeader>
              <CardContent>
                {todaysSchedule.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">No bookings for today.</div>
                ) : (
                  <div className="space-y-2">
                    {todaysSchedule.map((booking, index) => (
                      <div
                        key={
                          booking.id ??
                          `${booking.room ?? 'room'}-${booking.date ?? 'date'}-${booking.time ?? booking.startTime ?? index}`
                        }
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-[#25294B]">
                            {booking.meetingAgenda || "Room Booking"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeRange(booking)} • {sanitizeEmployeeName(booking.employeeName)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">{booking.room}</span>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 justify-end">
                            {booking.meetingCategory}
                            {statusBadge(booking.runtimeStatus || booking.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border border-[#808285]/20 bg-gradient-to-br from-white to-[#F5F7FB]">
              <CardHeader>
                <CardTitle className="text-[#25294B]">Snapshot</CardTitle>
                <CardDescription className="text-[#58595B]">Today's bookings at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#4F5D75]">
                <div className="flex items-center justify-between">
                  <span>Total Bookings</span>
                  <span className="font-semibold text-[#25294B]">{todaysSchedule.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rooms in Use</span>
                  <span className="font-semibold text-[#25294B]">{Math.min(totalRooms, todaysSchedule.length)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Booking</span>
                  <span className="font-semibold text-[#25294B]">
                    {activeBooking ? formatTimeRange(activeBooking) : "None"}
                  </span>
                </div>
                <div className="pt-3 border-t border-[#E3E6EF]">
                  <p className="text-xs text-[#7A768A]">Data refreshes automatically when new bookings are added.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {!loading && !error && todaysSchedule.length === 0 && (
          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white to-[#808285]/5">
            <CardContent className="py-12 text-center text-muted-foreground">
              There are currently no bookings. Rooms are open for reservation.
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Unable to load bookings</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}


