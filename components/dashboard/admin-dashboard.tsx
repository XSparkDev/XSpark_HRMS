"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  Eye,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

interface LeaveRequest {
  id: string
  employee_id: string
  full_name: string
  leave_type?: string | null
  leave_day_from: string
  leave_day_to: string
  total_days: number
  reason?: string
  created_at: string
  document_url?: string
  status?: string
  reviewed_at?: string
  reviewed_by?: string
  review_notes?: string
}

interface DashboardStats {
  activeEmployees: number
  onLeaveToday: number
  unverified: number
  expiringContracts: number
  missingDocuments: number
  pendingWarnings: number
}

export function AdminDashboard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    activeEmployees: 0,
    onLeaveToday: 0,
    unverified: 0,
    expiringContracts: 0,
    missingDocuments: 0,
    pendingWarnings: 0,
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Build auth headers (needed for protected API routes)
      let headers: Record<string, string> = { "Content-Type": "application/json" }
      if (typeof window !== "undefined") {
        const session = localStorage.getItem("xspark_session")
        if (session) {
          try {
            const parsed = JSON.parse(session)
            if (parsed?.access_token) {
              headers["Authorization"] = `Bearer ${parsed.access_token}`
            }
          } catch {
            // ignore parse errors and continue without auth header
          }
        }
      }

      const [leaveRes, employeesRes, unverifiedRes, approvedLeaveRes] = await Promise.all([
        fetch("/api/leave/requests?status=pending&limit=5", { headers }),
        // For dashboard purposes, “Active Employees” = all employees in the employees table
        // (the API defaults to all when no is_active filter is provided).
        fetch("/api/employees", { headers }),
        fetch("/api/employees?id_verified=false&is_active=true", { headers }),
        // Used to calculate how many people are currently on leave today.
        // API enforces limit <= 100, so keep it within that bound.
        fetch("/api/leave/requests?status=approved&limit=100", { headers }),
      ])

      const leaveData = await leaveRes.json()
      const employeesData = await employeesRes.json()
      const unverifiedData = await unverifiedRes.json()
      const approvedLeaveData = await approvedLeaveRes.json()

      // Pending requests for the card at the top
      setLeaveRequests(leaveData.data || [])

      // Calculate how many employees are on leave today
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const approvedRequests: any[] = Array.isArray(approvedLeaveData.data)
        ? approvedLeaveData.data
        : []

      const onLeaveTodayCount = approvedRequests.filter((req) => {
        const startStr = req.start_date || req.leave_day_from
        const endStr = req.end_date || req.leave_day_to
        if (!startStr || !endStr) return false

        const start = new Date(startStr)
        const end = new Date(endStr)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false

        // Normalize to midnight for comparison
        start.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)

        return start <= today && today <= end
      }).length

      setStats({
        activeEmployees: employeesData.data?.length || 0,
        onLeaveToday: onLeaveTodayCount,
        unverified: unverifiedData.data?.length || 0,
        expiringContracts: 0, // TODO: implement contract expiration logic
        missingDocuments: 0, // TODO: implement document completeness check
        pendingWarnings: 0, // TODO: implement disciplinary records
      })
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get the employee UUID (validates and fetches if needed)
  const getEmployeeUuid = async (): Promise<string | null> => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) {
        return null
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const isValidUuid = currentUser.employeeId && uuidRegex.test(currentUser.employeeId)

      if (isValidUuid) {
        return currentUser.employeeId || null
      }

      // If not a valid UUID, fetch from /api/auth/me which returns employee.id (UUID)
      try {
        const session = localStorage.getItem('xspark_session')
        let headers: Record<string, string> = { 'Content-Type': 'application/json' }
        
        if (session) {
          try {
            const sessionParsed = JSON.parse(session)
            if (sessionParsed?.access_token) {
              headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        const response = await fetch('/api/auth/me', { headers })
        const data = await response.json()
        
        if (response.ok && data.data?.employee?.id) {
          return data.data.employee.id // Return the employee UUID
        }
      } catch (fetchError) {
        console.error("Error fetching employee UUID from /api/auth/me:", fetchError)
      }

      return null
    } catch (error) {
      console.error("Error getting employee UUID:", error)
      return null
    }
  }

  const handleView = (request: LeaveRequest) => {
    setSelectedRequest(request)
    setIsViewDialogOpen(true)
  }

  const handleApprove = async (requestId: string) => {
    try {
      const employeeUuid = await getEmployeeUuid()
      if (!employeeUuid) {
        toast({
          title: "Error",
          description: "Unable to identify current user. Please try again.",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/leave/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId,
          status: "approved",
          reviewed_by: employeeUuid,
          review_notes: "Approved",
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Leave request approved successfully",
        })
        fetchDashboardData()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to approve leave request",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error approving leave:", error)
      toast({
        title: "Error",
        description: "An error occurred while approving the leave request",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      const employeeUuid = await getEmployeeUuid()
      if (!employeeUuid) {
        toast({
          title: "Error",
          description: "Unable to identify current user. Please try again.",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/leave/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId,
          status: "rejected",
          reviewed_by: employeeUuid,
          review_notes: "Rejected",
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Leave request rejected successfully",
        })
        fetchDashboardData()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to reject leave request",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error rejecting leave:", error)
      toast({
        title: "Error",
        description: "An error occurred while rejecting the leave request",
        variant: "destructive",
      })
    }
  }

  const getLeaveTypeDisplay = (type: string | undefined | null) => {
    if (!type) return "Unknown"
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const formatDateSafe = (dateString: string | undefined | null, formatStr: string): string => {
    if (!dateString) return "—"
    try {
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return "—"
      return format(date, formatStr)
    } catch {
      return "—"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending Leave Requests Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-800">Pending Leave Requests</CardTitle>
            <Badge className="bg-[#A6206A] text-white rounded-full">{leaveRequests.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending leave requests</p>
            ) : (
              leaveRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{request.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getLeaveTypeDisplay(request.leave_type)} • {formatDateSafe(request.leave_day_from, "MMM d")} - {formatDateSafe(request.leave_day_to, "MMM d, yyyy")}
                    </p>
                    {request.reason && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{request.reason}</p>
                    )}
                  </div>
                  <div className="ml-4">
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
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => handleView(request)}
                          className="cursor-pointer"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleApprove(request.id)}
                          className="cursor-pointer text-green-600 focus:text-green-600"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleReject(request.id)}
                          className="cursor-pointer text-red-600 focus:text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
            {leaveRequests.length > 0 && (
              <Link href="/admin/leave" className="block text-sm text-[#A6206A] hover:underline text-center pt-2">
                View All
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Leave Request Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              View detailed information about this leave request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Employee</Label>
                  <p className="text-sm">{selectedRequest.full_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Leave Type</Label>
                  <p className="text-sm">{getLeaveTypeDisplay(selectedRequest.leave_type)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <p className="text-sm">{formatDateSafe(selectedRequest.leave_day_from, "PPP")}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date</Label>
                  <p className="text-sm">{formatDateSafe(selectedRequest.leave_day_to, "PPP")}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Duration</Label>
                  <p className="text-sm">{selectedRequest.total_days} day{selectedRequest.total_days !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className="bg-yellow-500 text-white">Pending</Badge>
                </div>
              </div>
              
              {selectedRequest.reason && (
                <div>
                  <Label className="text-sm font-medium">Reason for Leave</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg mt-1">{selectedRequest.reason}</p>
                </div>
              )}
              
              {selectedRequest.document_url && (
                <div>
                  <Label className="text-sm font-medium">Supporting Document</Label>
                  <p className="text-sm mt-1">
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
              
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <Label className="text-sm font-medium">Submitted</Label>
                  <p>{formatDateSafe(selectedRequest.created_at, "PPP 'at' p")}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Team Overview */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-[#A6206A]" />
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">On Leave Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.onLeaveToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Unverified</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unverified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg font-semibold text-gray-800">Alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Contracts expiring soon:</span>
              <Badge className="bg-[#A6206A] text-white rounded-full">{stats.expiringContracts}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Missing documents:</span>
              <Badge className="bg-[#A6206A] text-white rounded-full">{stats.missingDocuments}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Pending warnings:</span>
              <Badge className="bg-[#A6206A] text-white rounded-full">{stats.pendingWarnings}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

