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
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

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
  const [loading, setLoading] = useState(true)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
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

      const [leaveRes, employeesRes, unverifiedRes] = await Promise.all([
        fetch("/api/leave/requests?status=pending&limit=5"),
        fetch("/api/employees?is_active=true"),
        fetch("/api/employees?id_verified=false&is_active=true"),
      ])

      const leaveData = await leaveRes.json()
      const employeesData = await employeesRes.json()
      const unverifiedData = await unverifiedRes.json()

      setLeaveRequests(leaveData.data || [])
      setStats({
        activeEmployees: employeesData.data?.length || 0,
        onLeaveToday: 0, // Would need to check leave dates
        unverified: unverifiedData.data?.length || 0,
        expiringContracts: 0, // Would need contract expiration logic
        missingDocuments: 0, // Would need document check
        pendingWarnings: 0, // Would need disciplinary records
      })
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leave/requests/${requestId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed_by: "current-user-id" }),
      })

      if (response.ok) {
        fetchDashboardData()
      }
    } catch (error) {
      console.error("Error approving leave:", error)
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leave/requests/${requestId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed_by: "current-user-id", rejection_reason: "Rejected" }),
      })

      if (response.ok) {
        fetchDashboardData()
      }
    } catch (error) {
      console.error("Error rejecting leave:", error)
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
      {/* Pending Approvals Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-800">Pending Approvals</CardTitle>
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
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                      onClick={() => handleApprove(request.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white h-8 px-3"
                      onClick={() => handleReject(request.id)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
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

