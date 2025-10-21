import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Mock user for API routes - in a real app, get from JWT token or session
const getMockUser = () => ({
  id: "user-1",
  role: "employee",
  name: "Test User"
})

// Validation schemas
const createNoteSchema = z.object({
  employee_id: z.string().uuid().optional(),
  content: z.string().min(1, "Content is required").max(5000, "Content too long"),
  alert_level: z.enum(["high", "medium", "low"]),
  visibility: z.enum(["public", "personal"]),
  attachments: z.array(z.string()).optional().default([]),
  reminder_at: z.string().datetime().optional(),
  pinned: z.boolean().optional().default(false),
})

const updateNoteSchema = createNoteSchema.partial()

const queryNotesSchema = z.object({
  employee_id: z.string().uuid().optional(),
  alert_level: z.enum(["high", "medium", "low"]).optional(),
  visibility: z.enum(["public", "personal"]).optional(),
  status: z.enum(["active", "archived", "deleted"]).optional().default("active"),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  offset: z.coerce.number().min(0).optional().default(0),
})

// Mock database - replace with actual Supabase/PostgreSQL
let notesDB: Array<{
  note_id: string
  employee_id?: string
  author_id: string
  author_role: string
  content: string
  alert_level: "high" | "medium" | "low"
  visibility: "public" | "personal"
  attachments: string[]
  reminder_at?: string
  pinned: boolean
  status: "active" | "archived" | "deleted"
  created_at: string
  updated_at: string
  deleted_by?: string
  deleted_at?: string
}> = [
  {
    note_id: "note-1",
    employee_id: "emp-1",
    author_id: "hr-admin-1",
    author_role: "hr_admin",
    content: "Performance review overdue - employee has not completed required training modules",
    alert_level: "high",
    visibility: "public",
    attachments: [],
    reminder_at: "2024-12-15T09:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-12-01T10:00:00Z",
    updated_at: "2024-12-01T10:00:00Z",
  },
  {
    note_id: "note-2",
    employee_id: "emp-2",
    author_id: "manager-1",
    author_role: "manager",
    content: "Disciplinary action required - repeated tardiness and policy violations",
    alert_level: "high",
    visibility: "public",
    attachments: [],
    reminder_at: "2024-12-05T10:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-11-28T14:30:00Z",
    updated_at: "2024-11-28T14:30:00Z",
  },
  {
    note_id: "note-3",
    employee_id: "emp-3",
    author_id: "emp-3",
    author_role: "employee",
    content: "Personal reminder: Annual performance review preparation due next week.",
    alert_level: "high",
    visibility: "personal",
    attachments: [],
    reminder_at: "2024-12-10T09:00:00Z",
    pinned: false,
    status: "active",
    created_at: "2024-11-25T09:15:00Z",
    updated_at: "2024-11-25T09:15:00Z",
  }
]

// Audit logging function
function logAuditAction(
  noteId: string,
  actorId: string,
  actorRole: string,
  action: string,
  previousValue?: any,
  newValue?: any
) {
  console.log("AUDIT:", {
    note_id: noteId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    previous_value: previousValue,
    new_value: newValue,
    timestamp: new Date().toISOString(),
    ip_address: "127.0.0.1", // In real app, get from request
    user_agent: "API", // In real app, get from request headers
  })
}

// Permission checks
function canViewNotes(userRole: string, requestedEmployeeId?: string, currentUserId?: string): boolean {
  if (userRole === "hr_admin" || userRole === "admin" || userRole === "super_admin") {
    return true
  }
  
  if (requestedEmployeeId && requestedEmployeeId !== currentUserId) {
    return false
  }
  
  return true
}

function canCreatePublicNote(userRole: string): boolean {
  return ["hr_admin", "admin", "super_admin", "manager"].includes(userRole)
}

function canDeleteNote(note: any, userId: string, userRole: string): boolean {
  return note.author_id === userId || 
         ["hr_admin", "admin", "super_admin"].includes(userRole)
}

// GET /api/notes - List notes with filters
export async function GET(request: NextRequest) {
  try {
    const user = getMockUser()

    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams.entries())
    const validatedQuery = queryNotesSchema.parse(query)

    // Permission check for employee_id filter
    if (validatedQuery.employee_id && !canViewNotes(user.role, validatedQuery.employee_id, user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build filter
    let filteredNotes = notesDB.filter(note => {
      if (validatedQuery.status && note.status !== validatedQuery.status) return false
      if (validatedQuery.alert_level && note.alert_level !== validatedQuery.alert_level) return false
      if (validatedQuery.visibility && note.visibility !== validatedQuery.visibility) return false
      if (validatedQuery.employee_id && note.employee_id !== validatedQuery.employee_id) return false
      
      // Visibility rules
      if (note.visibility === "personal" && note.author_id !== user.id) {
        // Only HR/Admin can see personal notes from others
        if (!["hr_admin", "admin", "super_admin"].includes(user.role)) {
          return false
        }
      }
      
      return true
    })

    // Sort by created_at DESC
    filteredNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Pagination
    const offset = validatedQuery.offset || 0
    const limit = validatedQuery.limit || 25
    const paginatedNotes = filteredNotes.slice(offset, offset + limit)

    // Log view action for personal notes viewed by HR/Admin
    if (validatedQuery.employee_id && validatedQuery.employee_id !== user.id) {
      paginatedNotes.forEach(note => {
        if (note.visibility === "personal") {
          logAuditAction(note.note_id, user.id, user.role, "view")
        }
      })
    }

    return NextResponse.json({
      notes: paginatedNotes,
      total: filteredNotes.length,
      offset,
      limit,
    })
  } catch (error) {
    console.error("Error fetching notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/notes - Create new note
export async function POST(request: NextRequest) {
  try {
    const user = getMockUser()

    const body = await request.json()
    const validatedData = createNoteSchema.parse(body)

    // Permission check for public notes
    if (validatedData.visibility === "public" && !canCreatePublicNote(user.role)) {
      return NextResponse.json({ 
        error: "Employees cannot create public notes" 
      }, { status: 403 })
    }

    // Create new note
    const newNote = {
      note_id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      employee_id: validatedData.employee_id,
      author_id: user.id,
      author_role: user.role,
      content: validatedData.content,
      alert_level: validatedData.alert_level,
      visibility: validatedData.visibility,
      attachments: validatedData.attachments || [],
      reminder_at: validatedData.reminder_at,
      pinned: validatedData.pinned || false,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    notesDB.push(newNote)

    // Log creation
    logAuditAction(newNote.note_id, user.id, user.role, "create", null, newNote)

    return NextResponse.json(newNote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/notes/[noteId] - Update note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.noteId
    const noteIndex = notesDB.findIndex(note => note.note_id === noteId)
    
    if (noteIndex === -1) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const existingNote = notesDB[noteIndex]

    // Permission check
    if (!canDeleteNote(existingNote, user.id, user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateNoteSchema.parse(body)

    // Permission check for public notes
    if (validatedData.visibility === "public" && !canCreatePublicNote(user.role)) {
      return NextResponse.json({ 
        error: "Employees cannot create public notes" 
      }, { status: 403 })
    }

    // Update note
    const updatedNote = {
      ...existingNote,
      ...validatedData,
      updated_at: new Date().toISOString(),
    }

    notesDB[noteIndex] = updatedNote

    // Log update
    logAuditAction(
      noteId, 
      user.id, 
      user.role, 
      existingNote.visibility !== updatedNote.visibility ? "visibility_change" : "edit",
      existingNote,
      updatedNote
    )

    return NextResponse.json(updatedNote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error updating note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/notes/[noteId] - Soft delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.noteId
    const noteIndex = notesDB.findIndex(note => note.note_id === noteId)
    
    if (noteIndex === -1) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const existingNote = notesDB[noteIndex]

    // Permission check
    if (!canDeleteNote(existingNote, user.id, user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Soft delete
    const deletedNote = {
      ...existingNote,
      status: "deleted" as const,
      deleted_by: user.id,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    notesDB[noteIndex] = deletedNote

    // Log deletion
    logAuditAction(noteId, user.id, user.role, "delete", existingNote, null)

    return NextResponse.json({ message: "Note deleted successfully" })
  } catch (error) {
    console.error("Error deleting note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/notes/dashboard - Get high alert notes for dashboard
export async function GET_DASHBOARD(request: NextRequest) {
  try {
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Global high alerts: alert_level='high' AND visibility='public' AND status='active'
    const globalHighAlerts = notesDB.filter(note => 
      note.alert_level === "high" && 
      note.visibility === "public" && 
      note.status === "active"
    )

    // Personal high alerts: alert_level='high' AND visibility='personal' AND author_id = current_user.id AND status='active'
    const personalHighAlerts = notesDB.filter(note => 
      note.alert_level === "high" && 
      note.visibility === "personal" && 
      note.author_id === user.id && 
      note.status === "active"
    )

    // HR/Admin exception: can see personal high alerts for employees
    let hrAdminPersonalHighAlerts: typeof notesDB = []
    if (["hr_admin", "admin", "super_admin"].includes(user.role)) {
      hrAdminPersonalHighAlerts = notesDB.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.status === "active" &&
        note.author_id !== user.id // Don't duplicate user's own notes
      )
    }

    // Combine and dedupe by note_id
    const allHighAlerts = [...globalHighAlerts, ...personalHighAlerts, ...hrAdminPersonalHighAlerts]
    const uniqueHighAlerts = allHighAlerts.filter((note, index, self) => 
      index === self.findIndex(n => n.note_id === note.note_id)
    )

    // Sort by created_at DESC and limit to 25
    const sortedHighAlerts = uniqueHighAlerts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 25)

    return NextResponse.json({
      notes: sortedHighAlerts,
      total: sortedHighAlerts.length,
    })
  } catch (error) {
    console.error("Error fetching dashboard notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
