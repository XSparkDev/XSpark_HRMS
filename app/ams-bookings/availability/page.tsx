"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import {
  Clock,
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
} from "lucide-react"
import { useState, useEffect } from "react"

export default function CheckRoomAvailabilityPage() {
  const user = getCurrentUser()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [rooms, setRooms] = useState<any[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([])

  if (!user) return null

  // Update time every second for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Mock data for rooms and meetings
  useEffect(() => {
    const mockRooms = [
      {
        id: "thinking-room",
        name: "Thinking Room",
        capacity: 8,
        status: "available", // "available" or "occupied"
        currentMeeting: null,
        nextMeeting: {
          title: "Interview with Sydney Roy",
          startTime: "14:15",
          organizer: "Henrietta Gardner",
        },
      },
      {
        id: "boardroom",
        name: "Boardroom",
        capacity: 10,
        status: "occupied",
        currentMeeting: {
          id: "meeting-001",
          title: "Board Meeting",
          organizer: "Alexander Stokes",
          startTime: "13:00",
          endTime: "14:00",
          meetingType: "Offline",
          category: "Internal Meeting",
        },
        nextMeeting: {
          title: "Client Sales Call",
          startTime: "15:45",
          organizer: "Martin Gutierrez",
        },
      },
    ]

    const mockMeetings = [
      {
        id: "meeting-001",
        room: "Boardroom",
        title: "Board Meeting",
        organizer: "Alexander Stokes",
        meetingType: "Offline",
        category: "Internal Meeting",
        startTime: "13:00",
        endTime: "14:00",
        date: "2025-01-15",
        status: "active", // "active", "upcoming", "cancelled"
        cancelledAt: null,
      },
      {
        id: "meeting-002",
        room: "Thinking Room",
        title: "Interview with Sydney Roy",
        organizer: "Henrietta Gardner",
        meetingType: "Online",
        category: "External Meeting",
        startTime: "14:15",
        endTime: "15:15",
        date: "2025-01-15",
        status: "upcoming",
        cancelledAt: null,
      },
      {
        id: "meeting-003",
        room: "Boardroom",
        title: "Client Sales Call",
        organizer: "Martin Gutierrez",
        meetingType: "Offline",
        category: "External Meeting",
        startTime: "15:45",
        endTime: "16:45",
        date: "2025-01-15",
        status: "upcoming",
        cancelledAt: null,
      },
      {
        id: "meeting-004",
        room: "Thinking Room",
        title: "Project Planning",
        organizer: "Susie Dunn",
        meetingType: "Online",
        category: "Internal Meeting",
        startTime: "11:00",
        endTime: "12:30",
        date: "2025-01-16",
        status: "upcoming",
        cancelledAt: null,
      },
      {
        id: "meeting-005",
        room: "Boardroom",
        title: "Team Standup",
        organizer: "John Doe",
        meetingType: "Online",
        category: "Internal Meeting",
        startTime: "10:00",
        endTime: "10:30",
        date: "2025-01-15",
        status: "cancelled",
        cancelledAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      },
    ]

    setRooms(mockRooms)
    setUpcomingMeetings(mockMeetings)
  }, [])

  const formatTime = (timeString: string) => {
    return timeString
  }

  const getTimeUntilNextMeeting = (startTime: string) => {
    const now = currentTime
    const meetingDate = new Date(`2025-01-15 ${startTime}`)
    const diff = meetingDate.getTime() - now.getTime()
    
    if (diff <= 0) return "Started"
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  const getTimeRemaining = (endTime: string, date: string) => {
    const now = currentTime
    const meetingDate = new Date(`${date} ${endTime}`)
    const diff = meetingDate.getTime() - now.getTime()
    
    if (diff <= 0) return "Ended"
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  const getTimeUntilStart = (startTime: string, date: string) => {
    const now = currentTime
    const meetingDate = new Date(`${date} ${startTime}`)
    const diff = meetingDate.getTime() - now.getTime()
    
    if (diff <= 0) return "Started"
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`
    } else {
      return `in ${minutes}m`
    }
  }

  const getCancellationTimeRemaining = (cancelledAt: Date) => {
    const now = currentTime
    const diff = now.getTime() - cancelledAt.getTime()
    const remaining = 10 * 60 * 1000 - diff // 10 minutes in milliseconds
    
    if (remaining <= 0) return null
    
    const minutes = Math.floor(remaining / (1000 * 60))
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleCancelMeeting = (meetingId: string) => {
    setUpcomingMeetings(prev => 
      prev.map(meeting => 
        meeting.id === meetingId 
          ? { ...meeting, status: "cancelled", cancelledAt: new Date() }
          : meeting
      )
    )
    alert("Meeting successfully cancelled. You can reschedule within the next 10 minutes.")
  }

  const handleRescheduleMeeting = (meetingId: string) => {
    alert("Redirecting to reschedule meeting...")
    // In a real app, this would redirect to a reschedule form
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "occupied":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "active":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "upcoming":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case "cancelled":
        return <XCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const todayMeetings = upcomingMeetings.filter(meeting => meeting.date === "2025-01-15")
  const tomorrowMeetings = upcomingMeetings.filter(meeting => meeting.date === "2025-01-16")

  return (
    <AMSDashboardLayout>
      {/* Everest-inspired design without background photo */}
      <div className="relative min-h-screen bg-gray-50">
        {/* Subtle overlay for readability */}
        <div className="absolute inset-0 bg-black/5"></div>
        
        <div className="relative z-10 space-y-6 p-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-navy">Check Room Availability</h1>
            <p className="text-muted-foreground mt-2">
              View real-time room status and upcoming meetings
            </p>
          </div>

          {/* Main Layout - Everest Style */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Section - Room Status Panel (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold text-navy mb-4">Room Status</h2>
              
              {rooms.map((room) => (
                <Card key={room.id} className="border-0 overflow-hidden relative min-h-[300px] bg-white">
                  <CardContent className="p-0 h-full">
                    {/* Room Status Card with Color Coding */}
                    <div className={`relative h-full min-h-[300px] flex flex-col justify-between p-6 ${
                      room.status === "available" 
                        ? "bg-gradient-to-br from-green-500/80 via-green-600/80 to-green-700/80" 
                        : "bg-gradient-to-br from-red-500/80 via-red-600/80 to-red-700/80"
                    }`}>
                      {/* Subtle overlay for text readability */}
                      <div className="absolute inset-0 bg-black/30"></div>
                      
                      {/* Top section with time and status */}
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-white/90 text-sm font-medium">
                            {currentTime.toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: false 
                            })} {currentTime.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(room.status)}
                            <span className="text-white font-semibold text-sm">
                              {room.status === "available" ? "AVAILABLE" : "OCCUPIED"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Center section with main content */}
                      <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center">
                        {room.status === "available" ? (
                          <div className="space-y-4">
                            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                              <CheckCircle2 className="h-10 w-10 text-white" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-bold text-white mb-2">{room.name}</h3>
                              <p className="text-white/90 text-lg">Available now</p>
                              <p className="text-white/80 text-sm mt-2">Capacity: {room.capacity} people</p>
                              {room.nextMeeting && (
                                <div className="mt-3 p-3 bg-white/10 rounded-lg">
                                  <p className="text-white/90 text-sm">Next: {room.nextMeeting.title}</p>
                                  <p className="text-white/80 text-xs">Organizer: {room.nextMeeting.organizer}</p>
                                  <p className="text-white/80 text-xs">Starts at: {room.nextMeeting.startTime}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                              <Clock className="h-10 w-10 text-white" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-bold text-white mb-2">{room.name}</h3>
                              <p className="text-white/90 text-lg">{room.currentMeeting?.title}</p>
                              <p className="text-white/80 text-sm mt-2">Organizer: {room.currentMeeting?.organizer}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom section with countdown or action */}
                      <div className="relative z-10">
                        {room.status === "available" ? (
                          <div className="text-center space-y-2">
                            {room.nextMeeting && (
                              <>
                                <div className="text-white/90 text-sm">Next meeting starts in:</div>
                                <div className="text-2xl font-bold text-white font-mono">
                                  {getTimeUntilNextMeeting(room.nextMeeting.startTime)}
                                </div>
                              </>
                            )}
                            <Button 
                              className="bg-white/20 text-white border border-white/30"
                              onClick={() => router.push("/ams-bookings/book")}
                            >
                              <Building2 className="h-4 w-4 mr-2" />
                              Book This Room
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center space-y-2">
                            <div className="text-white/90 text-sm">Time Remaining:</div>
                            <div className="text-2xl font-bold text-white font-mono">
                              {getTimeRemaining(room.currentMeeting?.endTime || "", "2025-01-15")}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Right Section - Upcoming Meetings (1/3 width) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-navy mb-4">Upcoming Meetings</h2>
              
              {/* Today's Meetings */}
              <Card className="border border-gray-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">TODAY</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {todayMeetings.length > 0 ? (
                    todayMeetings.map((meeting) => {
                      const cancellationTimeRemaining = meeting.status === "cancelled" 
                        ? getCancellationTimeRemaining(meeting.cancelledAt!)
                        : null
                      
                      return (
                        <div key={meeting.id} className={`p-3 rounded-lg border ${
                          meeting.status === "cancelled" 
                            ? "bg-yellow-50 border-yellow-200" 
                            : "bg-white border-gray-200"
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-navy">
                                  {meeting.startTime} → {meeting.endTime}
                                </span>
                                {meeting.status === "cancelled" && (
                                  <XCircle className="h-4 w-4 text-yellow-600" />
                                )}
                              </div>
                              <h4 className="font-medium text-sm text-navy mb-1">
                                {meeting.title}
                              </h4>
                              <p className="text-xs text-muted-foreground mb-1">
                                {meeting.organizer}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{meeting.meetingType}</span>
                                <span>•</span>
                                <span>{meeting.category}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              {meeting.status === "cancelled" ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Cancelled
                                  </span>
                                  {cancellationTimeRemaining && (
                                    <div className="text-xs text-muted-foreground">
                                      Reschedule in: {cancellationTimeRemaining}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  {getTimeUntilStart(meeting.startTime, meeting.date)}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {meeting.status === "cancelled" && cancellationTimeRemaining && (
                            <div className="flex gap-2 mt-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRescheduleMeeting(meeting.id)}
                                className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reschedule Meeting
                              </Button>
                            </div>
                          )}
                          
                          {meeting.status === "upcoming" && (
                            <div className="flex gap-2 mt-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleCancelMeeting(meeting.id)}
                                className="text-xs"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No meetings scheduled for today
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tomorrow's Meetings */}
              <Card className="border border-gray-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">TOMORROW, FRIDAY, JANUARY 16</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tomorrowMeetings.length > 0 ? (
                    tomorrowMeetings.map((meeting) => (
                      <div key={meeting.id} className="p-3 rounded-lg border bg-white border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-navy">
                                {meeting.startTime} → {meeting.endTime}
                              </span>
                            </div>
                            <h4 className="font-medium text-sm text-navy mb-1">
                              {meeting.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mb-1">
                              {meeting.organizer}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{meeting.meetingType}</span>
                              <span>•</span>
                              <span>{meeting.category}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {getTimeUntilStart(meeting.startTime, meeting.date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No meetings scheduled for tomorrow
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}
