"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import {
  Package,
  ArrowRight,
  FileText,
  History,
  Laptop,
  Smartphone,
  Printer,
  Tablet,
  Monitor,
  Headphones,
  CheckCircle2,
  XCircle,
} from "lucide-react"

export default function AMSDevicesPage() {
  const user = getCurrentUser()
  const router = useRouter()

  if (!user) return null

  // Available devices data
  const availableDevices = [
    { id: "MAC-001", name: "MacBook", type: "Laptop", status: "Available", icon: Laptop },
    { id: "IMAC-001", name: "iMac", type: "Desktop", status: "Available", icon: Monitor },
    { id: "IPAD-001", name: "iPad", type: "Tablet", status: "Available", icon: Tablet },
    { id: "IPAD-002", name: "iPad", type: "Tablet", status: "Borrowed", icon: Tablet },
    { id: "SAMS-001", name: "Samsung A05", type: "Phone", status: "Available", icon: Smartphone },
    { id: "IPH-001", name: "iPhone 11", type: "Phone", status: "Available", icon: Smartphone },
    { id: "HP-001", name: "Headphones", type: "Audio", status: "Available", icon: Headphones },
    { id: "HP-002", name: "Headphones", type: "Audio", status: "Available", icon: Headphones },
    { id: "HP-003", name: "Headphones", type: "Audio", status: "Borrowed", icon: Headphones },
    { id: "HP-004", name: "Headphones", type: "Audio", status: "Available", icon: Headphones },
    { id: "HP-005", name: "Headphones", type: "Audio", status: "Available", icon: Headphones },
    { id: "HP-006", name: "Headphones", type: "Audio", status: "Available", icon: Headphones },
    { id: "HP-007", name: "Headphones", type: "Audio", status: "Available", icon: Headphones },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Available":
        return <Badge className="bg-green-100 text-green-800">Available</Badge>
      case "Borrowed":
        return <Badge className="bg-red-100 text-red-800">Borrowed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleCardClick = (action: string) => {
    // Navigate to respective page or section based on the action
    switch (action) {
      case "borrow":
        router.push("/ams-devices/borrow")
        break
      case "return":
        router.push("/ams-devices/return")
        break
      case "reports":
        router.push("/ams-devices/reports")
        break
      case "history":
        router.push("/ams-devices/history")
        break
      default:
        break
    }
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Device Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your devices and view device information
          </p>
        </div>

        {/* Device Management Cards Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {/* Borrow Device Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Borrow Device</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Request to borrow a device from the IT department
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("borrow")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Borrow Device
              </Button>
            </CardContent>
          </Card>

          {/* Return Device Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <ArrowRight className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Return Device</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Return your currently assigned device
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("return")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Return Device
              </Button>
            </CardContent>
          </Card>

          {/* Device Condition Reports Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Device Condition Reports</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Submit and view device condition reports
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("reports")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                View Reports
              </Button>
            </CardContent>
          </Card>

          {/* Device History Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <History className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Device History</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  View the history of your device assignments
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("history")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                View History
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Available Devices Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Available Devices
            </CardTitle>
            <CardDescription>Current inventory of company devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {availableDevices.map((device) => {
                const IconComponent = device.icon
                return (
                  <Card key={device.id} className="group hover:shadow-md transition-all duration-300 hover:scale-105">
                    <CardContent className="p-4 text-center">
                      <div className="mb-3">
                        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <h4 className="font-semibold text-navy text-sm">{device.name}</h4>
                        <p className="text-xs text-muted-foreground">{device.type}</p>
                      </div>
                      <div className="space-y-2">
                        {getStatusBadge(device.status)}
                        <div className="flex gap-1">
                          {device.status === "Available" ? (
                            <Button 
                              size="sm" 
                              className="flex-1 text-xs gradient-primary text-white hover:opacity-90"
                              onClick={() => router.push("/ams-devices/borrow")}
                            >
                              Borrow
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 text-xs"
                              disabled
                            >
                              Borrowed
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs"
                            onClick={() => {/* View details logic */}}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>

      </div>
    </AMSDashboardLayout>
  )
}