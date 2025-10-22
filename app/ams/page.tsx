"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getCurrentUser } from "@/lib/auth"
import Link from "next/link"
import {
  Package,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Monitor,
  Smartphone,
  Laptop,
  Printer,
  Headphones,
  Activity,
  FileText,
  Users,
  Settings,
} from "lucide-react"

export default function AssetManagementPage() {
  const user = getCurrentUser()

  if (!user) return null

  const isEmployee = user.role === "employee"
  const isSupervisor = user.role === "junior_hr" || user.role === "hr_manager" || user.role === "super_admin"

  // Mock data for demonstration
  const deviceStats = {
    total: 156,
    available: 89,
    borrowed: 45,
    pending: 12,
    damaged: 10,
  }

  const recentActivity = [
    {
      id: 1,
      user: "John Smith",
      action: "borrowed",
      device: "MacBook Pro 16\"",
      timestamp: "2 hours ago",
      status: "completed",
    },
    {
      id: 2,
      user: "Sarah Johnson",
      action: "returned",
      device: "Dell Monitor 24\"",
      timestamp: "4 hours ago",
      status: "completed",
    },
    {
      id: 3,
      user: "Mike Chen",
      action: "requested",
      device: "iPad Pro 12.9\"",
      timestamp: "6 hours ago",
      status: "pending",
    },
  ]

  const deviceCategories = [
    { name: "Laptops", count: 45, icon: Laptop, color: "bg-blue-500" },
    { name: "Monitors", count: 32, icon: Monitor, color: "bg-green-500" },
    { name: "Mobile Devices", count: 28, icon: Smartphone, color: "bg-purple-500" },
    { name: "Printers", count: 15, icon: Printer, color: "bg-amber-500" },
    { name: "Accessories", count: 36, icon: Headphones, color: "bg-red-500" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* AMS Header */}
        <Card className="gradient-primary text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Asset Management System</h1>
                <p className="text-white/90">
                  Manage devices, rooms, approvals, utilities, and more.
                </p>
              </div>
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                <Package className="h-4 w-4 mr-2" />
                AMS
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-navy">{deviceStats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered assets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{deviceStats.available}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready to borrow</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Borrowed</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{deviceStats.borrowed}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently in use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{deviceStats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Damaged</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{deviceStats.damaged}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs repair</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common asset management tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/assets/all-devices">
                <Button className="h-auto flex-col gap-2 py-6 bg-transparent w-full" variant="outline">
                  <Search className="h-6 w-6 text-primary" />
                  <span>All Devices</span>
                </Button>
              </Link>
              
              {isSupervisor && (
                <Link href="/assets/add">
                  <Button className="h-auto flex-col gap-2 py-6 bg-transparent w-full" variant="outline">
                    <Plus className="h-6 w-6 text-primary" />
                    <span>Add Device</span>
                  </Button>
                </Link>
              )}
              
              <Link href="/assets/borrow">
                <Button className="h-auto flex-col gap-2 py-6 bg-transparent w-full" variant="outline">
                  <Package className="h-6 w-6 text-primary" />
                  <span>Borrow Device</span>
                </Button>
              </Link>
              
              <Link href="/assets/return">
                <Button className="h-auto flex-col gap-2 py-6 bg-transparent w-full" variant="outline">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  <span>Return Device</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Device Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Device Categories</CardTitle>
              <CardDescription>Assets by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deviceCategories.map((category, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <category.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <span className="text-muted-foreground">{category.count} devices</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${category.color}`} 
                        style={{ width: `${(category.count / deviceStats.total) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest asset transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.user}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.action} • {activity.device}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={activity.status === "completed" ? "default" : "secondary"}
                        className={activity.status === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                      >
                        {activity.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/assets/activity">
                  <Button variant="outline" className="w-full">
                    <Activity className="h-4 w-4 mr-2" />
                    View All Activity
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/assets/status">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Device Status
                </CardTitle>
                <CardDescription>Monitor device health and availability</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/assets/reports">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Condition Reports
                </CardTitle>
                <CardDescription>View and manage device condition logs</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {isSupervisor && (
            <Link href="/assets/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    AMS Settings
                  </CardTitle>
                  <CardDescription>Configure asset management preferences</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}