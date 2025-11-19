"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, ListChecks, Building2, Calendar, Clock } from "lucide-react"
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

export default function BookingDetailsPage() {
  const user = getCurrentUser()
  const [currentBookings, setCurrentBookings] = useState<Booking[]>([])

  if (!user) return null

  useEffect(() => {
    const stored = localStorage.getItem("room_bookings")
    if (stored) {
      const allBookings = JSON.parse(stored) as Booking[]
      // Filter for current user's bookings that haven't been attended yet (upcoming)
      const upcoming = allBookings
        .filter((b) => {
          if (b.employeeId !== user.id || b.status !== "Booked") return false
          const bookingDateTime = new Date(`${b.date}T${b.time}`)
          return bookingDateTime >= new Date()
        })
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}`)
          const dateB = new Date(`${b.date}T${b.time}`)
          return dateA.getTime() - dateB.getTime()
        })
      setCurrentBookings(upcoming)
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
          <h1 className="text-3xl font-bold text-navy">Booking Details</h1>
          <p className="text-muted-foreground mt-2">
            Your current bookings that you haven't attended yet
          </p>
        </div>

        {/* Current Bookings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Current Bookings
            </CardTitle>
            <CardDescription>Your upcoming room bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {currentBookings.length > 0 ? (
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
                      <TableHead>Editable Sections</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.room}</TableCell>
                        <TableCell>{booking.meetingCategory}</TableCell>
                        <TableCell>{new Date(booking.date).toLocaleDateString()}</TableCell>
                        <TableCell>{booking.time}</TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell className="max-w-xs truncate">{booking.meetingAgenda || "—"}</TableCell>
                        <TableCell className="max-w-xs truncate">{booking.editableSections || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-navy mb-2">No Current Bookings</h3>
                <p className="text-muted-foreground mb-4">You don't have any upcoming room bookings.</p>
                <Link href="/ams-bookings">
                  <Button className="gradient-primary text-white">
                    <Building2 className="h-4 w-4 mr-2" />
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













