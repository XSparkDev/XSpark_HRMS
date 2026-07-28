"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus, Search, Filter, Edit, Trash2, Eye, MoreHorizontal, History, RotateCcw, ExternalLink, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { EmployeeProfile, EmployeeFilters } from "@/lib/types/employee"
import { getCurrentUser, hasPermission, type User } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function EmployeeManagementPage() {
  type EmployeeDocumentPreview = {
    id: string
    employee_id: string
    name: string
    type: string
    file_size: number
    file_type: string
    file_url: string
    created_at: string
    is_sensitive: boolean
  }

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isPastEmployeesModalOpen, setIsPastEmployeesModalOpen] = useState(false)
  const [pastEmployees, setPastEmployees] = useState<EmployeeProfile[]>([])
  const [isLoadingPastEmployees, setIsLoadingPastEmployees] = useState(false)
  const [activeAddTab, setActiveAddTab] = useState("manual")
  const [isAppointmentConfirmOpen, setIsAppointmentConfirmOpen] = useState(false)
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false)
  const [gmail, setGmail] = useState("")
  const [gmailError, setGmailError] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null)
  const [selectedEmployeeDocuments, setSelectedEmployeeDocuments] = useState<EmployeeDocumentPreview[]>([])
  const [isLoadingEmployeeDocuments, setIsLoadingEmployeeDocuments] = useState(false)
  const [activePreviewDocument, setActivePreviewDocument] = useState<EmployeeDocumentPreview | null>(null)
  const [filters, setFilters] = useState<EmployeeFilters>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const user = getCurrentUser()
  const { toast } = useToast()
  const canVerifyEmployees = user?.role === "admin" || user?.role === "super_admin"
  const canPreviewEmployeeDocuments = user?.role === "admin" || user?.role === "super_admin"
  const hasFetchedRef = useRef(false)
  const unverifiedToastShownRef = useRef(false)

  useEffect(() => {
    if (!canVerifyEmployees) return
    if (unverifiedToastShownRef.current) return
    if (!employees || employees.length === 0) return

    const unverifiedCount = employees.filter((employee) => !(employee.id_verified && employee.bank_verified)).length
    if (unverifiedCount <= 0) return

    unverifiedToastShownRef.current = true
    toast({
      title: "Employees need verification",
      description: `${unverifiedCount} employee${unverifiedCount === 1 ? "" : "s"} are unverified. Click the ID/Bank badges to verify (or unverify).`,
    })
  }, [canVerifyEmployees, employees, toast])

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes"
    const units = ["Bytes", "KB", "MB", "GB"]
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / Math.pow(1024, unitIndex)
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
  }

  const formatDocumentType = (type: string) => type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())

  const inferFileTypeFromUrl = (url: string) => {
    const lower = (url || "").toLowerCase()
    if (lower.includes(".pdf")) return "application/pdf"
    if (lower.includes(".png")) return "image/png"
    if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg"
    return ""
  }

  const inferNameFromUrl = (url: string) => {
    try {
      const clean = url.split("?")[0] || url
      const parts = clean.split("/").filter(Boolean)
      return decodeURIComponent(parts[parts.length - 1] || "Document")
    } catch {
      return "Document"
    }
  }

  const fetchEmployeeDocuments = useCallback(async (employeeAuthUserId: string) => {
    if (!canPreviewEmployeeDocuments) {
      setSelectedEmployeeDocuments([])
      setActivePreviewDocument(null)
      return
    }

    try {
      setIsLoadingEmployeeDocuments(true)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
      }

      try {
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn("[Employees][DOCUMENTS] Failed to parse session for Bearer token:", error)
      }

      const res = await fetch(`/api/documents?employee_id=${encodeURIComponent(employeeAuthUserId)}`, { method: "GET", headers })
      const json = await res.json().catch(() => [])
      const employeeDocs = (Array.isArray(json) ? json : [])
        .map((doc: any) => ({
          id: String(doc.id ?? ""),
          employee_id: String(doc.employee_id ?? ""),
          name: String(doc.name ?? "Untitled document"),
          type: String(doc.type ?? "other_personal_documents"),
          file_size: Number(doc.file_size ?? 0),
          file_type: String(doc.file_type ?? ""),
          file_url: String(doc.file_url ?? ""),
          created_at: String(doc.created_at ?? ""),
          is_sensitive: Boolean(doc.is_sensitive),
        }))

      setSelectedEmployeeDocuments(employeeDocs)
      setActivePreviewDocument(employeeDocs[0] ?? null)
    } catch (error) {
      console.error("[Employees][DOCUMENTS] error:", error)
      setSelectedEmployeeDocuments([])
      setActivePreviewDocument(null)
      toast({
        title: "Unable to load documents",
        description: "We couldn't load this employee's documents right now.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingEmployeeDocuments(false)
    }
  }, [canPreviewEmployeeDocuments, toast, user])

  // Build headers for API requests (same pattern as notes page)
  const buildHeaders = (user: User | null) => {
    const headers: Record<string, string> = {}
    if (user?.id) headers["x-user-id"] = user.id
    if (user?.role) headers["x-user-role"] = user.role
    if (user?.employeeId) headers["x-employee-id"] = user.employeeId
    else if (user?.id) headers["x-employee-id"] = user.id // Fallback to user.id if employeeId not available
    return headers
  }

  // Fetch employees from API
  const fetchEmployees = useCallback(async () => {
    if (!user?.id || !hasPermission(user, "view_employees")) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      // Build headers with custom headers (for getRequestUser)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
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
        console.warn('[Employees][FETCH] Failed to parse session for Bearer token:', error)
      }
      
      const res = await fetch("/api/employees?limit=100&is_active=true", {
        method: "GET",
        headers,
      })
      const json = await res.json()
      
      if (res.ok && json.success && Array.isArray(json.data)) {
        // Map API response to EmployeeProfile type
        const employeeList: EmployeeProfile[] = json.data.map((emp: any) => {
          // Extract job title name from relationship
          let jobTitleName = ""
          
          // Debug: log what we're getting
          if (process.env.NODE_ENV === 'development') {
            console.log('[Employees] Job title data for', emp.first_name, emp.last_name, ':', emp.job_titles)
          }
          
          // Extract job title name from relationship (works for all employees - existing and new)
          if (emp.job_titles) {
            if (typeof emp.job_titles === 'object' && !Array.isArray(emp.job_titles)) {
              // Single object relationship (most common case)
              jobTitleName = emp.job_titles.title || ""
            } else if (Array.isArray(emp.job_titles) && emp.job_titles.length > 0) {
              // Array relationship (shouldn't happen for 1:1, but handle it)
              const jobTitle = emp.job_titles[0]
              jobTitleName = (typeof jobTitle === 'object' && jobTitle?.title) ? jobTitle.title : ""
            }
          }
          
          // Store job title name if available (will be empty string if null/undefined/not set)
          // This ensures all employees show their job title when available
          const finalJobTitle = jobTitleName || ""
          
          return {
            id: emp.id,
            user_id: emp.auth_user_id || emp.id,
            first_name: emp.first_name || "",
            middle_name: emp.middle_name || "",
            last_name: emp.last_name || "",
            preferred_name: emp.preferred_name || "",
            id_number: emp.id_number || "",
            dob: emp.dob || "",
            sex: emp.sex || 'male',
            gender: emp.gender || 'male',
            pronouns: emp.pronouns || "",
            employee_ID: emp.employee_id || "",
            job_title_id: finalJobTitle, // Store job title name, not UUID
            date_hired: emp.date_hired || "",
            date_terminated: emp.date_terminated || "",
            email: emp.email || "",
            phone: emp.phone || "",
            alternative_phone: emp.alternative_phone || "",
            address: emp.address || "",
            tax_number: emp.tax_number || "",
            nationality: emp.nationality || "South Africa",
            passport_number: emp.passport_number || "",
            passport_document: emp.passport_document_url || "",
            work_permit: emp.work_permit_url || "",
            id_verified: emp.id_verified || false,
            work_permit_verified: emp.work_permit_verified || false,
            bank_verified: emp.bank_verified || false,
            documents: Array.isArray(emp.documents) ? emp.documents : [],
            images: emp.profile_picture_url ? [emp.profile_picture_url] : [],
            created_at: emp.created_at || new Date().toISOString(),
            updated_at: emp.updated_at || new Date().toISOString(),
          }
        })
        setEmployees(employeeList)
        hasFetchedRef.current = true
      } else {
        console.error("[Employees][FETCH] failed:", json.error || "Unknown error")
        toast({
          title: "Unable to load employees",
          description: json.error || "Failed to fetch employee list.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[Employees][FETCH] error:", error)
      toast({
        title: "Unable to load employees",
        description: "We couldn't retrieve the employee list right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, user?.role, toast]) // Only depend on user.id and user.role, toast is stable

  // Fetch employees on mount only (once)
  useEffect(() => {
    if (hasFetchedRef.current) return // Already fetched, don't fetch again
    
    if (user?.id && hasPermission(user, "view_employees")) {
      fetchEmployees()
    } else if (!user?.id || !hasPermission(user, "view_employees")) {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Fetch past employees
  const fetchPastEmployees = useCallback(async () => {
    if (!user?.id || !hasPermission(user, "view_employees")) {
      return
    }

    try {
      setIsLoadingPastEmployees(true)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
      }
      
      // Send Bearer token as fallback
      try {
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn('[Past Employees][FETCH] Failed to parse session for Bearer token:', error)
      }
      
      const res = await fetch("/api/employees?limit=100&is_active=false", {
        method: "GET",
        headers,
      })
      const json = await res.json()
      
      if (res.ok && json.success && Array.isArray(json.data)) {
        const employeeList: EmployeeProfile[] = json.data.map((emp: any) => {
          // Extract job title name from relationship
          let jobTitleName = ""
          
          if (emp.job_titles) {
            if (typeof emp.job_titles === 'object' && !Array.isArray(emp.job_titles)) {
              jobTitleName = emp.job_titles.title || ""
            } else if (Array.isArray(emp.job_titles) && emp.job_titles.length > 0) {
              const jobTitle = emp.job_titles[0]
              jobTitleName = (typeof jobTitle === 'object' && jobTitle?.title) ? jobTitle.title : ""
            }
          }
          
          const finalJobTitle = jobTitleName || ""
          
          return {
            id: emp.id,
            user_id: emp.auth_user_id || emp.id,
            first_name: emp.first_name || "",
            middle_name: emp.middle_name || "",
            last_name: emp.last_name || "",
            preferred_name: emp.preferred_name || "",
            id_number: emp.id_number || "",
            dob: emp.dob || "",
            sex: emp.sex || 'male',
            gender: emp.gender || 'male',
            pronouns: emp.pronouns || "",
            employee_ID: emp.employee_id || "",
            job_title_id: finalJobTitle,
            date_hired: emp.date_hired || "",
            date_terminated: emp.date_terminated || "",
            email: emp.email || "",
            phone: emp.phone || "",
            alternative_phone: emp.alternative_phone || "",
            address: emp.address || "",
            tax_number: emp.tax_number || "",
            nationality: emp.nationality || "South Africa",
            passport_number: emp.passport_number || "",
            passport_document: emp.passport_document_url || "",
            work_permit: emp.work_permit_url || "",
            id_verified: emp.id_verified || false,
            work_permit_verified: emp.work_permit_verified || false,
            bank_verified: emp.bank_verified || false,
            documents: Array.isArray(emp.documents) ? emp.documents : [],
            images: emp.profile_picture_url ? [emp.profile_picture_url] : [],
            created_at: emp.created_at || new Date().toISOString(),
            updated_at: emp.updated_at || new Date().toISOString(),
          }
        })
        setPastEmployees(employeeList)
      } else {
        console.error("[Past Employees][FETCH] failed:", json.error || "Unknown error")
        toast({
          title: "Unable to load past employees",
          description: json.error || "Failed to fetch past employee list.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[Past Employees][FETCH] error:", error)
      toast({
        title: "Unable to load past employees",
        description: "We couldn't retrieve the past employee list right now. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPastEmployees(false)
    }
  }, [user?.id, user?.role, toast])

  // Fetch past employees when modal opens
  useEffect(() => {
    if (isPastEmployeesModalOpen && user?.id && hasPermission(user, "view_employees")) {
      fetchPastEmployees()
    }
  }, [isPastEmployeesModalOpen, fetchPastEmployees, user?.id])

  // Handle restore employee
  const handleRestoreEmployee = async (employee: EmployeeProfile) => {
    if (!confirm(`Are you sure you want to restore ${employee.first_name} ${employee.last_name}?`)) {
      return
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
      }
      
      // Send Bearer token as fallback
      try {
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn('[Restore Employee] Failed to parse session:', error)
      }

      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers,
      })
      
      const json = await res.json()
      
      if (res.ok && json.success) {
        toast({
          title: "Employee restored",
          description: `${employee.first_name} ${employee.last_name} has been restored successfully.`,
        })
        // Refresh both lists
        fetchPastEmployees()
        fetchEmployees()
      } else {
        throw new Error(json.error || "Failed to restore employee")
      }
    } catch (error) {
      console.error("Error restoring employee:", error)
      toast({
        title: "Failed to restore employee",
        description: error instanceof Error ? error.message : "An error occurred while restoring the employee.",
        variant: "destructive",
      })
    }
  }

  // Filter employees based on search and filters
  useEffect(() => {
    let filtered = employees

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_ID.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(emp => emp.job_title_id === filters.department)
    }

    // Status filter
    if (filters.status) {
      // For now, all employees are active
      filtered = filtered.filter(emp => filters.status === 'active')
    }

    setFilteredEmployees(filtered)
  }, [employees, searchTerm, filters])

  const handleCreateEmployee = () => {
    // Implement create employee logic
    console.log("Creating employee...")
    setIsCreateModalOpen(false)
    setIsAppointmentConfirmOpen(true)
  }

  const handleEditEmployee = (employee: EmployeeProfile) => {
    setSelectedEmployee(employee)
    setIsEditModalOpen(true)
  }

  const handleDeleteEmployee = async (employee: EmployeeProfile) => {
    if (!confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
      return
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
      }

      // Include bearer token if available
      try {
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn("[Employees][DELETE] Failed to parse session for Bearer token:", error)
      }

      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
        headers,
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete employee")
      }

      toast({
        title: "Employee deleted",
        description: `${employee.first_name} ${employee.last_name} was moved to Past Employees.`,
      })

      // Refresh both current and past employee lists
      fetchEmployees()
      fetchPastEmployees()
    } catch (error) {
      console.error("[Employees][DELETE] error:", error)
      toast({
        title: "Failed to delete employee",
        description:
          error instanceof Error ? error.message : "An error occurred while deleting the employee.",
        variant: "destructive",
      })
    }
  }

  const handleViewEmployee = (employee: EmployeeProfile) => {
    setSelectedEmployee(employee)
    setIsViewModalOpen(true)
    setActivePreviewDocument(null)
    if (canPreviewEmployeeDocuments) {
      const directDocs = Array.isArray(employee.documents) ? employee.documents.filter(Boolean) : []
      if (directDocs.length > 0) {
        const mapped = directDocs.map((url, index) => ({
          id: `${employee.id}-${index}-${String(url)}`,
          employee_id: (employee as any).user_id || employee.user_id || employee.id,
          name: inferNameFromUrl(String(url)),
          type: "other_personal_documents",
          file_size: 0,
          file_type: inferFileTypeFromUrl(String(url)),
          file_url: String(url),
          created_at: "",
          is_sensitive: false,
        }))
        setSelectedEmployeeDocuments(mapped)
        setActivePreviewDocument(mapped[0] ?? null)
      } else {
        fetchEmployeeDocuments((employee as any).user_id || employee.user_id || employee.id)
      }
    } else {
      setSelectedEmployeeDocuments([])
    }
  }

  const handleVerifyEmployee = async (employee: EmployeeProfile) => {
    const isVerified = Boolean(employee.id_verified)
    const prompt = isVerified
      ? `Unverify ID for ${employee.first_name} ${employee.last_name}?`
      : `Verify ID for ${employee.first_name} ${employee.last_name}?`
    if (!confirm(prompt)) return

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
      }

      try {
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
        }
      } catch (error) {
        console.warn("[Employees][VERIFY ID] Failed to parse session for Bearer token:", error)
      }

      const endpoint = isVerified ? "unverify-id" : "verify-id"
      const res = await fetch(`/api/employees/${employee.id}/${endpoint}`, { method: "POST", headers })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || (isVerified ? "Failed to unverify employee ID" : "Failed to verify employee ID"))
      }

      toast({
        title: isVerified ? "Employee ID unverified" : "Employee ID verified",
        description: `${employee.first_name} ${employee.last_name} has been ${isVerified ? "unverified" : "verified"}.`,
      })
      fetchEmployees()
    } catch (error) {
      console.error("[Employees][VERIFY ID] error:", error)
      toast({
        title: isVerified ? "Unverify failed" : "Verification failed",
        description: error instanceof Error ? error.message : "An error occurred while updating verification.",
        variant: "destructive",
      })
    }
  }

  const handleVerifyBank = async (employee: EmployeeProfile) => {
    const isVerified = Boolean(employee.bank_verified)
    const prompt = isVerified
      ? `Unverify bank details for ${employee.first_name} ${employee.last_name}?`
      : `Verify bank details for ${employee.first_name} ${employee.last_name}?`
    if (!confirm(prompt)) return

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildHeaders(user),
      }

      try {
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
        }
      } catch (error) {
        console.warn("[Employees][VERIFY BANK] Failed to parse session for Bearer token:", error)
      }

      const endpoint = isVerified ? "unverify-bank" : "verify-bank"
      const res = await fetch(`/api/employees/${employee.id}/${endpoint}`, { method: "POST", headers })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || (isVerified ? "Failed to unverify bank details" : "Failed to verify bank details"))
      }

      toast({
        title: isVerified ? "Bank unverified" : "Bank verified",
        description: `${employee.first_name} ${employee.last_name}'s bank details have been ${isVerified ? "unverified" : "verified"}.`,
      })
      fetchEmployees()
    } catch (error) {
      console.error("[Employees][VERIFY BANK] error:", error)
      toast({
        title: isVerified ? "Unverify failed" : "Verification failed",
        description: error instanceof Error ? error.message : "An error occurred while updating verification.",
        variant: "destructive",
      })
    }
  }

  const generateEmployeeId = () => {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `XSP${year}/${month}/${sequence}`
  }

  // Check if user has HR permissions
  if (!hasPermission(user, "view_employees")) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-navy mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view employee management.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Employee Management</h1>
          <p className="text-muted-foreground mt-2">Manage employee profiles and information</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Past Employees Button */}
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setIsPastEmployeesModalOpen(true)}
          >
            <History className="h-4 w-4" />
            Past Employees
          </Button>
          {/* Add Employee */}
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              {/* Tabs for Search by ID / Manual Input */}
              <Tabs value={activeAddTab} onValueChange={setActiveAddTab} className="mt-2">
                <TabsList>
                  <TabsTrigger value="search">Search by ID</TabsTrigger>
                  <TabsTrigger value="manual">Manual Input</TabsTrigger>
                </TabsList>
                <TabsContent value="search" className="pt-4">
                  <div className="flex flex-col sm:flex-row items-end gap-3 sm:gap-4">
                    <div className="flex-1">
                      <Label htmlFor="searchIdNumber">ID Number</Label>
                      <Input id="searchIdNumber" placeholder="enter ID number" className="mt-2 uniform-input" />
                    </div>
                    <Button
                      className="mt-2 sm:mt-0"
                      onClick={() => {
                        const idInput = (document.getElementById("searchIdNumber") as HTMLInputElement)
                        const idVal = idInput?.value?.trim()
                        if (!idVal) return alert("Please enter an ID Number")
                        console.log({ idNumber: idVal })
                        // Neutral info for now
                        alert("Search would call API — partner integration required")
                      }}
                    >
                      Search Employee
                    </Button>
                  </div>
                </TabsContent>
            <TabsContent value="manual" className="pt-4">
              <EmployeeForm 
                onSubmit={async () => {
                  // Refresh list after successful creation
                  await fetchEmployees()
                  await fetchPastEmployees()
                  // Close modal; skip appointment-letter flow for now
                  setIsCreateModalOpen(false)
                }}
                employeeId={generateEmployeeId()}
              />
            </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-b shadow-sm">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="uniform-input"
                  style={{ paddingLeft: '3rem' }}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Select value={filters.department} onValueChange={(value) => setFilters({...filters, department: value})}>
                <SelectTrigger className="w-full sm:w-48 uniform-input">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">Development</SelectItem>
                  <SelectItem value="designer">Design</SelectItem>
                  <SelectItem value="manager">Management</SelectItem>
                  <SelectItem value="hr">Human Resources</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value as 'active' | 'inactive'})}>
                <SelectTrigger className="w-full sm:w-48 uniform-input">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setFilters({})} className="w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Clear Filters</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/40">
                  <TableHead className="h-12 px-3 md:px-6 font-semibold">Employee</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold hidden sm:table-cell">Employee ID</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold hidden md:table-cell">Job Title</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold hidden lg:table-cell">Email</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold">Status</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold hidden md:table-cell">Verification</TableHead>
                  <TableHead className="h-12 px-3 md:px-6 font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee, index) => {
                  // Check if employee is fully verified (all three verifications must be true)
                  // "Verification status" is considered verified when ID + bank are verified.
                  // Work permit verification is tracked separately.
                  const isFullyVerified = employee.id_verified && employee.bank_verified
                  
                  return (
                    <TableRow 
                      key={employee.id}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        index % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                    >
                      <TableCell className="px-3 md:px-6 py-4">
                        <div className="flex items-center gap-2 md:gap-3">
                          <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                            <AvatarImage src={employee.images?.[0]} />
                            <AvatarFallback className="text-xs md:text-sm">
                              {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm md:text-base leading-tight">
                              {employee.preferred_name || employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                              {employee.nationality}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 sm:hidden font-mono">
                              {employee.employee_ID}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4 hidden sm:table-cell">
                        <span className="font-mono text-sm text-muted-foreground">
                          {employee.employee_ID}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4 hidden md:table-cell">
                        {employee.job_title_id && 
                         employee.job_title_id.trim() !== "" && 
                         !employee.job_title_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? (
                          <Badge variant="secondary" className="rounded-full px-2 md:px-3 py-1 text-xs">
                            {employee.job_title_id}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm break-words">{employee.email}</span>
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {employee.phone || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4">
                        <Badge 
                          variant={isFullyVerified ? "default" : "destructive"} 
                          className="rounded-full px-2 md:px-3 py-1 text-xs"
                        >
                          {isFullyVerified ? "Verified" : "Unverified"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4 hidden md:table-cell">
                        <div className="flex gap-1.5">
                          {canVerifyEmployees ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyEmployee(employee)}
                              className="disabled:cursor-not-allowed"
                              aria-label={`Verify ID for ${employee.first_name} ${employee.last_name}`}
                            >
                              <Badge
                                variant={employee.id_verified ? "default" : "secondary"}
                                className="text-xs rounded-full px-2.5 py-1 cursor-pointer"
                              >
                                ID
                              </Badge>
                            </button>
                          ) : (
                            <Badge
                              variant={employee.id_verified ? "default" : "secondary"}
                              className="text-xs rounded-full px-2.5 py-1"
                            >
                              ID
                            </Badge>
                          )}

                          {canVerifyEmployees ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyBank(employee)}
                              className="disabled:cursor-not-allowed"
                              aria-label={`Verify bank for ${employee.first_name} ${employee.last_name}`}
                            >
                              <Badge
                                variant={employee.bank_verified ? "default" : "secondary"}
                                className="text-xs rounded-full px-2.5 py-1 cursor-pointer"
                              >
                                Bank
                              </Badge>
                            </button>
                          ) : (
                            <Badge
                              variant={employee.bank_verified ? "default" : "secondary"}
                              className="text-xs rounded-full px-2.5 py-1"
                            >
                              Bank
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 md:px-6 py-4">
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              align="end" 
                              className="!p-2 w-40 bg-white shadow-lg rounded-lg border"
                            >
                              <DropdownMenuItem
                                onClick={() => handleViewEmployee(employee)}
                                className="cursor-pointer px-3 py-2.5 text-sm rounded-md hover:bg-muted focus:bg-muted"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditEmployee(employee)}
                                className="cursor-pointer px-3 py-2.5 text-sm rounded-md hover:bg-muted focus:bg-muted"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {canVerifyEmployees && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleVerifyEmployee(employee)}
                                    className="cursor-pointer px-3 py-2.5 text-sm rounded-md hover:bg-muted focus:bg-muted"
                                  >
                                    {employee.id_verified ? "Unverify ID" : "Verify ID"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleVerifyBank(employee)}
                                    className="cursor-pointer px-3 py-2.5 text-sm rounded-md hover:bg-muted focus:bg-muted"
                                  >
                                    {employee.bank_verified ? "Unverify Bank" : "Verify Bank"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator className="my-1.5" />
                              <DropdownMenuItem
                                onClick={() => handleDeleteEmployee(employee)}
                                className="cursor-pointer px-3 py-2.5 text-sm rounded-md text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No employees found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Employee Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className={cn("space-y-6", canPreviewEmployeeDocuments ? "lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0" : "")}>
              <div className={cn("space-y-6", canPreviewEmployeeDocuments ? "lg:max-h-[72vh] lg:overflow-y-auto lg:pr-2" : "")}>
                {/* Personal Information */}
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">First Name</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.first_name}</p>
                    </div>
                    {selectedEmployee.middle_name && (
                      <div className="min-w-0">
                        <Label className="text-sm text-muted-foreground">Middle Name</Label>
                        <p className="text-base font-medium break-words">{selectedEmployee.middle_name}</p>
                      </div>
                    )}
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Last Name</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.last_name}</p>
                    </div>
                    {selectedEmployee.preferred_name && (
                      <div className="min-w-0">
                        <Label className="text-sm text-muted-foreground">Preferred Name</Label>
                        <p className="text-base font-medium break-words">{selectedEmployee.preferred_name}</p>
                      </div>
                    )}
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Date of Birth</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.dob ? format(new Date(selectedEmployee.dob), "dd MMM yyyy") : "—"}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Gender</Label>
                      <p className="text-base font-medium capitalize break-words">{selectedEmployee.gender}</p>
                    </div>
                    {selectedEmployee.pronouns && (
                      <div className="min-w-0">
                        <Label className="text-sm text-muted-foreground">Pronouns</Label>
                        <p className="text-base font-medium break-words">{selectedEmployee.pronouns}</p>
                      </div>
                    )}
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Nationality</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.nationality}</p>
                    </div>
                  </div>
                </div>

                {/* Employment Details */}
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-4">Employment Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Employee ID</Label>
                      <p className="text-base font-medium font-mono break-words">{selectedEmployee.employee_ID}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Job Title</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.job_title_id || "—"}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Start Date</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.date_hired ? format(new Date(selectedEmployee.date_hired), "dd MMM yyyy") : "—"}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">End Date</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.date_terminated ? format(new Date(selectedEmployee.date_terminated), "dd MMM yyyy") : "not available"}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.email}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm text-muted-foreground">Phone</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.phone || "—"}</p>
                    </div>
                    {selectedEmployee.alternative_phone && (
                      <div className="min-w-0">
                        <Label className="text-sm text-muted-foreground">Alternative Phone</Label>
                        <p className="text-base font-medium break-words">{selectedEmployee.alternative_phone}</p>
                      </div>
                    )}
                    <div className="sm:col-span-2 min-w-0">
                      <Label className="text-sm text-muted-foreground">Address</Label>
                      <p className="text-base font-medium break-words">{selectedEmployee.address || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Verification Status */}
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-4">Verification Status</h3>
                  <div className="flex gap-4">
                    <Badge variant={selectedEmployee.id_verified ? "default" : "outline"} className="rounded-full px-3 py-1">
                      ID {selectedEmployee.id_verified ? "Verified" : "Unverified"}
                    </Badge>
                    <Badge variant={selectedEmployee.bank_verified ? "default" : "outline"} className="rounded-full px-3 py-1">
                      Bank {selectedEmployee.bank_verified ? "Verified" : "Unverified"}
                    </Badge>
                    {(selectedEmployee.nationality || "").trim().toLowerCase() !== "south africa" && (
                      <Badge variant={selectedEmployee.work_permit_verified ? "default" : "outline"} className="rounded-full px-3 py-1">
                        Work Permit {selectedEmployee.work_permit_verified ? "Verified" : "Unverified"}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Additional Information */}
                {(selectedEmployee.passport_number || selectedEmployee.tax_number) && (
                  <div>
                    <h3 className="text-lg font-semibold text-navy mb-4">Additional Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedEmployee.passport_number && (
                        <div className="min-w-0">
                          <Label className="text-sm text-muted-foreground">Passport Number</Label>
                          <p className="text-base font-medium break-words">{selectedEmployee.passport_number}</p>
                        </div>
                      )}
                      {selectedEmployee.tax_number && (
                        <div className="min-w-0">
                          <Label className="text-sm text-muted-foreground">Tax Number</Label>
                          <p className="text-base font-medium break-words">{selectedEmployee.tax_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {canPreviewEmployeeDocuments && (
                <div className="space-y-4 lg:max-h-[72vh] lg:overflow-y-auto lg:pl-4 lg:border-l">
                  <div>
                    <h3 className="text-lg font-semibold text-navy">Document Preview</h3>
                    <p className="text-xs text-muted-foreground">Preview files while comparing with employee details.</p>
                  </div>

                  {isLoadingEmployeeDocuments ? (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                      Loading documents...
                    </div>
                  ) : selectedEmployeeDocuments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No documents found for this employee.
                    </div>
                  ) : (
                    <>
                      <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                        {selectedEmployeeDocuments.map((document) => (
                          <button
                            key={document.id}
                            type="button"
                            onClick={() => setActivePreviewDocument(document)}
                            className={cn(
                              "w-full text-left rounded-lg border p-3 transition-colors",
                              activePreviewDocument?.id === document.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm font-medium truncate">{document.name}</p>
                              {document.is_sensitive && (
                                <Badge variant="secondary" className="text-[10px] rounded-full">Sensitive</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDocumentType(document.type)} • {formatFileSize(document.file_size)}
                              {document.created_at ? ` • ${format(new Date(document.created_at), "dd MMM yyyy")}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="rounded-lg border overflow-hidden h-[420px] bg-muted/10">
                        {!activePreviewDocument ? (
                          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            Select a document to preview.
                          </div>
                        ) : !activePreviewDocument.file_url ? (
                          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            This document has no preview link.
                          </div>
                        ) : activePreviewDocument.file_type.includes("pdf") ? (
                          <iframe
                            title={`Preview ${activePreviewDocument.name}`}
                            src={activePreviewDocument.file_url}
                            className="w-full h-full"
                          />
                        ) : activePreviewDocument.file_type.startsWith("image/") ? (
                          <img
                            src={activePreviewDocument.file_url}
                            alt={activePreviewDocument.name}
                            className="w-full h-full object-contain bg-white"
                          />
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
                            <p className="text-sm text-muted-foreground">
                              Inline preview is not available for this file type.
                            </p>
                            <Button asChild size="sm" variant="outline">
                              <a href={activePreviewDocument.file_url} target="_blank" rel="noopener noreferrer">
                                Open in new tab
                                <ExternalLink className="h-3.5 w-3.5 ml-1" />
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeForm
              onSubmit={() => { setIsEditModalOpen(false); fetchEmployees() }}
              employee={selectedEmployee}
              isEdit={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Appointment Letter Confirmation */}
      <Dialog open={isAppointmentConfirmOpen} onOpenChange={setIsAppointmentConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment letter has been created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Select an option to proceed:</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAppointmentConfirmOpen(false)}>Close</Button>
            <Button onClick={() => { setIsAppointmentConfirmOpen(false); setIsSendEmailOpen(true) }}>Send to employee</Button>
            <Button>Review Letter</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={isSendEmailOpen} onOpenChange={setIsSendEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send appointment letter</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="gmail">Employee Gmail address</Label>
            <Input id="gmail" placeholder="employee@gmail.com" value={gmail} onChange={(e) => { setGmail(e.target.value); setGmailError("") }} className="mt-2 uniform-input" />
            {gmailError && <p className="text-sm text-red-500 mt-1">{gmailError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsSendEmailOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              const re = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i
              if (!re.test(gmail)) { setGmailError("Please enter a valid Gmail address (example: name@gmail.com)"); return }
              console.log({ sendEmail: gmail, payload: 'appointmentLetterPayload' })
              setIsSendEmailOpen(false)
            }}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Past Employees Modal */}
      <Dialog open={isPastEmployeesModalOpen} onOpenChange={setIsPastEmployeesModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Past Employees</DialogTitle>
            <p className="text-sm text-muted-foreground">View and manage deleted/inactive employees</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {isLoadingPastEmployees ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-muted/40">
                      <TableHead className="h-12 px-6 font-semibold">Employee</TableHead>
                      <TableHead className="h-12 px-6 font-semibold hidden sm:table-cell">Employee ID</TableHead>
                      <TableHead className="h-12 px-6 font-semibold hidden md:table-cell">Job Title</TableHead>
                      <TableHead className="h-12 px-6 font-semibold hidden lg:table-cell">Email</TableHead>
                      <TableHead className="h-12 px-6 font-semibold hidden lg:table-cell">Phone</TableHead>
                      <TableHead className="h-12 px-6 font-semibold">Status</TableHead>
                      <TableHead className="h-12 px-6 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastEmployees.map((employee, index) => (
                      <TableRow 
                        key={employee.id}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/50",
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={employee.images?.[0]} />
                              <AvatarFallback className="text-sm">
                                {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-base leading-tight">
                                {employee.preferred_name || employee.first_name} {employee.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {employee.nationality}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 hidden sm:table-cell">
                          <span className="font-mono text-sm text-muted-foreground">
                            {employee.employee_ID}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 hidden md:table-cell">
                          {employee.job_title_id && 
                           employee.job_title_id.trim() !== "" && 
                           !employee.job_title_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? (
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                              {employee.job_title_id}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-sm break-words">{employee.email}</span>
                        </TableCell>
                        <TableCell className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {employee.phone || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                            Inactive
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent 
                                align="end" 
                                className="!p-2 w-40 bg-white shadow-lg rounded-lg border"
                              >
                                <DropdownMenuItem
                                  onClick={() => handleViewEmployee(employee)}
                                  className="cursor-pointer px-3 py-2.5 text-sm rounded-md hover:bg-muted focus:bg-muted"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRestoreEmployee(employee)}
                                  className="cursor-pointer px-3 py-2.5 text-sm rounded-md hover:bg-muted focus:bg-muted"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pastEmployees.length === 0 && !isLoadingPastEmployees && (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">No past employees found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Employee Form Component
function EmployeeForm({ 
  onSubmit, 
  employee, 
  isEdit = false, 
  employeeId 
}: { 
  onSubmit: () => void
  employee?: EmployeeProfile
  isEdit?: boolean
  employeeId?: string
}) {
  const user = getCurrentUser()
  const isSuperAdmin = user?.role === 'super_admin'
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [roles, setRoles] = useState<Array<{ id: string; role_name: string; description: string | null }>>([])
  const [loadingRoles, setLoadingRoles] = useState(false)

  const [formData, setFormData] = useState({
    first_name: employee?.first_name || "",
    middle_name: employee?.middle_name || "",
    last_name: employee?.last_name || "",
    preferred_name: employee?.preferred_name || "",
    id_number: (employee as any)?.id_number || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    alternative_phone: employee?.alternative_phone || "",
    address: employee?.address || "",
    dob: employee?.dob || "",
    sex: employee?.sex || "male",
    gender: employee?.gender || "male",
    nationality: employee?.nationality || "South Africa",
    job_title_id: employee?.job_title_id || "",
    tax_number: employee?.tax_number || "",
    pronouns: employee?.pronouns || "",
    date_hired: employee?.date_hired || "",
    employment_type: "full_time",
    work_location: "",
    employee_id: employee?.employee_ID || employeeId || "",
    role_id: (employee as any)?.role_id || "",
    ...(isEdit ? {} : { is_active: true }),
  })

  // Fetch roles on mount if admin or super_admin
  useEffect(() => {
    if (isAdminOrSuperAdmin) {
      setLoadingRoles(true)
      fetch('/api/roles')
        .then(res => res.json())
        .then(json => {
          if (json.success && Array.isArray(json.data)) {
            setRoles(json.data)
          }
        })
        .catch(err => {
          console.error('Error fetching roles:', err)
        })
        .finally(() => {
          setLoadingRoles(false)
        })
    }
  }, [isAdminOrSuperAdmin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (isEdit && employee?.id) {
        const updates: any = { ...formData }

        // Normalize optional enum and empty strings
        if (!updates.gender || updates.gender === "") {
          delete updates.gender
        } else if (updates.gender === "prefer not to say") {
          updates.gender = "prefer_not_to_say"
        }

        // Include employee_id if super_admin changed it
        if (isSuperAdmin && formData.employee_id && formData.employee_id !== employee?.employee_ID) {
          updates.employee_id = formData.employee_id
        }

        // Include role_id if admin or super_admin changed it
        if (isAdminOrSuperAdmin && formData.role_id && formData.role_id !== (employee as any)?.role_id) {
          updates.role_id = formData.role_id
        }

        // Remove empty-string fields so validation doesn't see ''
        Object.keys(updates).forEach((key) => {
          if (updates[key] === "") delete updates[key]
        })

        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const storedSession = localStorage.getItem('xspark_session')
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch (err) {
          console.warn('[Employees][UPDATE] Failed to parse session for Bearer token:', err)
        }

        const res = await fetch('/api/employees', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ id: employee.id, ...updates })
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error || 'Failed to update employee')
        }
      } else {
        // Creation path: send data to /api/employees
        if (!formData.first_name || !formData.last_name || !formData.dob) {
          throw new Error('Please complete the required personal details.')
        }
        if (!formData.email) {
          throw new Error('Email address is required.')
        }
        if (!formData.phone) {
          throw new Error('Phone number is required.')
        }
        if (!formData.address) {
          throw new Error('Address is required.')
        }
        if (!formData.date_hired) {
          throw new Error('Please select the Date of Joining.')
        }

        // Basic client-side validation for SA ID number: must be exactly 13 characters.
        if (formData.id_number && formData.id_number.length !== 13) {
          throw new Error('ID Number must be exactly 13 digits.')
        }

        // Normalise dates to YYYY-MM-DD to satisfy API regex
        const normalizeDate = (value: string) => {
          if (!value) return value
          const d = new Date(value)
          if (Number.isNaN(d.getTime())) return value
          return d.toISOString().slice(0, 10)
        }

        const payload: any = {
          first_name: formData.first_name,
          middle_name: formData.middle_name || undefined,
          last_name: formData.last_name,
          preferred_name: formData.preferred_name || undefined,
          id_number: formData.id_number || undefined,
          dob: normalizeDate(formData.dob),
          sex: formData.sex,
          gender: (() => {
            const genderValue = formData.gender as string | undefined
            if (!genderValue) return undefined
            // Normalize "prefer not to say" to "prefer_not_to_say"
            if (genderValue === "prefer not to say" || genderValue === "prefer_not_to_say") {
              return "prefer_not_to_say"
            }
            return genderValue as "male" | "female" | "other" | "prefer_not_to_say" | undefined
          })(),
          pronouns: formData.pronouns || undefined,
          email: formData.email,
          phone: formData.phone,
          alternative_phone: formData.alternative_phone || undefined,
          address: formData.address,
          tax_number: formData.tax_number || undefined,
          nationality: formData.nationality || "South Africa",
            is_active: (formData as any).is_active ?? true,
          employment_status: "probation",
          date_hired: normalizeDate(formData.date_hired),
          profile_picture_url: undefined,
          documents: [],
          // Default password for now (until onboarding flow is ready)
          password: "SecurePass123!",
        }

        // Add employee_id if super_admin provided one
        if (isSuperAdmin && formData.employee_id) {
          payload.employee_id = formData.employee_id
        }

        // Add role_id if admin or super_admin selected one
        if (isAdminOrSuperAdmin && formData.role_id) {
          payload.role_id = formData.role_id
        }

        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) delete payload[key]
        })

        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const storedSession = localStorage.getItem('xspark_session')
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch (err) {
          console.warn('[Employees][CREATE] Failed to parse session for Bearer token:', err)
        }

        const res = await fetch('/api/employees', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok || !json?.success) {
          // Log full response so we can see Zod validation errors from the API
          console.error("[Employees][CREATE] API error:", json)

          const details =
            json?.details && Array.isArray(json.details)
              ? `\nDetails: ${json.details
                  .map((d: any) => `${d.path?.join(".")}: ${d.message}`)
                  .join(" | ")}`
              : ""

          throw new Error((json?.error || "Failed to create employee") + details)
        }
      }

      onSubmit()
    } catch (err) {
      console.error('Save profile failed:', err)
      alert((err as any)?.message || 'Could not save profile')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              autoComplete="given-name"
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="middle_name">Middle Name</Label>
            <Input
              id="middle_name"
              autoComplete="additional-name"
              value={formData.middle_name}
              onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              autoComplete="family-name"
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="preferred_name">Preferred Name</Label>
            <Input
              id="preferred_name"
              value={formData.preferred_name}
              onChange={(e) => setFormData({...formData, preferred_name: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="id_number">ID Number *</Label>
            <Input
              id="id_number"
              autoComplete="off"
              value={formData.id_number}
              onChange={(e) => setFormData({...formData, id_number: e.target.value})}
              className="uniform-input"
              maxLength={13}
              required={!isEdit}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              South African ID: exactly 13 digits (no spaces).
            </p>
          </div>
          <div>
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              type="date"
              autoComplete="bday"
              value={formData.dob}
              onChange={(e) => setFormData({...formData, dob: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          {isAdminOrSuperAdmin && !isEdit && (
            <div>
              <Label htmlFor="is_active">Active Employee *</Label>
              <Select
                value={String((formData as any).is_active ?? true)}
                onValueChange={(value) => {
                  setFormData({ ...formData, is_active: value === "true" })
                }}
              >
                <SelectTrigger className="uniform-input">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive (Past)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="sex">Sex *</Label>
            <Select value={formData.sex} onValueChange={(value) => setFormData({...formData, sex: value as 'male' | 'female'})}>
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gender">Gender Identity</Label>
            <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value as any})}>
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pronouns">Pronouns</Label>
            <Input
              id="pronouns"
              value={formData.pronouns}
              onChange={(e) => setFormData({...formData, pronouns: e.target.value})}
              placeholder="e.g., he/him, she/her, they/them"
              className="uniform-input"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              autoComplete="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              required={!isEdit}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="alternative_phone">Alternative Phone</Label>
            <Input
              id="alternative_phone"
              autoComplete="tel"
              value={formData.alternative_phone}
              onChange={(e) => setFormData({...formData, alternative_phone: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              autoComplete="street-address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              required={!isEdit}
              className="uniform-input"
            />
          </div>
        </div>
      </div>

      {/* Employment Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">Employment Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employee_id">Employee ID</Label>
            <Input
              id="employee_id"
              value={formData.employee_id}
              onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
              readOnly={!isSuperAdmin}
              className={isSuperAdmin ? "uniform-input" : "bg-muted uniform-input"}
              placeholder={isSuperAdmin ? (isEdit ? "Enter employee ID" : "Leave empty for auto-generation") : ""}
            />
            {isSuperAdmin && (
              <p className="mt-1 text-xs text-muted-foreground">
                {isEdit ? "You can change the employee ID" : "Leave empty to auto-generate, or enter custom ID (e.g., XSP26/02/081)"}
              </p>
            )}
          </div>
          {isAdminOrSuperAdmin && (
            <div>
              <Label htmlFor="role_id">Role {!isEdit && "*"}</Label>
              <Select 
                value={formData.role_id} 
                onValueChange={(value) => setFormData({...formData, role_id: value})}
                disabled={loadingRoles && !isEdit}
              >
                <SelectTrigger className="uniform-input">
                  <SelectValue placeholder={loadingRoles && !isEdit ? "Loading roles..." : "Select role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.role_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      {role.description && ` - ${role.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.role_id && !isEdit && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a role for this employee
                </p>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="job_title">Job Title *</Label>
            <Select value={formData.job_title_id} onValueChange={(value) => setFormData({...formData, job_title_id: value})}>
              <SelectTrigger className="uniform-input">
                <SelectValue placeholder="Select job title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer">Software Developer</SelectItem>
                <SelectItem value="designer">UI/UX Designer</SelectItem>
                <SelectItem value="manager">Project Manager</SelectItem>
                <SelectItem value="hr">HR Specialist</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="nationality">Nationality *</Label>
            <Select value={formData.nationality} onValueChange={(value) => setFormData({...formData, nationality: value})}>
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="South Africa">South Africa</SelectItem>
                <SelectItem value="United States">United States</SelectItem>
                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tax_number">Tax Number</Label>
            <Input
              id="tax_number"
              value={formData.tax_number}
              onChange={(e) => setFormData({...formData, tax_number: e.target.value})}
              className="uniform-input"
            />
          </div>
          {/* New fields to meet requirements */}
          <div>
            <Label htmlFor="date_joining">Date of Joining *</Label>
            <Input
              id="date_joining"
              type="date"
              className="uniform-input"
              required
              value={formData.date_hired}
              onChange={(e) => setFormData({ ...formData, date_hired: e.target.value })}
            />
          </div>
          <div>
            <Label>Employment Type *</Label>
            <Select
              value={formData.employment_type}
              onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
            >
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-Time</SelectItem>
                <SelectItem value="part_time">Part-Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="work_location">Work Location *</Label>
            <Input
              id="work_location"
              className="uniform-input"
              required
              value={formData.work_location}
              onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="outline" onClick={onSubmit}>
          Cancel
        </Button>
        <Button type="submit">
          {isEdit ? "Update Employee" : "Create Employee"}
        </Button>
      </div>
    </form>
  )
}
