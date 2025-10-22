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
  Save,
  X,
} from "lucide-react"

export default function AddDevicePage() {
  const user = getCurrentUser()

  if (!user) return null

  if (!hasPermission(user, "add_devices")) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
              <p className="text-muted-foreground mb-4">
                You don't have permission to add devices. Only supervisors can perform this action.
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
    name: "",
    category: "",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    purchasePrice: "",
    warranty: "",
    location: "",
    condition: "",
    description: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Adding device:", formData)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/assets">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to AMS
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Add New Device</h1>
              <p className="text-muted-foreground">Register a new asset in the system</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Device Information
              </CardTitle>
              <CardDescription>
                Enter the details of the new device to be added to the asset management system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., MacBook Pro 16\""
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                      <SelectItem value="mobile">Mobile Device</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="accessory">Accessory</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    placeholder="e.g., Apple, Dell, HP"
                    value={formData.brand}
                    onChange={(e) => handleInputChange("brand", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    placeholder="e.g., MacBook Pro 16-inch 2023"
                    value={formData.model}
                    onChange={(e) => handleInputChange("model", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number *</Label>
                  <Input
                    id="serialNumber"
                    placeholder="Device serial number"
                    value={formData.serialNumber}
                    onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select onValueChange={(value) => handleInputChange("location", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it-department">IT Department</SelectItem>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="hr">HR Department</SelectItem>
                      <SelectItem value="office-floor-1">Office Floor 1</SelectItem>
                      <SelectItem value="office-floor-2">Office Floor 2</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Purchase Information</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date *</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => handleInputChange("purchaseDate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      placeholder="0.00"
                      value={formData.purchasePrice}
                      onChange={(e) => handleInputChange("purchasePrice", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warranty">Warranty Expiry</Label>
                    <Input
                      id="warranty"
                      type="date"
                      value={formData.warranty}
                      onChange={(e) => handleInputChange("warranty", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Device Condition</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="condition">Initial Condition *</Label>
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
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Additional notes about the device..."
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button type="submit" className="gradient-primary">
                  <Save className="h-4 w-4 mr-2" />
                  Add Device
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
      </div>
    </DashboardLayout>
  )
}
