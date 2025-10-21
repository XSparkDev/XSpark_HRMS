import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Mock user for API routes - in a real app, get from JWT token or session
const getMockUser = () => ({
  id: "user-1",
  role: "employee",
  name: "Test User"
})

// Validation schemas
const updateNoteSchema = z.object({
  employee_id: z.string().uuid().optional(),
  content: z.string().min(1, "Content is required").max(5000, "Content too long").optional(),
  alert_level: z.enum(["high", "medium", "low"]).optional(),
  visibility: z.enum(["public", "personal"]).optional(),
  attachments: z.array(z.string()).optional(),
  reminder_at: z.string().datetime().optional(),
  pinned: z.boolean().optional(),
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
function canCreatePublicNote(userRole: string): boolean {
  return ["hr_admin", "admin", "super_admin", "manager"].includes(userRole)
}

function canDeleteNote(note: any, userId: string, userRole: string): boolean {
  return note.author_id === userId || 
         ["hr_admin", "admin", "super_admin"].includes(userRole)
}

// PATCH /api/notes/[noteId] - Update note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const user = getMockUser()

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
    const user = getMockUser()

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
