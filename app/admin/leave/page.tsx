"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock, CheckCircle2, XCircle, FileText, Filter, Search, Eye, MessageSquare, User, MoreVertical } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { getLeaveTypeDisplayName, getLeaveStatusInfo } from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth"

// Mock leave requests data
const mockLeaveRequests = [
  {
    id: "1",
    employee_id: "emp-1",
    full_name: "John Doe",
    employee_number: "XSP2501/001",
    job_title: "Software Engineer",
    department: "Engineering",
    leave_type: "annual",
    reason: "Family vacation",
    leave_day_from: "2024-12-20",
    leave_day_to: "2024-12-27",
    total_days: 6,
    status: "pending",
    created_at: "2024-12-01T10:00:00Z",
    supporting_document_url: "",
    employee_signature: "",
    employer_signature: "",
    rejection_reason: "",
    approver_comment: "",
    reviewed_by: "",
    reviewed_at: "",
  },
  {
    id: "2",
    employee_id: "emp-2",
    full_name: "Jane Smith",
    employee_number: "XSP2501/002",
    job_title: "Marketing Manager",
    department: "Marketing",
    leave_type: "sick",
    reason: "Flu symptoms",
    leave_day_from: "2024-12-15",
    leave_day_to: "2024-12-17",
    total_days: 3,
    status: "approved",
    created_at: "2024-12-15T08:00:00Z",
    supporting_document_url: "https://example.com/medical-cert.pdf",
    employee_signature: "signed",
    employer_signature: "signed",
    rejection_reason: "",
    approver_comment: "Get well soon!",
    reviewed_by: "hr-admin-1",
    reviewed_at: "2024-12-15T09:00:00Z",
  },
  {
    id: "3",
    employee_id: "emp-3",
    full_name: "Mike Johnson",
    employee_number: "XSP2501/003",
    job_title: "Sales Representative",
    department: "Sales",
    leave_type: "annual",
    reason: "Personal matters",
    leave_day_from: "2024-12-10",
    leave_day_to: "2024-12-15",
    total_days: 4,
    status: "rejected",
    created_at: "2024-12-05T10:00:00Z",
    supporting_document_url: "",
    employee_signature: "signed",
    employer_signature: "",
    rejection_reason: "Insufficient notice period",
    approver_comment: "Please submit requests at least 2 weeks in advance.",
    reviewed_by: "manager-1",
    reviewed_at: "2024-12-06T16:00:00Z",
  }
]

export default function LeaveManagementPage() {
  const { toast } = useToast()
  const [leaveRequests, setLeaveRequests] = useState<typeof mockLeaveRequests>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<typeof mockLeaveRequests[0] | null>(null)
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null)
  const [approvalComment, setApprovalComment] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "early_return_pending">("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const currentUser = getCurrentUser()
  const isHRAdmin = currentUser?.role === "hr_admin" || currentUser?.role === "admin" || currentUser?.role === "super_admin"

  useEffect(() => {
    fetchLeaveRequests()
  }, [statusFilter]) // Refetch when status filter changes

  const fetchLeaveRequests = async () => {
    setIsLoading(true)
    try {
      // Get auth token from localStorage
      let authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const storedSession = localStorage.getItem('xspark_session')
      if (storedSession) {
        try {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        } catch {}
      }

      // Fetch leave requests from API
      const statusParam =
        statusFilter === "early_return_pending"
          ? `&early_return_status=pending`
          : statusFilter !== "all"
            ? `&status=${statusFilter}`
            : ""
      const response = await fetch(`/api/leave/requests?limit=100${statusParam}`, {
        headers: authHeaders,
      })

      if (!response.ok) {
        throw new Error('Failed to fetch leave requests')
      }

      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        // Map API response to UI format (API now includes employee and leave_type via joins)
        const enrichedRequests = json.data.map((request: any) => {
          // Handle both singular and plural response structures
          // PostgREST returns joined data with table name (plural), so check both
          const employee = request.employees || request.employee || (Array.isArray(request.employees) ? request.employees[0] : null)
          const leaveType = request.leave_types || request.leave_type || (Array.isArray(request.leave_types) ? request.leave_types[0] : null)
          
          // Debug logging
          if (!employee || !leaveType) {
            console.warn('Missing employee or leave_type data for request:', {
              requestId: request.id,
              hasEmployees: !!request.employees,
              hasEmployee: !!request.employee,
              hasLeaveTypes: !!request.leave_types,
              hasLeaveType: !!request.leave_type,
              employeeData: request.employees || request.employee,
              leaveTypeData: request.leave_types || request.leave_type
            })
          }

          // Build full name
          let fullName = 'Unknown Employee'
          if (employee) {
            if (employee.first_name && employee.last_name) {
              const nameParts = [employee.first_name]
              if (employee.middle_name) nameParts.push(employee.middle_name)
              nameParts.push(employee.last_name)
              fullName = nameParts.join(' ').trim()
            } else if (employee.full_name) {
              fullName = employee.full_name
            }
          }

          // Get leave type key
          let leaveTypeKey = 'unknown'
          if (leaveType) {
            leaveTypeKey = leaveType.key || leaveType.leave_type || 'unknown'
          }

          return {
            id: request.id,
            employee_id: request.employee_id,
            full_name: fullName,
            employee_number: employee?.employee_id || employee?.employee_number || 'N/A',
            job_title: employee?.job_titles?.title || employee?.job_title || 'N/A',
            department: employee?.departments?.name || employee?.department || 'N/A',
            leave_type: leaveTypeKey,
            reason: request.reason || '',
            leave_day_from: request.start_date || request.leave_day_from,
            leave_day_to: request.end_date || request.leave_day_to,
            total_days: request.total_days,
            status: request.status,
            created_at: request.created_at || request.submitted_at,
            early_return_date: request.early_return_date ?? null,
            early_return_requested_at: request.early_return_requested_at ?? null,
            early_return_status: request.early_return_status ?? null,
            supporting_document_url: request.document_url || request.supporting_document_url || '',
            employee_signature: '',
            employer_signature: '',
            rejection_reason: request.review_notes || request.rejection_reason || '',
            approver_comment: request.review_notes || request.approver_comment || '',
            reviewed_by: request.reviewed_by || '',
            reviewed_at: request.reviewed_at || '',
          }
        })
        setLeaveRequests(enrichedRequests)
      } else {
        setLeaveRequests([])
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch leave requests. Please try again.',
        variant: 'destructive',
      })
      setLeaveRequests([])
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const filteredRequests = leaveRequests.filter(request => {
    if (statusFilter !== "all" && statusFilter !== "early_return_pending" && request.status !== statusFilter) return false
    if (departmentFilter !== "all" && request.department !== departmentFilter) return false
    if (searchTerm && !request.full_name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !request.employee_number.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  // Reuse the same helper logic as admin dashboard: we need the employee UUID
  // for reviewed_by, not the auth user ID.
  const getReviewerEmployeeUuid = async (): Promise<string | null> => {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (currentUser?.employeeId && uuidRegex.test(currentUser.employeeId)) {
        return currentUser.employeeId
      }

      const session = localStorage.getItem('xspark_session')
      let headers: Record<string, string> = { 'Content-Type': 'application/json' }

      if (session) {
        try {
          const sessionParsed = JSON.parse(session)
          if (sessionParsed?.access_token) {
            headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        } catch {
          // ignore parse error, we'll just call without auth
        }
      }

      const res = await fetch('/api/auth/me', { headers })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.data?.employee?.id && uuidRegex.test(data.data.employee.id)) {
        return data.data.employee.id as string
      }
    } catch (err) {
      console.error('[Admin Leave] Failed to resolve reviewer employee UUID:', err)
    }
    return null
  }

  const handleApprovalAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return

    // Validate rejection reason is provided
    if (action === "reject" && !rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this leave request.",
        variant: "destructive",
      })
      return
    }

    const reviewerEmployeeId = await getReviewerEmployeeUuid()
    if (!reviewerEmployeeId) {
      toast({
        title: "Error",
        description: "Unable to identify current HR user. Please try again.",
        variant: "destructive",
      })
      return
    }

    try {
      // Get auth token from localStorage
      let authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const storedSession = localStorage.getItem('xspark_session')
      if (storedSession) {
        try {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        } catch {}
      }

      // Call API to approve/reject
      const response = await fetch('/api/leave/requests', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          id: selectedRequest.id,
          status: action === "approve" ? "approved" : "rejected",
          reviewed_by: reviewerEmployeeId,
          review_notes: action === "approve" ? approvalComment : rejectionReason,
        }),
      })

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.success) {
        const message = json?.error || `Failed to ${action} leave request`

        // If the request is already in the desired status, treat as success and just refresh.
        if (message.startsWith("Cannot update leave request with status")) {
          await fetchLeaveRequests()
          setIsApprovalModalOpen(false)
          setSelectedRequest(null)
          setApprovalComment("")
          setRejectionReason("")

          toast({
            title: "Already updated",
            description: message,
          })
          return
        }

        throw new Error(message)
      }

      if (json.success) {
      toast({
        title: `Leave Request ${action === "approve" ? "Approved" : "Rejected"}`,
        description: `The leave request has been ${action === "approve" ? "approved" : "rejected"} successfully.`,
      })

        // Refresh the list
        await fetchLeaveRequests()

      setIsApprovalModalOpen(false)
      setSelectedRequest(null)
      setApprovalComment("")
      setRejectionReason("")
      } else {
        throw new Error(json.error || `Failed to ${action} leave request`)
      }
    } catch (error) {
      console.error(`Error ${action}ing leave request:`, error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} leave request. Please try again.`,
        variant: "destructive",
      })
    }
  }

  const openApprovalModal = (request: typeof mockLeaveRequests[0], action: "approve" | "reject") => {
    setSelectedRequest(request)
    setApprovalAction(action)
    setIsApprovalModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage employee leave requests
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="font-semibold">Pending</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveRequests.filter(req => req.status === "pending").length}
            </div>
            <p className="text-sm text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold">Approved</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveRequests.filter(req => req.status === "approved").length}
            </div>
            <p className="text-sm text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-semibold">Rejected</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveRequests.filter(req => req.status === "rejected").length}
            </div>
            <p className="text-sm text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">Total</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveRequests.length}
            </div>
            <p className="text-sm text-muted-foreground">All requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search by name or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="early_return_pending">Early Return Requests</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {statusFilter === "early_return_pending" ? "Early Return Requests" : "Leave Requests"} ({filteredRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leave requests found matching your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>{statusFilter === "early_return_pending" ? "Original end date" : "Dates"}</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>{statusFilter === "early_return_pending" ? "Requested return date" : "Status"}</TableHead>
                  <TableHead>{statusFilter === "early_return_pending" ? "Requested On" : "Submitted"}</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filteredRequests.map((request) => {
                    const statusInfo = getLeaveStatusInfo(request.status)
                    return (
                      <motion.tr
                        key={request.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{request.full_name}</div>
                            <div className="text-sm text-muted-foreground">{request.employee_number}</div>
                            <div className="text-sm text-muted-foreground">{request.job_title}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{getLeaveTypeDisplayName(request.leave_type)}</div>
                            <div className="text-sm text-muted-foreground max-w-xs truncate">
                              {request.reason}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {statusFilter === "early_return_pending" ? (
                            <div className="text-sm">
                              {format(new Date(request.leave_day_to), "MMM dd, yyyy")}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-sm">
                              <CalendarIcon className="h-4 w-4" />
                              <div>
                                <div>{format(new Date(request.leave_day_from), "MMM dd")}</div>
                                <div className="text-muted-foreground">to {format(new Date(request.leave_day_to), "MMM dd, yyyy")}</div>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {request.total_days} day{request.total_days !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell>
                          {statusFilter === "early_return_pending" ? (
                            <div className="text-sm">
                              {request.early_return_date ? format(new Date(request.early_return_date), "MMM dd, yyyy") : "—"}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {getStatusIcon(request.status)}
                              <Badge variant={statusInfo.variant}>
                                {statusInfo.name}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {statusFilter === "early_return_pending"
                            ? (request.early_return_requested_at
                                ? format(new Date(request.early_return_requested_at), "MMM dd, yyyy")
                                : "—")
                            : format(new Date(request.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* View details (opens dialog) */}
                            <Dialog>
                              <DialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="flex items-center gap-2 cursor-pointer"
                                    // prevent Radix from immediately closing before DialogTrigger fires
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                  <Eye className="h-4 w-4" />
                                    <span>View details</span>
                                  </DropdownMenuItem>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Leave Request Details</DialogTitle>
                                </DialogHeader>
                                <LeaveRequestDetails request={request} />
                              </DialogContent>
                            </Dialog>
                            
                              {/* Approve / Reject only for pending + HR Admin */}
                            {request.status === "pending" && isHRAdmin && statusFilter !== "early_return_pending" && (
                              <>
                                  <DropdownMenuItem
                                    className="flex items-center gap-2 cursor-pointer text-green-700 focus:text-green-700"
                                  onClick={() => openApprovalModal(request, "approve")}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                    <span>Approve</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                                  onClick={() => openApprovalModal(request, "reject")}
                                >
                                  <XCircle className="h-4 w-4" />
                                    <span>Reject</span>
                                  </DropdownMenuItem>
                              </>
                            )}

                            {statusFilter === "early_return_pending" && isHRAdmin && (
                              <>
                                <DropdownMenuItem
                                  className="flex items-center gap-2 cursor-pointer text-green-700 focus:text-green-700"
                                  onClick={async () => {
                                    try {
                                      const storedSession = localStorage.getItem("xspark_session")
                                      const headers: Record<string, string> = { "Content-Type": "application/json" }
                                      if (storedSession) {
                                        const sessionParsed = JSON.parse(storedSession)
                                        if (sessionParsed?.access_token) headers.Authorization = `Bearer ${sessionParsed.access_token}`
                                      }
                                      const res = await fetch(`/api/leave/requests/${request.id}/approve-early-return`, { method: "PATCH", headers })
                                      const json = await res.json().catch(() => ({}))
                                      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to approve early return")
                                      toast({ title: "Early return approved", description: `Closed leave early for ${request.full_name}.` })
                                      fetchLeaveRequests()
                                    } catch (e) {
                                      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Failed to approve.", variant: "destructive" })
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Approve early return</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                                  onClick={async () => {
                                    try {
                                      const storedSession = localStorage.getItem("xspark_session")
                                      const headers: Record<string, string> = { "Content-Type": "application/json" }
                                      if (storedSession) {
                                        const sessionParsed = JSON.parse(storedSession)
                                        if (sessionParsed?.access_token) headers.Authorization = `Bearer ${sessionParsed.access_token}`
                                      }
                                      const res = await fetch(`/api/leave/requests/${request.id}/reject-early-return`, { method: "PATCH", headers })
                                      const json = await res.json().catch(() => ({}))
                                      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to reject early return")
                                      toast({ title: "Early return rejected", description: `Rejected early return for ${request.full_name}.` })
                                      fetchLeaveRequests()
                                    } catch (e) {
                                      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Failed to reject.", variant: "destructive" })
                                    }
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>Reject early return</span>
                                </DropdownMenuItem>
                              </>
                            )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold">{selectedRequest.full_name}</h4>
                <p className="text-sm text-muted-foreground">
                  {getLeaveTypeDisplayName(selectedRequest.leave_type)} - {selectedRequest.total_days} days
                </p>
                <p className="text-sm">{selectedRequest.reason}</p>
              </div>
            )}
            
            <div>
              <Label htmlFor="comment">
                {approvalAction === "approve" ? "Approval Comment" : "Rejection Reason"}
                {approvalAction === "reject" && " *"}
              </Label>
              <Textarea
                id="comment"
                value={approvalAction === "approve" ? approvalComment : rejectionReason}
                onChange={(e) => {
                  if (approvalAction === "approve") {
                    setApprovalComment(e.target.value)
                  } else {
                    setRejectionReason(e.target.value)
                  }
                }}
                placeholder={
                  approvalAction === "approve" 
                    ? "Add any comments for the employee (optional)..." 
                    : "Explain why this request is being rejected..."
                }
                rows={3}
                required={approvalAction === "reject"}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsApprovalModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleApprovalAction(approvalAction!)}
                disabled={approvalAction === "reject" && !rejectionReason.trim()}
                className={approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {approvalAction === "approve" ? "Approve" : "Reject"} Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface LeaveRequestDetailsProps {
  request: typeof mockLeaveRequests[0]
}

function LeaveRequestDetails({ request }: LeaveRequestDetailsProps) {
  const statusInfo = getLeaveStatusInfo(request.status)
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Employee</Label>
          <p className="text-sm">{request.full_name} ({request.employee_number})</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Department</Label>
          <p className="text-sm">{request.department}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Job Title</Label>
          <p className="text-sm">{request.job_title}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Leave Type</Label>
          <p className="text-sm">{getLeaveTypeDisplayName(request.leave_type)}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Start Date</Label>
          <p className="text-sm">{format(new Date(request.leave_day_from), "PPP")}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">End Date</Label>
          <p className="text-sm">{format(new Date(request.leave_day_to), "PPP")}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Duration</Label>
          <p className="text-sm">{request.total_days} days</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <Badge variant={statusInfo.variant}>{statusInfo.name}</Badge>
        </div>
      </div>
      
      <div>
        <Label className="text-sm font-medium">Reason for Leave</Label>
        <p className="text-sm bg-gray-50 p-3 rounded-lg">{request.reason}</p>
      </div>
      
      {request.supporting_document_url && (
        <div>
          <Label className="text-sm font-medium">Supporting Document</Label>
          <p className="text-sm">
            <a href={request.supporting_document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              View Document
            </a>
          </p>
        </div>
      )}
      
      {request.approver_comment && (
        <div>
          <Label className="text-sm font-medium">Approver Comment</Label>
          <p className="text-sm bg-blue-50 p-3 rounded-lg">{request.approver_comment}</p>
        </div>
      )}
      
      {request.rejection_reason && (
        <div>
          <Label className="text-sm font-medium">Rejection Reason</Label>
          <p className="text-sm bg-red-50 p-3 rounded-lg">{request.rejection_reason}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div>
          <Label className="text-sm font-medium">Submitted</Label>
          <p>{format(new Date(request.created_at), "PPP 'at' p")}</p>
        </div>
        {request.reviewed_at && (
          <div>
            <Label className="text-sm font-medium">Reviewed</Label>
            <p>{format(new Date(request.reviewed_at), "PPP 'at' p")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
