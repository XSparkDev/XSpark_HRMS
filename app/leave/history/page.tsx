"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarIcon, Clock, CheckCircle2, XCircle, FileText, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getCurrentUser } from "@/lib/auth"
import { getLeaveTypeDisplayName, getLeaveStatusInfo } from "@/lib/validation/leave"

interface LeaveRequest {
  id: string
  employee_id: string
  leave_type_id: string
  leave_type?: string
  start_date: string
  end_date: string
  total_days: number
  reason?: string
  status: string
  created_at: string
  submitted_at?: string
  reviewed_at?: string
  reviewed_by?: string
  review_notes?: string
  document_url?: string
  employees?: {
    first_name?: string
    middle_name?: string
    last_name?: string
    full_name?: string
    employee_id?: string
  }
  leave_types?: {
    key: string
    display_name: string
  }
}

export default function LeaveHistoryPage() {
  const router = useRouter()
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [employeeUuid, setEmployeeUuid] = useState<string | null>(null)

  const user = getCurrentUser()

  // Fetch employee UUID from /api/auth/me
  useEffect(() => {
    if (!user?.id) {
      router.replace("/login")
      return
    }

    const fetchEmployeeUuid = async () => {
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
          console.warn('[LeaveHistory] Failed to parse session for Bearer token:', error)
        }

        const res = await fetch("/api/auth/me", { headers })
        const json = await res.json()
        
        if (res.ok && json.success && json.data?.employee?.id) {
          setEmployeeUuid(json.data.employee.id)
        } else {
          if (res.status !== 401) {
            console.warn("[LeaveHistory] Failed to fetch employee UUID:", json.error)
          }
        }
      } catch (error) {
        console.warn("[LeaveHistory] Error fetching employee UUID:", error)
      }
    }

    fetchEmployeeUuid()
  }, [user?.id, router])

  // Fetch leave requests when employee UUID is available
  useEffect(() => {
    if (!employeeUuid) return

    const fetchLeaveRequests = async () => {
      try {
        setIsLoading(true)
        
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

        // Fetch all leave requests for this employee
        const response = await fetch(`/api/leave/requests?employee_id=${employeeUuid}&limit=100`, {
          headers: authHeaders,
        })

        if (!response.ok) {
          throw new Error('Failed to fetch leave requests')
        }

        const json = await response.json()
        if (json.success && Array.isArray(json.data)) {
          // Map API response to match our interface
          const mappedRequests = json.data.map((request: any) => {
            // Handle both singular and plural response structures from PostgREST
            const employee = request.employees || request.employee || (Array.isArray(request.employees) ? request.employees[0] : null)
            const leaveType = request.leave_types || request.leave_type || (Array.isArray(request.leave_types) ? request.leave_types[0] : null)
            
            // Get leave type key
            const leaveTypeKey = leaveType?.key || 'unknown'
            
            return {
              ...request,
              leave_type: leaveTypeKey,
              employees: employee,
              leave_types: leaveType,
            }
          })
          
          // Sort by created_at descending (newest first)
          mappedRequests.sort((a: LeaveRequest, b: LeaveRequest) => {
            const dateA = new Date(a.created_at || a.submitted_at || 0).getTime()
            const dateB = new Date(b.created_at || b.submitted_at || 0).getTime()
            return dateB - dateA
          })
          
          setLeaveHistory(mappedRequests)
        } else {
          setLeaveHistory([])
        }
      } catch (error) {
        console.error('Error fetching leave requests:', error)
        setLeaveHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaveRequests()
  }, [employeeUuid])

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
          <h1 className="text-3xl font-bold text-navy">Leave History</h1>
          <p className="text-muted-foreground mt-1">
            View your past and current leave requests
          </p>
        </div>
        <Button onClick={() => router.push("/leave")} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Leave Request
        </Button>
      </div>

      {/* Leave Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold">Approved</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveHistory.filter(req => req.status === "approved").length}
            </div>
            <p className="text-sm text-muted-foreground">Total approved requests</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="font-semibold">Pending</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveHistory.filter(req => req.status === "pending").length}
            </div>
            <p className="text-sm text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-semibold">Rejected</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {leaveHistory.filter(req => req.status === "rejected").length}
            </div>
            <p className="text-sm text-muted-foreground">Total rejected requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Leave History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaveHistory.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                No Leave Requests Found
              </h3>
              <p className="text-muted-foreground mb-4">
                You haven't submitted any leave requests yet.
              </p>
              <Button onClick={() => router.push("/leave")}>
                Submit Your First Request
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveHistory.map((request) => {
                  const statusInfo = getLeaveStatusInfo(request.status)
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {getLeaveTypeDisplayName(request.leave_type || 'unknown')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.reason}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(request.start_date), "MMM dd")} - {format(new Date(request.end_date), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.total_days} day{request.total_days !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.name}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at || request.submitted_at || ''), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request)
                            setIsDetailsDialogOpen(true)
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Leave Request Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Leave Type</Label>
                    <p className="text-sm">{getLeaveTypeDisplayName(selectedRequest.leave_type || 'unknown')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedRequest.status)}
                      <Badge variant={getLeaveStatusInfo(selectedRequest.status).variant}>
                        {getLeaveStatusInfo(selectedRequest.status).name}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                    <p className="text-sm">{format(new Date(selectedRequest.start_date), "PPP")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                    <p className="text-sm">{format(new Date(selectedRequest.end_date), "PPP")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                    <p className="text-sm">{selectedRequest.total_days} day{selectedRequest.total_days !== 1 ? 's' : ''}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Submitted</Label>
                    <p className="text-sm">{format(new Date(selectedRequest.created_at || selectedRequest.submitted_at || ''), "PPP 'at' p")}</p>
                  </div>
                  {selectedRequest.reviewed_at && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Reviewed</Label>
                      <p className="text-sm">{format(new Date(selectedRequest.reviewed_at), "PPP 'at' p")}</p>
                    </div>
                  )}
                </div>
                
                {selectedRequest.reason && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2">Reason for Leave</Label>
                    <p className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.reason}</p>
                  </div>
                )}
                
                {selectedRequest.review_notes && selectedRequest.status === 'approved' && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2">Approver Comment</Label>
                    <p className="text-sm bg-blue-50 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.review_notes}</p>
                  </div>
                )}
                
                {selectedRequest.review_notes && selectedRequest.status === 'rejected' && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2">Rejection Reason</Label>
                    <p className="text-sm bg-red-50 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.review_notes}</p>
                  </div>
                )}
                
                {selectedRequest.document_url && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2">Supporting Document</Label>
                    <p className="text-sm">
                      <a 
                        href={selectedRequest.document_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline"
                      >
                        View Document
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
