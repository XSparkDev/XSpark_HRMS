import { NextRequest, NextResponse } from "next/server"

import { getRequestUser } from "@/lib/auth/request-user"
import { notes2Service } from "@/lib/services/notes2-service"

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const notes = await notes2Service.getHighAlertNotesByEmployee(user.id)
    return NextResponse.json({ success: true, data: notes })
  } catch (error) {
    console.error("Notes2 high-alert GET error:", error)
    return NextResponse.json({ success: false, error: "Failed to load high alert notes" }, { status: 500 })
  }
}

