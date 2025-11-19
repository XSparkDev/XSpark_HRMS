"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, Building2, Calendar, Clock, Users } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  getBookingTimeBounds,
  loadRoomBookings,
  resolveBookingRuntimeStatus,
  RoomBookingRecord,
  ROOM_BOOKINGS_UPDATED_EVENT,
} from "@/lib/storage/room-bookings"
import { timeStringToMinutes } from "@/lib/utils/business-hours"

export default function CheckRoomAvailabilityPage() {
  const user = getCurrentUser()
  const [bookings, setBookings] = useState<RoomBookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [referenceTime, setReferenceTime] = useState(() => new Date())

  if (!user) return null

  useEffect(() => {
    const load = () => {
      setLoading(true)
      setError(null)
      try {
        setBookings(loadRoomBookings())
      } catch (err) {
        console.error("Failed to load room bookings", err)
        setError(err instanceof Error ? err.message : "Unable to fetch bookings")
        setBookings([])
      } finally {
        setLoading(false)
      }
    }

    load()

    if (typeof window === "undefined") return
    const handleUpdate = () => load()
    window.addEventListener(ROOM_BOOKINGS_UPDATED_EVENT, handleUpdate)

    return () => {
      window.removeEventListener(ROOM_BOOKINGS_UPDATED_EVENT, handleUpdate)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setReferenceTime(new Date())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const todayIso = referenceTime.toISOString().split("T")[0]
  const todaysSchedule = useMemo(() => {
    const nowMinutes = referenceTime.getHours() * 60 + referenceTime.getMinutes()
    return bookings
      .filter((booking) => booking.date === todayIso)
      .map((booking) => {
        const { startMinutes, endMinutes } = getBookingTimeBounds(booking)
        return {
          booking,
          startMinutes,
          endMinutes,
          runtimeStatus: resolveBookingRuntimeStatus(booking, bookings, referenceTime),
        }
      })
      .filter(({ endMinutes }) => endMinutes === null || endMinutes > nowMinutes)
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
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const formatTimeRange = (booking?: RoomBookingRecord) => {
    if (!booking) return '—'
    const rawStart = booking.startTime || booking.time?.split("-")[0] || booking.start_time
    const rawEnd = booking.endTime || booking.time?.split("-")[1] || booking.end_time
    const start = rawStart ? rawStart.trim() : null
    const end = rawEnd ? rawEnd.trim() : null

    if (start && end) return `${start} – ${end}`
    if (start) return start
    if (end) return end
    return '—'
  }

  const statusBadge = (status?: string | null) => {
    const normalized = (status || 'booked').toLowerCase()
    const variant: 'default' | 'secondary' | 'outline' | 'destructive' =
      normalized === 'in progress'
        ? 'default'
        : normalized === 'pending'
        ? 'destructive'
        : normalized === 'completed'
        ? 'secondary'
        : 'outline'
    return <Badge variant={variant}>{toTitleCase(status)}</Badge>
  }

  const toTitleCase = (value?: string | null) => {
    if (!value) return 'Unknown'
    return value
      .toLowerCase()
      .split(/\s+|_/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Check Room Availability</h1>
          <p className="text-muted-foreground mt-2">
            View upcoming room bookings across all rooms
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            {/* Everest-style Highlight */}
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <div className="rounded-2xl bg-gradient-to-r from-[#FBE8D4] via-[#F8DDEC] to-[#E9F2FF] p-6 md:p-8 border border-white shadow-sm">
                  {activeBooking ? (
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div className="space-y-2 text-[#3F3D56]">
                        <p className="uppercase tracking-wide text-xs text-[#7A768A]">Next meeting</p>
                        <h2 className="text-3xl font-semibold text-[#2B2E4A]">
                          {activeBooking?.meetingAgenda || "Room Booking"}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-[#4F5D75]">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(activeBooking?.date)}</span>
                          <Clock className="h-4 w-4 ml-3" />
                          <span>{formatTimeRange(activeBooking)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[#4F5D75]">
                          <Building2 className="h-4 w-4" />
                          <span>{activeBooking?.room || "Unassigned Room"}</span>
                          <Users className="h-4 w-4 ml-3" />
                          <span>{activeBooking?.employeeName}</span>
                        </div>
                        <div className="mt-4">
                          {statusBadge(activeBooking?.runtimeStatus || activeBooking?.status)}
                        </div>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-4 md:p-6 min-w-[220px] text-center border border-white">
                        <p className="text-xs uppercase tracking-wide text-[#7A768A]">Agenda</p>
                        <p className="mt-2 text-sm text-[#4F5D75]">
                          {activeBooking.meetingAgenda || "Agenda not provided."}
                        </p>
                      </div>
              </div>
            ) : (
                    <div className="py-12 text-center text-[#4F5D75]">
                      <h2 className="text-2xl font-semibold mb-2">No bookings scheduled today</h2>
                      <p className="text-sm mb-4">Rooms are available right now. Schedule your next meeting below.</p>
                <Link href="/ams-bookings">
                  <Button className="gradient-primary text-white">
                    <Building2 className="h-4 w-4 mr-2" />
                    Book a Room
                  </Button>
                </Link>
              </div>
            )}
                </div>
              </CardContent>
            </Card>

            {/* Today's schedule */}
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
                    {todaysSchedule.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#25294B]">
                            {booking.meetingAgenda || "Room Booking"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeRange(booking)} • {booking.employeeName}
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
                  <p className="text-xs text-[#7A768A]">
                    Data refreshes automatically when new bookings are added.
                  </p>
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
      </div>
    </AMSDashboardLayout>
  )
}
