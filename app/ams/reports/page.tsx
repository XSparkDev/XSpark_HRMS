"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Save,
  X,
} from "lucide-react"

export default function ConditionReportsPage() {
  const user = getCurrentUser()

  if (!user) return null

  const isSupervisor = user.role === "junior_hr" || user.role === "hr_manager" || user.role === "super_admin"

  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    deviceId: "",
    deviceName: "",
    condition: "",
    issues: "",
    maintenance: "",
    reportedBy: user.name,
    reportDate: new Date().toISOString().split('T')[0],
    priority: "",
    notes: "",
  })

  // Mock condition reports data
  const conditionReports = [
    {
      id: 1,
      deviceId: "DEV001",
      deviceName: "MacBook Pro 16\"",
      condition: "excellent",
      issues: "None",
      maintenance: "Regular cleaning",
      reportedBy: "John Smith",
      reportDate: "2024-12-15",
      priority: "low",
      status: "resolved",
    },
    {
      id: 2,
      deviceId: "DEV002",
      deviceName: "Dell Monitor 24\"",
      condition: "good",
      issues: "Minor screen flickering",
      maintenance: "Screen calibration",
      reportedBy: "Sarah Johnson",
      reportDate: "2024-12-14",
      priority: "medium",
      status: "in_progress",
    },
    {
      id: 3,
      deviceId: "DEV003",
      deviceName: "HP LaserJet Pro",
      condition: "poor",
      issues: "Paper jam issues, slow printing",
      maintenance: "Full service required",
      reportedBy: "Mike Chen",
      reportDate: "2024-12-13",
      priority: "high",
      status: "pending",
    },
    {
      id: 4,
      deviceId: "DEV004",
      deviceName: "iPad Pro 12.9\"",
      condition: "excellent",
      issues: "None",
      maintenance: "Software update",
      reportedBy: "Emma Davis",
      reportDate: "2024-12-12",
      priority: "low",
      status: "resolved",
    },
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Adding condition report:", formData)
    setShowAddForm(false)
    // Reset form
    setFormData({
      deviceId: "",
      deviceName: "",
      condition: "",
      issues: "",
      maintenance: "",
      reportedBy: user.name,
      reportDate: new Date().toISOString().split('T')[0],
      priority: "",
      notes: "",
    })
  }

  const getConditionBadge = (condition: string) => {
    const conditionConfig = {
      excellent: { color: "bg-green-100 text-green-800" },
      good: { color: "bg-blue-100 text-blue-800" },
      fair: { color: "bg-yellow-100 text-yellow-800" },
      poor: { color: "bg-orange-100 text-orange-800" },
      damaged: { color: "bg-red-100 text-red-800" },
    }
    const config = conditionConfig[condition as keyof typeof conditionConfig]
    return (
      <Badge className={config.color}>
        {condition.charAt(0).toUpperCase() + condition.slice(1)}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { color: "bg-green-100 text-green-800" },
      medium: { color: "bg-yellow-100 text-yellow-800" },
      high: { color: "bg-red-100 text-red-800" },
    }
    const config = priorityConfig[priority as keyof typeof priorityConfig]
    return (
      <Badge className={config.color}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      resolved: { color: "bg-green-100 text-green-800" },
      in_progress: { color: "bg-blue-100 text-blue-800" },
      pending: { color: "bg-amber-100 text-amber-800" },
    }
    const config = statusConfig[status as keyof typeof statusConfig]
    return (
      <Badge className={config.color}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
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
              <h1 className="text-3xl font-bold">Condition Reports</h1>
              <p className="text-muted-foreground">View and manage device condition reports</p>
            </div>
          </div>
          {hasPermission(user, "manage_condition_reports") && (
            <Button onClick={() => setShowAddForm(true)} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Report
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reports by device name or ID..."
                    className="pl-10"
                  />
                </div>
              </div>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conditions</SelectItem>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Report Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Add Condition Report
              </CardTitle>
              <CardDescription>
                Report the current condition of a device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="deviceId">Device ID *</Label>
                    <Input
                      id="deviceId"
                      placeholder="e.g., DEV001"
                      value={formData.deviceId}
                      onChange={(e) => handleInputChange("deviceId", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceName">Device Name *</Label>
                    <Input
                      id="deviceName"
                      placeholder="e.g., MacBook Pro 16\""
                      value={formData.deviceName}
                      onChange={(e) => handleInputChange("deviceName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition">Condition *</Label>
                    <Select onValueChange={(value) => handleInputChange("condition", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority *</Label>
                    <Select onValueChange={(value) => handleInputChange("priority", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issues">Issues Found</Label>
                  <Textarea
                    id="issues"
                    placeholder="Describe any issues or problems..."
                    value={formData.issues}
                    onChange={(e) => handleInputChange("issues", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maintenance">Maintenance Required</Label>
                  <Textarea
                    id="maintenance"
                    placeholder="Describe maintenance tasks needed..."
                    value={formData.maintenance}
                    onChange={(e) => handleInputChange("maintenance", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex gap-4">
                  <Button type="submit" className="gradient-primary">
                    <Save className="h-4 w-4 mr-2" />
                    Save Report
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Condition Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Device Condition Reports</CardTitle>
            <CardDescription>Recent condition assessments and maintenance reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conditionReports.map((report) => (
                <div key={report.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{report.deviceName}</h4>
                      {getConditionBadge(report.condition)}
                      {getPriorityBadge(report.priority)}
                      {getStatusBadge(report.status)}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <p><span className="font-medium">Device ID:</span> {report.deviceId}</p>
                        <p><span className="font-medium">Reported by:</span> {report.reportedBy}</p>
                        <p><span className="font-medium">Date:</span> {report.reportDate}</p>
                      </div>
                      <div>
                        <p><span className="font-medium">Issues:</span> {report.issues}</p>
                        <p><span className="font-medium">Maintenance:</span> {report.maintenance}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    {hasPermission(user, "manage_condition_reports") && (
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-navy">{conditionReports.length}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <FileText className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {conditionReports.filter(r => r.status === 'resolved').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {conditionReports.filter(r => r.status === 'in_progress').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Being worked on</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <FileText className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {conditionReports.filter(r => r.priority === 'high').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Need attention</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}