import { supabaseAdmin } from "@/lib/supabase-admin"

export interface EmployeeNote {
  id: string
  employee_id: string
  author_id: string
  title?: string | null
  content: string
  alert_level: "high" | "medium" | "low"
  is_confidential: boolean
  pinned: boolean
  tags?: string | null
  reminder_enabled?: boolean | null
  reminder_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreateEmployeeNoteData {
  employee_id: string
  author_id: string
  title?: string | null
  content: string
  alert_level: "high" | "medium" | "low"
  is_confidential?: boolean
  pinned?: boolean
  tags?: string | null
  reminder_enabled?: boolean
  reminder_at?: string | null
}

export interface UpdateEmployeeNoteData {
  title?: string | null
  content?: string
  alert_level?: "high" | "medium" | "low"
  is_confidential?: boolean
  pinned?: boolean
  tags?: string | null
  reminder_enabled?: boolean
  reminder_at?: string | null
}

export async function createEmployeeNote(data: CreateEmployeeNoteData): Promise<EmployeeNote> {
  const payload = {
    ...data,
    is_confidential: data.is_confidential ?? true,
    pinned: data.pinned ?? false,
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("employee_notes")
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return inserted as EmployeeNote
}

export async function getEmployeeNotesByEmployee(employeeId: string): Promise<EmployeeNote[]> {
  const { data, error } = await supabaseAdmin
    .from("employee_notes")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as EmployeeNote[]
}

export async function getEmployeeNoteById(id: string): Promise<EmployeeNote | null> {
  const { data, error } = await supabaseAdmin
    .from("employee_notes")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    throw error
  }
  return data as EmployeeNote
}

export async function updateEmployeeNote(
  id: string,
  updates: UpdateEmployeeNoteData
) {
  const { data, error } = await supabaseAdmin
    .from("employee_notes")
    .update({
      title: updates.title ?? null,
      content: updates.content,
      alert_level: updates.alert_level,
      is_confidential: updates.is_confidential ?? false,
      pinned: updates.pinned ?? false,
      tags: updates.tags ?? null,
      reminder_enabled: updates.reminder_enabled ?? false,
      reminder_at: updates.reminder_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteEmployeeNote(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("employee_notes")
    .delete()
    .eq("id", id)

  if (error) throw error
}

