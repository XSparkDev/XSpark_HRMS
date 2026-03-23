"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, subDays } from "date-fns"
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  Loader2,
  Plus,
  Search,
  Send,
  Shield,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, type User } from "@/lib/auth"
import { isEmployeeFullyVerified } from "@/lib/employee-verification"
import { documentsService, setDocumentsRequestHeaders } from "@/lib/services/documents-service"
import { cn } from "@/lib/utils"
import {
  formatFileSize,
  getDocumentTypeDisplayName,
  isSensitiveDocumentType,
  type Document,
  type DocumentAccessLog,
  type DocumentFormData,
} from "@/lib/validation/documents"

const EMPLOYEE_UPLOAD_OPTIONS = [
  { value: "id_copies", label: "ID Copy" },
  { value: "qualifications", label: "Qualifications" },
  { value: "work_permits", label: "Work Permit" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "doctors_notes", label: "Doctor's Note" },
  { value: "other_personal_documents", label: "Other Personal" },
] as const

const ADMIN_UPLOAD_OPTIONS = [
  ...EMPLOYEE_UPLOAD_OPTIONS,
  { value: "contracts", label: "Contract" },
  { value: "offer_letters", label: "Offer Letter" },
  { value: "payslips", label: "Payslip" },
  { value: "performance_reviews", label: "Performance Review" },
  { value: "reports", label: "Report" },
  { value: "resignation_letters", label: "Resignation Letter" },
  { value: "company_policies", label: "Company Policy" },
  { value: "official_hr_documents", label: "Official HR Document" },
] as const

type DocumentTypeOption = (typeof ADMIN_UPLOAD_OPTIONS)[number]
type DocumentTypeValue = DocumentTypeOption["value"]

const ADMIN_TABS = ["all", "recent", "by_employee", "sensitive", "audit"] as const
type AdminTab = (typeof ADMIN_TABS)[number]

type EmployeeOption = {
  id: string
  name: string
  number?: string
}

type UploadFormPayload = DocumentFormData & {
  file: File
  employeeId: string
  employeeName: string
  employeeNumber?: string
}

type DateRangeFilter = {
  from: string
  to: string
}

type SendDocumentRequest = {
  employeeIds: string[]
  documentType: DocumentTypeValue
  existingDocumentId?: string
  file?: File | null
}

export default function DocumentsPage() {
  const router = useRouter()
  const user = getCurrentUser()
  const { toast } = useToast()
  const normalizedRole = user?.role?.toLowerCase() ?? "employee"
  const isAdminView = normalizedRole === "admin" || normalizedRole === "super_admin"

  const buildApiHeaders = useCallback(() => {
    const headers: Record<string, string> = {}
    if (user?.id) headers["x-user-id"] = user.id
    if (user?.employeeId) headers["x-employee-id"] = user.employeeId
    else if (user?.id) headers["x-employee-id"] = user.id
    if (user?.role) headers["x-user-role"] = user.role
    if (user?.name) headers["x-user-name"] = user.name
    if (user?.email) headers["x-user-email"] = user.email

    if (typeof window !== "undefined") {
      try {
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch (error) {
        console.warn("[Documents] Failed to parse session token", error)
      }
    }

    return headers
  }, [user?.id, user?.employeeId, user?.role, user?.name, user?.email])

  useEffect(() => {
    if (typeof window === "undefined") return
    setDocumentsRequestHeaders(buildApiHeaders())
  }, [buildApiHeaders])
  const [documents, setDocuments] = useState<Document[]>([])
  const [auditLogs, setAuditLogs] = useState<DocumentAccessLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadContext, setUploadContext] = useState<"employee" | "admin">("employee")
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("all")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<DocumentTypeValue | "all">("all")
  const [employeeDateRange, setEmployeeDateRange] = useState<DateRangeFilter>({ from: "", to: "" })
  const [adminFilters, setAdminFilters] = useState({ search: "", type: "all", dateFrom: "", dateTo: "" })
  const [employeeFilterForTab, setEmployeeFilterForTab] = useState("all")
  const [isSendingDocument, setIsSendingDocument] = useState(false)

  useEffect(() => {
    if (user?.role !== "employee") return

    const enforceVerificationAccess = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers.Authorization = `Bearer ${sessionParsed.access_token}`
          }
        }

        const res = await fetch("/api/auth/me", { headers })
        const json = await res.json().catch(() => ({}))
        const profile = json?.data?.employee
        if (!isEmployeeFullyVerified(profile)) {
          toast({
            title: "Verification required",
            description: "Complete your profile verification to access Documents.",
            variant: "destructive",
          })
          router.replace("/dashboard")
        }
      } catch {
        router.replace("/dashboard")
      }
    }

    enforceVerificationAccess()
  }, [router, toast, user?.role])

  useEffect(() => {
    let isMounted = true

    const loadDocuments = async () => {
      setIsLoading(true)
      try {
        const docs = await documentsService.getAllDocuments(user?.id, user?.role)
        if (!isMounted) return
        setDocuments(docs)
        if (isAdminView) {
          const logs = await documentsService.getAllAccessLogs()
          if (isMounted) {
            setAuditLogs(logs)
          }
        }
      } catch (error) {
        console.error("[Documents] Failed to load", error)
        toast({ title: "Unable to load documents", description: "Please try again shortly.", variant: "destructive" })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDocuments()
    const unsubscribe = documentsService.subscribe((updatedDocs) => {
      setDocuments(updatedDocs)
      if (isAdminView) {
        documentsService.getAllAccessLogs().then(setAuditLogs).catch(console.error)
      }
    })

    return () => {
      isMounted = false
      if (typeof unsubscribe === "function") {
        unsubscribe()
      }
    }
  }, [user?.id, user?.role, toast, isAdminView])

  const uniqueEmployees: EmployeeOption[] = useMemo(() => {
    const directory = new Map<string, EmployeeOption>()
    documents.forEach((doc) => {
      if (!directory.has(doc.employee_id)) {
        directory.set(doc.employee_id, {
          id: doc.employee_id,
          name: doc.employee_name,
          number: doc.employee_number,
        })
      }
    })
    return Array.from(directory.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [documents])

  const employeeDocuments = useMemo(() => {
    if (!user?.id) return []
    return documents.filter((doc) => doc.employee_id === user.id)
  }, [documents, user?.id])

  const filteredEmployeeDocuments = useMemo(() => {
    return employeeDocuments.filter((doc) => {
      const matchesSearch = employeeSearch
        ? doc.name.toLowerCase().includes(employeeSearch.toLowerCase())
        : true
      const matchesType = employeeTypeFilter === "all" ? true : doc.type === employeeTypeFilter
      const docDate = new Date(doc.created_at)
      const matchesFrom = employeeDateRange.from ? docDate >= new Date(employeeDateRange.from) : true
      const matchesTo = employeeDateRange.to ? docDate <= new Date(employeeDateRange.to) : true
      return matchesSearch && matchesType && matchesFrom && matchesTo
    })
  }, [employeeDocuments, employeeSearch, employeeTypeFilter, employeeDateRange])

  const adminFilteredDocuments = useMemo(() => {
    let base = documents
    if (adminFilters.search) {
      const lookup = adminFilters.search.toLowerCase()
      base = base.filter((doc) =>
        doc.name.toLowerCase().includes(lookup) ||
        doc.employee_name.toLowerCase().includes(lookup) ||
        (doc.tags ?? "").toLowerCase().includes(lookup)
      )
    }
    if (adminFilters.type !== "all") {
      base = base.filter((doc) => doc.type === adminFilters.type)
    }
    if (adminFilters.dateFrom) {
      const from = new Date(adminFilters.dateFrom)
      base = base.filter((doc) => new Date(doc.created_at) >= from)
    }
    if (adminFilters.dateTo) {
      const to = new Date(adminFilters.dateTo)
      base = base.filter((doc) => new Date(doc.created_at) <= to)
    }
    return base
  }, [documents, adminFilters])

  const groupedDocuments = useMemo(() => {
    const groups = new Map<string, { employee: EmployeeOption; items: Document[] }>()
    adminFilteredDocuments.forEach((doc) => {
      if (!groups.has(doc.employee_id)) {
        groups.set(doc.employee_id, {
          employee: { id: doc.employee_id, name: doc.employee_name, number: doc.employee_number },
          items: [],
        })
      }
      groups.get(doc.employee_id)!.items.push(doc)
    })
    return Array.from(groups.values()).sort((a, b) => a.employee.name.localeCompare(b.employee.name))
  }, [adminFilteredDocuments])

  const stats = useMemo(() => {
    const total = documents.length
    const sensitive = documents.filter((doc) => doc.is_sensitive).length
    const active = documents.filter((doc) => doc.is_active).length
    const thisMonth = documents.filter((doc) => {
      const date = new Date(doc.created_at)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length
    return { total, sensitive, active, thisMonth }
  }, [documents])

  const recentDocuments = useMemo(() => {
    const windowStart = subDays(new Date(), 30)
    return adminFilteredDocuments.filter((doc) => new Date(doc.created_at) >= windowStart)
  }, [adminFilteredDocuments])

  const sensitiveDocuments = useMemo(() => adminFilteredDocuments.filter((doc) => doc.is_sensitive), [adminFilteredDocuments])

  const auditTimeline = useMemo(() => {
    return auditLogs.map((log) => {
      const documentMeta = documents.find((doc) => doc.id === log.document_id)
      return {
        ...log,
        documentName: documentMeta?.name ?? "Document",
        employeeName: documentMeta?.employee_name ?? "Unknown",
      }
    })
  }, [auditLogs, documents])

  const defaultEmployeeOption: EmployeeOption | undefined =
    user && user.id
      ? { id: user.id, name: user.name ?? "You", number: user.employeeId ?? "N/A" }
    : undefined

  const handleUploadDocument = async (payload: UploadFormPayload) => {
    if (!user?.id) {
      toast({ title: "You're not signed in", description: "Please sign in to upload documents.", variant: "destructive" })
      return
    }

    try {
      // Step 1: Upload the file first to get a permanent URL
      const formData = new FormData()
      formData.append("file", payload.file)

      // Build headers for file upload
      const headers: Record<string, string> = {}
      if (user?.id) headers["x-user-id"] = user.id
      if (user?.employeeId) headers["x-employee-id"] = user.employeeId
      else if (user?.id) headers["x-employee-id"] = user.id
      if (user?.role) headers["x-user-role"] = user.role

      if (typeof window !== "undefined") {
        try {
          const storedSession = localStorage.getItem("xspark_session")
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch (error) {
          console.warn("[Documents] Failed to parse session token", error)
        }
      }

      const uploadResponse = await fetch("/api/documents/upload-file", {
        method: "POST",
        headers,
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ message: "Upload failed" }))
        throw new Error(errorData.message || "Failed to upload file")
      }

      const uploadResult = await uploadResponse.json()
      const fileUrl = uploadResult.fileUrl

      if (!fileUrl) {
        throw new Error("No file URL returned from upload")
      }

      // Step 2: Save the document record with the permanent file URL
      await documentsService.uploadDocument({
        name: payload.name,
        type: payload.type,
        description: payload.description ?? "",
        tags: payload.tags ?? "",
        employee_id: payload.employeeId,
        uploaded_by: user.id,
        uploaded_by_name: user.name ?? "Unknown",
        employee_name: payload.employeeName,
        employee_number: payload.employeeNumber ?? "N/A",
        file_size: payload.file.size,
        file_type: payload.file.type,
        file_url: fileUrl,
        is_sensitive: isSensitiveDocumentType(payload.type),
        version: 1,
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      })

      toast({ title: "Document uploaded", description: "Your document is now available." })
      setIsUploadModalOpen(false)
    } catch (error) {
      console.error("[Documents] Upload failed", error)
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : "Please try again.", 
        variant: "destructive" 
      })
    }
  }

  const handleDownloadDocument = async (doc: Document) => {
    if (!user?.id) return
    
    try {
      // Prefer API so we get a fresh signed URL for the private bucket
      let downloadUrl: string | null = null
      if (doc.id) {
        try {
          downloadUrl = await documentsService.downloadDocument(doc.id, user.id, user.name ?? "User")
        } catch (error) {
          console.error("[Documents] Failed to get download URL from API", error)
        }
      }
      if (!downloadUrl) {
        downloadUrl = doc.file_url?.startsWith("blob:") ? null : doc.file_url
      }
      
      if (!downloadUrl) {
        toast({ title: "Download failed", description: "No download URL available.", variant: "destructive" })
        return
      }
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = doc.name
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      
      // For blob URLs or same-origin URLs, try direct download
      // For external URLs (like Supabase storage), open in new tab
      if (downloadUrl.startsWith('blob:') || downloadUrl.startsWith(window.location.origin)) {
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // External URL - open in new tab (will trigger download if headers are set correctly)
        window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      }
      
      toast({ title: "Download started", description: doc.name })
    } catch (error) {
      console.error("[Documents] Download failed", error)
      toast({ title: "Unable to download", description: "Please try again.", variant: "destructive" })
    }
  }

  const handleSendDocument = async (request: SendDocumentRequest) => {
    setIsSendingDocument(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      toast({
        title: "Document sent",
        description: request.file
          ? `Uploaded a new ${getDocumentTypeDisplayName(request.documentType)} to ${request.employeeIds.length} employee(s).`
          : `Shared ${getDocumentTypeDisplayName(request.documentType)} with ${request.employeeIds.length} employee(s).`,
      })
      setIsSendModalOpen(false)
    } finally {
      setIsSendingDocument(false)
    }
  }

  const openUploadModal = (context: "employee" | "admin") => {
    setUploadContext(context)
    setIsUploadModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isAdminView ? (
        <AdminDocumentsView
          stats={stats}
          documents={adminFilteredDocuments}
          groupedDocuments={groupedDocuments}
          recentDocuments={recentDocuments}
          sensitiveDocuments={sensitiveDocuments}
          auditTimeline={auditTimeline}
          activeTab={activeAdminTab}
          onTabChange={(value) => setActiveAdminTab(value as AdminTab)}
          filters={adminFilters}
          onFilterChange={setAdminFilters}
          employeeFilter={employeeFilterForTab}
          onEmployeeFilterChange={setEmployeeFilterForTab}
          employees={uniqueEmployees}
          onUpload={() => openUploadModal("admin")}
          onSend={() => setIsSendModalOpen(true)}
          onPreview={setPreviewDocument}
          onDownload={handleDownloadDocument}
        />
      ) : (
        <EmployeeDocumentsView
          documents={filteredEmployeeDocuments}
          totalDocuments={employeeDocuments.length}
          searchValue={employeeSearch}
          onSearchChange={setEmployeeSearch}
          typeFilter={employeeTypeFilter}
          onTypeFilterChange={(value) => setEmployeeTypeFilter(value as DocumentTypeValue | "all")}
          dateRange={employeeDateRange}
          onDateChange={setEmployeeDateRange}
          onUpload={() => openUploadModal("employee")}
          onPreview={setPreviewDocument}
          onDownload={handleDownloadDocument}
        />
      )}

      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{uploadContext === "admin" ? "Upload Employee Document" : "Upload Personal Document"}</DialogTitle>
            <DialogDescription>
              {uploadContext === "admin"
                ? "Choose the employee and document category before uploading."
                : "Upload and manage your personal HR documents."}
            </DialogDescription>
          </DialogHeader>
          <DocumentUploadForm
            allowedTypes={uploadContext === "admin" ? ADMIN_UPLOAD_OPTIONS : EMPLOYEE_UPLOAD_OPTIONS}
            onSubmit={handleUploadDocument}
            onCancel={() => setIsUploadModalOpen(false)}
            employeeOptions={uploadContext === "admin" ? uniqueEmployees : undefined}
            defaultEmployee={uploadContext === "employee" ? defaultEmployeeOption : undefined}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Send Document</DialogTitle>
            <DialogDescription>Share an existing file or upload a new one with selected employees.</DialogDescription>
          </DialogHeader>
          <SendDocumentForm employees={uniqueEmployees} documents={documents} onSubmit={handleSendDocument} isSubmitting={isSendingDocument} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {previewDocument?.name}
            </DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <DocumentPreview
              document={previewDocument}
              isAdminView={isAdminView}
              onDownload={() => handleDownloadDocument(previewDocument)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface EmployeeDocumentsViewProps {
  documents: Document[]
  totalDocuments: number
  searchValue: string
  onSearchChange: (value: string) => void
  typeFilter: DocumentTypeValue | "all"
  onTypeFilterChange: (value: string) => void
  dateRange: DateRangeFilter
  onDateChange: (range: DateRangeFilter) => void
  onUpload: () => void
  onPreview: (doc: Document) => void
  onDownload: (doc: Document) => void
}

function EmployeeDocumentsView({
  documents,
  totalDocuments,
  searchValue,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  dateRange,
  onDateChange,
  onUpload,
  onPreview,
  onDownload,
}: EmployeeDocumentsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">My Documents</h1>
          <p className="text-sm text-muted-foreground">View and manage your personal documents.</p>
        </div>
        <Button onClick={onUpload} className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Search my documents..."
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EMPLOYEE_UPLOAD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">From</Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(event) => onDateChange({ ...dateRange, from: event.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">To</Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(event) => onDateChange({ ...dateRange, to: event.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">{totalDocuments} document(s)</h2>
        {documents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You don't have any documents yet.</p>
              <Button variant="outline" onClick={onUpload} size="sm">
                Upload your first document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((doc) => (
              <Card key={doc.id} className="border shadow-sm">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{doc.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{getDocumentTypeDisplayName(doc.type)}</Badge>
                        <span>{format(new Date(doc.created_at), "dd MMM yyyy")}</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onPreview(doc)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDownload(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface AdminDocumentsViewProps {
  stats: { total: number; sensitive: number; active: number; thisMonth: number }
  documents: Document[]
  groupedDocuments: { employee: EmployeeOption; items: Document[] }[]
  recentDocuments: Document[]
  sensitiveDocuments: Document[]
  auditTimeline: Array<DocumentAccessLog & { documentName: string; employeeName: string }>
  activeTab: AdminTab
  onTabChange: (tab: string) => void
  filters: { search: string; type: string; dateFrom: string; dateTo: string }
  onFilterChange: (filters: { search: string; type: string; dateFrom: string; dateTo: string }) => void
  employeeFilter: string
  onEmployeeFilterChange: (value: string) => void
  employees: EmployeeOption[]
  onUpload: () => void
  onSend: () => void
  onPreview: (doc: Document) => void
  onDownload: (doc: Document) => void
}

function AdminDocumentsView({
  stats,
  documents,
  groupedDocuments,
  recentDocuments,
  sensitiveDocuments,
  auditTimeline,
  activeTab,
  onTabChange,
  filters,
  onFilterChange,
  employeeFilter,
  onEmployeeFilterChange,
  employees,
  onUpload,
  onSend,
  onPreview,
  onDownload,
}: AdminDocumentsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Documents</h1>
          <p className="text-sm text-muted-foreground">Manage and organize employee documents securely.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" onClick={onSend}>
            <Send className="h-4 w-4" />
            Send Document
          </Button>
          <Button className="gap-2" onClick={onUpload}>
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Documents" value={stats.total} icon={<FileText className="h-4 w-4 text-blue-600" />} />
        <StatCard label="Sensitive" value={stats.sensitive} icon={<Shield className="h-4 w-4 text-red-600" />} />
        <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
        <StatCard label="This Month" value={stats.thisMonth} icon={<Calendar className="h-4 w-4 text-orange-600" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Input
            placeholder="Search documents..."
            value={filters.search}
            onChange={(event) => onFilterChange({ ...filters, search: event.target.value })}
          />
          <Select value={filters.type} onValueChange={(value) => onFilterChange({ ...filters, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ADMIN_UPLOAD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onFilterChange({ ...filters, dateFrom: event.target.value })}
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(event) => onFilterChange({ ...filters, dateTo: event.target.value })}
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="flex w-full flex-wrap justify-start gap-2">
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="recent">Recent Uploads</TabsTrigger>
          <TabsTrigger value="by_employee">By Employee</TabsTrigger>
          <TabsTrigger value="sensitive">Sensitive Documents</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DocumentTable documents={documents} onPreview={onPreview} onDownload={onDownload} />
        </TabsContent>

        <TabsContent value="recent">
          <DocumentTable documents={recentDocuments} onPreview={onPreview} onDownload={onDownload} emptyMessage="No recent uploads." />
        </TabsContent>

        <TabsContent value="by_employee">
          <div className="mb-4 flex items-center gap-3">
            <Label className="text-xs uppercase text-muted-foreground">Employee</Label>
            <Select value={employeeFilter} onValueChange={onEmployeeFilterChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            {groupedDocuments
              .filter((group) => (employeeFilter === "all" ? true : group.employee.id === employeeFilter))
              .map((group) => (
                <Card key={group.employee.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>{group.employee.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{group.employee.number}</p>
                    </div>
                    <Badge variant="secondary">{group.items.length} document(s)</Badge>
                  </CardHeader>
                  <CardContent>
                    <DocumentTable
                      documents={group.items}
                      onPreview={onPreview}
                      onDownload={onDownload}
                      dense
                    />
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="sensitive">
          <DocumentTable
            documents={sensitiveDocuments}
            onPreview={onPreview}
            onDownload={onDownload}
            emptyMessage="No sensitive documents found."
          />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTimeline logs={auditTimeline} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface DocumentTableProps {
  documents: Document[]
  onPreview: (doc: Document) => void
  onDownload: (doc: Document) => void
  emptyMessage?: string
  dense?: boolean
}

function DocumentTable({ documents, onPreview, onDownload, emptyMessage = "No documents found.", dense }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</CardContent>
      </Card>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
        <span>Name</span>
        <span>Employee</span>
        <span>Uploaded By</span>
        <span>Date</span>
        <span className="text-right">Actions</span>
      </div>
      {documents.map((doc) => (
        <div key={doc.id} className={cn("grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3", dense && "py-2") }>
          <div>
            <p className="text-sm font-medium">{doc.name}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{getDocumentTypeDisplayName(doc.type)}</Badge>
              {doc.is_sensitive && <Badge variant="destructive">Sensitive</Badge>}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">{doc.employee_name}</div>
          <div className="text-sm text-muted-foreground">{doc.uploaded_by_name}</div>
          <div className="text-sm text-muted-foreground">{format(new Date(doc.created_at), "dd MMM yyyy")}</div>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => onPreview(doc)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDownload(doc)}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-navy">{value}</p>
        </div>
        <div className="rounded-full bg-muted p-2">{icon}</div>
      </CardContent>
    </Card>
  )
}

interface DocumentUploadFormProps {
  allowedTypes: readonly DocumentTypeOption[]
  onSubmit: (payload: UploadFormPayload) => void
  onCancel: () => void
  employeeOptions?: EmployeeOption[]
  defaultEmployee?: EmployeeOption
}

function DocumentUploadForm({ allowedTypes, onSubmit, onCancel, employeeOptions, defaultEmployee }: DocumentUploadFormProps) {
  const [formData, setFormData] = useState<{ name: string; type: DocumentTypeValue; description: string; tags: string }>(() => ({
    name: "",
    type: allowedTypes[0].value,
    description: "",
    tags: "",
  }))
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => defaultEmployee?.id ?? employeeOptions?.[0]?.id ?? "")

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("File must be under 10MB")
      return
    }
    const allowedMimes = ["application/pdf", "image/jpeg", "image/png"]
    if (!allowedMimes.includes(file.type)) {
      alert("Only PDF, JPG and PNG are allowed")
      return
    }
    setSelectedFile(file)
    if (!formData.name) {
      setFormData((prev) => ({ ...prev, name: file.name }))
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFile) return

    const employeeInfo = employeeOptions?.find((emp) => emp.id === selectedEmployeeId) ?? defaultEmployee
    if (!employeeInfo) return

    onSubmit({
      ...formData,
      file: selectedFile,
      employeeId: employeeInfo.id,
      employeeName: employeeInfo.name,
      employeeNumber: employeeInfo.number,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {employeeOptions && (
        <div>
          <Label>Employee</Label>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employeeOptions.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Document Name</Label>
          <Input value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} required />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as DocumentTypeValue }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Document File</Label>
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center",
            isDragOver && "border-primary bg-primary/5",
            selectedFile && "border-emerald-400 bg-emerald-50"
          )}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            const file = event.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
        >
          {selectedFile ? (
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm">Drag & drop or click to select</p>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 10MB</p>
            </div>
          )}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            id="document-file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => document.getElementById("document-file")?.click()}>
            Choose File
          </Button>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Input value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!selectedFile || !formData.name.trim()}>
          Upload
        </Button>
      </div>
    </form>
  )
}

interface DocumentPreviewProps {
  document: Document
  isAdminView: boolean
  onDownload: () => void
}

function DocumentPreview({ document, isAdminView, onDownload }: DocumentPreviewProps) {
  const [previewError, setPreviewError] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(true)
  const isImage = document.file_type.startsWith("image/")
  const isPdf = document.file_type === "application/pdf"

  // Fetch a signed URL for private bucket (preview and download use signed URLs)
  useEffect(() => {
    if (!document.id) {
      setPreviewUrl(document.file_url)
      setUrlLoading(false)
      return
    }
    let cancelled = false
    setUrlLoading(true)
    setPreviewError(false)
    fetch(`/api/documents/${document.id}/signed-url`, { credentials: "include" })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) throw new Error("Failed to get preview URL")
        return res.json()
      })
      .then((data: { url?: string }) => {
        if (cancelled) return
        setPreviewUrl(data?.url ?? document.file_url)
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(document.file_url)
        }
      })
      .finally(() => {
        if (!cancelled) setUrlLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [document.id, document.file_url])

  const displayUrl = previewUrl || document.file_url

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{getDocumentTypeDisplayName(document.type)}</Badge>
        {document.is_sensitive && <Badge variant="destructive">Sensitive</Badge>}
        <span>Uploaded {format(new Date(document.created_at), "dd MMM yyyy")}</span>
        <span>{formatFileSize(document.file_size)}</span>
        {isAdminView && <span>Employee: {document.employee_name}</span>}
      </div>
      <div className="rounded-lg border bg-muted/20 p-4">
        {urlLoading ? (
          <div className="flex h-[420px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayUrl && !previewError ? (
          isImage ? (
            <img 
              src={displayUrl} 
              alt={document.name} 
              className="mx-auto max-h-[420px] object-contain"
              onError={() => setPreviewError(true)}
            />
          ) : isPdf ? (
            <iframe 
              title={document.name} 
              src={displayUrl} 
              className="h-[420px] w-full rounded-lg"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Preview not available. Please download to view the file.
            </div>
          )
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            {previewError ? "Failed to load preview. " : ""}Please download to view the file.
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={onDownload} className="gap-2" variant="outline">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  )
}

interface SendDocumentFormProps {
  employees: EmployeeOption[]
  documents: Document[]
  onSubmit: (request: SendDocumentRequest) => void
  isSubmitting: boolean
}

function SendDocumentForm({ employees, documents, onSubmit, isSubmitting }: SendDocumentFormProps) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [selectedDocType, setSelectedDocType] = useState<DocumentTypeValue>(ADMIN_UPLOAD_OPTIONS[0].value)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("")
  const [sendMode, setSendMode] = useState<"existing" | "new">("existing")
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (selectedEmployees.length === 0) return
    if (sendMode === "existing" && !selectedDocumentId) return
    if (sendMode === "new" && !uploadFile) return

    onSubmit({
      employeeIds: selectedEmployees,
      documentType: selectedDocType,
      existingDocumentId: sendMode === "existing" ? selectedDocumentId : undefined,
      file: sendMode === "new" ? uploadFile : null,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <Label>Select Employee(s)</Label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-4">
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees available.</p>
          ) : (
            employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={selectedEmployees.includes(employee.id)} onCheckedChange={() => toggleEmployee(employee.id)} />
                <span>
                  {employee.name} {employee.number && <span className="text-xs text-muted-foreground">({employee.number})</span>}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Document Type</Label>
          <Select value={selectedDocType} onValueChange={(value) => setSelectedDocType(value as DocumentTypeValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_UPLOAD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Send Mode</Label>
          <Select value={sendMode} onValueChange={(value) => setSendMode(value as "existing" | "new")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="existing">Use Existing Document</SelectItem>
              <SelectItem value="new">Upload New File</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sendMode === "existing" ? (
        <div>
          <Label>Existing Document</Label>
          <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose existing document" />
            </SelectTrigger>
            <SelectContent>
              {documents.length === 0 && <SelectItem value="">No documents available</SelectItem>}
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  {doc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div>
          <Label>Upload File</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              setUploadFile(file)
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG up to 10MB.</p>
        </div>
      )}

      <DialogFooter>
        <Button
          type="submit"
          className="gap-2"
          disabled={
            selectedEmployees.length === 0 ||
            isSubmitting ||
            (sendMode === "existing" && !selectedDocumentId) ||
            (sendMode === "new" && !uploadFile)
          }
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Document
        </Button>
      </DialogFooter>
    </form>
  )
}

function AuditTimeline({ logs }: { logs: Array<DocumentAccessLog & { documentName: string; employeeName: string }> }) {
  if (logs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">No audit activity recorded yet.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{log.user_name}</span>
              <span className="text-muted-foreground">{log.action}ed</span>
              <span>{log.documentName}</span>
            </div>
            <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd MMM yyyy • HH:mm")}</span>
          </div>
          <p className="text-xs text-muted-foreground">Employee: {log.employeeName}</p>
        </div>
      ))}
    </div>
  )
}
