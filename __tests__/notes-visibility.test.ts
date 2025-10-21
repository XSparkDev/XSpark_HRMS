import { describe, it, expect, beforeEach } from "vitest"
import { notesService } from "@/lib/services/notes-service"

describe("Notes Visibility Rules", () => {
  beforeEach(() => {
    // Reset the service state before each test
    // In a real implementation, this would reset the database
  })

  describe("High Alert Notes Dashboard Queries", () => {
    it("should return global high alerts (high + public) for all users", async () => {
      const userId = "user-1"
      const userRole = "employee"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      // Should include high + public notes
      const globalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && note.visibility === "public"
      )
      
      expect(globalHighAlerts.length).toBeGreaterThan(0)
      expect(globalHighAlerts.every(note => note.status === "active")).toBe(true)
    })

    it("should return personal high alerts (high + personal) for note author", async () => {
      const userId = "emp-3" // Mike Johnson who has a personal high alert note
      const userRole = "employee"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      // Should include personal high alerts for this user
      const personalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.author_id === userId
      )
      
      expect(personalHighAlerts.length).toBeGreaterThan(0)
    })

    it("should not return personal high alerts for other users", async () => {
      const userId = "emp-1" // John Doe
      const userRole = "employee"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      // Should not include personal high alerts from other users
      const otherPersonalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" && 
        note.author_id !== userId
      )
      
      expect(otherPersonalHighAlerts.length).toBe(0)
    })

    it("should return personal high alerts for HR/Admin users", async () => {
      const userId = "hr-admin-1"
      const userRole = "hr_admin"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      // Should include personal high alerts from employees
      const personalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && 
        note.visibility === "personal" &&
        note.author_id !== userId // Not their own notes
      )
      
      expect(personalHighAlerts.length).toBeGreaterThan(0)
    })

    it("should deduplicate notes when combining global and personal alerts", async () => {
      const userId = "hr-admin-1"
      const userRole = "hr_admin"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      // Check for duplicates by ID
      const noteIds = notes.map(note => note.id)
      const uniqueIds = new Set(noteIds)
      
      expect(noteIds.length).toBe(uniqueIds.size)
    })

    it("should limit results to 25 notes", async () => {
      const userId = "hr-admin-1"
      const userRole = "hr_admin"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      expect(notes.length).toBeLessThanOrEqual(25)
    })

    it("should sort notes by created_at DESC", async () => {
      const userId = "hr-admin-1"
      const userRole = "hr_admin"
      
      const notes = await notesService.getHighAlertNotesForDashboard(userId, userRole)
      
      for (let i = 0; i < notes.length - 1; i++) {
        const current = new Date(notes[i].created_at)
        const next = new Date(notes[i + 1].created_at)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })
  })

  describe("Note Deletion Rules", () => {
    it("should allow note author to delete their own notes", async () => {
      const noteId = "5" // Mike Johnson's personal note
      const userId = "emp-3" // Mike Johnson
      const userRole = "employee"
      
      // Should not throw an error
      await expect(notesService.deleteNote(noteId, userId, userRole)).resolves.not.toThrow()
    })

    it("should allow HR/Admin to delete any notes", async () => {
      const noteId = "5" // Mike Johnson's personal note
      const userId = "hr-admin-1"
      const userRole = "hr_admin"
      
      // Should not throw an error
      await expect(notesService.deleteNote(noteId, userId, userRole)).resolves.not.toThrow()
    })

    it("should not allow regular employees to delete other users' notes", async () => {
      const noteId = "5" // Mike Johnson's personal note
      const userId = "emp-1" // John Doe (different user)
      const userRole = "employee"
      
      // Should throw an error
      await expect(notesService.deleteNote(noteId, userId, userRole)).rejects.toThrow("Insufficient permissions")
    })

    it("should implement soft delete correctly", async () => {
      const noteId = "5"
      const userId = "emp-3"
      const userRole = "employee"
      
      await notesService.deleteNote(noteId, userId, userRole)
      
      // Note should still exist but with status='deleted'
      const allNotes = await notesService.getAllNotes()
      const deletedNote = allNotes.find(note => note.id === noteId)
      
      expect(deletedNote).toBeDefined()
      expect(deletedNote?.status).toBe("deleted")
      expect(deletedNote?.deleted_by).toBe(userId)
      expect(deletedNote?.deleted_at).not.toBeNull()
    })
  })

  describe("Note Creation Rules", () => {
    it("should create notes with correct default values", async () => {
      const noteData = {
        employee_id: "emp-1",
        author_id: "emp-1",
        content: "Test note",
        alert_level: "high" as const,
        visibility: "personal" as const,
        attachments: [],
        reminder_at: null,
        pinned: false,
        status: "active" as const,
        deleted_by: null,
        deleted_at: null,
        author_role: "Employee",
        employee_name: "Test Employee",
        employee_number: "EMP001",
        author_name: "Test Employee",
      }
      
      const createdNote = await notesService.createNote(noteData)
      
      expect(createdNote.id).toBeDefined()
      expect(createdNote.content).toBe("Test note")
      expect(createdNote.alert_level).toBe("high")
      expect(createdNote.visibility).toBe("personal")
      expect(createdNote.status).toBe("active")
      expect(createdNote.created_at).toBeDefined()
      expect(createdNote.updated_at).toBeDefined()
    })
  })

  describe("Real-time Updates", () => {
    it("should notify listeners when notes are created", async () => {
      let notifiedNotes: any[] = []
      const unsubscribe = notesService.subscribe((notes) => {
        notifiedNotes = notes
      })
      
      const noteData = {
        employee_id: "emp-1",
        author_id: "emp-1",
        content: "Test real-time note",
        alert_level: "high" as const,
        visibility: "public" as const,
        attachments: [],
        reminder_at: null,
        pinned: false,
        status: "active" as const,
        deleted_by: null,
        deleted_at: null,
        author_role: "Employee",
        employee_name: "Test Employee",
        employee_number: "EMP001",
        author_name: "Test Employee",
      }
      
      await notesService.createNote(noteData)
      
      // Should have been notified with updated notes
      expect(notifiedNotes.length).toBeGreaterThan(0)
      
      unsubscribe()
    })

    it("should notify listeners when notes are deleted", async () => {
      let notifiedNotes: any[] = []
      const unsubscribe = notesService.subscribe((notes) => {
        notifiedNotes = notes
      })
      
      const noteId = "1"
      const userId = "hr-admin-1"
      const userRole = "hr_admin"
      
      await notesService.deleteNote(noteId, userId, userRole)
      
      // Should have been notified with updated notes
      expect(notifiedNotes.length).toBeGreaterThan(0)
      
      unsubscribe()
    })
  })

  describe("Edge Cases", () => {
    it("should handle visibility change from personal to public", async () => {
      // This test would verify that changing visibility from personal to public
      // immediately makes the note visible to everyone
      const noteId = "5" // Personal high alert note
      const userId = "emp-3"
      const userRole = "employee"
      
      // Update visibility to public
      const updatedNote = await notesService.updateNote(noteId, {
        visibility: "public",
        updated_at: new Date().toISOString(),
      })
      
      expect(updatedNote?.visibility).toBe("public")
      
      // Now check if it appears in global high alerts for other users
      const otherUserId = "emp-1"
      const otherUserRole = "employee"
      const notes = await notesService.getHighAlertNotesForDashboard(otherUserId, otherUserRole)
      
      const globalHighAlerts = notes.filter(note => 
        note.alert_level === "high" && note.visibility === "public"
      )
      
      expect(globalHighAlerts.some(note => note.id === noteId)).toBe(true)
    })

    it("should handle non-existent note deletion gracefully", async () => {
      const nonExistentNoteId = "non-existent"
      const userId = "emp-1"
      const userRole = "employee"
      
      await expect(notesService.deleteNote(nonExistentNoteId, userId, userRole))
        .rejects.toThrow("Note not found")
    })
  })
})
