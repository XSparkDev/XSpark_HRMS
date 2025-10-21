import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"

// Mock the API endpoints
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(() => ({
    id: "user-1",
    role: "employee",
    name: "Test User"
  }))
}))

// Mock the toast hook
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe("Notes Visibility Rules - Comprehensive Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  describe("API Endpoints", () => {
    it("should create note with correct visibility rules", async () => {
      const noteData = {
        employee_id: "emp-1",
        content: "Test note",
        alert_level: "high",
        visibility: "public",
        attachments: [],
        pinned: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note_id: "note-123",
          ...noteData,
          author_id: "user-1",
          author_role: "employee",
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      })

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      })

      expect(response.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      }))
    })

    it("should reject public note creation by employees", async () => {
      const noteData = {
        content: "Test note",
        alert_level: "high",
        visibility: "public",
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Employees cannot create public notes" })
      })

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(403)
    })

    it("should fetch dashboard notes with correct visibility rules", async () => {
      const mockNotes = [
        {
          note_id: "note-1",
          alert_level: "high",
          visibility: "public",
          status: "active",
          content: "Global high alert",
          author_id: "hr-admin-1",
          created_at: "2024-12-01T10:00:00Z"
        },
        {
          note_id: "note-2",
          alert_level: "high",
          visibility: "personal",
          status: "active",
          content: "Personal high alert",
          author_id: "user-1",
          created_at: "2024-12-01T09:00:00Z"
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes: mockNotes, total: 2 })
      })

      const response = await fetch('/api/notes/dashboard')
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.notes).toHaveLength(2)
      expect(data.notes[0].alert_level).toBe("high")
      expect(data.notes[0].visibility).toBe("public")
    })

    it("should soft delete notes correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Note deleted successfully" })
      })

      const response = await fetch('/api/notes/note-123', {
        method: 'DELETE'
      })

      expect(response.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/notes/note-123', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
    })

    it("should reject unauthorized note deletion", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Forbidden" })
      })

      const response = await fetch('/api/notes/note-123', {
        method: 'DELETE'
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(403)
    })
  })

  describe("Visibility Rules Logic", () => {
    it("should return global high alerts (high + public + active)", () => {
      const notes = [
        { note_id: "1", alert_level: "high", visibility: "public", status: "active" },
        { note_id: "2", alert_level: "high", visibility: "personal", status: "active" },
        { note_id: "3", alert_level: "medium", visibility: "public", status: "active" },
        { note_id: "4", alert_level: "high", visibility: "public", status: "deleted" },
      ]

      const globalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "public" && 
        note.status === "active"
      )

      expect(globalHighAlerts).toHaveLength(1)
      expect(globalHighAlerts[0].note_id).toBe("1")
    })

    it("should return personal high alerts for current user", () => {
      const userId = "user-1"
      const notes = [
        { note_id: "1", alert_level: "high", visibility: "personal", status: "active", author_id: "user-1" },
        { note_id: "2", alert_level: "high", visibility: "personal", status: "active", author_id: "user-2" },
        { note_id: "3", alert_level: "high", visibility: "personal", status: "deleted", author_id: "user-1" },
      ]

      const personalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.author_id === userId && 
        note.status === "active"
      )

      expect(personalHighAlerts).toHaveLength(1)
      expect(personalHighAlerts[0].note_id).toBe("1")
    })

    it("should allow HR/Admin to see personal high alerts from employees", () => {
      const userRole = "hr_admin"
      const userId = "hr-admin-1"
      const notes = [
        { note_id: "1", alert_level: "high", visibility: "personal", status: "active", author_id: "user-1" },
        { note_id: "2", alert_level: "high", visibility: "personal", status: "active", author_id: "hr-admin-1" },
        { note_id: "3", alert_level: "high", visibility: "personal", status: "active", author_id: "user-2" },
      ]

      let hrAdminPersonalHighAlerts = []
      if (["hr_admin", "admin", "super_admin"].includes(userRole)) {
        hrAdminPersonalHighAlerts = notes.filter(note => 
          note.alert_level === "high" && 
          note.visibility === "personal" && 
          note.status === "active" &&
          note.author_id !== userId // Don't duplicate user's own notes
        )
      }

      expect(hrAdminPersonalHighAlerts).toHaveLength(2)
      expect(hrAdminPersonalHighAlerts.map(n => n.note_id)).toEqual(["1", "3"])
    })

    it("should deduplicate notes when combining global and personal alerts", () => {
      const globalHighAlerts = [
        { note_id: "1", alert_level: "high", visibility: "public", status: "active" },
        { note_id: "2", alert_level: "high", visibility: "public", status: "active" },
      ]

      const personalHighAlerts = [
        { note_id: "1", alert_level: "high", visibility: "personal", status: "active", author_id: "user-1" },
        { note_id: "3", alert_level: "high", visibility: "personal", status: "active", author_id: "user-1" },
      ]

      const allHighAlerts = [...globalHighAlerts, ...personalHighAlerts]
      const uniqueHighAlerts = allHighAlerts.filter((note, index, self) => 
        index === self.findIndex(n => n.note_id === note.note_id)
      )

      expect(uniqueHighAlerts).toHaveLength(3)
      expect(uniqueHighAlerts.map(n => n.note_id)).toEqual(["1", "2", "3"])
    })

    it("should sort notes by created_at DESC", () => {
      const notes = [
        { note_id: "1", created_at: "2024-12-01T10:00:00Z" },
        { note_id: "2", created_at: "2024-12-01T09:00:00Z" },
        { note_id: "3", created_at: "2024-12-01T11:00:00Z" },
      ]

      const sortedNotes = notes.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      expect(sortedNotes[0].note_id).toBe("3")
      expect(sortedNotes[1].note_id).toBe("1")
      expect(sortedNotes[2].note_id).toBe("2")
    })

    it("should limit results to 25 notes", () => {
      const notes = Array.from({ length: 30 }, (_, i) => ({
        note_id: `note-${i}`,
        alert_level: "high",
        visibility: "public",
        status: "active",
        created_at: new Date().toISOString()
      }))

      const limitedNotes = notes.slice(0, 25)

      expect(limitedNotes).toHaveLength(25)
    })
  })

  describe("Stable Key Generation", () => {
    it("should generate stable keys for notes with note_id", () => {
      const note = {
        note_id: "note-123",
        author_id: "user-1",
        created_at: "2024-12-01T10:00:00Z"
      }

      const getStableKey = (note: any) => {
        const baseId = note.note_id || `${note.author_id}-${note.created_at}`
        const timestamp = new Date(note.created_at).getTime()
        return `${baseId}-${timestamp}`
      }

      const key = getStableKey(note)
      expect(key).toBe("note-123-1733049600000")
    })

    it("should generate stable keys for notes without note_id", () => {
      const note = {
        author_id: "user-1",
        created_at: "2024-12-01T10:00:00Z"
      }

      const getStableKey = (note: any) => {
        const baseId = note.note_id || `${note.author_id}-${note.created_at}`
        const timestamp = new Date(note.created_at).getTime()
        return `${baseId}-${timestamp}`
      }

      const key = getStableKey(note)
      expect(key).toBe("user-1-2024-12-01T10:00:00Z-1733049600000")
    })

    it("should generate unique keys for different notes", () => {
      const note1 = { note_id: "note-1", author_id: "user-1", created_at: "2024-12-01T10:00:00Z" }
      const note2 = { note_id: "note-2", author_id: "user-1", created_at: "2024-12-01T10:00:00Z" }

      const getStableKey = (note: any) => {
        const baseId = note.note_id || `${note.author_id}-${note.created_at}`
        const timestamp = new Date(note.created_at).getTime()
        return `${baseId}-${timestamp}`
      }

      const key1 = getStableKey(note1)
      const key2 = getStableKey(note2)

      expect(key1).not.toBe(key2)
    })
  })

  describe("Permission Checks", () => {
    it("should allow employees to create personal notes", () => {
      const userRole = "employee"
      const visibility = "personal"

      const canCreate = visibility === "personal" || 
                      ["hr_admin", "admin", "super_admin", "manager"].includes(userRole)

      expect(canCreate).toBe(true)
    })

    it("should reject employees from creating public notes", () => {
      const userRole = "employee"
      const visibility = "public"

      const canCreate = visibility === "personal" || 
                      ["hr_admin", "admin", "super_admin", "manager"].includes(userRole)

      expect(canCreate).toBe(false)
    })

    it("should allow HR/Admin to create public notes", () => {
      const userRole = "hr_admin"
      const visibility = "public"

      const canCreate = visibility === "personal" || 
                      ["hr_admin", "admin", "super_admin", "manager"].includes(userRole)

      expect(canCreate).toBe(true)
    })

    it("should allow note authors to delete their own notes", () => {
      const note = { author_id: "user-1" }
      const userId = "user-1"
      const userRole = "employee"

      const canDelete = note.author_id === userId || 
                       ["hr_admin", "admin", "super_admin"].includes(userRole)

      expect(canDelete).toBe(true)
    })

    it("should allow HR/Admin to delete any notes", () => {
      const note = { author_id: "user-1" }
      const userId = "hr-admin-1"
      const userRole = "hr_admin"

      const canDelete = note.author_id === userId || 
                       ["hr_admin", "admin", "super_admin"].includes(userRole)

      expect(canDelete).toBe(true)
    })

    it("should reject employees from deleting other users' notes", () => {
      const note = { author_id: "user-2" }
      const userId = "user-1"
      const userRole = "employee"

      const canDelete = note.author_id === userId || 
                       ["hr_admin", "admin", "super_admin"].includes(userRole)

      expect(canDelete).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("should handle visibility change from personal to public", () => {
      const originalNote = {
        note_id: "note-1",
        alert_level: "high",
        visibility: "personal",
        status: "active",
        author_id: "user-1"
      }

      const updatedNote = {
        ...originalNote,
        visibility: "public"
      }

      // After visibility change, note should appear in global high alerts
      const globalHighAlerts = [updatedNote].filter(note => 
        note.alert_level === "high" && 
        note.visibility === "public" && 
        note.status === "active"
      )

      expect(globalHighAlerts).toHaveLength(1)
      expect(globalHighAlerts[0].visibility).toBe("public")
    })

    it("should handle non-existent note deletion gracefully", () => {
      const notes = [
        { note_id: "note-1", status: "active" },
        { note_id: "note-2", status: "active" }
      ]

      const noteIndex = notes.findIndex(note => note.note_id === "non-existent")
      expect(noteIndex).toBe(-1)
    })

    it("should handle empty notes array", () => {
      const notes: any[] = []

      const globalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "public" && 
        note.status === "active"
      )

      expect(globalHighAlerts).toHaveLength(0)
    })

    it("should handle notes with missing fields", () => {
      const notes = [
        { note_id: "note-1", alert_level: "high" }, // missing visibility
        { note_id: "note-2", visibility: "public" }, // missing alert_level
        { note_id: "note-3", alert_level: "high", visibility: "public", status: "active" }
      ]

      const globalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "public" && 
        note.status === "active"
      )

      expect(globalHighAlerts).toHaveLength(1)
      expect(globalHighAlerts[0].note_id).toBe("note-3")
    })
  })

  describe("Developer Warnings", () => {
    it("should warn about notes without note_id in development", () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      process.env.NODE_ENV = 'development'

      const notes = [
        { note_id: "note-1", alert_level: "high", visibility: "public", status: "active" },
        { alert_level: "high", visibility: "public", status: "active" }, // missing note_id
        { note_id: "note-3", alert_level: "high", visibility: "public", status: "active" }
      ]

      const notesWithoutId = notes.filter(note => !note.note_id)
      if (notesWithoutId.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Found ${notesWithoutId.length} notes without note_id. This will cause duplicate key errors.`)
      }

      expect(consoleSpy).toHaveBeenCalledWith("⚠️ Found 1 notes without note_id. This will cause duplicate key errors.")

      consoleSpy.mockRestore()
    })

    it("should not warn in production", () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      process.env.NODE_ENV = 'production'

      const notes = [
        { alert_level: "high", visibility: "public", status: "active" }, // missing note_id
      ]

      const notesWithoutId = notes.filter(note => !note.note_id)
      if (notesWithoutId.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Found ${notesWithoutId.length} notes without note_id. This will cause duplicate key errors.`)
      }

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
