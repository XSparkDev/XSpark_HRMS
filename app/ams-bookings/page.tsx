"use client"

import React, { useState, useEffect, useCallback } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getCurrentUser } from "@/lib/auth"
import { Building2, Calendar, Search, ListChecks, Trash2, Pencil } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import {
  addRoomBooking,
  hasBookingConflict,
  isBookingInProgress,
  loadRoomBookings,
  removeRoomBooking,
  resolveBookingRuntimeStatus,
  updateRoomBooking,
  RoomBookingRecord,
  ROOM_BOOKINGS_UPDATED_EVENT,
  ROOM_BOOKINGS_STORAGE_KEY,
} from "@/lib/storage/room-bookings"
import { BUSINESS_START_TIME, BUSINESS_END_TIME, BUSINESS_TIME_PATTERN, isWithinBusinessHours as isBusinessTime, timeStringToMinutes } from "@/lib/utils/business-hours"

type Booking = RoomBookingRecord

export default function AMSBookingsPage() {
  const user = getCurrentUser()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<RoomBookingRecord[]>([])
  const [filter, setFilter] = useState<"All" | "External" | "Internal">("All")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null)
  const [bookRoomOpen, setBookRoomOpen] = useState(false)
  const [bookingSummaryOpen, setBookingSummaryOpen] = useState(false)
  const [bookingSummaryData, setBookingSummaryData] = useState<RoomBookingRecord | null>(null)
  const [bookingSummaryConflict, setBookingSummaryConflict] = useState(false)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({})
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

  if (!user) return null

  const userId = user.id || user.email || "guest"

  const loadUserBookings = useCallback(() => {
    const all = loadRoomBookings()
    setAllBookings(all)
    const userBookings = all
      .filter((b) => b.employeeId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setBookings(userBookings as Booking[])
  }, [userId])

  useEffect(() => {
    loadUserBookings()
  }, [loadUserBookings])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ROOM_BOOKINGS_STORAGE_KEY) {
        loadUserBookings()
      }
    }
    const handleCustom = () => loadUserBookings()
    window.addEventListener("storage", handleStorage)
    window.addEventListener(ROOM_BOOKINGS_UPDATED_EVENT, handleCustom)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(ROOM_BOOKINGS_UPDATED_EVENT, handleCustom)
    }
  }, [loadUserBookings])

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
    if (isBookingInProgress(booking) && booking.employeeId !== userId) {
      toast({
        variant: "destructive",
        title: "Cannot cancel this booking",
        description: "Only the meeting owner can cancel an in-progress booking.",
      })
      return
    }
    setBookingToDelete(booking)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!bookingToDelete) return

    const updated = removeRoomBooking(bookingToDelete.id, userId)
    setAllBookings(updated)
    setBookings(updated.filter((b) => b.employeeId === userId) as Booking[])

    setDeleteDialogOpen(false)
    setBookingToDelete(null)
  }

  const handleEditBooking = (booking: Booking) => {
    const [start, end] = (booking.time || '').split('-')
    setBookingForm({
      room: booking.room,
      meetingType: booking.editableSections || "",
      meetingCategory: booking.meetingCategory,
      agenda: booking.meetingAgenda || "",
      date: booking.date,
      startTime: booking.startTime || start || "",
      endTime: booking.endTime || end || "",
    })
    setEditingBookingId(booking.id)
    setBookingErrors({})
    setBookRoomOpen(true)
  }

  // Map bookings to rows format for display
  const rows = bookings.map((booking) => {
    const [timeStart, timeEnd] = (booking.time || "").split("-")
    const runtimeStatus = resolveBookingRuntimeStatus(booking, allBookings)
    return {
      id: booking.id,
      room: booking.room,
      category: booking.meetingCategory,
      type: booking.editableSections || "Offline",
      agenda: booking.meetingAgenda || "",
      date: booking.date,
      start: booking.startTime || timeStart || booking.time,
      end: booking.endTime || timeEnd || "",
      status: runtimeStatus,
    }
  })

  const filtered = rows.filter(r => {
    if (filter === "All") return true
    return [r.category, r.type, r.status].includes(filter)
  })

  const rooms = [
    { value: "ThinkTank1", label: "ThinkTank 1" },
    { value: "ThinkTank2", label: "ThinkTank 2" },
    { value: "Boardroom", label: "Boardroom" },
  ]

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

  const validateBookingForm = (form = bookingForm) => {
    const errors: Record<string, string> = {}
    if (!form.room) errors.room = "Select a room."
    if (!form.meetingType) errors.meetingType = "Select a meeting type."
    if (!form.meetingCategory) errors.meetingCategory = "Select a category."
    if (!form.date) {
      errors.date = "Select a booking date."
    } else if (isPastDate(form.date)) {
      errors.date = "Booking date cannot be in the past."
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

    return errors
  }

  const updateFormWithValidation = (patch: Partial<typeof bookingForm>) => {
    const nextForm = { ...bookingForm, ...patch }
    setBookingForm(nextForm)
    setBookingErrors(validateBookingForm(nextForm))
  }

  const handleBookingFormSubmit = () => {
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

    const payload = {
      employeeId: userId,
      employeeName: user.name || "Employee",
      room: bookingForm.room,
      meetingCategory: bookingForm.meetingCategory,
      editableSections: bookingForm.meetingType,
      meetingAgenda: bookingForm.agenda,
      date: bookingForm.date,
      time: `${bookingForm.startTime}-${bookingForm.endTime}`,
      startTime: bookingForm.startTime,
      endTime: bookingForm.endTime,
    }

    if (editingBookingId) {
      const existing = allBookings.find((booking) => booking.id === editingBookingId)
      const conflict = hasBookingConflict(
        { ...(existing ?? { id: editingBookingId }), ...payload } as RoomBookingRecord,
        allBookings,
      )
      const nextStatus = conflict ? "Pending" : "Booked"
      const updated = updateRoomBooking(editingBookingId, {
        ...payload,
        status: nextStatus,
      })
      setAllBookings(updated)
      setBookings(updated.filter((b) => b.employeeId === userId) as Booking[])
      setBookingSummaryConflict(conflict)
      setBookingSummaryData({
        ...(existing ?? {
          id: editingBookingId,
          createdAt: new Date().toISOString(),
        }),
        ...payload,
        id: editingBookingId,
        status: nextStatus,
      })
      setBookingSummaryOpen(true)
      setBookRoomOpen(false)
      setEditingBookingId(null)
      toast({
        title: conflict ? "Booking update pending review" : "Booking updated",
        description: conflict
          ? "There is a conflict with this booking. We'll notify you once it's resolved."
          : `${bookingForm.room} updated for ${bookingForm.date}.`,
      })
    } else {
      const bookingRecord: RoomBookingRecord = {
        id: `BK-${Date.now()}`,
        ...payload,
        status: "Booked",
        createdAt: new Date().toISOString(),
      }

      const conflict = hasBookingConflict(bookingRecord, allBookings)
      const updated = addRoomBooking(bookingRecord)
      setAllBookings(updated)
      setBookings(updated.filter((b) => b.employeeId === userId) as Booking[])
      setBookRoomOpen(false)
      setBookingSummaryConflict(conflict)
      setBookingSummaryData(bookingRecord)
      setBookingSummaryOpen(true)
      toast({
        title: conflict ? "Booking pending review" : "Room booked",
        description: conflict
          ? "There is a conflict with another booking. You'll be notified once it is resolved."
          : `${bookingForm.room} reserved for ${bookingForm.date}.`,
      })
    }

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
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Room Booking</h1>
          <p className="text-muted-foreground mt-2">Book, manage, and review your room bookings</p>
        </div>

        {/* Booking History Table and Book a Room Button */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Booking History</CardTitle>
              <CardDescription>Your personal room booking history</CardDescription>
            </div>
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
              <DialogContent className="sm:max-w-lg rounded-xl shadow-xl space-y-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle>Book a Room</DialogTitle>
                  <DialogDescription>Provide booking details</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Room Selection</Label>
                    <Select value={bookingForm.room} onValueChange={(value) => updateFormWithValidation({ room: value })}>
                      <SelectTrigger className={bookingErrors.room ? "border-destructive focus-visible:ring-destructive/40" : undefined}>
                        <SelectValue placeholder="Choose a room" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((room) => (
                          <SelectItem key={room.value} value={room.value}>
                            {room.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {bookingErrors.room && <p className="text-xs text-destructive mt-1">{bookingErrors.room}</p>}
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
                  <div className="flex items-center justify-between pt-2">
                    <DialogClose asChild>
                      <Button variant="outline" className="w-40">Cancel</Button>
                    </DialogClose>
                    <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40" onClick={handleBookingFormSubmit}>
                      Book Room
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">Filter by</div>
              <div className="flex items-center gap-2">
                <Select
                  value={filter === "All" ? undefined : filter}
                  onValueChange={(value) => setFilter(value as "External" | "Internal")}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All bookings" />
                  </SelectTrigger>
                <SelectContent>
                    <SelectItem value="External">External</SelectItem>
                  <SelectItem value="Internal">Internal</SelectItem>
                </SelectContent>
              </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter("All")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-[#92278F]/10 to-[#BE1E2D]/10">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Room</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Meeting Category</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Meeting Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Agenda</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Start</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">End</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-navy">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const booking = bookings.find(b => b.id === r.id)
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.room}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.agenda}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{r.start}</TableCell>
                        <TableCell>{r.end}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {booking && !['attended', 'cancelled'].includes(r.status.toLowerCase()) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit booking"
                                onClick={() => handleEditBooking(booking)}
                                className="hover:bg-muted"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => booking && handleDeleteClick(booking)}
                              disabled={booking ? (isBookingInProgress(booking) && booking.employeeId !== userId) : false}
                              className="hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="space-y-4">
            <AlertDialogHeader className="space-y-1">
              <AlertDialogTitle>Delete Booking</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this booking for {bookingToDelete?.room} on {bookingToDelete?.date}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteDialogOpen(false)
                setBookingToDelete(null)
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={bookingSummaryOpen} onOpenChange={setBookingSummaryOpen}>
        <DialogContent className="sm:max-w-lg border border-[#25294B]/20 bg-gradient-to-br from-white via-[#F1E9FF] to-[#FFE5F0] shadow-xl space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle>Booking Summary</DialogTitle>
            <DialogDescription>Your room booking confirmation</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#58595B]">Room:</span>
              <span className="font-medium text-[#25294B]">{bookingSummaryData?.room ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Category:</span>
              <span className="font-medium text-[#25294B]">{bookingSummaryData?.meetingCategory ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Date:</span>
              <span className="font-medium text-[#25294B]">{bookingSummaryData?.date ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#58595B]">Time:</span>
              <span className="font-medium text-[#25294B]">
                {bookingSummaryData?.startTime ?? bookingSummaryData?.time?.split('-')[0] ?? '—'} -{' '}
                {bookingSummaryData?.endTime ?? bookingSummaryData?.time?.split('-')[1] ?? '—'}
              </span>
            </div>
            {bookingSummaryData?.meetingAgenda && (
              <div className="flex justify-between">
                <span className="text-[#58595B]">Agenda:</span>
                <span className="font-medium text-[#25294B]">{bookingSummaryData.meetingAgenda}</span>
              </div>
            )}
            <div className="flex justify-between mt-4">
              <span className="text-[#58595B]">Employee ID:</span>
              <span className="font-medium text-[#25294B]">{user.employeeId || '—'}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#808285]/20 flex items-center justify-between">
              <span className="text-[#58595B] text-xs">Status</span>
              <Badge variant={bookingSummaryConflict ? "destructive" : "secondary"} className="text-xs">
                {bookingSummaryConflict ? "Pending" : "Booked"}
              </Badge>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
              onClick={() => {
                setBookingSummaryOpen(false)
                setBookingSummaryData(null)
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AMSDashboardLayout>
  )
}
