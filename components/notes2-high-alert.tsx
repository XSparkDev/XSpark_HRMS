"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, Loader2, MessageSquare } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, type User } from "@/lib/auth"
import { cn } from "@/lib/utils"

type AlertLevel = "high" | "medium" | "low"

type DashboardNote = {
  id: string
  title: string | null
  content: string
  alert_level: AlertLevel
  created_at: string
  visibility: "private" | "public"
  employee_id: string
  creator_role?: string | null // Role name of the note creator
}

const alertStyles: Record<
  AlertLevel,
  { badge: string; card: string; label: string }
> = {
  high: {
    badge: "bg-red-600 text-white",
    card: "border-red-200 bg-red-50/60",
    label: "High Alert",
  },
  medium: {
    badge: "bg-amber-500/90 text-white",
    card: "border-amber-200 bg-amber-50/60",
    label: "Medium Alert",
  },
  low: {
    badge: "bg-blue-500/80 text-white",
    card: "border-blue-200 bg-blue-50/60",
    label: "Low Alert",
  },
}

const buildHeaders = (user: User | null) => {
  const headers: Record<string, string> = {}
  if (user?.id) headers["x-user-id"] = user.id
  if (user?.role) headers["x-user-role"] = user.role
  // x-employee-id must be the employees.id UUID (target_employee_id lookups),
  // not the auth user id - fall back to user.id only if employeeId is missing.
  if ((user as any)?.employeeId) headers["x-employee-id"] = (user as any).employeeId
  else if (user?.id) headers["x-employee-id"] = user.id
  return headers
}

export function Notes2HighAlert() {
  const { toast } = useToast()
  const [notes, setNotes] = useState<DashboardNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<DashboardNote | null>(null)
  const [hasError, setHasError] = useState(false)

  const user = useMemo(() => getCurrentUser(), [])

  const fetchNotes = useCallback(async () => {
    if (!user?.employeeId) {
      setIsLoading(false)
      return
    }

    try {
      setHasError(false)
      setIsLoading(true)
      const res = await fetch("/api/notes2/high-alert", {
        headers: buildHeaders(user),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load high alert notes")
      }
      const data: DashboardNote[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
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
        title: "Unable to load notes",
        description: "We couldn't retrieve your high alert notes. Please try again.",
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
    (note: DashboardNote) => {
      if (note.employee_id === user?.id) {
        return "You"
      }
      // Use the actual creator role if available, otherwise fall back to default
      if (note.creator_role) {
        // Format role name nicely (e.g., "super_admin" -> "Super Admin", "hr_manager" -> "HR Manager")
        return note.creator_role
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
      // Fallback for old notes without creator_role
      return "Team member"
    },
    [user?.id],
  )

  if (!user) {
    return null
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            High Alert Notes
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
            <AlertTriangle className="h-5 w-5 text-red-600" />
            High Alert Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
          <p className="text-sm text-muted-foreground">
            We ran into a problem retrieving your high alert notes.
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
            <AlertTriangle className="h-5 w-5 text-red-600" />
            High Alert Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground space-y-2">
          <AlertTriangle className="h-10 w-10 mx-auto opacity-60" />
          <p className="text-sm">No high alert notes at the moment.</p>
          <p className="text-xs">You're all clear. We’ll keep this area updated.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            High Alert Notes
            <Badge variant="destructive" className="ml-2">
              {notes.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notes.map((note) => {
              const meta = alertStyles[note.alert_level]
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelected(note)}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    meta.card,
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", meta.badge)}>
                        {meta.label}
                      </Badge>
                      {note.visibility === "public" && (
                        <Badge variant="outline" className="text-xs border-purple-200 text-purple-600 bg-purple-50">
                          Public
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), "MMM dd, yyyy")}
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
              <AlertTriangle className="h-4 w-4 text-red-500" />
              {selected?.title || "High Alert Note"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={alertStyles[selected.alert_level].badge}>
                  {alertStyles[selected.alert_level].label}
                </Badge>
                {selected.visibility === "public" && (
                  <Badge variant="outline" className="text-xs border-purple-200 text-purple-600 bg-purple-50">
                    Public
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(selected.created_at), "PPP")}
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

export default Notes2HighAlert

