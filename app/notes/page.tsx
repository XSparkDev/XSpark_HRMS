"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import { AlertTriangle, Loader2, MessageSquare, Notebook, Plus, StickyNote, PenSquare, Trash2, Clock, Calendar, Search, X } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar as DatePicker } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, type User } from "@/lib/auth"
import { cn } from "@/lib/utils"

type AlertLevel = "high" | "medium" | "low"

type Notes2Item = {
  id: string
  title: string | null
  content: string
  alert_level: AlertLevel
  created_at: string
  employee_id: string
  target_employee_id: string | null
  visibility: "private" | "public"
  reminder_at: string | null
  reminder_enabled: boolean
  creator_role?: string | null // Role name of the note creator
  recipient_names?: string[] // Names of employees this note was sent to (for grouped notes)
  recipient_count?: number // Number of recipients (for grouped notes)
  note_ids?: string[] // All note IDs in this group (for deletion/updates)
}

const ALERT_META: Record<
  AlertLevel,
  { badge: string; chip: string; dot: string; label: string }
> = {
  high: {
    badge: "bg-red-600 text-white",
    chip: "border-red-200 bg-red-50/60",
    dot: "bg-red-500",
    label: "High Alert",
  },
  medium: {
    badge: "bg-amber-500 text-white",
    chip: "border-amber-200 bg-amber-50",
    dot: "bg-amber-400",
    label: "Medium Alert",
  },
  low: {
    badge: "bg-blue-500 text-white",
    chip: "border-blue-200 bg-blue-50",
    dot: "bg-blue-400",
    label: "Low Alert",
  },
}

// All non-employee roles can create public notes
const PUBLIC_NOTE_ROLES = new Set(["admin", "super_admin", "junior_hr", "hr_manager", "hr_admin", "manager", "supervisor"])
// All non-employee roles can create notes for specific employees
const CAN_CREATE_FOR_EMPLOYEE_ROLES = new Set(["admin", "super_admin", "junior_hr", "hr_manager", "hr_admin", "manager", "supervisor"])

const buildHeaders = (user: User | null, employeeUuid: string | null) => {
  const headers: Record<string, string> = {}
  if (user?.id) headers["x-user-id"] = user.id
  if (user?.role) headers["x-user-role"] = user.role
  // Use actual employee UUID from employees table (not employee_id string)
  if (employeeUuid) {
    headers["x-employee-id"] = employeeUuid
  } else if (user?.id) {
    // Fallback to user.id if employee UUID not available yet (will be fetched)
    headers["x-employee-id"] = user.id
  }
  return headers
}

export default function NotesPage() {
  const { toast } = useToast()
  const user = useMemo(() => getCurrentUser(), [])
  const [employeeUuid, setEmployeeUuid] = useState<string | null>(null) // Store actual employee UUID

  // Fetch employee UUID from /api/auth/me using Bearer token
  // This is optional - if it fails, the API routes will fetch it when needed
  const fetchEmployeeUuid = useCallback(async () => {
    if (!user?.id) return

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      
      // Get Bearer token from localStorage
      try {
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn('[Notes2] Failed to parse session for Bearer token:', error)
      }

      const res = await fetch("/api/auth/me", { headers })
      const json = await res.json()
      
      if (res.ok && json.success && json.data?.employee?.id) {
        // Use the actual UUID from employees table (not employee_id string like "XSP25/11/005")
        setEmployeeUuid(json.data.employee.id)
      } else {
        // Silently fail - the API routes will handle fetching employee UUID when needed
        // This is not critical for the notes page to function
        if (res.status !== 401) {
          console.warn("[Notes2] Failed to fetch employee UUID (non-critical):", json.error)
        }
        // Don't set employeeUuid - API routes will fetch it when needed
      }
    } catch (error) {
      // Silently fail - this is not critical
      console.warn("[Notes2] Error fetching employee UUID (non-critical):", error)
      // Don't set employeeUuid - API routes will fetch it when needed
    }
  }, [user?.id])

  // Fetch employee UUID on mount
  useEffect(() => {
    fetchEmployeeUuid()
  }, [fetchEmployeeUuid])

  const [personalNotes, setPersonalNotes] = useState<Notes2Item[]>([])
  const [publicNotes, setPublicNotes] = useState<Notes2Item[]>([])
  const [forYouNotes, setForYouNotes] = useState<Notes2Item[]>([])
  const [scheduledNotes, setScheduledNotes] = useState<Notes2Item[]>([])
  const [personalLoading, setPersonalLoading] = useState(true)
  const [publicLoading, setPublicLoading] = useState(true)
  const [forYouLoading, setForYouLoading] = useState(true)
  const [scheduledLoading, setScheduledLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"personal" | "public" | "for_you" | "scheduled">("personal")
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; email: string }>>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAlertLevel, setFilterAlertLevel] = useState<AlertLevel | "all">("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selected, setSelected] = useState<Notes2Item | null>(null)
  const [editNote, setEditNote] = useState<Notes2Item | null>(null)
  const [isDeletePending, setIsDeletePending] = useState<string | null>(null)
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [createNoteTab, setCreateNoteTab] = useState<"personal" | "public">("personal")
  const [createNoteType, setCreateNoteType] = useState<"public" | "specific_employee">("public")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingNoteSubmission, setPendingNoteSubmission] = useState<(() => void) | null>(null)
  const [form, setForm] = useState({
    title: "",
    content: "",
    alert_level: "low" as AlertLevel,
    target_employee_id: "" as string | "",
    reminder_date: undefined as Date | undefined,
    reminder_time: "",
    reminder_enabled: false,
  })
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    alert_level: "low" as AlertLevel,
    visibility: "private" as "private" | "public",
  })

  const isEmployee = user?.role === "employee"
  const canManagePublic = user ? PUBLIC_NOTE_ROLES.has(user.role) : false
  const canCreateForEmployee = user ? CAN_CREATE_FOR_EMPLOYEE_ROLES.has(user.role) : false

  const sortNotes = (data: Notes2Item[]) =>
    [...data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

  const fetchPersonalNotes = useCallback(async () => {
    if (!user?.id) {
      setPersonalLoading(false)
      return
    }

    try {
      setPersonalLoading(true)
      const res = await fetch("/api/notes2", {
        headers: buildHeaders(user, employeeUuid),
      })
      const json = await res.json()
      console.log("[Notes2][FETCH personal] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Unable to load notes")
      }
      const data: Notes2Item[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
            employee_id: note.employee_id,
            target_employee_id: note.target_employee_id ?? null,
            visibility: (note.visibility ?? "private") as "private" | "public",
            reminder_at: note.reminder_at ?? null,
            reminder_enabled: note.reminder_enabled ?? false,
            creator_role: note.creator_role ?? null,
          }))
        : []
      setPersonalNotes(sortNotes(data))
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to load notes",
        description: "We couldn't retrieve your notes right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setPersonalLoading(false)
    }
  }, [toast, user])

  const fetchForYouNotes = useCallback(async () => {
    if (!user?.id) {
      setForYouLoading(false)
      return
    }

    try {
      setForYouLoading(true)
      const res = await fetch("/api/notes2?scope=for_you", {
        headers: buildHeaders(user, employeeUuid),
      })
      const json = await res.json()
      console.log("[Notes2][FETCH for_you] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Unable to load notes")
      }
      const data: Notes2Item[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
            employee_id: note.employee_id,
            target_employee_id: note.target_employee_id ?? null,
            visibility: (note.visibility ?? "private") as "private" | "public",
            reminder_at: note.reminder_at ?? null,
            reminder_enabled: note.reminder_enabled ?? false,
            creator_role: note.creator_role ?? null,
            recipient_names: note.recipient_names ?? undefined,
            recipient_count: note.recipient_count ?? undefined,
            note_ids: note.note_ids ?? undefined,
          }))
        : []
      setForYouNotes(sortNotes(data))
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to load notes",
        description: "We couldn't retrieve your notes right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setForYouLoading(false)
    }
  }, [toast, user, employeeUuid])

  const fetchPublicNotes = useCallback(async () => {
    if (!user?.id) {
      setPublicLoading(false)
      return
    }

    try {
      setPublicLoading(true)
      const res = await fetch("/api/notes2?scope=public", {
        headers: buildHeaders(user, employeeUuid),
      })
      const json = await res.json()
      console.log("[Notes2][FETCH public] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Unable to load public notes")
      }
      const data: Notes2Item[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
            employee_id: note.employee_id,
            target_employee_id: note.target_employee_id ?? null,
            visibility: (note.visibility ?? "public") as "private" | "public",
            reminder_at: note.reminder_at ?? null,
            reminder_enabled: note.reminder_enabled ?? false,
            creator_role: note.creator_role ?? null,
          }))
        : []
      setPublicNotes(sortNotes(data))
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to load public notes",
        description: "Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setPublicLoading(false)
    }
  }, [toast, user, employeeUuid])

  const fetchScheduledNotes = useCallback(async () => {
    if (!user?.id) {
      setScheduledLoading(false)
      return
    }

    try {
      setScheduledLoading(true)
      const res = await fetch("/api/notes2?scope=scheduled", {
        headers: buildHeaders(user, employeeUuid),
      })
      const json = await res.json()
      console.log("[Notes2][FETCH scheduled] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Unable to load scheduled notes")
      }
      const data: Notes2Item[] = Array.isArray(json.data)
        ? json.data.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
            employee_id: note.employee_id,
            target_employee_id: note.target_employee_id ?? null,
            visibility: (note.visibility ?? "private") as "private" | "public",
            reminder_at: note.reminder_at ?? null,
            reminder_enabled: note.reminder_enabled ?? false,
            creator_role: note.creator_role ?? null,
          }))
        : []
      setScheduledNotes(sortNotes(data))
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to load scheduled notes",
        description: "We couldn't retrieve your scheduled notes right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setScheduledLoading(false)
    }
  }, [toast, user, employeeUuid])


  const fetchEmployees = useCallback(async () => {
    if (!canCreateForEmployee || !user?.id) return

    try {
      setEmployeesLoading(true)
      // Build headers with custom headers (for getRequestUser)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
            ...buildHeaders(user, employeeUuid),
      }
      
      // Also send Bearer token as fallback (like /api/auth/me)
      try {
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn('[Notes2][FETCH employees] Failed to parse session for Bearer token:', error)
      }
      
      console.log("[Notes2][FETCH employees] fetching with headers:", Object.keys(headers))
      const res = await fetch("/api/employees?limit=100&is_active=true", {
        method: "GET",
        headers,
      })
      const json = await res.json()
      console.log("[Notes2][FETCH employees] response", { status: res.status, body: json })
      
      if (res.ok && json.success && Array.isArray(json.data)) {
        const employeeList = json.data
          .filter((emp: any) => emp.id !== user?.id) // Exclude current user
          .map((emp: any) => ({
            id: emp.id,
            first_name: emp.first_name || "",
            last_name: emp.last_name || "",
            email: emp.email || "",
          }))
        console.log("[Notes2][FETCH employees] setting employees:", employeeList.length)
        setEmployees(employeeList)
      } else {
        console.error("[Notes2][FETCH employees] failed:", json.error || "Unknown error")
        toast({
          title: "Unable to load employees",
          description: json.error || "Failed to fetch employee list.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[Notes2][FETCH employees] error:", error)
      toast({
        title: "Unable to load employees",
        description: "We couldn't retrieve the employee list right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setEmployeesLoading(false)
    }
  }, [canCreateForEmployee, user?.id, toast])

  useEffect(() => {
    fetchPersonalNotes()
    fetchPublicNotes()
    fetchForYouNotes()
    fetchScheduledNotes()
    if (canCreateForEmployee) {
      fetchEmployees()
    }
  }, [fetchPersonalNotes, fetchPublicNotes, fetchForYouNotes, fetchScheduledNotes, fetchEmployees, canCreateForEmployee])

  useEffect(() => {
    const handler = () => {
      fetchPersonalNotes()
      fetchPublicNotes()
      fetchScheduledNotes()
    }
    if (typeof window !== "undefined") {
      window.addEventListener("notes2-updated", handler)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("notes2-updated", handler)
      }
    }
  }, [fetchPersonalNotes, fetchPublicNotes, fetchScheduledNotes])

  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      alert_level: "low",
      target_employee_id: "",
      reminder_date: undefined,
      reminder_time: "",
      reminder_enabled: false,
    })
    setCreateNoteTab("personal")
    setCreateNoteType("public")
    setSelectedEmployeeIds([])
  }

  const openCreateModal = () => {
    setCreateNoteTab(activeTab === "public" ? "public" : "personal")
    setIsCreateOpen(true)
    // Fetch employees when opening the dialog (if needed and not already loaded)
    if (canCreateForEmployee && employees.length === 0 && !employeesLoading) {
      fetchEmployees()
    }
  }

  const handleCreateNote = async () => {
    if (!user?.id) {
      toast({
        title: "You're not signed in",
        description: "Please sign in again to create a note.",
        variant: "destructive",
      })
      return
    }

    if (!form.content.trim()) {
      toast({
        title: "Content required",
        description: "Please add a few details to your note.",
        variant: "destructive",
      })
      return
    }

    // Validation for public tab
    if (createNoteTab === "public" && createNoteType === "specific_employee" && selectedEmployeeIds.length === 0) {
      toast({
        title: "Employee selection required",
        description: "Please select at least one employee.",
        variant: "destructive",
      })
      return
    }

    // Show confirmation dialog
    setPendingNoteSubmission(() => async () => {
      await submitNote()
    })
    setShowConfirmDialog(true)
  }

  const submitNote = async () => {
    if (!user?.id) return

    try {
      setIsSubmitting(true)
      
      // Determine visibility and target employees
      const isPublic = createNoteTab === "public" && createNoteType === "public" && canManagePublic
      const targetEmployees = createNoteTab === "public" && createNoteType === "specific_employee" ? selectedEmployeeIds : []

      if (targetEmployees.length > 0) {
        // Create notes for each selected employee
        const promises = targetEmployees.map(async (employeeId) => {
          // Build reminder_at if reminder is enabled
          let reminderAt: string | null = null
          if (form.reminder_enabled && form.reminder_date && form.reminder_time) {
            const [hours, minutes] = form.reminder_time.split(":")
            const reminderDateTime = new Date(form.reminder_date)
            reminderDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
            reminderAt = reminderDateTime.toISOString()
          }

          const requestPayload = {
            title: form.title.trim() || undefined,
            content: form.content.trim(),
            alert_level: form.alert_level,
            visibility: "private" as const,
            target_employee_id: employeeId,
            reminder_at: reminderAt,
            reminder_enabled: form.reminder_enabled && !!reminderAt,
          }
          console.log("[Notes2][CREATE] payload", requestPayload)
          const res = await fetch("/api/notes2", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...buildHeaders(user, employeeUuid),
            },
            body: JSON.stringify(requestPayload),
          })
          const json = await res.json()
          if (!res.ok || !json?.success) {
            throw new Error(json?.error || "Failed to create note")
          }
          return json.data
        })

        const createdNotes = await Promise.all(promises)
        
        // Add created notes to "for_you" list for non-employees (they sent these to employees)
        if (!isEmployee) {
          const formattedNotes: Notes2Item[] = createdNotes.map((note: any) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            alert_level: note.alert_level as AlertLevel,
            created_at: note.created_at,
            employee_id: note.employee_id ?? user.id,
            target_employee_id: note.target_employee_id ?? null,
            visibility: (note.visibility ?? "private") as "private" | "public",
            creator_role: note.creator_role ?? user.role ?? null,
          }))
          setForYouNotes((prev) => sortNotes([...formattedNotes, ...prev]))
        }
        
        toast({ 
          title: "Notes created", 
          description: `Successfully created ${createdNotes.length} note(s) for selected employee(s).` 
        })
      } else {
        // Create single note (personal or public)
        // Build reminder_at if reminder is enabled
        let reminderAt: string | null = null
        if (form.reminder_enabled && form.reminder_date && form.reminder_time) {
          const [hours, minutes] = form.reminder_time.split(":")
          const reminderDateTime = new Date(form.reminder_date)
          reminderDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
          reminderAt = reminderDateTime.toISOString()
        }

        const requestPayload = {
          title: form.title.trim() || undefined,
          content: form.content.trim(),
          alert_level: form.alert_level,
          visibility: isPublic ? "public" : "private",
          target_employee_id: undefined,
          reminder_at: reminderAt,
          reminder_enabled: form.reminder_enabled && !!reminderAt,
        }
        console.log("[Notes2][CREATE] payload", requestPayload)
        const res = await fetch("/api/notes2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildHeaders(user, employeeUuid),
          },
          body: JSON.stringify(requestPayload),
        })

        const json = await res.json()
        console.log("[Notes2][CREATE] response", { status: res.status, body: json })
        if (!res.ok || !json?.success) {
          const errorMsg = json?.error || json?.message || "Failed to create note"
          const errorDetails = json?.details ? ` Details: ${JSON.stringify(json.details)}` : ""
          console.error("[Notes2][CREATE] Error details:", { status: res.status, error: errorMsg, details: json?.details })
          throw new Error(`${errorMsg}${errorDetails}`)
        }

        const created: Notes2Item = {
          id: json.data.id,
          title: json.data.title,
          content: json.data.content,
          alert_level: json.data.alert_level,
          created_at: json.data.created_at,
          visibility: json.data.visibility ?? (isPublic ? "public" : "private"),
          employee_id: json.data.employee_id ?? user.id,
          target_employee_id: json.data.target_employee_id ?? null,
          reminder_at: json.data.reminder_at ?? null,
          reminder_enabled: json.data.reminder_enabled ?? false,
          creator_role: json.data.creator_role ?? user.role ?? null,
        }

        if (created.visibility === "public") {
          setPublicNotes((prev) => sortNotes([created, ...prev]))
        } else if (created.reminder_enabled) {
          setScheduledNotes((prev) => sortNotes([created, ...prev]))
        } else {
          setPersonalNotes((prev) => sortNotes([created, ...prev]))
        }
        toast({ title: "Note created", description: "Your note has been saved." })
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notes2-updated"))
      }
      resetForm()
      setIsCreateOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to save note",
        description: "Something went wrong while creating the note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setShowConfirmDialog(false)
      setPendingNoteSubmission(null)
    }
  }

  const handleUpdateNote = async () => {
    if (!editNote) return
    if (!user?.id) {
      toast({
        title: "You're not signed in",
        description: "Please sign in again before updating notes.",
        variant: "destructive",
      })
      return
    }
    if (!editForm.content.trim()) {
      toast({
        title: "Content required",
        description: "Please add content before saving the note.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsEditSubmitting(true)
      const updatePayload = {
        title: editForm.title.trim() || null,
        content: editForm.content.trim(),
        alert_level: editForm.alert_level,
        visibility:
          editForm.visibility === "public" && canManagePublic ? "public" : "private",
      }
      console.log("[Notes2][UPDATE] payload", { noteId: editNote.id, updatePayload })
      const res = await fetch(`/api/notes2/${editNote.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
            ...buildHeaders(user, employeeUuid),
        },
        body: JSON.stringify(updatePayload),
      })

      const json = await res.json()
      console.log("[Notes2][UPDATE] response", { status: res.status, body: json })
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update note")
      }

      toast({ title: "Note updated", description: "Your changes have been saved." })
      setEditNote(null)
      await Promise.all([fetchPersonalNotes(), fetchPublicNotes(), fetchForYouNotes()])
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notes2-updated"))
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to update note",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: string, note?: Notes2Item) => {
    if (!user?.id) {
      toast({
        title: "You're not signed in",
        description: "Please sign in again before deleting notes.",
        variant: "destructive",
      })
      return
    }
    
    // If this is a grouped note (sent to multiple employees), delete all notes in the group
    const noteIdsToDelete = note?.note_ids && note.note_ids.length > 0 ? note.note_ids : [noteId]
    const confirmMessage = noteIdsToDelete.length > 1
      ? `Are you sure you want to delete this note sent to ${noteIdsToDelete.length} employee(s)? This cannot be undone.`
      : "Are you sure you want to delete this note? This cannot be undone."
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setIsDeletePending(noteId)
      console.log("[Notes2][DELETE] request", { noteId, noteIdsToDelete })
      
      // Delete all notes in the group
      const deletePromises = noteIdsToDelete.map((id) =>
        fetch(`/api/notes2/${id}`, {
          method: "DELETE",
          headers: buildHeaders(user, employeeUuid),
        })
      )
      
      const results = await Promise.all(deletePromises)
      const jsonResults = await Promise.all(results.map((res) => res.json().catch(() => ({}))))
      
      // Check if all deletions succeeded
      const allSucceeded = results.every((res, index) => res.ok && jsonResults[index]?.success)
      
      if (!allSucceeded) {
        throw new Error("Failed to delete note(s)")
      }

      toast({ 
        title: "Note deleted",
        description: noteIdsToDelete.length > 1 ? `Deleted note sent to ${noteIdsToDelete.length} employee(s).` : undefined
      })
      
      // Remove from all note lists
      setPersonalNotes((prev) => prev.filter((n) => !noteIdsToDelete.includes(n.id)))
      setPublicNotes((prev) => prev.filter((n) => !noteIdsToDelete.includes(n.id)))
      setForYouNotes((prev) => prev.filter((n) => !noteIdsToDelete.includes(n.id)))
      
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notes2-updated"))
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to delete note",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeletePending(null)
    }
  }

  const getCreatorLabel = (note: Notes2Item) => {
    if (note.employee_id === user?.id) {
      return "You"
    }
    // Use the actual creator role if available, otherwise fall back to default
    if (note.creator_role) {
      // Format role name nicely (e.g., "super_admin" -> "Super Admin", "hr_manager" -> "HR Manager")
      return note.creator_role
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
    // Fallback for old notes without creator_role
    return "Team member"
  }

  const isNoteForCurrentUser = (note: Notes2Item) => {
    return note.target_employee_id === user?.id
  }

  const renderNoteCard = (note: Notes2Item) => {
    const meta = ALERT_META[note.alert_level]
    const canModify = note.employee_id === user?.id

    return (
      <Card
        key={note.id}
        className={cn(
          "cursor-pointer transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
          meta.chip,
        )}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-note-action]")) {
            return
          }
          setSelected(note)
        }}
      >
        <CardContent className="py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
              <Badge variant="outline" className={meta.badge}>
                {meta.label}
              </Badge>
              {note.visibility === "public" && (
                <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600 bg-purple-50">
                  Public
                </Badge>
              )}
              {isNoteForCurrentUser(note) && (
                <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50">
                  Only for you
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(note.created_at), "MMM dd, yyyy • HH:mm")}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm font-semibold text-navy">{note.title || "Untitled note"}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{note.content}</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Created by {getCreatorLabel(note)}</span>
              </div>
              {note.reminder_enabled && note.reminder_at && (
                <div className="flex items-center gap-2 ml-5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Reminder: {format(new Date(note.reminder_at), "PPP 'at' p")}</span>
                </div>
              )}
              {note.recipient_names && note.recipient_names.length > 0 && (
                <span className="text-xs text-muted-foreground ml-5">
                  Sent to: {note.recipient_names.join(", ")}
                </span>
              )}
            </div>
            {canModify && (
              <div className="flex items-center gap-3">
                <button
                  data-note-action
                  type="button"
                  className="text-primary hover:text-primary/80 transition-colors"
                  aria-label="Edit note"
                  onClick={() => {
                    setEditNote(note)
                    setEditForm({
                      title: note.title ?? "",
                      content: note.content,
                      alert_level: note.alert_level,
                      visibility: note.visibility,
                    })
                  }}
                >
                  <PenSquare className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </button>
                <button
                  data-note-action
                  type="button"
                  className="text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                  onClick={() => handleDeleteNote(note.id, note)}
                  disabled={isDeletePending === note.id}
                  aria-label="Delete note"
                >
                  {isDeletePending === note.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {isDeletePending === note.id ? "Deleting note" : "Delete note"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Filter notes based on search query and alert level
  const filterNotes = (notes: Notes2Item[]): Notes2Item[] => {
    let filtered = [...notes]

    // Filter by search query (title and content)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((note) => {
        const titleMatch = note.title?.toLowerCase().includes(query) ?? false
        const contentMatch = note.content.toLowerCase().includes(query)
        return titleMatch || contentMatch
      })
    }

    // Filter by alert level
    if (filterAlertLevel !== "all") {
      filtered = filtered.filter((note) => note.alert_level === filterAlertLevel)
    }

    return filtered
  }

  const renderNotesPane = (
    notesArr: Notes2Item[],
    loading: boolean,
    emptyMessage: string,
    scope: "personal" | "public" | "for_you" | "scheduled",
  ) => {
    if (loading) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      )
    }

    // Apply filters to the notes
    const filteredNotes = filterNotes(notesArr)

    // Show message if filters are active but no notes match
    if (!filteredNotes.length && notesArr.length > 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3 text-muted-foreground">
            <Notebook className="h-8 w-8 mx-auto opacity-70" />
            <p className="text-sm">No notes match your filters.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setFilterAlertLevel("all")
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )
    }

    // Show empty state if no notes at all
    if (!filteredNotes.length) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3 text-muted-foreground">
            <Notebook className="h-8 w-8 mx-auto opacity-70" />
            <p className="text-sm">{emptyMessage}</p>
            {scope === "personal" && (
              <Button size="sm" variant="outline" onClick={openCreateModal}>
                Create your first note
              </Button>
            )}
          </CardContent>
        </Card>
      )
    }

    return <div className="grid gap-4">{filteredNotes.map((note) => renderNoteCard(note))}</div>
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-4" />
            Loading notes...
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Notes</h1>
          <p className="text-sm text-muted-foreground">Personal reminders and organisation-wide alerts.</p>
        </div>
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {activeTab === "public" && canManagePublic ? "Create Public Note" : "Create Note"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "personal" | "public" | "for_you" | "scheduled")} className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="for_you">
            {isEmployee ? "For You" : "Sent to Employees"}
          </TabsTrigger>
          <TabsTrigger value="scheduled">Schedule Notes</TabsTrigger>
        </TabsList>
        
        {/* Filter Section */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Alert Level Filter */}
              <div className="w-full md:w-48">
                <Select
                  value={filterAlertLevel}
                  onValueChange={(value) => setFilterAlertLevel(value as AlertLevel | "all")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by alert level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Alert Levels</SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        High Alert
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Medium Alert
                      </span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Low Alert
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Clear Filters Button */}
              {(searchQuery || filterAlertLevel !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setFilterAlertLevel("all")
                  }}
                  className="whitespace-nowrap"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <TabsContent value="personal">
          {renderNotesPane(
            personalNotes,
            personalLoading,
            "You have not created any notes yet.",
            "personal",
          )}
        </TabsContent>
        <TabsContent value="public">
          {renderNotesPane(publicNotes, publicLoading, "No public notes have been shared yet.", "public")}
        </TabsContent>
        <TabsContent value="for_you">
          {renderNotesPane(
            forYouNotes,
            forYouLoading,
            isEmployee 
              ? "No notes have been sent to you yet." 
              : "You have not sent any notes to specific employees yet.",
            "for_you",
          )}
        </TabsContent>
        <TabsContent value="scheduled">
          {renderNotesPane(
            scheduledNotes,
            scheduledLoading,
            "You have no scheduled notes with reminders.",
            "scheduled",
          )}
        </TabsContent>
      </Tabs>

      {/* Create Note Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Note</DialogTitle>
          </DialogHeader>
          <Tabs value={createNoteTab} onValueChange={(value) => setCreateNoteTab(value as "personal" | "public")} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="public">Public</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Optional title"
                  value={form.title}
                  maxLength={120}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  placeholder="Describe what needs attention..."
                  rows={4}
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Alert level</Label>
                <Select
                  value={form.alert_level}
                  onValueChange={(value: AlertLevel) =>
                    setForm((prev) => ({ ...prev, alert_level: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select alert level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        High Alert
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Medium Alert
                      </span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Low Alert
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reminder-enabled"
                    checked={form.reminder_enabled}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, reminder_enabled: checked === true }))
                    }
                  />
                  <Label htmlFor="reminder-enabled" className="cursor-pointer">
                    Set reminder
                  </Label>
                </div>
                {form.reminder_enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reminder-date">Reminder Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !form.reminder_date && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {form.reminder_date ? format(form.reminder_date, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <DatePicker
                            mode="single"
                            selected={form.reminder_date}
                            onSelect={(date) => setForm((prev) => ({ ...prev, reminder_date: date }))}
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder-time">Reminder Time</Label>
                      <Input
                        id="reminder-time"
                        type="time"
                        value={form.reminder_time}
                        onChange={(e) => setForm((prev) => ({ ...prev, reminder_time: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="public" className="space-y-4">
              {!canManagePublic ? (
                <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                  You don't have permission to create public notes.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Note Type</Label>
                    <Select
                      value={createNoteType}
                      onValueChange={(value) => {
                        setCreateNoteType(value as "public" | "specific_employee")
                        setSelectedEmployeeIds([])
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select note type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Create for Public</SelectItem>
                        {canCreateForEmployee && (
                          <SelectItem value="specific_employee">Create for a specific employee</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title-public">Title</Label>
                    <Input
                      id="title-public"
                      placeholder="Optional title"
                      value={form.title}
                      maxLength={120}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content-public">Content *</Label>
                    <Textarea
                      id="content-public"
                      placeholder="Describe what needs attention..."
                      rows={4}
                      value={form.content}
                      onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alert level</Label>
                    <Select
                      value={form.alert_level}
                      onValueChange={(value: AlertLevel) =>
                        setForm((prev) => ({ ...prev, alert_level: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select alert level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            High Alert
                          </span>
                        </SelectItem>
                        <SelectItem value="medium">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Medium Alert
                          </span>
                        </SelectItem>
                        <SelectItem value="low">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Low Alert
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="reminder-enabled-public"
                        checked={form.reminder_enabled}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, reminder_enabled: checked === true }))
                        }
                      />
                      <Label htmlFor="reminder-enabled-public" className="cursor-pointer">
                        Set reminder
                      </Label>
                    </div>
                    {form.reminder_enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="reminder-date-public">Reminder Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !form.reminder_date && "text-muted-foreground"
                                )}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {form.reminder_date ? format(form.reminder_date, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <DatePicker
                                mode="single"
                                selected={form.reminder_date}
                                onSelect={(date) => setForm((prev) => ({ ...prev, reminder_date: date }))}
                                disabled={(date) => date < new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reminder-time-public">Reminder Time</Label>
                          <Input
                            id="reminder-time-public"
                            type="time"
                            value={form.reminder_time}
                            onChange={(e) => setForm((prev) => ({ ...prev, reminder_time: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {createNoteType === "specific_employee" && (
                    <div className="space-y-2">
                      <Label>Select Employee(s)</Label>
                      {employeesLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading employees...
                        </div>
                      ) : (
                        <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                          {employees.length === 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">No employees available</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fetchEmployees()}
                                className="text-xs"
                              >
                                Retry
                              </Button>
                            </div>
                          ) : (
                            employees.map((emp) => (
                              <div key={emp.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`employee-${emp.id}`}
                                  checked={selectedEmployeeIds.includes(emp.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedEmployeeIds((prev) => [...prev, emp.id])
                                    } else {
                                      setSelectedEmployeeIds((prev) => prev.filter((id) => id !== emp.id))
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`employee-${emp.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                >
                                  {emp.first_name} {emp.last_name} {emp.email ? `(${emp.email})` : ""}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                      {selectedEmployeeIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedEmployeeIds.length} employee(s) selected
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Note Creation</DialogTitle>
            <DialogDescription>
              {createNoteTab === "public" && createNoteType === "public" 
                ? "Are you sure you want to create a public note? This will be visible to all employees and everyone using the system."
                : createNoteTab === "public" && createNoteType === "specific_employee"
                ? `Are you sure you want to send notes to ${selectedEmployeeIds.length} selected employee(s)?`
                : "Are you sure you want to create this personal note?"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false)
                setPendingNoteSubmission(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingNoteSubmission) {
                  pendingNoteSubmission()
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={!!editNote} onOpenChange={(open) => !open && setEditNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                maxLength={120}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                rows={4}
                value={editForm.content}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, content: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Alert level</Label>
              <Select
                value={editForm.alert_level}
                onValueChange={(value: AlertLevel) =>
                  setEditForm((prev) => ({ ...prev, alert_level: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alert level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      High Alert
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Medium Alert
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Low Alert
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canManagePublic && (
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select
                  value={editForm.visibility}
                  onValueChange={(value: "private" | "public") =>
                    setEditForm((prev) => ({ ...prev, visibility: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Personal (only visible to you)</SelectItem>
                    <SelectItem value="public">Public (visible to everyone)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditNote(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNote} disabled={isEditSubmitting}>
              {isEditSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note details dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              {selected?.title || "Note Details"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <Badge className={ALERT_META[selected.alert_level].badge}>
                  {ALERT_META[selected.alert_level].label}
                </Badge>
              {selected.visibility === "public" && (
                <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600 bg-purple-50">
                  Public
                </Badge>
              )}
              {isNoteForCurrentUser(selected) && (
                <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50">
                  Only for you
                </Badge>
              )}
                <span className="text-muted-foreground">
                  {format(new Date(selected.created_at), "PPP • HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">{selected.content}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
              Created by <span className="font-medium">{getCreatorLabel(selected)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

