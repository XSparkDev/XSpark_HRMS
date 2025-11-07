"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Plus, AlertTriangle, Eye, EyeOff, Pin, Calendar, User, Edit, Trash2, Paperclip } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import EditNoteForm from "@/components/EditNoteForm"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { getCurrentUser } from "@/lib/auth"

type NoteVisibility = "public" | "personal"

type NoteItem = {
  id: string
  employee_id: string
  author_id: string
  author_role?: string | null
  title?: string | null
  content: string
  alert_level: "high" | "medium" | "low"
  visibility: NoteVisibility
  is_confidential: boolean
  reminder_enabled?: boolean | null
  reminder_at?: string | null
  pinned: boolean
  tags?: string | null
  created_at: string
  updated_at: string
}

interface NewNoteInput {
  title?: string
  content: string
  alert_level: "high" | "medium" | "low"
  visibility: NoteVisibility
  pinned?: boolean
  tags?: string
  reminder_enabled?: boolean
  reminder_at?: Date
}

interface NotesSectionProps {
  employeeId: string
  isOwnProfile?: boolean
}

export function NotesSection({ employeeId, isOwnProfile = false }: NotesSectionProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "personal">("all")

  const currentUser = getCurrentUser()
  const isHRAdmin = ["hr_admin", "hr_manager", "admin", "super_admin"].includes(currentUser?.role ?? "")
  const isManager = currentUser?.role === "manager"

  const buildHeaders = () => {
    const headers: Record<string, string> = {}
    if (currentUser?.id) headers["x-user-id"] = currentUser.id
    if (currentUser?.role) headers["x-user-role"] = currentUser.role
    if (employeeId) headers["x-employee-id"] = employeeId
    return headers
  }

  const normalizeNote = (note: any): NoteItem => ({
    id: note.id ?? note.note_id ?? `note-${Date.now()}`,
    employee_id: note.employee_id ?? employeeId,
    author_id: note.author_id ?? currentUser?.id ?? "",
    author_role: note.author_role ?? null,
    title: note.title ?? null,
    content: note.content ?? "",
    alert_level: note.alert_level ?? "low",
    visibility: note.visibility ?? (note.is_confidential ? "personal" : "public"),
    is_confidential: note.is_confidential ?? (note.visibility ? note.visibility === "personal" : true),
    reminder_enabled: note.reminder_enabled ?? false,
    reminder_at: note.reminder_at ?? null,
    pinned: note.pinned ?? false,
    tags: note.tags ?? null,
    created_at: note.created_at ?? new Date().toISOString(),
    updated_at: note.updated_at ?? note.created_at ?? new Date().toISOString(),
  })

  useEffect(() => {
    let isMounted = true

    const fetchNotes = async () => {
      if (!employeeId || !currentUser?.id) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const headers = buildHeaders()
        console.log("Loading notes for:", { employeeId, currentUser })
        const res = await fetch(`/api/notes`, { headers })
        if (!res.ok) {
          throw new Error(`Failed to load notes (${res.status})`)
        }

        const json = await res.json()
        if (!isMounted) return

        const fetchedNotes: NoteItem[] = Array.isArray(json?.notes)
          ? json.notes.map((note: any) => normalizeNote(note))
          : []

        setNotes(fetchedNotes)
      } catch (error) {
        console.error("Error loading notes:", error)
        if (isMounted) {
          toast({
            title: "Unable to load notes",
            description: "We couldn't retrieve your notes. Please try again shortly.",
            variant: "destructive",
          })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchNotes()

    return () => {
      isMounted = false
    }
  }, [employeeId, currentUser, toast])

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getVisibilityIcon = (visibility: string) => {
    return visibility === "public" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />
  }

  const filteredNotes = notes.filter(note => {
    if (filter !== "all" && note.alert_level !== filter) return false
    if (visibilityFilter !== "all" && note.visibility !== visibilityFilter) return false
    return true
  }).sort((a, b) => {
    // Sort by pinned first, then by created date
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const canEditNote = (note: NoteItem) => {
    if (isHRAdmin) return true
    if (isManager && note.author_id === currentUser?.id) return true
    if (isOwnProfile && note.author_id === currentUser?.id) return true
    return false
  }

  const canCreatePublicNote = () => {
    return isHRAdmin || isManager
  }

  const handleCreateNote = async (data: NewNoteInput) => {
    if (!employeeId || !currentUser?.id) {
      toast({
        title: "Unable to create note",
        description: "Please sign in again before adding a note.",
        variant: "destructive",
      })
      return
    }

    const headers = {
      "Content-Type": "application/json",
      ...buildHeaders(),
    }

    console.log("Creating note with headers:", headers)

    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()

    const optimisticNote: NoteItem = {
      id: tempId,
      employee_id: employeeId,
      author_id: currentUser.id,
      author_role: currentUser.role,
      title: data.title || null,
      content: data.content,
      alert_level: data.alert_level,
      visibility: data.visibility,
      is_confidential: data.visibility === "personal",
      pinned: data.pinned || false,
      tags: data.tags || null,
      reminder_enabled: data.reminder_enabled || false,
      reminder_at: data.reminder_enabled && data.reminder_at ? data.reminder_at.toISOString() : null,
      created_at: now,
      updated_at: now,
    }

    setNotes((prev) => [optimisticNote, ...prev])
    setIsCreateModalOpen(false)

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: data.title || null,
          content: data.content,
          alert_level: data.alert_level,
          visibility: data.visibility,
          pinned: data.pinned || false,
          tags: data.tags || null,
          reminder_enabled: data.reminder_enabled || false,
          reminder_at: data.reminder_enabled && data.reminder_at ? data.reminder_at.toISOString() : undefined,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to create note (${res.status})`)
      }

      const created = await res.json()

      setNotes((prev) =>
        prev.map((note) => (note.id === tempId ? normalizeNote(created) : note))
      )

      toast({
        title: "Note created",
        description: "Your note has been saved.",
      })
    } catch (error) {
      console.error(error)
      setNotes((prev) => prev.filter((note) => note.id !== tempId))
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!employeeId || !currentUser?.id) {
      toast({
        title: "Unable to delete note",
        description: "Please sign in again before deleting a note.",
        variant: "destructive",
      })
      return
    }

    const previous = notes
    setNotes((prev) => prev.filter((note) => note.id !== noteId))

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      })

      if (!res.ok) {
        throw new Error(`Failed to delete note (${res.status})`)
      }

      toast({
        title: "Note deleted",
        description: "The note has been removed.",
      })
    } catch (error) {
      console.error(error)
      setNotes(() => [...previous])
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditNote = async (noteId: string, data: Partial<NewNoteInput>) => {
    if (!employeeId || !currentUser?.id) return

    const headers = {
      "Content-Type": "application/json",
      ...buildHeaders(),
    }

    const previous = notes
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              ...data,
              reminder_at:
                data.reminder_at instanceof Date
                  ? data.reminder_at.toISOString()
                  : data.reminder_at ?? n.reminder_at,
              visibility: data.visibility ?? n.visibility,
              updated_at: new Date().toISOString(),
            }
          : n
      )
    )

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === noteId ? normalizeNote(updated) : n)))
      toast({ title: "Note updated" })
    } catch (error) {
      setNotes(previous)
      toast({ title: "Error updating note", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Notes & Reminders
          </CardTitle>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Note</DialogTitle>
              </DialogHeader>
              <CreateNoteForm 
                onSubmit={handleCreateNote}
                canCreatePublic={canCreatePublicNote()}
                onCancel={() => setIsCreateModalOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={!!editingNote} onOpenChange={(open) => setEditingNote(open ? editingNote : null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Note</DialogTitle>
              </DialogHeader>
              {editingNote && (
                <EditNoteForm
                  note={editingNote}
                  onSave={async (id, data) => {
                    await handleEditNote(id, data)
                    setEditingNote(null)
                  }}
                  onCancel={() => setEditingNote(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Alert Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={visibilityFilter} onValueChange={(value: any) => setVisibilityFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notes found matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredNotes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "border rounded-lg p-4 space-y-3",
                    note.pinned && "border-primary bg-primary/5",
                    getAlertLevelColor(note.alert_level)
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {note.pinned && <Pin className="h-4 w-4 text-primary" />}
                      <Badge variant="outline" className={getAlertLevelColor(note.alert_level)}>
                        {note.alert_level.toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {getVisibilityIcon(note.visibility)}
                        <span>{note.visibility}</span>
                      </div>
                    </div>
                    
                    {canEditNote(note) && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNote(note)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm">{note.content}</p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{note.author_role || "Employee"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(note.created_at), "MMM dd, yyyy")}</span>
                      </div>
                      {note.reminder_enabled && note.reminder_at && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Reminder: {format(new Date(note.reminder_at), "MMM dd, yyyy")}</span>
                        </div>
                      )}
                    </div>
                    
                    {note.tags && (
                      <div className="text-xs">
                        {note.tags.split(',').map(tag => (
                          <span key={tag} className="bg-gray-100 px-2 py-1 rounded mr-1">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface CreateNoteFormProps {
  onSubmit: (data: NewNoteInput) => void
  canCreatePublic: boolean
  onCancel: () => void
}

function CreateNoteForm({ onSubmit, canCreatePublic, onCancel }: CreateNoteFormProps) {
  const [formData, setFormData] = useState<Partial<NewNoteInput>>({
    content: "",
    alert_level: "low",
    visibility: "personal",
    reminder_enabled: false,
    pinned: false,
    tags: "",
    title: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.content?.trim()) return

    onSubmit({
      title: formData.title?.trim() || undefined,
      content: formData.content,
      alert_level: (formData.alert_level as NewNoteInput["alert_level"]) || "low",
      visibility: (formData.visibility as NoteVisibility) || "personal",
      pinned: formData.pinned || false,
      tags: formData.tags,
      reminder_enabled: formData.reminder_enabled || false,
      reminder_at: formData.reminder_enabled && formData.reminder_at ? new Date(formData.reminder_at) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Optional title for this note"
        />
      </div>

      <div>
        <Label htmlFor="content">Note Content *</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Enter your note content..."
          rows={4}
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="alert_level">Alert Level</Label>
          <Select 
            value={formData.alert_level ?? "low"} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, alert_level: value as any }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="visibility">Visibility</Label>
          <Select 
            value={formData.visibility ?? "personal"} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value as any }))}
            disabled={!canCreatePublic}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              {canCreatePublic && <SelectItem value="public">Public</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          placeholder="e.g., training, performance, reminder"
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="reminder_enabled"
          checked={formData.reminder_enabled}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminder_enabled: !!checked }))}
        />
        <Label htmlFor="reminder_enabled">Set Reminder</Label>
      </div>
      
      {formData.reminder_enabled && (
        <div>
          <Label htmlFor="reminder_at">Reminder Date</Label>
          <Input
            id="reminder_at"
            type="datetime-local"
            value={formData.reminder_at ? formData.reminder_at.toISOString().slice(0, 16) : ""}
            onChange={(e) => setFormData(prev => ({ ...prev, reminder_at: e.target.value ? new Date(e.target.value) : undefined }))}
          />
        </div>
      )}
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="pinned"
          checked={formData.pinned}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pinned: !!checked }))}
        />
        <Label htmlFor="pinned">Pin this note</Label>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Create Note
        </Button>
      </div>
    </form>
  )
}
