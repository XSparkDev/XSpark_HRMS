"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { AlertTriangle, Eye, User, Calendar, MessageSquare, Plus } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { getCurrentUser } from "@/lib/auth"

// Mock high-alert notes data
const mockHighAlertNotes = [
  {
    note_id: "1",
    employee_id: "emp-1",
    employee_name: "John Doe",
    employee_number: "XSP2501/001",
    content: "Performance review overdue - employee has not completed required training modules",
    created_at: "2024-12-01T10:00:00Z",
    author_role: "HR Admin",
    alert_level: "high" as const,
    visibility: "public" as const,
    reminder_at: "2024-12-15T09:00:00Z",
    reminder_enabled: true,
    tags: "performance,training,overdue",
  },
  {
    note_id: "2",
    employee_id: "emp-2",
    employee_name: "Jane Smith",
    employee_number: "XSP2501/002",
    content: "Disciplinary action required - repeated tardiness and policy violations",
    created_at: "2024-11-28T14:30:00Z",
    author_role: "Manager",
    alert_level: "high" as const,
    visibility: "public" as const,
    reminder_at: "2024-12-05T10:00:00Z",
    reminder_enabled: true,
    tags: "disciplinary,policy,tardiness",
  },
  {
    note_id: "3",
    employee_id: "emp-3",
    employee_name: "Mike Johnson",
    employee_number: "XSP2501/003",
    content: "Contract renewal deadline approaching - decision needed within 2 weeks",
    created_at: "2024-11-25T09:15:00Z",
    author_role: "HR Admin",
    alert_level: "high" as const,
    visibility: "public" as const,
    reminder_at: "2024-12-10T09:00:00Z",
    reminder_enabled: true,
    tags: "contract,renewal,deadline",
  }
]

interface NotesDashboardProps {
  isManager?: boolean
}

export function NotesDashboard({ isManager = false }: NotesDashboardProps) {
  const { toast } = useToast()
  const [highAlertNotes, setHighAlertNotes] = useState<typeof mockHighAlertNotes>([])
  const [isLoading, setIsLoading] = useState(true)

  const currentUser = getCurrentUser()
  const isHRAdmin = currentUser?.role === "hr_admin" || currentUser?.role === "admin"

  useEffect(() => {
    // Mock API call - replace with actual API
    setTimeout(() => {
      setHighAlertNotes(mockHighAlertNotes)
      setIsLoading(false)
    }, 1000)
  }, [])

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

  const handleViewEmployee = (employeeId: string) => {
    // Navigate to employee profile
    window.location.href = `/employees/${employeeId}`
  }

  const handleCreateNote = () => {
    // Navigate to notes creation
    window.location.href = "/notes/create"
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

  const filteredNotes = highAlertNotes.filter(note => {
    // If manager, only show notes for their direct reports
    if (isManager && !isHRAdmin) {
      // Mock check - in real app, check if employee is direct report
      return true
    }
    return true
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            High Alert Notes
            <Badge variant="destructive" className="ml-2">
              {filteredNotes.length}
            </Badge>
          </CardTitle>
          {(isHRAdmin || isManager) && (
            <Button size="sm" onClick={handleCreateNote} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Note
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Critical notes requiring immediate attention
        </p>
      </CardHeader>
      
      <CardContent>
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No high alert notes at this time.</p>
            <p className="text-sm">All systems are running smoothly!</p>
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
                    "border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-gray-50 transition-colors",
                    getAlertLevelColor(note.alert_level)
                  )}
                  onClick={() => handleViewEmployee(note.employee_id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getAlertLevelColor(note.alert_level)}>
                        HIGH ALERT
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        <span>Public</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{note.author_role}</span>
                    </div>
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
                      <div className="text-xs">
                        {note.tags.split(',').map(tag => (
                          <span key={tag} className="bg-gray-100 px-2 py-1 rounded mr-1">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="text-xs">
                      View Employee Profile
                    </Button>
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
