import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getEmployeeNoteById,
  updateEmployeeNote,
  deleteEmployeeNote,
} from "@/lib/services/employee-notes-service"
import { getRequestUser } from "@/lib/auth/request-user"

const updateNoteSchema = z.object({
  title: z.string().optional().nullable(),
  content: z.string().min(1, "Content required"),
  alert_level: z.enum(["high", "medium", "low"]),
  pinned: z.boolean().optional(),
  tags: z.string().optional().nullable(),
  reminder_enabled: z.boolean().optional(),
  reminder_at: z.string().optional().nullable(),
  visibility: z.enum(["personal", "shared"]).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { noteId: string } }) {
  const user = getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const payload = updateNoteSchema.parse(body)

  const note = await getEmployeeNoteById(params.noteId)
  if (!note || note.employee_id !== user.employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await updateEmployeeNote(params.noteId, {
    ...payload,
    is_confidential: payload.visibility === "personal",
  })

  return NextResponse.json(updated, { status: 200 })
}

export async function DELETE(request: NextRequest, { params }: { params: { noteId: string } }) {
  const user = getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const note = await getEmployeeNoteById(params.noteId)
  if (!note || note.employee_id !== user.employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await deleteEmployeeNote(params.noteId)
  return NextResponse.json({ success: true })
}
