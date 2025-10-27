"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, Building2, Users, Calendar, Clock, Plus, X, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function BookRoomPage() {
  const user = getCurrentUser()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  if (!user) return null

  // Form state
  const [formData, setFormData] = useState({
    room: "",
    meetingType: "",
    meetingCategory: "",
    agenda: "",
    hasColleagues: "",
    members: [] as string[],
    date: "",
    startTime: "",
    endTime: "",
  })

  // Mock colleagues data
  const colleagues = [
    { id: "1", name: "John Smith", email: "john.smith@company.com", department: "Engineering" },
    { id: "2", name: "Sarah Johnson", email: "sarah.johnson@company.com", department: "Design" },
    { id: "3", name: "Mike Wilson", email: "mike.wilson@company.com", department: "Marketing" },
    { id: "4", name: "Lisa Brown", email: "lisa.brown@company.com", department: "HR" },
    { id: "5", name: "David Chen", email: "david.chen@company.com", department: "Engineering" },
    { id: "6", name: "Emma Davis", email: "emma.davis@company.com", department: "Finance" },
  ]

  const [searchQuery, setSearchQuery] = useState("")
  const [showMemberSearch, setShowMemberSearch] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  const handleColleaguesChange = (value: string) => {
    setFormData({
      ...formData,
      hasColleagues: value,
    })
    
    if (value === "yes") {
      setShowMemberSearch(true)
    } else {
      setShowMemberSearch(false)
      setFormData(prev => ({ ...prev, members: [] }))
    }
  }

  const addMember = (memberId: string) => {
    if (!formData.members.includes(memberId)) {
      setFormData({
        ...formData,
        members: [...formData.members, memberId],
      })
    }
    setSearchQuery("")
  }

  const removeMember = (memberId: string) => {
    setFormData({
      ...formData,
      members: formData.members.filter(id => id !== memberId),
    })
  }

  const filteredColleagues = colleagues.filter(colleague =>
    colleague.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    colleague.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    // Create booking
    const booking = {
      id: `BK-${Date.now()}`,
      room: formData.room,
      meetingType: formData.meetingType,
      meetingCategory: formData.meetingCategory,
      agenda: formData.agenda,
      members: formData.members,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      bookedBy: user.name,
      bookedAt: new Date().toISOString(),
      status: "Confirmed",
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Store in localStorage for demo purposes
    const existingBookings = JSON.parse(localStorage.getItem('roomBookings') || '[]')
    existingBookings.push(booking)
    localStorage.setItem('roomBookings', JSON.stringify(existingBookings))
    
    // Show success notification
    alert("Room booked successfully and added to your calendar and Room Bookings.")
    
    setIsSubmitting(false)
    setShowConfirmation(false)
    
    // Reset form
    setFormData({
      room: "",
      meetingType: "",
      meetingCategory: "",
      agenda: "",
      hasColleagues: "",
      members: [],
      date: "",
      startTime: "",
      endTime: "",
    })
    setShowMemberSearch(false)
    setSearchQuery("")
    
    // Redirect to room bookings page
    router.push('/ams-bookings')
  }

  const isFormValid = formData.room && formData.meetingType && formData.meetingCategory && 
                     formData.date && formData.startTime && formData.endTime

  const getRoomCapacity = (room: string) => {
    switch (room) {
      case "thinking-room":
        return "8 people max"
      case "boardroom":
        return "10 people max"
      default:
        return ""
    }
  }

  const getSelectedMembers = () => {
    return colleagues.filter(colleague => formData.members.includes(colleague.id))
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
          <h1 className="text-3xl font-bold text-navy">Book a Room</h1>
          <p className="text-muted-foreground mt-2">
            Reserve a meeting room for your upcoming meeting
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Room Selection
                </CardTitle>
                <CardDescription>Choose the room for your meeting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room">Select Room *</Label>
                  <Select value={formData.room} onValueChange={(value) => handleInputChange("room", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thinking-room">
                        <div className="flex items-center justify-between w-full">
                          <span>Thinking Room</span>
                          <Badge variant="outline" className="ml-2">8 people max</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="boardroom">
                        <div className="flex items-center justify-between w-full">
                          <span>Boardroom</span>
                          <Badge variant="outline" className="ml-2">10 people max</Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.room && (
                    <p className="text-sm text-muted-foreground">
                      Capacity: {getRoomCapacity(formData.room)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Meeting Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Meeting Details
                </CardTitle>
                <CardDescription>Provide details about your meeting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Meeting Type */}
                <div className="space-y-3">
                  <Label>Select Meeting Type *</Label>
                  <RadioGroup value={formData.meetingType} onValueChange={(value) => handleInputChange("meetingType", value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="online" id="online" />
                      <Label htmlFor="online">Online</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="offline" id="offline" />
                      <Label htmlFor="offline">Offline</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Meeting Category */}
                <div className="space-y-3">
                  <Label>Meeting Category *</Label>
                  <RadioGroup value={formData.meetingCategory} onValueChange={(value) => handleInputChange("meetingCategory", value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="internal" id="internal" />
                      <Label htmlFor="internal">Internal Meeting</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="external" id="external" />
                      <Label htmlFor="external">External Meeting</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Agenda */}
                <div className="space-y-2">
                  <Label htmlFor="agenda">Meeting Agenda</Label>
                  <Textarea
                    id="agenda"
                    placeholder="Describe the purpose, agenda items, or any notes for this meeting..."
                    value={formData.agenda}
                    onChange={(e) => handleInputChange("agenda", e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Members Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Members Involved
                </CardTitle>
                <CardDescription>Add colleagues to your meeting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Are any colleagues involved in this meeting?</Label>
                  <RadioGroup value={formData.hasColleagues} onValueChange={handleColleaguesChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="yes" />
                      <Label htmlFor="yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="no" />
                      <Label htmlFor="no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                {showMemberSearch && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="memberSearch">Search and Add Members</Label>
                      <div className="relative">
                        <Input
                          id="memberSearch"
                          placeholder="Search by name or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {filteredColleagues.map((colleague) => (
                              <div
                                key={colleague.id}
                                className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                onClick={() => addMember(colleague.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{colleague.name}</p>
                                    <p className="text-xs text-muted-foreground">{colleague.email}</p>
                                    <p className="text-xs text-muted-foreground">{colleague.department}</p>
                                  </div>
                                  <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Members */}
                    {formData.members.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Members</Label>
                        <div className="flex flex-wrap gap-2">
                          {getSelectedMembers().map((member) => (
                            <Badge key={member.id} variant="secondary" className="flex items-center gap-1">
                              {member.name}
                              <X 
                                className="h-3 w-3 cursor-pointer hover:text-red-500" 
                                onClick={() => removeMember(member.id)}
                              />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Date and Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Date & Time
                </CardTitle>
                <CardDescription>Select when your meeting will take place</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange("date", e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange("startTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time *</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange("endTime", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Booking Summary
                </CardTitle>
                <CardDescription>Review your booking details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.room ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Room:</span>
                        <span className="text-sm font-medium">
                          {formData.room === "thinking-room" ? "Thinking Room" : "Boardroom"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Capacity:</span>
                        <span className="text-sm font-medium">{getRoomCapacity(formData.room)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Meeting Type:</span>
                        <span className="text-sm font-medium capitalize">{formData.meetingType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Category:</span>
                        <span className="text-sm font-medium capitalize">{formData.meetingCategory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Date:</span>
                        <span className="text-sm font-medium">{formData.date || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Time:</span>
                        <span className="text-sm font-medium">
                          {formData.startTime && formData.endTime 
                            ? `${formData.startTime} - ${formData.endTime}` 
                            : "Not set"
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Members:</span>
                        <span className="text-sm font-medium">
                          {formData.members.length > 0 ? `${formData.members.length} selected` : "None"}
                        </span>
                      </div>
                    </div>

                    <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          className="w-full gradient-primary text-white hover:opacity-90 transition-opacity" 
                          disabled={!isFormValid || isSubmitting}
                        >
                          {isSubmitting ? "Booking..." : "Book Room"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Room Booking</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to book this room? This will add the meeting to your calendar and Room Bookings.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleSubmit}>
                            Confirm Booking
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    {!isFormValid && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Please fill in all required fields to book the room
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Select a room to see booking summary
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}
