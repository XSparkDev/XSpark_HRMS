"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  Users,
  Archive,
  Clock,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface DashboardStats {
  idVerifications: number
  bankDetails: number
  workPermits: number
  totalActiveEmployees: number
  unverifiedProfiles: number
  pendingApprovals: number
  archivedEmployees: number
  expiringContracts: number
  leaveBalanceWarnings: number
}

interface RecentActivity {
  id: string
  timestamp: string
  user_name: string
  action: string
}

export function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    idVerifications: 0,
    bankDetails: 0,
    workPermits: 0,
    totalActiveEmployees: 0,
    unverifiedProfiles: 0,
    pendingApprovals: 0,
    archivedEmployees: 0,
    expiringContracts: 0,
    leaveBalanceWarnings: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [pendingOver7Days, setPendingOver7Days] = useState<{
    id: number
    bank: number
    workPermit: number
  }>({ id: 0, bank: 0, workPermit: 0 })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch all stats in parallel
      const [
        employeesRes,
        leaveRequestsRes,
        idVerificationsRes,
        bankDetailsRes,
        workPermitsRes,
      ] = await Promise.all([
        fetch("/api/employees?is_active=true"),
        fetch("/api/leave/requests?status=pending"),
        fetch("/api/employees?id_verified=false&is_active=true"),
        fetch("/api/employees?bank_verified=false&is_active=true"),
        fetch("/api/employees?work_permit_verified=false&is_active=true"),
      ])

      const employees = await employeesRes.json()
      const leaveRequests = await leaveRequestsRes.json()
      const idVerifications = await idVerificationsRes.json()
      const bankDetails = await bankDetailsRes.json()
      const workPermits = await workPermitsRes.json()

      // Calculate pending over 7 days (mock for now - would need created_at dates)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      setStats({
        idVerifications: idVerifications.data?.length || 0,
        bankDetails: bankDetails.data?.length || 0,
        workPermits: workPermits.data?.length || 0,
        totalActiveEmployees: employees.data?.length || 0,
        unverifiedProfiles: (idVerifications.data?.length || 0) + (bankDetails.data?.length || 0) + (workPermits.data?.length || 0),
        pendingApprovals: leaveRequests.data?.length || 0,
        archivedEmployees: 0, // Would need to fetch archived employees
        expiringContracts: 0, // Would need contract expiration logic
        leaveBalanceWarnings: 0, // Would need leave balance check
      })

      // Fetch recent activity (mock data for now)
      setRecentActivity([
        {
          id: "1",
          timestamp: new Date().toISOString(),
          user_name: "System Admin",
          action: "Updated user permissions",
        },
        {
          id: "2",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          user_name: "HR Manager",
          action: "Approved leave request",
        },
        {
          id: "3",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          user_name: "Admin User",
          action: "Created new employee profile",
        },
        {
          id: "4",
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          user_name: "System",
          action: "Automated backup completed",
        },
        {
          id: "5",
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          user_name: "Super Admin",
          action: "Modified system settings",
        },
      ])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
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
      {/* Pending Verifications Section */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-800">ID Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{stats.idVerifications}</span>
                {pendingOver7Days.id > 0 && (
                  <Badge className="bg-orange-500 text-white rounded-full">{pendingOver7Days.id} over 7 days</Badge>
                )}
              </div>
              <Button className="bg-[#A6206A] hover:bg-[#8B1A5A] text-white px-4 py-2 rounded-md">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-800">Bank Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{stats.bankDetails}</span>
                {pendingOver7Days.bank > 0 && (
                  <Badge className="bg-orange-500 text-white rounded-full">{pendingOver7Days.bank} over 7 days</Badge>
                )}
              </div>
              <Button className="bg-[#A6206A] hover:bg-[#8B1A5A] text-white px-4 py-2 rounded-md">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-800">Work Permits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{stats.workPermits}</span>
                {pendingOver7Days.workPermit > 0 && (
                  <Badge className="bg-orange-500 text-white rounded-full">{pendingOver7Days.workPermit} over 7 days</Badge>
                )}
              </div>
              <Button className="bg-[#A6206A] hover:bg-[#8B1A5A] text-white px-4 py-2 rounded-md">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Alerts Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg font-semibold text-gray-800">System Alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Contracts expiring in 30 days:</span>
              <Badge className="bg-[#A6206A] text-white rounded-full">{stats.expiringContracts}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Leave balance warnings:</span>
              <Badge className="bg-[#A6206A] text-white rounded-full">{stats.leaveBalanceWarnings}</Badge>
            </div>
            <Link href="/admin/alerts" className="block text-sm text-[#A6206A] hover:underline text-center pt-2">
              View All
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-[#A6206A]" />
              <div>
                <p className="text-sm text-muted-foreground">Total Active Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalActiveEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Unverified Profiles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unverifiedProfiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingApprovals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Archive className="h-8 w-8 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Archived Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.archivedEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-800">High Priority Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.user_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.action}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {formatDateSafe(activity.timestamp, "MMM d, h:mm a")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

