import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  createEmployeeNote,
  deleteEmployeeNote,
  getEmployeeNoteById,
  getEmployeeNotesByEmployee,
  updateEmployeeNote,
  type EmployeeNote,
} from "@/lib/services"
import { getRequestUser } from "@/lib/auth/request-user"

const visibilityEnum = z.enum(["public", "personal"]) as unknown as z.ZodEnum<["public", "personal"]>

const createNoteSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1, "Content is required").max(5000, "Content too long"),
  alert_level: z.enum(["high", "medium", "low"]).default("low"),
  visibility: visibilityEnum.default("personal"),
  pinned: z.boolean().optional(),
  tags: z.string().max(255).optional().nullable(),
  reminder_enabled: z.boolean().optional(),
  reminder_at: z.string().datetime().optional(),
})

const updateNoteSchema = createNoteSchema.partial()

function mapNoteToResponse(note: EmployeeNote) {
  return {
    ...note,
    visibility: note.is_confidential ? "personal" : "public",
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notes = await getEmployeeNotesByEmployee(user.employeeId)
    return NextResponse.json({
      notes: notes.map(mapNoteToResponse),
      total: notes.length,
      offset: 0,
      limit: notes.length,
    })
  } catch (error) {
    console.error("Error fetching notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const payload = createNoteSchema.parse(body)

    const newNote = await createEmployeeNote({
      employee_id: user.employeeId,
      author_id: user.id,
      title: payload.title ?? null,
      content: payload.content,
      alert_level: payload.alert_level,
      is_confidential: payload.visibility === "personal",
      pinned: payload.pinned ?? false,
      tags: payload.tags ?? null,
      reminder_enabled: payload.reminder_enabled ?? false,
      reminder_at: payload.reminder_at ?? null,
    })

    return NextResponse.json(mapNoteToResponse(newNote), { status: 201 })
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
