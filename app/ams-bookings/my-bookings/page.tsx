"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, Calendar, Building2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

type Booking = {
  id: string
  employeeId: string
  employeeName: string
  room: string
  meetingCategory: string
  date: string
  time: string
  editableSections: string
  meetingAgenda: string
  status: string
  createdAt: string
}

export default function MyRoomBookingsPage() {
  const user = getCurrentUser()
  const [bookings, setBookings] = useState<Booking[]>([])

  if (!user) return null

  useEffect(() => {
    const stored = localStorage.getItem("room_bookings")
    if (stored) {
      const allBookings = JSON.parse(stored) as Booking[]
      // Filter for current user and sort by date (most recent first)
      const userBookings = allBookings
        .filter((b) => b.employeeId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setBookings(userBookings)
    }
  }, [user])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      Booked: "default",
      Cancelled: "outline",
      Completed: "secondary",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const isPastBooking = (date: string, time: string) => {
    const bookingDateTime = new Date(`${date}T${time}`)
    return bookingDateTime < new Date()
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/ams-bookings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Room Bookings
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">My Room Bookings</h1>
          <p className="text-muted-foreground mt-2">
            History of all your room bookings
          </p>
        </div>

        {/* Bookings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Booking History
            </CardTitle>
            <CardDescription>All your room bookings, past and upcoming</CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agenda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow
                        key={booking.id}
                        className={isPastBooking(booking.date, booking.time) ? "opacity-60" : ""}
                      >
                        <TableCell className="font-medium">{booking.room}</TableCell>
                        <TableCell>{booking.meetingCategory}</TableCell>
                        <TableCell>{new Date(booking.date).toLocaleDateString()}</TableCell>
                        <TableCell>{booking.time}</TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell className="max-w-xs truncate">{booking.meetingAgenda || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-navy mb-2">No Bookings Found</h3>
                <p className="text-muted-foreground mb-4">You haven't made any room bookings yet.</p>
                <Link href="/ams-bookings">
                  <Button className="gradient-primary text-white">
                    <Calendar className="h-4 w-4 mr-2" />
                    Book a Room
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}
