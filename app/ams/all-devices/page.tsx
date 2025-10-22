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
  Search,
  Filter,
  Package,
  Monitor,
  Smartphone,
  Laptop,
  Printer,
  Headphones,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
} from "lucide-react"

export default function AllDevicesPage() {
  const user = getCurrentUser()

  if (!user) return null

  // Mock device data
  const devices = [
    {
      id: "DEV001",
      name: "MacBook Pro 16\"",
      category: "Laptop",
      brand: "Apple",
      model: "MacBook Pro 16-inch 2023",
      status: "available",
      condition: "excellent",
      location: "IT Department",
      assignedTo: null,
      lastMaintenance: "2024-11-15",
      purchaseDate: "2024-01-15",
      warranty: "2027-01-15",
    },
    {
      id: "DEV002",
      name: "Dell Monitor 24\"",
      category: "Monitor",
      brand: "Dell",
      model: "UltraSharp U2422H",
      status: "borrowed",
      condition: "good",
      location: "Engineering",
      assignedTo: "John Smith",
      lastMaintenance: "2024-10-20",
      purchaseDate: "2023-08-10",
      warranty: "2026-08-10",
    },
    {
      id: "DEV003",
      name: "iPad Pro 12.9\"",
      category: "Mobile Device",
      brand: "Apple",
      model: "iPad Pro 12.9-inch 6th Gen",
      status: "pending",
      condition: "excellent",
      location: "Marketing",
      assignedTo: null,
      lastMaintenance: "2024-12-01",
      purchaseDate: "2024-03-20",
      warranty: "2027-03-20",
    },
    {
      id: "DEV004",
      name: "HP LaserJet Pro",
      category: "Printer",
      brand: "HP",
      model: "LaserJet Pro M404dn",
      status: "damaged",
      condition: "needs_repair",
      location: "Office Floor 2",
      assignedTo: null,
      lastMaintenance: "2024-09-15",
      purchaseDate: "2022-11-30",
      warranty: "2025-11-30",
    },
    {
      id: "DEV005",
      name: "Sony WH-1000XM4",
      category: "Accessory",
      brand: "Sony",
      model: "WH-1000XM4",
      status: "available",
      condition: "good",
      location: "IT Department",
      assignedTo: null,
      lastMaintenance: "2024-11-20",
      purchaseDate: "2023-12-05",
      warranty: "2026-12-05",
    },
  ]

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { color: "bg-green-100 text-green-800", icon: CheckCircle2 },
      borrowed: { color: "bg-blue-100 text-blue-800", icon: Package },
      pending: { color: "bg-amber-100 text-amber-800", icon: Clock },
      damaged: { color: "bg-red-100 text-red-800", icon: AlertCircle },
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

  const getCategoryIcon = (category: string) => {
    const icons = {
      Laptop: Laptop,
      Monitor: Monitor,
      "Mobile Device": Smartphone,
      Printer: Printer,
      Accessory: Headphones,
    }
    const Icon = icons[category as keyof typeof icons] || Package
    return <Icon className="h-4 w-4" />
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
              <h1 className="text-3xl font-bold">All Devices</h1>
              <p className="text-muted-foreground">Manage and monitor all company assets</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search devices by name, ID, or brand..."
                    className="pl-10"
                  />
                </div>
              </div>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="borrowed">Borrowed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="laptop">Laptops</SelectItem>
                  <SelectItem value="monitor">Monitors</SelectItem>
                  <SelectItem value="mobile">Mobile Devices</SelectItem>
                  <SelectItem value="printer">Printers</SelectItem>
                  <SelectItem value="accessory">Accessories</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Devices Grid */}
        <div className="grid gap-6">
          {devices.map((device) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      {getCategoryIcon(device.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{device.name}</h3>
                        {getStatusBadge(device.status)}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div>
                          <p><span className="font-medium">ID:</span> {device.id}</p>
                          <p><span className="font-medium">Brand:</span> {device.brand}</p>
                          <p><span className="font-medium">Model:</span> {device.model}</p>
                          <p><span className="font-medium">Location:</span> {device.location}</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Condition:</span> {device.condition}</p>
                          <p><span className="font-medium">Last Maintenance:</span> {device.lastMaintenance}</p>
                          <p><span className="font-medium">Warranty:</span> {device.warranty}</p>
                          {device.assignedTo && (
                            <p><span className="font-medium">Assigned to:</span> {device.assignedTo}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-5 of {devices.length} devices
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
