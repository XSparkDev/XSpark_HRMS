"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { format } from "date-fns"
import { AlertTriangle, Trash2, User, Calendar, Info } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { getCurrentUser } from "@/lib/auth"
import { notesService, type Note } from "@/lib/services/notes-service"

interface HighAlertNotesProps {
  className?: string
}

export function HighAlertNotes({ className }: HighAlertNotesProps) {
  const { toast } = useToast()
  const [highAlertNotes, setHighAlertNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    // Fetch high alert notes from API endpoint with correct visibility rules
    const fetchHighAlertNotes = async () => {
      try {
        setHasError(false)
        const response = await fetch('/api/notes/dashboard')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard notes')
        }
        const data = await response.json()
        setHighAlertNotes(data.notes || [])
      } catch (error) {
        console.error("Error fetching high alert notes:", error)
        setHasError(true)
        toast({
          title: "Error",
          description: "Failed to load high alert notes",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchHighAlertNotes()

    // Subscribe to real-time updates
    const unsubscribe = notesService.subscribe((notes) => {
      // Re-apply the same filtering logic for real-time updates
      const globalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "public" && 
        note.status === "active"
      )
      
      const personalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.author_id === (currentUser?.id || "") && 
        note.status === "active"
      )
      
      let hrAdminPersonalHighAlerts: typeof notes = []
      if (currentUser?.role === "hr_admin" || currentUser?.role === "admin" || currentUser?.role === "super_admin") {
        hrAdminPersonalHighAlerts = notes.filter(note => 
          note.alert_level === "high" && 
          note.visibility === "personal" && 
          note.status === "active" &&
          note.author_id !== (currentUser?.id || "")
        )
      }
      
      const allHighAlerts = [...globalHighAlerts, ...personalHighAlerts, ...hrAdminPersonalHighAlerts]
      const uniqueHighAlerts = allHighAlerts.filter((note, index, self) => 
        index === self.findIndex(n => n.note_id === note.note_id)
      )
      
      setHighAlertNotes(uniqueHighAlerts
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 25)
      )
    })

    return unsubscribe
  }, [toast]) // Remove currentUser from dependencies to prevent infinite loops

  const handleDeleteNote = useCallback(async (noteId: string) => {
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
        description: "High alert note has been removed from all dashboards.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      })
    }
  }, [toast])

  const getStableKey = (note: Note) => {
    // Create stable composite key to avoid duplicate key errors
    const baseId = note.note_id || `${note.author_id}-${note.created_at}`
    const timestamp = new Date(note.created_at).getTime()
    return `${baseId}-${timestamp}`
  }

  const canDeleteNote = useMemo(() => {
    return (note: Note) => {
      return note.author_id === currentUser?.id || 
             currentUser?.role === "hr_admin" || 
             currentUser?.role === "admin" || 
             currentUser?.role === "super_admin"
    }
  }, [currentUser?.id, currentUser?.role])

  const truncateContent = useCallback((content: string, maxLength: number = 100) => {
    return content.length > maxLength ? content.substring(0, maxLength) + "..." : content
  }, [])

  if (isLoading) {
    return (
      <Card className={cn("rounded-xl shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            ⚠️ High Alert Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card className={cn("rounded-xl shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            ⚠️ High Alert Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-600 py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p>Failed to load high alert notes.</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (highAlertNotes.length === 0) {
    return (
      <Card className={cn("rounded-xl shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            ⚠️ High Alert Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No high alert notes at this time.</p>
            <p className="text-xs text-muted-foreground">All systems are running smoothly!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("rounded-xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-navy flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          ⚠️ High Alert Notes
          <div className="group relative">
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
              High + Public: visible to everyone<br/>
              High + Personal: visible only to author
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <AnimatePresence>
            {highAlertNotes.map((note) => (
              <motion.div
                key={getStableKey(note)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="border border-red-200 rounded-lg p-4 bg-red-50/50 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive" className="bg-red-600 text-white">
                        HIGH ALERT
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {note.employee_name} ({note.employee_number})
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-800 mb-3">
                      {truncateContent(note.content)}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                          <span>Due: {format(new Date(note.reminder_at), "MMM dd, yyyy")}</span>
                        </div>
                      )}
                    </div>
                    
                    {note.tags && (
                      <div className="mt-2">
                        {note.tags.split(',').map(tag => (
                          <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-xs mr-1">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {canDeleteNote(note) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmNote(note.note_id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmNote} onOpenChange={() => setDeleteConfirmNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete High Alert Note</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this high alert note? This action cannot be undone and will remove the note from all dashboards.
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
    </Card>
  )
}
