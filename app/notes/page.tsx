"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import { AlertTriangle, Loader2, MessageSquare, Notebook, Plus, StickyNote } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, type User } from "@/lib/auth"
import { cn } from "@/lib/utils"

type AlertLevel = "high" | "medium" | "low"

type Notes2Item = {
  id: string
  title: string | null
  content: string
  alert_level: AlertLevel
  created_at: string
}

const ALERT_META: Record<
  AlertLevel,
  { badge: string; chip: string; dot: string; label: string }
> = {
  high: {
    badge: "bg-red-600 text-white",
    chip: "border-red-200 bg-red-50/60",
    dot: "bg-red-500",
    label: "High Alert",
  },
  medium: {
    badge: "bg-amber-500 text-white",
    chip: "border-amber-200 bg-amber-50",
    dot: "bg-amber-400",
    label: "Medium Alert",
  },
  low: {
    badge: "bg-blue-500 text-white",
    chip: "border-blue-200 bg-blue-50",
    dot: "bg-blue-400",
    label: "Low Alert",
  },
}

const buildHeaders = (user: User | null) => {
  const headers: Record<string, string> = {}
  if (user?.id) headers["x-user-id"] = user.id
  if (user?.role) headers["x-user-role"] = user.role
  if (user?.id) headers["x-employee-id"] = user.id
  return headers
}

export default function NotesPage() {
  const { toast } = useToast()
  const user = useMemo(() => getCurrentUser(), [])

  const [notes, setNotes] = useState<Notes2Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selected, setSelected] = useState<Notes2Item | null>(null)
  const [editNote, setEditNote] = useState<Notes2Item | null>(null)
  const [isDeletePending, setIsDeletePending] = useState<string | null>(null)
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: "",
    content: "",
    alert_level: "low" as AlertLevel,
  })
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    alert_level: "low" as AlertLevel,
  })

  const isEmployee = user?.role === "employee"

  const sortNotes = (data: Notes2Item[]) =>
    [...data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

  const fetchNotes = useCallback(async () => {
    if (!user?.employeeId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      console.log("[Notes2][FETCH] request", { employeeId: user.employeeId })
      const res = await fetch("/api/notes2", {
        headers: buildHeaders(user),
      })
      const json = await res.json()
      console.log("[Notes2][FETCH] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Unable to load notes")
      }
      const data: Notes2Item[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
          }))
        : []
      setNotes(sortNotes(data))
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to load notes",
        description: "We couldn't retrieve your notes right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, user])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const resetForm = () =>
    setForm({
      title: "",
      content: "",
      alert_level: "low",
    })

  const handleCreateNote = async () => {
    if (!user?.id || !user.employeeId) {
      toast({
        title: "You're not signed in",
        description: "Please sign in again to create a note.",
        variant: "destructive",
      })
      return
    }

    if (!form.content.trim()) {
      toast({
        title: "Content required",
        description: "Please add a few details to your note.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const requestPayload = {
        title: form.title.trim() || undefined,
        content: form.content.trim(),
        alert_level: form.alert_level,
      }
      console.log("[Notes2][CREATE] payload", requestPayload)
      const res = await fetch("/api/notes2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(user),
        },
        body: JSON.stringify(requestPayload),
      })

      const json = await res.json()
      console.log("[Notes2][CREATE] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to create note")
      }

      const created: Notes2Item = {
        id: json.data.id,
        title: json.data.title,
        content: json.data.content,
        alert_level: json.data.alert_level,
        created_at: json.data.created_at,
      }

      setNotes((prev) => sortNotes([created, ...prev]))
      toast({ title: "Note created", description: "Your note has been saved." })
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notes2-updated"))
      }
      resetForm()
      setIsCreateOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to save note",
        description: "Something went wrong while creating the note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateNote = async () => {
    if (!editNote) return
    if (!user?.id || !user.employeeId) {
      toast({
        title: "You're not signed in",
        description: "Please sign in again before updating notes.",
        variant: "destructive",
      })
      return
    }
    if (!editForm.content.trim()) {
      toast({
        title: "Content required",
        description: "Please add content before saving the note.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsEditSubmitting(true)
      const updatePayload = {
        title: editForm.title.trim() || null,
        content: editForm.content.trim(),
        alert_level: editForm.alert_level,
      }
      console.log("[Notes2][UPDATE] payload", { noteId: editNote.id, updatePayload })
      const res = await fetch(`/api/notes2/${editNote.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(user),
        },
        body: JSON.stringify(updatePayload),
      })

      const json = await res.json()
      console.log("[Notes2][UPDATE] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update note")
      }

      toast({ title: "Note updated", description: "Your changes have been saved." })
      setEditNote(null)
      await fetchNotes()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notes2-updated"))
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to update note",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!user?.id || !user.employeeId) {
      toast({
        title: "You're not signed in",
        description: "Please sign in again before deleting notes.",
        variant: "destructive",
      })
      return
    }
    if (!confirm("Are you sure you want to delete this note? This cannot be undone.")) {
      return
    }

    try {
      setIsDeletePending(noteId)
      console.log("[Notes2][DELETE] request", { noteId })
      const res = await fetch(`/api/notes2/${noteId}`, {
        method: "DELETE",
        headers: buildHeaders(user),
      })
      const json = await res.json().catch(() => ({}))
      console.log("[Notes2][DELETE] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete note")
      }

      toast({ title: "Note deleted" })
      setNotes((prev) => prev.filter((note) => note.id !== noteId))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notes2-updated"))
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to delete note",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeletePending(null)
    }
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-4" />
            Loading notes...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isEmployee) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Notes2 is currently available for employees only. Please switch to the admin dashboard to
            manage organization-wide notes.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">My Notes</h1>
          <p className="text-sm text-muted-foreground">Capture important reminders and alerts.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Note
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      ) : notes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3 text-muted-foreground">
            <Notebook className="h-8 w-8 mx-auto opacity-70" />
            <p className="text-sm">You have not created any notes yet.</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
              Create your first note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {notes.map((note) => {
            const meta = ALERT_META[note.alert_level]
            return (
              <Card
                key={note.id}
                className={cn(
                  "cursor-pointer transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
                  meta.chip,
                )}
                onClick={(event) => {
                  // prevent card click when clicking action buttons
                  if ((event.target as HTMLElement).closest("[data-note-action]")) {
                    return
                  }
                  setSelected(note)
                }}
              >
                <CardContent className="py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                      <Badge variant="outline" className={meta.badge}>
                        {meta.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), "MMM dd, yyyy • HH:mm")}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-navy">
                      {note.title || "Untitled note"}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{note.content}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Created by {user?.name || "You"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        data-note-action
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          setEditNote(note)
                          setEditForm({
                            title: note.title ?? "",
                            content: note.content,
                            alert_level: note.alert_level,
                          })
                        }}
                      >
                        Edit
                      </button>
                      <button
                        data-note-action
                        type="button"
                        className="text-red-500 hover:underline disabled:opacity-50"
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={isDeletePending === note.id}
                      >
                        {isDeletePending === note.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Note Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Optional title"
                value={form.title}
                maxLength={120}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Describe what needs attention..."
                rows={4}
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Alert level</Label>
              <Select
                value={form.alert_level}
                onValueChange={(value: AlertLevel) =>
                  setForm((prev) => ({ ...prev, alert_level: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alert level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      High Alert
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Medium Alert
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Low Alert
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={!!editNote} onOpenChange={(open) => !open && setEditNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                maxLength={120}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                rows={4}
                value={editForm.content}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, content: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Alert level</Label>
              <Select
                value={editForm.alert_level}
                onValueChange={(value: AlertLevel) =>
                  setEditForm((prev) => ({ ...prev, alert_level: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alert level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      High Alert
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Medium Alert
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Low Alert
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditNote(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNote} disabled={isEditSubmitting}>
              {isEditSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note details dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              {selected?.title || "Note Details"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <Badge className={ALERT_META[selected.alert_level].badge}>
                  {ALERT_META[selected.alert_level].label}
                </Badge>
                <span className="text-muted-foreground">
                  {format(new Date(selected.created_at), "PPP • HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">{selected.content}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Created by <span className="font-medium">{user?.name || "You"}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

