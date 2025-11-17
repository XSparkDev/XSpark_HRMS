"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { getCurrentUser } from "@/lib/auth"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"

export default function AMSCalendarPage() {
  const user = getCurrentUser()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  if (!user) return null

  // Important dates with notes
  const importantDates: Record<string, string> = {
    "2025-01-25": "Meeting Booking",
    "2025-01-28": "Device Return Due",
    "2025-01-30": "Meeting You're Involved In",
  }

  // Get important dates for current month (demo dates)
  const today = new Date()
  const importantDatesArray = Object.entries(importantDates).map(([dateStr, note]) => ({
    date: new Date(dateStr),
    note,
  }))

  const modifiers = {
    important: importantDatesArray.map((item) => item.date),
  }

  const modifiersClassNames = {
    important: "bg-primary/20 border-2 border-primary rounded-md font-semibold relative after:content-[''] after:absolute after:top-1 after:right-1 after:w-2 after:h-2 after:bg-primary after:rounded-full",
  }

  const getDateNote = (date: Date | undefined): string | null => {
    if (!date) return null
    const dateStr = date.toISOString().split("T")[0]
    return importantDates[dateStr] || null
  }

  // Check if date is important
  const isImportantDate = (date: Date): boolean => {
    const dateStr = date.toISOString().split("T")[0]
    return dateStr in importantDates
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Calendar
            </CardTitle>
            <CardDescription>View your schedule and upcoming events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto max-w-4xl space-y-4">
              <Calendar
                className="rounded-md border w-full p-2"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
              />
              {selectedDate && getDateNote(selectedDate) && (
                <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
                  <Badge variant="secondary">{getDateNote(selectedDate)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedDate.toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}


