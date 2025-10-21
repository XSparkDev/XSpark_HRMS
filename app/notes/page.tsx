"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Plus, AlertTriangle, Eye, EyeOff, User, Calendar, Edit, Trash2, StickyNote, Filter, Search } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { noteSchema, NoteFormData, alertLevelEnum, visibilityEnum, reminderRepeatEnum } from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth"
import { notesService, type Note } from "@/lib/services/notes-service"

export default function NotesPage() {
  const { toast } = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "personal">("all")
  const [searchTerm, setSearchTerm] = useState("")

  const currentUser = getCurrentUser()
  const isHRAdmin = currentUser?.role === "hr_admin" || currentUser?.role === "admin"
  const isManager = currentUser?.role === "manager"

  useEffect(() => {
    // Fetch notes from shared service
    const fetchNotes = async () => {
      try {
        const allNotes = await notesService.getAllNotes()
        setNotes(allNotes)
      } catch (error) {
        console.error("Error fetching notes:", error)
        toast({
          title: "Error",
          description: "Failed to load notes",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchNotes()

    // Subscribe to real-time updates
    const unsubscribe = notesService.subscribe((updatedNotes) => {
      setNotes(updatedNotes)
    })

    return unsubscribe
  }, [toast])

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
    if (searchTerm && !note.content.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !note.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    // Sort by pinned first, then by created date
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const canEditNote = (note: Note) => {
    if (isHRAdmin) return true
    if (isManager && note.author_id === currentUser?.id) return true
    if (note.author_id === currentUser?.id) return true
    return false
  }

  const canCreatePublicNote = () => {
    return isHRAdmin || isManager
  }

  const getStableKey = (note: Note) => {
    // Create stable composite key to avoid duplicate key errors
    const baseId = note.note_id || `${note.author_id}-${note.created_at}`
    const timestamp = new Date(note.created_at).getTime()
    return `${baseId}-${timestamp}`
  }

  const handleCreateNote = async (data: NoteFormData) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: data.employee_id,
          content: data.content,
          alert_level: data.alert_level,
          visibility: data.visibility,
          attachments: data.attachments || [],
          reminder_at: data.reminder_at?.toISOString(),
          pinned: data.pinned || false,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create note')
      }
      
      const newNote = await response.json()
      
      setIsCreateModalOpen(false)
      
      toast({
        title: "Note Created",
        description: "Your note has been successfully created.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete note')
      }
      
      toast({
        title: "Note Deleted",
        description: "The note has been successfully deleted from all dashboards.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Employee Notes</h1>
          <p className="text-muted-foreground mt-1">
            Write, manage, and track important notes and reminders.
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-semibold">High Alert</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {notes.filter(note => note.alert_level === "high").length}
            </div>
            <p className="text-sm text-muted-foreground">Critical notes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">Public</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {notes.filter(note => note.visibility === "public").length}
            </div>
            <p className="text-sm text-muted-foreground">Shared notes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-gray-600" />
              <span className="font-semibold">Personal</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {notes.filter(note => note.visibility === "personal").length}
            </div>
            <p className="text-sm text-muted-foreground">Private notes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-green-600" />
              <span className="font-semibold">Total</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {notes.length}
            </div>
            <p className="text-sm text-muted-foreground">All notes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
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
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes ({filteredNotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notes found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredNotes.map((note) => (
                  <motion.div
                    key={getStableKey(note)}
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
                        <Badge variant="outline" className={getAlertLevelColor(note.alert_level)}>
                          {note.alert_level.toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {getVisibilityIcon(note.visibility)}
                          <span>{note.visibility}</span>
                        </div>
                        {note.pinned && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            PINNED
                          </Badge>
                        )}
                      </div>
                      
                      {canEditNote(note) && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingNote(note.note_id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmNote(note.note_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="font-medium text-sm mb-1">
                        {note.employee_name} ({note.employee_number})
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{note.author_role}</span>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmNote} onOpenChange={() => setDeleteConfirmNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this note? This action cannot be undone and will remove the note from all dashboards.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmNote(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (deleteConfirmNote) {
                  handleDeleteNote(deleteConfirmNote)
                  setDeleteConfirmNote(null)
                }
              }}
            >
              Delete Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CreateNoteFormProps {
  onSubmit: (data: NoteFormData) => void
  canCreatePublic: boolean
  onCancel: () => void
}

function CreateNoteForm({ onSubmit, canCreatePublic, onCancel }: CreateNoteFormProps) {
  const [formData, setFormData] = useState<Partial<NoteFormData>>({
    content: "",
    alert_level: "low",
    visibility: "personal",
    reminder_enabled: false,
    reminder_repeat: "none",
    pinned: false,
    tags: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.content?.trim()) return
    
    onSubmit({
      note_id: undefined,
      employee_id: "current-employee", // In real app, get from context
      author_id: "current-user", // In real app, get from auth
      author_role: "Employee", // In real app, get from user role
      content: formData.content,
      created_at: new Date(),
      updated_at: new Date(),
      reminder_at: formData.reminder_enabled ? formData.reminder_at : undefined,
      alert_level: formData.alert_level || "low",
      visibility: formData.visibility || "personal",
      reminder_enabled: formData.reminder_enabled || false,
      reminder_repeat: formData.reminder_repeat || "none",
      pinned: formData.pinned || false,
      attachments: [],
      tags: formData.tags,
      status: "active",
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            value={formData.alert_level} 
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
            value={formData.visibility} 
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
          {formData.alert_level === "high" && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">High Alert Visibility Rules:</span>
              </div>
              <div className="text-blue-700 text-sm mt-1 space-y-1">
                <p>• <strong>High + Public:</strong> Visible to everyone on their dashboard</p>
                <p>• <strong>High + Personal:</strong> Visible only to you (and HR/Admin per policy)</p>
              </div>
            </div>
          )}
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
            value={formData.reminder_at ? new Date(formData.reminder_at).toISOString().slice(0, 16) : ""}
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
        <Button type="submit" disabled={!formData.content?.trim()}>
          Create Note
        </Button>
      </div>
    </form>
  )
}
