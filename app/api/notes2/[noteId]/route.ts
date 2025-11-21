import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getRequestUser } from "@/lib/auth/request-user"
import { notes2Service } from "@/lib/services/notes2-service"

const PUBLIC_NOTE_ROLES = new Set(["admin", "super_admin", "junior_hr", "hr_manager", "hr_admin"])

const updateSchema = z.object({
  title: z
    .string()
    .max(120, "Title is too long")
    .optional()
    .nullable(),
  content: z
    .string()
    .max(2000, "Content is too long")
    .optional(),
  alert_level: z.enum(["high", "medium", "low"]).optional(),
  visibility: z.enum(["private", "public"]).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.noteId
    if (!noteId) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 })
    }

    const body = await request.json()
    console.log("[Notes2 API][PATCH]", { noteId, body })
    const payload = updateSchema.parse(body)

    if (!Object.keys(payload).length) {
      return NextResponse.json(
        { success: false, error: "Please provide at least one field to update." },
        { status: 400 },
      )
    }

    if (payload.visibility === "public" && !PUBLIC_NOTE_ROLES.has(user.role)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to make a note public." },
        { status: 403 },
      )
    }

    const updated = await notes2Service.updateNote(noteId, payload, user.id)
    console.log("[Notes2 API][PATCH] updated note", updated)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 },
      )
    }

    console.error("Notes2 PATCH error:", error)
    return NextResponse.json({ success: false, error: "Failed to update note" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.noteId
    if (!noteId) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 })
    }

    console.log("[Notes2 API][DELETE]", { noteId, employeeId: user.id })
    await notes2Service.deleteNote(noteId, user.id)
    console.log("[Notes2 API][DELETE] success", { noteId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Notes2 DELETE error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete note" }, { status: 500 })
  }
}

