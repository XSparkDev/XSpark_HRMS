// ============================================================================
// NOTES2 SERVICE - Employee-focused notes stored in Supabase
// ============================================================================
// This service encapsulates all Supabase calls for the new employee notes
// experience (Notes2). It follows the same repository-style patterns used
// throughout the rest of the lib/services directory.
// ============================================================================

import { supabase } from "@/lib/supabase"

export type Notes2AlertLevel = "high" | "medium" | "low"

export interface Notes2Record {
  id: string
  employee_id: string
  title: string | null
  content: string
  alert_level: Notes2AlertLevel
  created_at: string
  updated_at: string
}

export interface CreateNotes2Input {
  employee_id: string
  title?: string | null
  content: string
  alert_level: Notes2AlertLevel
}

export interface UpdateNotes2Input {
  title?: string | null
  content?: string
  alert_level?: Notes2AlertLevel
}

const TABLE_NAME = "notes2"

const log = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[Notes2Service]", ...args)
  }
}

const mapRecord = (record: any): Notes2Record => ({
  id: record.id,
  employee_id: record.employee_id,
  title: record.title ?? null,
  content: record.content ?? "",
  alert_level: (record.alert_level ?? "low") as Notes2AlertLevel,
  created_at: record.created_at ?? new Date().toISOString(),
  updated_at: record.updated_at ?? record.created_at ?? new Date().toISOString(),
})

class Notes2Service {
  /**
   * Return all notes created by the employee (newest first)
   */
  async getNotesByEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })

      log("getNotesByEmployee:query", { employeeId })
      log("getNotesByEmployee:rows", data?.length ?? 0)
      if (error) throw error
      return (data ?? []).map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getNotesByEmployee error:", error)
      throw new Error("Unable to load your notes right now.")
    }
  }

  /**
   * Return only high alert notes for dashboards
   */
  async getHighAlertNotesByEmployee(employeeId: string): Promise<Notes2Record[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("employee_id", employeeId)
        .eq("alert_level", "high")
        .order("created_at", { ascending: false })

      log("getHighAlertNotesByEmployee:query", { employeeId })
      log("getHighAlertNotesByEmployee:rows", data?.length ?? 0)
      if (error) throw error
      return (data ?? []).map(mapRecord)
    } catch (error) {
      console.error("Notes2Service.getHighAlertNotesByEmployee error:", error)
      throw new Error("Unable to load high alert notes.")
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
        title: payload.title ?? null,
        content: payload.content ?? "",
        alert_level: payload.alert_level,
      }

      console.log("[Notes2Service] 3. Insert payload:", insertPayload)
      console.log("[Notes2Service] 4. Executing Supabase insert")
      const { data, error } = await supabase
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

    if (!Object.keys(updatePayload).length) {
      throw new Error("No fields provided to update")
    }

    try {
      let query = supabase.from(TABLE_NAME).update(updatePayload).eq("id", noteId)
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
      let query = supabase.from(TABLE_NAME).delete().eq("id", noteId)
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
}

export const notes2Service = new Notes2Service()
export type EmployeeNote2 = Notes2Record

export default notes2Service

