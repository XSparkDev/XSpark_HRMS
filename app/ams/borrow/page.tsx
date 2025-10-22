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
  Calendar,
  Clock,
  User,
  Save,
  X,
} from "lucide-react"

export default function BorrowDevicePage() {
  const user = getCurrentUser()

  if (!user) return null

  if (!hasPermission(user, "borrow_devices")) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
              <p className="text-muted-foreground mb-4">
                You don't have permission to borrow devices.
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
    employeeName: user.name,
    department: "Engineering", // This would come from user data
    position: "Software Developer", // This would come from user data
    borrowDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: "",
    purpose: "",
    notes: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Borrowing device:", formData)
    alert("Borrow request submitted successfully!")
  }

  // Mock available devices
  const availableDevices = [
    { id: "DEV001", name: "MacBook Pro 16\"", category: "Laptop", location: "IT Department" },
    { id: "DEV002", name: "Dell Monitor 24\"", category: "Monitor", location: "Engineering" },
    { id: "DEV003", name: "iPad Pro 12.9\"", category: "Mobile Device", location: "Marketing" },
    { id: "DEV004", name: "Sony WH-1000XM4", category: "Accessory", location: "IT Department" },
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
              <h1 className="text-3xl font-bold">Borrow Device</h1>
              <p className="text-muted-foreground">Request to borrow a company device</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Borrow Request
              </CardTitle>
              <CardDescription>
                Fill out the form below to request borrowing a device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Employee Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Employee Information</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee ID *</Label>
                    <Input
                      id="employeeId"
                      value={formData.employeeId}
                      onChange={(e) => handleInputChange("employeeId", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeName">Employee Name *</Label>
                    <Input
                      id="employeeName"
                      value={formData.employeeName}
                      onChange={(e) => handleInputChange("employeeName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => handleInputChange("department", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position *</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => handleInputChange("position", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Device Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Device Selection</h3>
                <div className="space-y-2">
                  <Label htmlFor="deviceId">Select Device *</Label>
                  <Select onValueChange={(value) => handleInputChange("deviceId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a device to borrow" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name} ({device.category}) - {device.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Borrow Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Borrow Details</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="borrowDate">Borrow Date *</Label>
                    <Input
                      id="borrowDate"
                      type="date"
                      value={formData.borrowDate}
                      onChange={(e) => handleInputChange("borrowDate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expectedReturnDate">Expected Return Date *</Label>
                    <Input
                      id="expectedReturnDate"
                      type="date"
                      value={formData.expectedReturnDate}
                      onChange={(e) => handleInputChange("expectedReturnDate", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose *</Label>
                  <Select onValueChange={(value) => handleInputChange("purpose", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Work-related tasks</SelectItem>
                      <SelectItem value="meeting">Meeting/presentation</SelectItem>
                      <SelectItem value="training">Training session</SelectItem>
                      <SelectItem value="project">Project work</SelectItem>
                      <SelectItem value="travel">Business travel</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information about the borrow request..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Terms and Conditions</h3>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>• You are responsible for the device while it's in your possession</li>
                      <li>• Report any damage or issues immediately to IT department</li>
                      <li>• Return the device on or before the expected return date</li>
                      <li>• Do not install unauthorized software or modify device settings</li>
                      <li>• Keep the device secure and do not leave it unattended</li>
                      <li>• Failure to return on time may result in disciplinary action</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button type="submit" className="gradient-primary">
                  <Save className="h-4 w-4 mr-2" />
                  Submit Borrow Request
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

        {/* Available Devices Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Available Devices</CardTitle>
            <CardDescription>Currently available devices for borrowing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {availableDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{device.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {device.category} • {device.location}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Available
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}