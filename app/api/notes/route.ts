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
import { getCurrentUser } from "@/lib/auth"
import { getRequestUser } from "@/lib/auth/request-user"

// Helper functions for permissions
function canDeleteNote(note: EmployeeNote, userId: string, userRole: string): boolean {
  // Only author or HR/Admin/SuperAdmin can delete
  return note.author_id === userId || 
         ["hr_admin", "admin", "super_admin", "hr_manager", "junior_hr"].includes(userRole)
}

function canCreatePublicNote(userRole: string): boolean {
  // Only HR roles and admins can create public notes
  return ["hr_admin", "admin", "super_admin", "hr_manager", "junior_hr"].includes(userRole)
}

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
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.noteId
    const existingNote = await getEmployeeNoteById(noteId)
    
    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    // Permission check
    if (!canDeleteNote(existingNote, user.id, user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateNoteSchema.parse(body)

    // Permission check for public notes
    if (validatedData.visibility === "public" && !canCreatePublicNote(user.role || "")) {
      return NextResponse.json({ 
        error: "Employees cannot create public notes" 
      }, { status: 403 })
    }

    // Map visibility to is_confidential
    const updateData: Parameters<typeof updateEmployeeNote>[1] = {
      title: validatedData.title,
      content: validatedData.content,
      alert_level: validatedData.alert_level,
      is_confidential: validatedData.visibility === "personal",
      pinned: validatedData.pinned,
      tags: validatedData.tags,
      reminder_enabled: validatedData.reminder_enabled,
      reminder_at: validatedData.reminder_at,
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })

    const updatedNote = await updateEmployeeNote(noteId, updateData)

    return NextResponse.json(mapNoteToResponse(updatedNote))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error updating note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/notes/[noteId] - Delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.noteId
    const existingNote = await getEmployeeNoteById(noteId)
    
    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    // Permission check
    if (!canDeleteNote(existingNote, user.id, user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete note
    await deleteEmployeeNote(noteId)

    return NextResponse.json({ message: "Note deleted successfully" })
  } catch (error) {
    console.error("Error deleting note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/notes/dashboard - Get high alert notes for dashboard
export async function GET_DASHBOARD(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all notes for the employee
    const allNotes = await getEmployeeNotesByEmployee(user.employeeId)

    // Global high alerts: alert_level='high' AND visibility='public' (is_confidential=false)
    const globalHighAlerts = allNotes.filter(note => 
      note.alert_level === "high" && 
      !note.is_confidential
    )

    // Personal high alerts: alert_level='high' AND visibility='personal' (is_confidential=true) AND author_id = current_user.id
    const personalHighAlerts = allNotes.filter(note => 
      note.alert_level === "high" && 
      note.is_confidential &&
      note.author_id === user.id
    )

    // HR/Admin exception: can see personal high alerts for employees
    let hrAdminPersonalHighAlerts: EmployeeNote[] = []
    if (["hr_admin", "admin", "super_admin"].includes(user.role || "")) {
      // For HR/Admin, we'd need to fetch all employee notes, but for now we'll use the employee's notes
      // In a full implementation, you'd query all notes from the database
      hrAdminPersonalHighAlerts = allNotes.filter(note => 
        note.alert_level === "high" && 
        note.is_confidential &&
        note.author_id !== user.id // Don't duplicate user's own notes
      )
    }

    // Combine and dedupe by id
    const allHighAlerts = [...globalHighAlerts, ...personalHighAlerts, ...hrAdminPersonalHighAlerts]
    const uniqueHighAlerts = allHighAlerts.filter((note, index, self) => 
      index === self.findIndex(n => n.id === note.id)
    )

    // Sort by created_at DESC and limit to 25
    const sortedHighAlerts = uniqueHighAlerts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 25)

    return NextResponse.json({
      notes: sortedHighAlerts.map(mapNoteToResponse),
      total: sortedHighAlerts.length,
    })
  } catch (error) {
    console.error("Error fetching dashboard notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
