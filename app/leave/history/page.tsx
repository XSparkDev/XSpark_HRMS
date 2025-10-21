"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarIcon, Clock, CheckCircle2, XCircle, FileText, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { getLeaveTypeDisplayName, getLeaveStatusInfo } from "@/lib/validation/leave"

// Mock leave history data
const mockLeaveHistory = [
  {
    id: "1",
    leave_type: "annual",
    reason: "Family vacation",
    leave_day_from: "2024-12-20",
    leave_day_to: "2024-12-27",
    total_days: 6,
    status: "approved",
    created_at: "2024-12-01T10:00:00Z",
    reviewed_at: "2024-12-02T14:30:00Z",
    approver_comment: "Approved. Enjoy your vacation!"
  },
  {
    id: "2", 
    leave_type: "sick",
    reason: "Flu symptoms",
    leave_day_from: "2024-11-15",
    leave_day_to: "2024-11-17",
    total_days: 3,
    status: "approved",
    created_at: "2024-11-15T08:00:00Z",
    reviewed_at: "2024-11-15T09:00:00Z",
    approver_comment: "Get well soon!"
  },
  {
    id: "3",
    leave_type: "annual", 
    reason: "Personal matters",
    leave_day_from: "2024-10-05",
    leave_day_to: "2024-10-10",
    total_days: 4,
    status: "rejected",
    created_at: "2024-10-01T10:00:00Z",
    reviewed_at: "2024-10-02T16:00:00Z",
    rejection_reason: "Insufficient notice period",
    approver_comment: "Please submit requests at least 2 weeks in advance."
  }
]

export default function LeaveHistoryPage() {
  const router = useRouter()
  const [leaveHistory, setLeaveHistory] = useState<typeof mockLeaveHistory>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace("/login")
      return
    }

    // Mock API call - replace with actual API
    setTimeout(() => {
      setLeaveHistory(mockLeaveHistory)
      setIsLoading(false)
    }, 1000)
  }, [router])

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
                        {getLeaveTypeDisplayName(request.leave_type)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.reason}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(request.leave_day_from), "MMM dd")} - {format(new Date(request.leave_day_to), "MMM dd, yyyy")}
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
                        {format(new Date(request.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // In a real app, this would open a detailed view modal
                            console.log("View details for request:", request.id)
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
    </div>
  )
}
