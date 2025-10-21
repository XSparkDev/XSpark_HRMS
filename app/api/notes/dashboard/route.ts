import { NextRequest, NextResponse } from "next/server"

// GET /api/notes/dashboard - Get high alert notes for dashboard
export async function GET(request: NextRequest) {
  try {
    // For now, use mock user data since getCurrentUser() doesn't work in API routes
    // In a real app, you would get user from JWT token or session
    const mockUser = {
      id: "user-1",
      role: "employee",
      name: "Test User"
    }

    // Import the notes database from the main route
    // In a real app, this would be a database query
    const notesDB = [
      {
        note_id: "note-1",
        employee_id: "emp-1",
        author_id: "hr-admin-1",
        author_role: "hr_admin",
        content: "Performance review overdue - employee has not completed required training modules",
        alert_level: "high" as const,
        visibility: "public" as const,
        attachments: [],
        reminder_at: "2024-12-15T09:00:00Z",
        pinned: false,
        status: "active" as const,
        created_at: "2024-12-01T10:00:00Z",
        updated_at: "2024-12-01T10:00:00Z",
      },
      {
        note_id: "note-2",
        employee_id: "emp-2",
        author_id: "manager-1",
        author_role: "manager",
        content: "Disciplinary action required - repeated tardiness and policy violations",
        alert_level: "high" as const,
        visibility: "public" as const,
        attachments: [],
        reminder_at: "2024-12-05T10:00:00Z",
        pinned: false,
        status: "active" as const,
        created_at: "2024-11-28T14:30:00Z",
        updated_at: "2024-11-28T14:30:00Z",
      },
      {
        note_id: "note-3",
        employee_id: "emp-3",
        author_id: "emp-3",
        author_role: "employee",
        content: "Personal reminder: Annual performance review preparation due next week.",
        alert_level: "high" as const,
        visibility: "personal" as const,
        attachments: [],
        reminder_at: "2024-12-10T09:00:00Z",
        pinned: false,
        status: "active" as const,
        created_at: "2024-11-25T09:15:00Z",
        updated_at: "2024-11-25T09:15:00Z",
      }
    ]

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
      note.author_id === mockUser.id && 
      note.status === "active"
    )

    // HR/Admin exception: can see personal high alerts for employees
    let hrAdminPersonalHighAlerts: typeof notesDB = []
    if (["hr_admin", "admin", "super_admin"].includes(mockUser.role)) {
      hrAdminPersonalHighAlerts = notesDB.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.status === "active" &&
        note.author_id !== mockUser.id // Don't duplicate user's own notes
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
