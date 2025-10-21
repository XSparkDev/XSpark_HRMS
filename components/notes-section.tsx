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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { noteSchema, NoteFormData, alertLevelEnum, visibilityEnum, reminderRepeatEnum } from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth"

// Mock notes data
const mockNotes = [
  {
    note_id: "1",
    employee_id: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    author_id: "hr-admin-1",
    author_role: "HR Admin",
    content: "Employee completed probation successfully. Performance review scheduled for next month.",
    created_at: new Date("2024-12-01T10:00:00Z"),
    updated_at: new Date("2024-12-01T10:00:00Z"),
    alert_level: "medium" as const,
    visibility: "public" as const,
    reminder_enabled: false,
    reminder_repeat: "none" as const,
    pinned: true,
    attachments: [],
    tags: "probation,performance",
    status: "active" as const,
  },
  {
    note_id: "2",
    employee_id: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    author_id: "manager-1",
    author_role: "Manager",
    content: "Training completed for new software system. Employee shows good adaptability.",
    created_at: new Date("2024-11-28T14:30:00Z"),
    updated_at: new Date("2024-11-28T14:30:00Z"),
    alert_level: "low" as const,
    visibility: "public" as const,
    reminder_enabled: false,
    reminder_repeat: "none" as const,
    pinned: false,
    attachments: [],
    tags: "training,software",
    status: "active" as const,
  },
  {
    note_id: "3",
    employee_id: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    author_id: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    author_role: "Employee",
    content: "Personal reminder: Annual performance review preparation due next week.",
    created_at: new Date("2024-11-25T09:15:00Z"),
    updated_at: new Date("2024-11-25T09:15:00Z"),
    reminder_at: new Date("2024-12-10T09:00:00Z"),
    alert_level: "high" as const,
    visibility: "personal" as const,
    reminder_enabled: true,
    reminder_repeat: "none" as const,
    pinned: false,
    attachments: [],
    tags: "personal,reminder",
    status: "active" as const,
  }
]

interface NotesSectionProps {
  employeeId: string
  isOwnProfile?: boolean
}

export function NotesSection({ employeeId, isOwnProfile = false }: NotesSectionProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<typeof mockNotes>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "personal">("all")

  const currentUser = getCurrentUser()
  const isHRAdmin = currentUser?.role === "hr_admin" || currentUser?.role === "admin"
  const isManager = currentUser?.role === "manager"

  useEffect(() => {
    // Mock API call - replace with actual API
    setTimeout(() => {
      setNotes(mockNotes)
      setIsLoading(false)
    }, 1000)
  }, [employeeId])

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

  const canEditNote = (note: typeof mockNotes[0]) => {
    if (isHRAdmin) return true
    if (isManager && note.author_id === currentUser?.id) return true
    if (isOwnProfile && note.author_id === currentUser?.id) return true
    return false
  }

  const canCreatePublicNote = () => {
    return isHRAdmin || isManager
  }

  const handleCreateNote = async (data: NoteFormData) => {
    try {
      // Mock API call - replace with actual API
      const newNote = {
        ...data,
        note_id: Date.now().toString(),
        employee_id: employeeId,
        author_id: currentUser?.id || "",
        author_role: currentUser?.role || "employee",
        created_at: new Date(),
        updated_at: new Date(),
      }
      
      setNotes(prev => [newNote, ...prev])
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
      // Mock API call - replace with actual API
      setNotes(prev => prev.filter(note => note.note_id !== noteId))
      
      toast({
        title: "Note Deleted",
        description: "The note has been successfully deleted.",
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
                  key={note.note_id}
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
                          onClick={() => setEditingNote(note.note_id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNote(note.note_id)}
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
      employee_id: "",
      author_id: "",
      author_role: "",
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
        <Button type="submit">
          Create Note
        </Button>
      </div>
    </form>
  )
}
