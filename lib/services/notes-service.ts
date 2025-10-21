// Shared notes service for consistent data management across components
// This will be replaced with actual Supabase integration

interface Note {
  note_id: string
  employee_id: string | null // nullable if general note
  author_id: string
  content: string
  alert_level: "high" | "medium" | "low"
  visibility: "public" | "personal"
  attachments: string[]
  reminder_at: string | null
  pinned: boolean
  status: "active" | "archived" | "deleted"
  created_at: string
  updated_at: string
  deleted_by: string | null
  deleted_at: string | null
  author_role: string
  // Additional fields for display
  employee_name?: string
  employee_number?: string
  author_name?: string
}

// Mock data store - replace with Supabase table
let notesStore: Note[] = [
  {
    note_id: "note-1",
    employee_id: "emp-1",
    author_id: "hr-admin-1",
    content: "Performance review overdue - employee has not completed required training modules",
    alert_level: "high",
    visibility: "public",
    attachments: [],
    reminder_at: "2024-12-15T09:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-12-01T10:00:00Z",
    updated_at: "2024-12-01T10:00:00Z",
    deleted_by: null,
    deleted_at: null,
    author_role: "HR Admin",
    employee_name: "John Doe",
    employee_number: "XSP2501/001",
    author_name: "HR Admin",
  },
  {
    note_id: "note-2",
    employee_id: "emp-2",
    author_id: "manager-1",
    content: "Disciplinary action required - repeated tardiness and policy violations",
    alert_level: "high",
    visibility: "public",
    attachments: [],
    reminder_at: "2024-12-05T10:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-11-28T14:30:00Z",
    updated_at: "2024-11-28T14:30:00Z",
    deleted_by: null,
    deleted_at: null,
    author_role: "Manager",
    employee_name: "Jane Smith",
    employee_number: "XSP2501/002",
    author_name: "Manager",
  },
  {
    note_id: "note-3",
    employee_id: "emp-3",
    author_id: "hr-admin-1",
    content: "Contract renewal deadline approaching - decision needed within 2 weeks",
    alert_level: "high",
    visibility: "public",
    attachments: [],
    reminder_at: "2024-12-10T09:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-11-25T09:15:00Z",
    updated_at: "2024-11-25T09:15:00Z",
    deleted_by: null,
    deleted_at: null,
    author_role: "HR Admin",
    employee_name: "Mike Johnson",
    employee_number: "XSP2501/003",
    author_name: "HR Admin",
  },
  {
    note_id: "note-4",
    employee_id: "emp-1",
    author_id: "manager-1",
    content: "Training completed for new software system. Employee shows good adaptability.",
    alert_level: "medium",
    visibility: "public",
    attachments: [],
    reminder_at: null,
    pinned: false,
    status: "active",
    created_at: "2024-11-28T14:30:00Z",
    updated_at: "2024-11-28T14:30:00Z",
    deleted_by: null,
    deleted_at: null,
    author_role: "Manager",
    employee_name: "John Doe",
    employee_number: "XSP2501/001",
    author_name: "Manager",
  },
  {
    note_id: "note-5",
    employee_id: "emp-3",
    author_id: "emp-3",
    content: "Personal reminder: Annual performance review preparation due next week.",
    alert_level: "high",
    visibility: "personal",
    attachments: [],
    reminder_at: "2024-12-10T09:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-11-25T09:15:00Z",
    updated_at: "2024-11-25T09:15:00Z",
    deleted_by: null,
    deleted_at: null,
    author_role: "Employee",
    employee_name: "Mike Johnson",
    employee_number: "XSP2501/003",
    author_name: "Mike Johnson",
  }
]

// Event listeners for real-time updates
const listeners: Array<(notes: Note[]) => void> = []

const notifyListeners = () => {
  listeners.forEach(listener => listener([...notesStore]))
}

export const notesService = {
  // Get all notes
  async getAllNotes(): Promise<Note[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    return [...notesStore]
  },

  // Get high alert notes for dashboard (implements correct visibility rules)
  async getHighAlertNotesForDashboard(userId: string, userRole: string): Promise<Note[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Global high alerts: alert_level='high' AND visibility='public' AND status='active'
    const globalHighAlerts = notesStore.filter(note => 
      note.alert_level === "high" && 
      note.visibility === "public" && 
      note.status === "active"
    )
    
    // Personal high alerts: alert_level='high' AND visibility='personal' AND author_id = current_user.id AND status='active'
    const personalHighAlerts = notesStore.filter(note => 
      note.alert_level === "high" && 
      note.visibility === "personal" && 
      note.author_id === userId && 
      note.status === "active"
    )
    
    // HR/Admin exception: can see personal high alerts for employees
    let hrAdminPersonalHighAlerts: Note[] = []
    if (userRole === "hr_admin" || userRole === "admin" || userRole === "super_admin") {
      hrAdminPersonalHighAlerts = notesStore.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.status === "active" &&
        note.author_id !== userId // Don't duplicate user's own notes
      )
    }
    
    // Combine and dedupe by note_id
    const allHighAlerts = [...globalHighAlerts, ...personalHighAlerts, ...hrAdminPersonalHighAlerts]
    const uniqueHighAlerts = allHighAlerts.filter((note, index, self) => 
      index === self.findIndex(n => n.note_id === note.note_id)
    )
    
    // Developer warning for missing note_id
    const notesWithoutId = uniqueHighAlerts.filter(note => !note.note_id)
    if (notesWithoutId.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Found ${notesWithoutId.length} notes without note_id. This will cause duplicate key errors.`)
    }
    
    // Sort by created_at DESC and limit to 25
    return uniqueHighAlerts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 25)
  },

  // Create a new note
  async createNote(note: Omit<Note, "note_id" | "created_at" | "updated_at">): Promise<Note> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newNote: Note = {
      note_id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...note,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    notesStore.push(newNote)
    
    // Log creation for audit
    console.log("Note created:", {
      note_id: newNote.note_id,
      author_id: newNote.author_id,
      author_role: newNote.author_role,
      alert_level: newNote.alert_level,
      visibility: newNote.visibility,
      action: "create",
      timestamp: new Date().toISOString()
    })
    
    notifyListeners()
    return newNote
  },

  // Soft delete a note
  async deleteNote(noteId: string, userId: string, userRole: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const noteIndex = notesStore.findIndex(note => note.note_id === noteId)
    if (noteIndex === -1) {
      throw new Error("Note not found")
    }
    
    const note = notesStore[noteIndex]
    
    // Check permissions: only author or HR/Admin/SuperAdmin can delete
    const canDelete = note.author_id === userId || 
                     userRole === "hr_admin" || 
                     userRole === "admin" || 
                     userRole === "super_admin"
    
    if (!canDelete) {
      throw new Error("Insufficient permissions to delete note")
    }
    
    // Soft delete: set status='deleted', record deleted_by & deleted_at
    notesStore[noteIndex] = {
      ...note,
      status: "deleted",
      deleted_by: userId,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    // Log deletion for audit
    console.log("Note deleted:", {
      note_id: noteId,
      deleted_by: userId,
      user_role: userRole,
      note_author: note.author_id,
      alert_level: note.alert_level,
      visibility: note.visibility,
      action: "delete",
      timestamp: new Date().toISOString()
    })
    
    notifyListeners()
  },

  // Update a note
  async updateNote(noteId: string, updates: Partial<Note>): Promise<Note | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const index = notesStore.findIndex(note => note.note_id === noteId)
    if (index !== -1) {
      notesStore[index] = {
        ...notesStore[index],
        ...updates,
        updated_at: new Date().toISOString(),
      }
      notifyListeners()
      return notesStore[index]
    }
    return null
  },

  // Subscribe to real-time updates
  subscribe(listener: (notes: Note[]) => void): () => void {
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  },

  // Get notes by employee ID
  async getNotesByEmployee(employeeId: string): Promise<Note[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    return notesStore.filter(note => note.employee_id === employeeId)
  },

  // Get notes by author ID
  async getNotesByAuthor(authorId: string): Promise<Note[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    return notesStore.filter(note => note.author_id === authorId)
  }
}

export type { Note }
