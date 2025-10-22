"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
} from "lucide-react"

export default function ReturnDevicePage() {
  const user = getCurrentUser()

  if (!user) return null

  if (!hasPermission(user, "return_devices")) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
              <p className="text-muted-foreground mb-4">
                You don't have permission to return devices.
              </p>
              <Link href="/assets">
                <Button>Back to Asset Management</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const [formData, setFormData] = useState({
    deviceId: "",
    employeeId: user.employeeId || "",
    returnDate: new Date().toISOString().split('T')[0],
    condition: "",
    notes: "",
    supervisorApproval: false,
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Returning device:", formData)
    alert("Return request submitted successfully!")
  }

  // Mock borrowed devices for current user
  const borrowedDevices = [
    {
      id: "DEV001",
      name: "MacBook Pro 16\"",
      category: "Laptop",
      borrowDate: "2024-11-15",
      expectedReturnDate: "2024-12-15",
      condition: "excellent",
    },
    {
      id: "DEV002",
      name: "Dell Monitor 24\"",
      category: "Monitor",
      borrowDate: "2024-11-20",
      expectedReturnDate: "2024-12-20",
      condition: "good",
    },
  ]

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
              <h1 className="text-3xl font-bold">Return Device</h1>
              <p className="text-muted-foreground">Return a borrowed device to the company</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Device Return
              </CardTitle>
              <CardDescription>
                Fill out the form below to return a borrowed device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Employee Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Employee Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID *</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => handleInputChange("employeeId", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Device Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Device Selection</h3>
                <div className="space-y-2">
                  <Label htmlFor="deviceId">Select Device to Return *</Label>
                  <Select onValueChange={(value) => handleInputChange("deviceId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a device to return" />
                    </SelectTrigger>
                    <SelectContent>
                      {borrowedDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name} ({device.category}) - Borrowed: {device.borrowDate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Return Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Return Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="returnDate">Return Date *</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={formData.returnDate}
                    onChange={(e) => handleInputChange("returnDate", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Device Condition *</Label>
                  <Select onValueChange={(value) => handleInputChange("condition", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select current condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent - No issues</SelectItem>
                      <SelectItem value="good">Good - Minor wear</SelectItem>
                      <SelectItem value="fair">Fair - Some wear but functional</SelectItem>
                      <SelectItem value="poor">Poor - Significant wear</SelectItem>
                      <SelectItem value="damaged">Damaged - Needs repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Return Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any notes about the device condition or return process..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Supervisor Approval */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Supervisor Approval</h3>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Supervisor Approval Required
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          A supervisor must verify the device condition and approve the return before it's processed.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button type="submit" className="gradient-primary">
                  <Save className="h-4 w-4 mr-2" />
                  Submit Return Request
                </Button>
                <Link href="/assets">
                  <Button variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Currently Borrowed Devices */}
        <Card>
          <CardHeader>
            <CardTitle>Your Borrowed Devices</CardTitle>
            <CardDescription>Devices currently borrowed by you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {borrowedDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{device.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {device.category} • Borrowed: {device.borrowDate} • Expected Return: {device.expectedReturnDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      Borrowed
                    </Badge>
                    <Button size="sm" variant="outline">
                      Return
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}