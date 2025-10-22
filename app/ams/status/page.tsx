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
  ArrowLeft,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Monitor,
  Smartphone,
  Laptop,
  Printer,
  Headphones,
} from "lucide-react"

export default function DeviceStatusPage() {
  const user = getCurrentUser()

  if (!user) return null

  // Mock device status data
  const deviceStatus = {
    total: 156,
    available: 89,
    borrowed: 45,
    pending: 12,
    damaged: 10,
  }

  const deviceHealth = [
    { name: "Excellent", count: 45, percentage: 28.8, color: "bg-green-500" },
    { name: "Good", count: 67, percentage: 42.9, color: "bg-blue-500" },
    { name: "Fair", count: 34, percentage: 21.8, color: "bg-yellow-500" },
    { name: "Poor", count: 7, percentage: 4.5, color: "bg-orange-500" },
    { name: "Damaged", count: 3, percentage: 1.9, color: "bg-red-500" },
  ]

  const categoryStatus = [
    { name: "Laptops", total: 45, available: 28, borrowed: 15, pending: 2, icon: Laptop },
    { name: "Monitors", total: 32, available: 18, borrowed: 12, pending: 2, icon: Monitor },
    { name: "Mobile Devices", total: 28, available: 15, borrowed: 10, pending: 3, icon: Smartphone },
    { name: "Printers", total: 15, available: 8, borrowed: 5, pending: 2, icon: Printer },
    { name: "Accessories", total: 36, available: 20, borrowed: 13, pending: 3, icon: Headphones },
  ]

  const maintenanceSchedule = [
    { device: "MacBook Pro 16\"", lastMaintenance: "2024-11-15", nextDue: "2025-02-15", status: "good" },
    { device: "Dell Monitor 24\"", lastMaintenance: "2024-10-20", nextDue: "2025-01-20", status: "good" },
    { device: "HP LaserJet Pro", lastMaintenance: "2024-09-15", nextDue: "2024-12-15", status: "due" },
    { device: "iPad Pro 12.9\"", lastMaintenance: "2024-12-01", nextDue: "2025-03-01", status: "good" },
  ]

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      good: { color: "bg-green-100 text-green-800", icon: CheckCircle2 },
      due: { color: "bg-amber-100 text-amber-800", icon: Clock },
      overdue: { color: "bg-red-100 text-red-800", icon: AlertCircle },
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
              <h1 className="text-3xl font-bold">Device Status</h1>
              <p className="text-muted-foreground">Monitor device health and availability</p>
            </div>
          </div>
        </div>

        {/* Overall Status */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-navy">{deviceStatus.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered assets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{deviceStatus.available}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready to borrow</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Borrowed</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{deviceStatus.borrowed}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently in use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{deviceStatus.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Damaged</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{deviceStatus.damaged}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs repair</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Device Health Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Device Health Distribution</CardTitle>
              <CardDescription>Overall condition of all devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deviceHealth.map((health, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{health.name}</span>
                      <span className="text-muted-foreground">{health.count} devices ({health.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${health.color}`} 
                        style={{ width: `${health.percentage}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Category Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status by Category</CardTitle>
              <CardDescription>Device availability by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryStatus.map((category, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <category.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <span className="text-muted-foreground">{category.total} total</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="font-medium text-green-700">{category.available}</div>
                        <div className="text-green-600">Available</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="font-medium text-blue-700">{category.borrowed}</div>
                        <div className="text-blue-600">Borrowed</div>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded">
                        <div className="font-medium text-amber-700">{category.pending}</div>
                        <div className="text-amber-600">Pending</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Maintenance Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Schedule</CardTitle>
            <CardDescription>Upcoming and overdue maintenance tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maintenanceSchedule.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.device}</p>
                    <p className="text-xs text-muted-foreground">
                      Last: {item.lastMaintenance} • Next: {item.nextDue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <Button size="sm" variant="outline">
                      Schedule
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Device Utilization Trends</CardTitle>
            <CardDescription>Usage patterns over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Utilization chart would be displayed here</p>
                <p className="text-sm text-muted-foreground">Integration with charting library needed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}