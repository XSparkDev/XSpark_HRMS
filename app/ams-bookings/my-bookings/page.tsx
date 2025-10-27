"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Clock,
  Users,
  Building2,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { useState, useEffect } from "react"

export default function MyRoomBookingsPage() {
  const user = getCurrentUser()
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])

  if (!user) return null

  // Mock data for user's room bookings
  useEffect(() => {
    const mockBookings = [
      {
        id: "BK-001",
        room: "Thinking Room",
        capacity: 8,
        date: "2025-01-15",
        time: "10:00 AM - 12:00 PM",
        meetingType: "Online",
        meetingCategory: "Internal Meeting",
        agenda: "Weekly team standup meeting",
        members: ["John Doe", "Jane Smith"],
        status: "Confirmed",
        createdAt: "2025-01-10",
      },
      {
        id: "BK-002", 
        room: "Boardroom",
        capacity: 10,
        date: "2025-01-18",
        time: "2:00 PM - 4:00 PM",
        meetingType: "Offline",
        meetingCategory: "External Meeting",
        agenda: "Client presentation and discussion",
        members: ["Client Team"],
        status: "Pending",
        createdAt: "2025-01-12",
      },
      {
        id: "BK-003",
        room: "Thinking Room",
        capacity: 8,
        date: "2025-01-20",
        time: "9:00 AM - 10:00 AM",
        meetingType: "Online",
        meetingCategory: "Internal Meeting",
        agenda: "Project review meeting",
        members: [],
        status: "Confirmed",
        createdAt: "2025-01-14",
      },
    ]
    setBookings(mockBookings)
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>
      case "Pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case "Cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "Pending":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case "Cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const isUpcoming = (dateString: string) => {
    const bookingDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return bookingDate >= today
  }

  const upcomingBookings = bookings.filter(booking => isUpcoming(booking.date))
  const pastBookings = bookings.filter(booking => !isUpcoming(booking.date))

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy">My Room Bookings</h1>
            <p className="text-muted-foreground mt-2">
              View and manage your room bookings
            </p>
          </div>
          <Button 
            onClick={() => router.push("/ams-bookings/book")}
            className="gradient-primary text-white"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Book New Room
          </Button>
        </div>

        {/* Upcoming Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Bookings
            </CardTitle>
            <CardDescription>Your confirmed and pending room bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length > 0 ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-navy">{booking.room}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(booking.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {booking.time}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Up to {booking.capacity} people
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium">{booking.meetingType}</span> • 
                          <span className="ml-1">{booking.meetingCategory}</span>
                          {booking.agenda && (
                            <span className="ml-2">• {booking.agenda}</span>
                          )}
                        </div>
                        {booking.members.length > 0 && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            Members: {booking.members.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(booking.status)}
                        {getStatusBadge(booking.status)}
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-navy mb-2">No Upcoming Bookings</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have any upcoming room bookings.
                </p>
                <Button onClick={() => router.push("/ams-bookings/book")} className="gradient-primary text-white">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Book a Room
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Past Bookings
              </CardTitle>
              <CardDescription>Your completed room bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pastBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 opacity-75">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-700">{booking.room}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(booking.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {booking.time}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium">{booking.meetingType}</span> • 
                          <span className="ml-1">{booking.meetingCategory}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(booking.status)}
                        {getStatusBadge(booking.status)}
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Completed
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AMSDashboardLayout>
  )
}


