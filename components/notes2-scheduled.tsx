"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Clock, Loader2, MessageSquare } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, type User } from "@/lib/auth"
import { cn } from "@/lib/utils"

type DashboardScheduledNote = {
  id: string
  title: string | null
  content: string
  alert_level: "high" | "medium" | "low"
  created_at: string
  reminder_at: string
  visibility: "private" | "public"
  employee_id: string
  creator_role?: string | null
}

const buildHeaders = (user: User | null) => {
  const headers: Record<string, string> = {}
  if (user?.id) headers["x-user-id"] = user.id
  if (user?.role) headers["x-user-role"] = user.role
  if (user?.id) headers["x-employee-id"] = user.id
  return headers
}

export function Notes2Scheduled() {
  const { toast } = useToast()
  const [notes, setNotes] = useState<DashboardScheduledNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<DashboardScheduledNote | null>(null)
  const [hasError, setHasError] = useState(false)

  const user = useMemo(() => getCurrentUser(), [])

  const fetchNotes = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    try {
      setHasError(false)
      setIsLoading(true)
      const res = await fetch("/api/notes2/scheduled", {
        headers: buildHeaders(user),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load scheduled notes")
      }
      const data: DashboardScheduledNote[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level,
            created_at: note.created_at,
            reminder_at: note.reminder_at,
            visibility: (note.visibility ?? "private") as "private" | "public",
            employee_id: note.employee_id,
            creator_role: note.creator_role ?? null,
          }))
        : []
      setNotes(data)
    } catch (error) {
      console.error(error)
      setHasError(true)
      toast({
        title: "Unable to load scheduled notes",
        description: "We couldn't retrieve your scheduled notes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, user])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    const handler = () => fetchNotes()
    if (typeof window !== "undefined") {
      window.addEventListener("notes2-updated", handler)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("notes2-updated", handler)
      }
    }
  }, [fetchNotes])

  const getCreatorLabel = useCallback(
    (note: DashboardScheduledNote) => {
      if (note.employee_id === user?.id) {
        return "You"
      }
      if (note.creator_role) {
        return note.creator_role
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
      return "Team member"
    },
    [user?.id],
  )

  const getDaysUntilReminder = (reminderAt: string): number => {
    const now = new Date()
    const reminder = new Date(reminderAt)
    const diffTime = reminder.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (!user) {
    return null
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Scheduled Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Scheduled Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-4">
          <Clock className="h-12 w-12 mx-auto text-blue-500" />
          <p className="text-sm text-muted-foreground">
            We ran into a problem retrieving your scheduled notes.
          </p>
          <Button variant="outline" size="sm" onClick={fetchNotes}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!notes.length) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Scheduled Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground space-y-2">
          <Clock className="h-10 w-10 mx-auto opacity-60" />
          <p className="text-sm">No scheduled notes in the next 3 days.</p>
          <p className="text-xs">Notes with reminders will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Scheduled Notes
            <Badge variant="secondary" className="ml-2">
              {notes.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notes.map((note) => {
              const daysUntil = getDaysUntilReminder(note.reminder_at)
              const isUrgent = daysUntil <= 1
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelected(note)}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isUrgent ? "border-orange-200 bg-orange-50/60" : "border-blue-200 bg-blue-50/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", isUrgent ? "bg-orange-500 text-white" : "bg-blue-500 text-white")}>
                        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                      </Badge>
                      {note.visibility === "public" && (
                        <Badge variant="outline" className="text-xs border-purple-200 text-purple-600 bg-purple-50">
                          Public
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.reminder_at), "MMM dd, yyyy 'at' p")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-navy line-clamp-1">
                    {note.title || "Untitled note"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Created by {getCreatorLabel(note)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              {selected?.title || "Scheduled Note"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500 text-white">
                  Reminder: {format(new Date(selected.reminder_at), "PPP 'at' p")}
                </Badge>
                {selected.visibility === "public" && (
                  <Badge variant="outline" className="text-xs border-purple-200 text-purple-600 bg-purple-50">
                    Public
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Created {format(new Date(selected.created_at), "PPP")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-line">{selected.content}</p>
              <div className="text-xs text-muted-foreground">
                Created by <span className="font-medium">{getCreatorLabel(selected)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Notes2Scheduled

