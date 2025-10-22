"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCurrentUser } from "@/lib/auth"
import Link from "next/link"
import {
  ArrowLeft,
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

export default function ActivityLogPage() {
  const user = getCurrentUser()

  if (!user) return null

  // Mock activity data
  const activities = [
    {
      id: 1,
      timestamp: "2024-12-15 14:30:00",
      user: "John Smith",
      action: "borrowed",
      device: "MacBook Pro 16\"",
      deviceId: "DEV001",
      status: "completed",
      details: "Borrowed for project work",
    },
    {
      id: 2,
      timestamp: "2024-12-15 12:15:00",
      user: "Sarah Johnson",
      action: "returned",
      device: "Dell Monitor 24\"",
      deviceId: "DEV002",
      status: "completed",
      details: "Returned in excellent condition",
    },
    {
      id: 3,
      timestamp: "2024-12-15 10:45:00",
      user: "Mike Chen",
      action: "requested",
      device: "iPad Pro 12.9\"",
      deviceId: "DEV003",
      status: "pending",
      details: "Request pending supervisor approval",
    },
    {
      id: 4,
      timestamp: "2024-12-14 16:20:00",
      user: "Emma Davis",
      action: "borrowed",
      device: "Sony WH-1000XM4",
      deviceId: "DEV004",
      status: "completed",
      details: "Borrowed for business travel",
    },
    {
      id: 5,
      timestamp: "2024-12-14 14:10:00",
      user: "Robert Lee",
      action: "returned",
      device: "HP LaserJet Pro",
      deviceId: "DEV005",
      status: "completed",
      details: "Returned with minor wear",
    },
    {
      id: 6,
      timestamp: "2024-12-14 11:30:00",
      user: "Lisa Wang",
      action: "reported_damage",
      device: "Dell Monitor 24\"",
      deviceId: "DEV006",
      status: "completed",
      details: "Reported screen flickering issue",
    },
  ]

  const getActionIcon = (action: string) => {
    const icons = {
      borrowed: Package,
      returned: CheckCircle2,
      requested: Clock,
      reported_damage: AlertCircle,
    }
    const Icon = icons[action as keyof typeof icons] || Activity
    return <Icon className="h-4 w-4" />
  }

  const getActionColor = (action: string) => {
    const colors = {
      borrowed: "text-blue-600",
      returned: "text-green-600",
      requested: "text-amber-600",
      reported_damage: "text-red-600",
    }
    return colors[action as keyof typeof colors] || "text-gray-600"
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { color: "bg-green-100 text-green-800", icon: CheckCircle2 },
      pending: { color: "bg-amber-100 text-amber-800", icon: Clock },
      cancelled: { color: "bg-red-100 text-red-800", icon: AlertCircle },
    }
    const config = statusConfig[status as keyof typeof statusConfig]
    const Icon = config.icon
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/assets">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to AMS
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Activity Log</h1>
              <p className="text-muted-foreground">Track all asset management activities</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search activities by user, device, or action..."
                    className="pl-10"
                  />
                </div>
              </div>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="borrowed">Borrowed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="reported_damage">Damage Reports</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Recent asset management activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="p-2 rounded-full bg-muted">
                    <div className={getActionColor(activity.action)}>
                      {getActionIcon(activity.action)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{activity.user}</h4>
                        <span className="text-sm text-muted-foreground">
                          {activity.action.replace('_', ' ')} {activity.device}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(activity.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Device ID: {activity.deviceId}</span>
                      <span>•</span>
                      <span>{activity.details}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-navy">{activities.length}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {activities.filter(a => a.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Successful transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {activities.filter(a => a.status === 'pending').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Damage Reports</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {activities.filter(a => a.action === 'reported_damage').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Need attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-{activities.length} of {activities.length} activities
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}