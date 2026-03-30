// ============================================================================
// NOTES2 SERVICE - Employee-focused notes stored in Supabase
// ============================================================================
// This service encapsulates all Supabase calls for the new employee notes
// experience (Notes2). It follows the same repository-style patterns used
// throughout the rest of the lib/services directory.
// ============================================================================

import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"

export type Notes2AlertLevel = "high" | "medium" | "low"
export type Notes2Visibility = "private" | "public"

export interface Notes2Record {
  id: string
  employee_id: string
  target_employee_id: string | null
  title: string | null
  content: string
  alert_level: Notes2AlertLevel
  visibility: Notes2Visibility
  created_at: string
  updated_at: string
  reminder_at: string | null // When the reminder should trigger
  reminder_enabled: boolean // Whether reminder is active
  creator_role?: string | null // Role name of the note creator
  recipient_names?: string[] // Names of employees this note was sent to (for grouped notes)
  recipient_count?: number // Number of recipients (for grouped notes)
  note_ids?: string[] // All note IDs in this group (for deletion/updates)
}

export interface CreateNotes2Input {
  employee_id: string
  target_employee_id?: string | null
  title?: string | null
  content: string
  alert_level: Notes2AlertLevel
  visibility?: Notes2Visibility
  reminder_at?: string | null // ISO datetime string
  reminder_enabled?: boolean
}

export interface UpdateNotes2Input {
  title?: string | null
  content?: string
  alert_level?: Notes2AlertLevel
  visibility?: Notes2Visibility
  reminder_at?: string | null // ISO datetime string
  reminder_enabled?: boolean
}

const TABLE_NAME = "notes2"

const log = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[Notes2Service]", ...args)
  }
}

const mapRecord = (record: any): Notes2Record => {
  // Extract creator role from joined data
  let creatorRole: string | null = null
  if (record.creator?.role?.role_name) {
    creatorRole = record.creator.role.role_name
  } else if (record.employees?.role?.role_name) {
    creatorRole = record.employees.role.role_name
  } else if (typeof record.creator_role === 'string') {
    creatorRole = record.creator_role
  }

  return {
    id: record.id,
    employee_id: record.employee_id,
    target_employee_id: record.target_employee_id ?? null,
    title: record.title ?? null,
    content: record.content ?? "",
    alert_level: (record.alert_level ?? "low") as Notes2AlertLevel,
    visibility: (record.visibility ?? "private") as Notes2Visibility,
    created_at: record.created_at ?? new Date().toISOString(),
    updated_at: record.updated_at ?? record.created_at ?? new Date().toISOString(),
    reminder_at: record.reminder_at ?? null,
    reminder_enabled: record.reminder_enabled ?? false,
    creator_role: creatorRole,
    recipient_names: record.recipient_names ?? undefined,
    recipient_count: record.recipient_count ?? undefined,
    note_ids: record.note_ids ?? undefined,
  }
}

class Notes2Service {
  /**
   * Return all notes created by the employee (newest first)
   * Excludes notes targeted to other employees
   */
  async getNotesByEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // notes2.employee_id references auth.users.id, so we fetch employees by auth_user_id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", employeeId)
        .eq("visibility", "private")
        .is("target_employee_id", null)
        .order("created_at", { ascending: false })

      log("getNotesByEmployee:query", { employeeId })
      log("getNotesByEmployee:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getNotesByEmployee error:", error)
      throw new Error("Unable to load your notes right now.")
    }
  }

  /**
   * Return all notes targeted to a specific employee (newest first)
   * These are notes created by admins/HR specifically for this employee
   * Note: Uses supabaseAdmin to bypass RLS since this is called from authenticated API routes
   */
  async getNotesForEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // notes2.employee_id references auth.users.id, so we fetch employees by auth_user_id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("target_employee_id", employeeId)
        .order("created_at", { ascending: false })

      log("getNotesForEmployee:query", { employeeId })
      log("getNotesForEmployee:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getNotesForEmployee error:", error)
      throw new Error("Unable to load notes for you right now.")
    }
  }

  /**
   * Return all notes created by a user for specific employees (where target_employee_id IS NOT NULL)
   * This is used by admins/HR to see notes they sent to specific employees
   * Groups notes with the same content/title/created_at together and includes recipient info
   */
  async getNotesSentToEmployees(authUserId: string): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // notes2.employee_id references auth.users.id, so we fetch employees by auth_user_id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", authUserId)
        .not("target_employee_id", "is", null)
        .order("created_at", { ascending: false })

      log("getNotesSentToEmployees:query", { authUserId })
      log("getNotesSentToEmployees:rows", notes?.length ?? 0)
      if (error) throw error

      if (!notes || notes.length === 0) {
        return []
      }

      // Fetch creator role once
      const { data: creatorEmployee } = await supabaseAdmin
        .from("employees")
        .select("role:roles(role_name)")
        .eq("auth_user_id", authUserId)
        .single()

      const creatorRole = creatorEmployee?.role ? (creatorEmployee.role as any)?.role_name : null

      // Group notes by content, title, alert_level, and employee_id (creator)
      // Notes with identical content/title/alert from the same creator are grouped together
      // regardless of when they were created (as long as they're sent to different employees)
      const groupedNotes = new Map<string, any[]>()
      
      for (const note of notes) {
        // Create a key based on content, title, alert_level, and creator
        // This groups all notes with the same content that were sent to different employees
        const groupKey = `${note.content || ''}-${note.title || ''}-${note.alert_level}-${note.employee_id}`
        
        if (!groupedNotes.has(groupKey)) {
          groupedNotes.set(groupKey, [])
        }
        groupedNotes.get(groupKey)!.push(note)
      }

      // Get all unique target employee IDs
      const allTargetEmployeeIds = new Set<string>()
      for (const group of groupedNotes.values()) {
        for (const note of group) {
          if (note.target_employee_id) {
            allTargetEmployeeIds.add(note.target_employee_id)
          }
        }
      }

      // Fetch employee names for all target employees
      const employeeNamesMap = new Map<string, string>()
      if (allTargetEmployeeIds.size > 0) {
        const { data: employees } = await supabaseAdmin
          .from("employees")
          .select("id, first_name, last_name, preferred_name")
          .in("id", Array.from(allTargetEmployeeIds))

        if (employees) {
          for (const emp of employees) {
            const displayName = emp.preferred_name 
              ? `${emp.preferred_name} ${emp.last_name}`
              : `${emp.first_name} ${emp.last_name}`
            employeeNamesMap.set(emp.id, displayName)
          }
        }
      }

      // Create grouped note records
      const groupedRecords: Notes2Record[] = []
      for (const [groupKey, noteGroup] of groupedNotes.entries()) {
        // Use the first note as the base (they're all the same except target_employee_id)
        const baseNote = noteGroup[0]
        
        // Collect recipient names
        const recipientNames: string[] = []
        const recipientIds: string[] = []
        
        for (const note of noteGroup) {
          if (note.target_employee_id) {
            const name = employeeNamesMap.get(note.target_employee_id)
            if (name && !recipientNames.includes(name)) {
              recipientNames.push(name)
              recipientIds.push(note.target_employee_id)
            }
          }
        }

        // Create a record with recipient information
        const groupedRecord: Notes2Record = {
          id: baseNote.id, // Use the first note's ID
          employee_id: baseNote.employee_id,
          target_employee_id: recipientIds.length === 1 ? recipientIds[0] : null, // Store first or null if multiple
          title: baseNote.title,
          content: baseNote.content,
          alert_level: baseNote.alert_level,
          visibility: baseNote.visibility,
          created_at: baseNote.created_at,
          updated_at: baseNote.updated_at,
          reminder_at: baseNote.reminder_at ?? null,
          reminder_enabled: baseNote.reminder_enabled ?? false,
          creator_role: creatorRole,
          // Add recipient info as metadata (we'll need to extend the type)
          recipient_names: recipientNames, // This will be passed through
          recipient_count: recipientNames.length,
          note_ids: noteGroup.map((n: Notes2Record) => n.id), // Store all note IDs for deletion
        }

        groupedRecords.push(groupedRecord)
      }

      return groupedRecords.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } catch (error) {
      console.error("Notes2Service.getNotesSentToEmployees error:", error)
      throw new Error("Unable to load notes sent to employees right now.")
    }
  }

  /**
   * Return only high alert notes for dashboards (created by the employee)
   */
  async getHighAlertNotesByEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // notes2.employee_id references auth.users.id, so we fetch employees by auth_user_id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", employeeId)
        .eq("visibility", "private")
        .eq("alert_level", "high")
        .order("created_at", { ascending: false })

      log("getHighAlertNotesByEmployee:query", { employeeId })
      log("getHighAlertNotesByEmployee:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getHighAlertNotesByEmployee error:", error)
      throw new Error("Unable to load high alert notes.")
    }
  }

  /**
   * Return high alert notes sent to a specific employee (for dashboard)
   */
  async getHighAlertNotesForEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // notes2.employee_id references auth.users.id, so we fetch employees by auth_user_id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("target_employee_id", employeeId)
        .eq("alert_level", "high")
        .order("created_at", { ascending: false })

      log("getHighAlertNotesForEmployee:query", { employeeId })
      log("getHighAlertNotesForEmployee:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getHighAlertNotesForEmployee error:", error)
      throw new Error("Unable to load high alert notes for employee.")
    }
  }

  /**
   * Return all public notes (newest first)
   */
  async getPublicNotes(): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // notes2.employee_id references auth.users.id, so we fetch employees by auth_user_id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })

      log("getPublicNotes:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getPublicNotes error:", error)
      throw new Error("Unable to load public notes.")
    }
  }

  async getHighAlertPublicNotes(): Promise<Notes2Record[]> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // First get notes, then fetch creator roles separately since notes2.employee_id references auth.users.id
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("visibility", "public")
        .eq("alert_level", "high")
        .order("created_at", { ascending: false })

      log("getHighAlertPublicNotes:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getHighAlertPublicNotes error:", error)
      throw new Error("Unable to load shared high alert notes.")
    }
  }

  /**
   * Create a brand new note for the employee
   */
  async createNote(payload: CreateNotes2Input): Promise<Notes2Record> {
    console.log("[Notes2Service] 1. createNote called with:", payload)
    try {
      console.log("[Notes2Service] 2. Preparing insert payload")
      const insertPayload: any = {
        employee_id: payload.employee_id,
        target_employee_id: payload.target_employee_id ?? null,
        title: payload.title ?? null,
        content: payload.content ?? "",
        alert_level: payload.alert_level,
        visibility: payload.visibility ?? "private",
      }
      
      // Only include reminder fields if reminder is enabled and reminder_at is set
      // This allows notes to be created even if reminder columns don't exist yet
      if (payload.reminder_enabled && payload.reminder_at) {
        insertPayload.reminder_at = payload.reminder_at
        insertPayload.reminder_enabled = true
      }
      // If reminder is not enabled or not set, we don't include these fields
      // This way notes can be created in the same table even without the migration

      console.log("[Notes2Service] 3. Insert payload:", insertPayload)
      console.log("[Notes2Service] 4. Executing Supabase insert")
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // that already verify user permissions. The API route ensures only authorized users can create notes.
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .insert([insertPayload])
        .select("*")

      console.log("[Notes2Service] 5. Supabase response:", { data, error })
      if (error) {
        console.error("[Notes2Service] 6. Supabase insert error:", error)
        // If error is about missing columns, provide helpful message
        if (error.message && error.message.includes("reminder")) {
          throw new Error("Database migration required: Please run the notes2-reminder.sql migration to add reminder columns to the notes2 table.")
        }
        throw error
      }

      if (!Array.isArray(data) || !data.length) {
        console.error("[Notes2Service] 6b. Supabase insert returned no rows")
        throw new Error("Supabase insert returned no data")
      }

      console.log("[Notes2Service] 7. Returning created note")
      return mapRecord(data[0])
    } catch (error: any) {
      console.error("[Notes2Service] FULL ERROR OBJECT:", JSON.stringify(error, null, 2))
      console.error("[Notes2Service] Error name:", error?.name)
      console.error("[Notes2Service] Error message:", error?.message)
      console.error("[Notes2Service] Error code:", error?.code)
      console.error("[Notes2Service] Error details:", error?.details)
      console.error("[Notes2Service] Error hint:", error?.hint)
      
      // Provide more helpful error messages
      if (error?.code === '42703' || (error?.message && error.message.includes('column') && error.message.includes('does not exist'))) {
        throw new Error("Database migration required: The reminder columns (reminder_at, reminder_enabled) don't exist in the notes2 table. Please run the migration: database/notes2-reminder.sql")
      }
      
      if (error?.code === '23502' || (error?.message && error.message.includes('null value'))) {
        throw new Error(`Database constraint error: ${error.message || 'A required field is missing'}`)
      }
      
      // Re-throw with original error message
      throw new Error(error?.message || error?.details || "Failed to create note in database")
    }
  }

  /**
   * Update an existing note (title/content/alert level)
   */
  async updateNote(
    noteId: string,
    payload: UpdateNotes2Input,
    employeeId?: string,
  ): Promise<Notes2Record> {
    const updatePayload: Record<string, unknown> = {}
    if (payload.title !== undefined) updatePayload.title = payload.title
    if (payload.content !== undefined) updatePayload.content = payload.content
    if (payload.alert_level !== undefined) updatePayload.alert_level = payload.alert_level
    if (payload.visibility !== undefined) updatePayload.visibility = payload.visibility
    if (payload.reminder_at !== undefined) updatePayload.reminder_at = payload.reminder_at
    if (payload.reminder_enabled !== undefined) updatePayload.reminder_enabled = payload.reminder_enabled

    if (!Object.keys(updatePayload).length) {
      throw new Error("No fields provided to update")
    }

    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // that already verify user permissions. The API route ensures only authorized users can update notes.
      let query = supabaseAdmin.from(TABLE_NAME).update(updatePayload).eq("id", noteId)
      if (employeeId) {
        query = query.eq("employee_id", employeeId)
      }

      log("updateNote:payload", { noteId, employeeId, updatePayload })
      const { data, error } = await query.select("*").single()

      log("updateNote:response", data)
      if (error) throw error
      if (!data) throw new Error("Unable to find note to update")

      return mapRecord(data)
    } catch (error) {
      console.error("Notes2Service.updateNote error:", error)
      throw new Error("Unable to update note. Please try again.")
    }
  }

  /**
   * Delete a note (hard delete until RLS rules are added for soft delete)
   */
  async deleteNote(noteId: string, employeeId?: string): Promise<void> {
    try {
      // Use supabaseAdmin to bypass RLS since this is called from authenticated API routes
      // that already verify user permissions. The API route ensures only authorized users can delete notes.
      let query = supabaseAdmin.from(TABLE_NAME).delete().eq("id", noteId)
      if (employeeId) {
        query = query.eq("employee_id", employeeId)
      }
      log("deleteNote:payload", { noteId, employeeId })
      const { error } = await query
      log("deleteNote:success", { noteId })
      if (error) throw error
    } catch (error) {
      console.error("Notes2Service.deleteNote error:", error)
      throw new Error("Unable to delete note.")
    }
  }

  // ---------------------------------------------------------------------------
  // Backwards-compatible helpers (older code may still reference these)
  // ---------------------------------------------------------------------------

  async listEmployeeNotes(employeeId: string) {
    return this.getNotesByEmployee(employeeId)
  }

  async listHighAlertNotes(employeeId: string) {
    return this.getHighAlertNotesByEmployee(employeeId)
  }

  async createEmployeeNote(payload: CreateNotes2Input) {
    return this.createNote(payload)
  }

  async listPublicNotes() {
    return this.getPublicNotes()
  }

  /**
   * Return all scheduled notes (with reminders) for an employee
   * These are notes where reminder_enabled = true
   * Note: employeeId parameter should be the employee UUID from employees table
   * We need to convert it to auth_user_id to query notes2.employee_id
   */
  async getScheduledNotesByEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      // First, get the auth_user_id from the employee UUID
      const { data: employee, error: empError } = await supabaseAdmin
        .from("employees")
        .select("auth_user_id")
        .eq("id", employeeId)
        .single()

      if (empError || !employee || !employee.auth_user_id) {
        console.error("getScheduledNotesByEmployee: Employee not found or no auth_user_id", { employeeId, empError })
        return []
      }

      const authUserId = employee.auth_user_id

      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", authUserId) // notes2.employee_id references auth.users.id
        .eq("reminder_enabled", true)
        .not("reminder_at", "is", null)
        .order("reminder_at", { ascending: true })

      log("getScheduledNotesByEmployee:query", { employeeId, authUserId })
      log("getScheduledNotesByEmployee:rows", notes?.length ?? 0)
      if (error) throw error

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      return notesWithRoles.map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getScheduledNotesByEmployee error:", error)
      throw new Error("Unable to load scheduled notes.")
    }
  }

  /**
   * Get current date/time components in South African timezone (SAST - UTC+2)
   * Returns an object with date components in SAST
   */
  private getSouthAfricanDateComponents(): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => {
      const part = parts.find(p => p.type === type)
      return part ? parseInt(part.value, 10) : 0
    }
    
    return {
      year: getPart('year'),
      month: getPart('month') - 1, // JavaScript months are 0-indexed
      day: getPart('day'),
      hours: getPart('hour'),
      minutes: getPart('minute'),
      seconds: getPart('second')
    }
  }

  /**
   * Get a date representing a specific time in SAST timezone
   * @param year Year in SAST
   * @param month Month (0-11) in SAST
   * @param day Day in SAST
   * @param hours Hours (0-23) in SAST
   * @param minutes Minutes in SAST
   * @param seconds Seconds in SAST
   */
  private createDateInSAST(year: number, month: number, day: number, hours: number = 0, minutes: number = 0, seconds: number = 0): Date {
    // Create ISO string with SAST offset (+02:00)
    const monthStr = String(month + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const hoursStr = String(hours).padStart(2, '0')
    const minutesStr = String(minutes).padStart(2, '0')
    const secondsStr = String(seconds).padStart(2, '0')
    const sastISO = `${year}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}:${secondsStr}+02:00`
    return new Date(sastISO)
  }

  /**
   * Add days to a SAST date, handling month/year rollovers correctly
   * @param year Year in SAST
   * @param month Month (0-11) in SAST
   * @param day Day in SAST
   * @param daysToAdd Number of days to add
   * @returns Date components for the new date in SAST
   */
  private addDaysToSASTDate(year: number, month: number, day: number, daysToAdd: number): { year: number; month: number; day: number } {
    // Create a date in SAST, add days, then extract components in SAST
    const startDate = this.createDateInSAST(year, month, day, 12, 0, 0) // Use noon to avoid DST issues
    const endDate = new Date(startDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000))
    
    // Get the date components in SAST timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const parts = formatter.formatToParts(endDate)
    const getPart = (type: string) => {
      const part = parts.find(p => p.type === type)
      return part ? parseInt(part.value, 10) : 0
    }
    
    return {
      year: getPart('year'),
      month: getPart('month') - 1, // JavaScript months are 0-indexed
      day: getPart('day')
    }
  }

  /**
   * Return scheduled notes that should appear on dashboard (reminder within 3 days)
   * Notes appear starting 3 days before the reminder date
   * Uses South African timezone (SAST - UTC+2) for all date calculations
   * Note: employeeId parameter should be the employee UUID from employees table
   * We need to convert it to auth_user_id to query notes2.employee_id
   */
  async getScheduledNotesForDashboard(employeeId: string, authUserIdFallback?: string): Promise<Notes2Record[]> {
    try {
      console.log("[Notes2Service] ===== getScheduledNotesForDashboard START =====")
      console.log("[Notes2Service] Input employeeId:", {
        employeeId,
        type: typeof employeeId,
        length: employeeId?.length,
        authUserIdFallback,
      })

      const isUuid = (value: string | null | undefined) =>
        !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

      let authUserId: string | null = authUserIdFallback ?? null

      if (isUuid(employeeId)) {
        // Treat as employee UUID first, try to resolve to auth_user_id
        const { data: employee, error: empError } = await supabaseAdmin
          .from("employees")
          .select("auth_user_id, id")
          .eq("id", employeeId)
          .single()

        if (empError || !employee || !employee.auth_user_id) {
          console.warn("[Notes2Service] Employee lookup by UUID failed, will fallback to direct auth id assumption:", {
            employeeId,
            error: empError,
            employeeData: employee,
          })
          // If the passed value is actually an auth_user_id, use it directly
          authUserId = authUserId || employeeId
        } else {
          authUserId = employee.auth_user_id
          console.log("[Notes2Service] Employee resolved from UUID:", {
            employeeId,
            authUserId,
            employeeRecordId: employee.id,
          })
        }
      } else {
        // Not a UUID: assume it's already auth_user_id
        authUserId = employeeId
        console.log("[Notes2Service] Input is not UUID; treating as auth_user_id directly:", { authUserId })
      }

      if (!authUserId) {
        console.error("[Notes2Service] No authUserId could be derived; aborting.", {
          employeeId,
          authUserIdFallback,
        })
        return []
      }
      console.log("[Notes2Service] Using authUserId for queries:", { authUserId })

      // Timezone handling: Africa/Johannesburg is UTC+2
      // Get current time in UTC (Supabase stores timestamps in UTC)
      const now = new Date()
      const timezoneOffsetMinutes = now.getTimezoneOffset() // positive if behind UTC
      const timezoneOffsetHours = timezoneOffsetMinutes / 60
      
      // For UTC+2 (Africa/Johannesburg), we're 2 hours ahead of UTC
      // So we want to be more generous with the "now" time to catch notes that are
      // scheduled for today in local time but might be slightly in the past in UTC
      // Use a 2-hour buffer instead of 1 hour to account for UTC+2
      const bufferHours = 2 // Match UTC+2 timezone
      const nowWithBuffer = new Date(now.getTime() - (bufferHours * 60 * 60 * 1000))
      const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))
      const nowISO = nowWithBuffer.toISOString()
      const threeDaysFromNowISO = threeDaysFromNow.toISOString()
      
      console.log("[Notes2Service] Date range calculation:", {
        serverNow: now.toISOString(),
        serverNowLocal: now.toString(),
        timezoneOffsetMinutes,
        timezoneOffsetHours,
        bufferHours,
        nowWithBuffer: nowWithBuffer.toISOString(),
        threeDaysFromNow: threeDaysFromNow.toISOString(),
        queryRange: {
          from: nowISO,
          to: threeDaysFromNowISO,
        },
        employeeId,
        authUserId,
      })

      // Query for notes where reminder is within the next 3 days
      // First, let's see ALL notes with reminders for this user (for debugging)
      console.log("[Notes2Service] Querying ALL reminder notes (TEMP no employee filter)...", {
        authUserIdInUse: authUserId,
      })
      const { data: allReminderNotes, error: allNotesError } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("id, title, reminder_at, reminder_enabled, employee_id, created_at")
        // TEMP: remove employee_id filter to see all reminder notes system-wide
        .eq("reminder_enabled", true)
        .not("reminder_at", "is", null)
        .order("reminder_at", { ascending: true })

      if (allNotesError) {
        console.error("[Notes2Service] Error fetching all reminder notes:", allNotesError)
      }

      console.log("[Notes2Service] ALL reminder notes for user:", {
        authUserId,
        total: allReminderNotes?.length ?? 0,
        queryError: allNotesError,
        distinctEmployeeIds: Array.from(new Set(allReminderNotes?.map((n: Notes2Record) => n.employee_id) ?? [])),
        notes: allReminderNotes?.map((n: Notes2Record) => {
          if (!n.reminder_at) return { id: n.id, title: n.title, reminder_at: null, error: 'No reminder date' }
          const reminderDate = new Date(n.reminder_at)
          const nowDate = new Date(nowISO)
          const threeDaysDate = new Date(threeDaysFromNowISO)
          const isInRange = reminderDate >= nowDate && reminderDate <= threeDaysDate
          const hoursUntil = (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60)
          const daysUntil = hoursUntil / 24
          
          return {
            id: n.id,
            title: n.title,
            reminder_at: n.reminder_at,
            reminder_at_parsed: reminderDate.toISOString(),
            reminder_enabled: n.reminder_enabled,
            employee_id: n.employee_id,
            hoursUntil: Math.round(hoursUntil * 100) / 100,
            daysUntil: Math.round(daysUntil * 100) / 100,
            isInRange,
            comparison: {
              reminder_vs_nowISO: reminderDate >= nowDate ? ">= nowISO" : "< nowISO",
              reminder_vs_3days: reminderDate <= threeDaysDate ? "<= 3days" : "> 3days",
            },
          }
        }) ?? [],
      })

      // Now query for notes within the date range
      console.log("[Notes2Service] Querying notes within date range...")
      console.log("[Notes2Service] Query parameters:", {
        employee_id: authUserId,
        reminder_enabled: true,
        reminder_at_gte: nowISO,
        reminder_at_lte: threeDaysFromNowISO,
      })
      
      const { data: notes, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", authUserId) // notes2.employee_id references auth.users.id
        .eq("reminder_enabled", true)
        .not("reminder_at", "is", null)
        .gte("reminder_at", nowISO) // Reminder hasn't passed
        .lte("reminder_at", threeDaysFromNowISO) // Reminder is within next 3 days
        .order("reminder_at", { ascending: true })

      if (error) {
        console.error("[Notes2Service] Query error:", error)
        throw error
      }

      // Debug: Check if any notes are being filtered out
      if (allReminderNotes && allReminderNotes.length > 0) {
        const filteredOut = allReminderNotes.filter((note: Notes2Record) => {
          if (!note.reminder_at) return true // Filter out notes without reminder dates
          const reminderDate = new Date(note.reminder_at)
          const nowDate = new Date(nowISO)
          const threeDaysDate = new Date(threeDaysFromNowISO)
          const isInPast = reminderDate < nowDate
          const isTooFarFuture = reminderDate > threeDaysDate
          return isInPast || isTooFarFuture
        })
        
        const filteredIn = allReminderNotes.filter((note: Notes2Record) => {
          if (!note.reminder_at) return false // Filter out notes without reminder dates
          const reminderDate = new Date(note.reminder_at)
          const nowDate = new Date(nowISO)
          const threeDaysDate = new Date(threeDaysFromNowISO)
          return reminderDate >= nowDate && reminderDate <= threeDaysDate
        })
        
        console.log("[Notes2Service] Filtering analysis:", {
          totalNotes: allReminderNotes.length,
          filteredIn: filteredIn.length,
          filteredOut: filteredOut.length,
          filteredOutDetails: filteredOut.map((n: Notes2Record) => {
            if (!n.reminder_at) return { id: n.id, title: n.title, reminder_at: null, error: 'No reminder date' }
            const reminderDate = new Date(n.reminder_at)
            const nowDate = new Date(nowISO)
            const threeDaysDate = new Date(threeDaysFromNowISO)
            const isInPast = reminderDate < nowDate
            const isTooFarFuture = reminderDate > threeDaysDate
            const hoursUntil = (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60)
            const daysUntil = hoursUntil / 24
            
            return {
              id: n.id,
              title: n.title,
              reminder_at: n.reminder_at,
              reminder_at_parsed: reminderDate.toISOString(),
              hoursUntil: Math.round(hoursUntil * 100) / 100,
              daysUntil: Math.round(daysUntil * 100) / 100,
              reason: isInPast 
                ? `in the past (${Math.abs(Math.round(hoursUntil * 100) / 100)} hours ago)`
                : `more than 3 days away (${Math.round(daysUntil * 100) / 100} days)`,
              comparison: {
                reminder: reminderDate.toISOString(),
                nowISO: nowDate.toISOString(),
                threeDaysISO: threeDaysDate.toISOString(),
                reminder_vs_now: reminderDate < nowDate ? "< nowISO" : ">= nowISO",
                reminder_vs_3days: reminderDate > threeDaysDate ? "> 3days" : "<= 3days",
              },
            }
          }),
          filteredInDetails: filteredIn.map((n: Notes2Record) => {
            if (!n.reminder_at) return { id: n.id, title: n.title, reminder_at: null, error: 'No reminder date' }
            const reminderDate = new Date(n.reminder_at)
            const hoursUntil = (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60)
            const daysUntil = hoursUntil / 24
            
            return {
              id: n.id,
              title: n.title,
              reminder_at: n.reminder_at,
              hoursUntil: Math.round(hoursUntil * 100) / 100,
              daysUntil: Math.round(daysUntil * 100) / 100,
            }
          }),
        })
      }

      console.log("[Notes2Service] Final query results:", {
        dateRange: {
          from: nowISO,
          to: threeDaysFromNowISO,
        },
        notesFound: notes?.length ?? 0,
        distinctEmployeeIds: Array.from(new Set(notes?.map((n: Notes2Record) => n.employee_id) ?? [])),
        reminderDates: notes?.map((n: Notes2Record) => {
          if (!n.reminder_at) return { id: n.id, title: n.title, reminder_at: null, hoursUntil: null, daysUntil: null }
          const reminderDate = new Date(n.reminder_at)
          const hoursUntil = (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60)
          const daysUntil = hoursUntil / 24
          
          return {
            id: n.id,
            title: n.title,
            reminder_at: n.reminder_at,
            hoursUntil: Math.round(hoursUntil * 100) / 100,
            daysUntil: Math.round(daysUntil * 100) / 100,
          }
        }) ?? [],
        fullNotes: notes?.map((n: Notes2Record) => ({
          id: n.id,
          title: n.title,
          content: n.content?.substring(0, 50),
          reminder_at: n.reminder_at,
          reminder_enabled: n.reminder_enabled,
          employee_id: n.employee_id,
        })) ?? [],
      })

      log("getScheduledNotesForDashboard:query", { employeeId, authUserId })
      log("getScheduledNotesForDashboard:rows", notes?.length ?? 0)

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note: Notes2Record) => {
          const { data: employee } = await supabaseAdmin
            .from("employees")
            .select("role:roles(role_name)")
            .eq("auth_user_id", note.employee_id)
            .single()

          return {
            ...note,
            creator: employee ? { role: employee.role } : null,
          }
        })
      )

      const mappedNotes = notesWithRoles.map(mapRecord)
      console.log("[Notes2Service] Final mapped notes:", {
        count: mappedNotes.length,
        noteIds: mappedNotes.map(n => n.id),
      })
      console.log("[Notes2Service] ===== getScheduledNotesForDashboard END =====")

      return mappedNotes
    } catch (error) {
      console.error("[Notes2Service] getScheduledNotesForDashboard ERROR:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      })
      throw new Error("Unable to load scheduled notes for dashboard.")
    }
  }
}

export const notes2Service = new Notes2Service()
export type EmployeeNote2 = Notes2Record

export default notes2Service

