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
  creator_role?: string | null // Role name of the note creator
}

export interface CreateNotes2Input {
  employee_id: string
  target_employee_id?: string | null
  title?: string | null
  content: string
  alert_level: Notes2AlertLevel
  visibility?: Notes2Visibility
}

export interface UpdateNotes2Input {
  title?: string | null
  content?: string
  alert_level?: Notes2AlertLevel
  visibility?: Notes2Visibility
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
    creator_role: creatorRole,
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
        (notes ?? []).map(async (note) => {
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
        (notes ?? []).map(async (note) => {
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

      // Fetch creator roles for each note
      const notesWithRoles = await Promise.all(
        (notes ?? []).map(async (note) => {
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
        (notes ?? []).map(async (note) => {
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
        (notes ?? []).map(async (note) => {
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
        (notes ?? []).map(async (note) => {
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
        (notes ?? []).map(async (note) => {
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
      const insertPayload = {
        employee_id: payload.employee_id,
        target_employee_id: payload.target_employee_id ?? null,
        title: payload.title ?? null,
        content: payload.content ?? "",
        alert_level: payload.alert_level,
        visibility: payload.visibility ?? "private",
      }

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
      throw error
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
}

export const notes2Service = new Notes2Service()
export type EmployeeNote2 = Notes2Record

export default notes2Service

