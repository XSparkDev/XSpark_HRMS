import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getRequestUser } from "@/lib/auth/request-user"
import { notes2Service } from "@/lib/services/notes2-service"

const createNoteSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  content: z.string().min(1, "Content is required").max(2000, "Note is too long"),
  alert_level: z.enum(["high", "medium", "low"]).default("low"),
})

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const notes = await notes2Service.getNotesByEmployee(user.id)
    return NextResponse.json({ success: true, data: notes })
  } catch (error) {
    console.error("Notes2 GET error:", error)
    return NextResponse.json({ success: false, error: "Failed to load notes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("[Notes2 API][POST] incoming body", body)
    const payload = createNoteSchema.parse(body)

    const noteInput = {
      employee_id: user.id,
      title: payload.title ?? null,
      content: payload.content,
      alert_level: payload.alert_level,
    }
    console.log("[Notes2 API][POST] create payload", noteInput)
    const note = await notes2Service.createNote(noteInput)
    console.log("[Notes2 API][POST] created note", note)

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 },
      )
    }
    console.error("Notes2 POST error:", error)
    return NextResponse.json({ success: false, error: "Failed to create note" }, { status: 500 })
  }
}

