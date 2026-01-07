"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, User, Package, Camera, CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ReturnDevicePage() {
  const user = getCurrentUser()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  if (!user) return null

  // Mock HRMS data - in real implementation, this would come from HRMS API
  const employeeDetails = {
    name: user.name,
    employeeId: `XSP/23/10/003`, // Format: XSP/YY/MM/NNN
    department: "Engineering",
    jobTitle: user.role === "employee" ? "Software Developer" : "Senior Developer",
    email: user.email,
    phone: "+27 12 345 6789"
  }

  // Mock device inventory data
  const deviceTypes = [
    { value: "laptop", label: "Laptop" },
    { value: "phone", label: "Phone" },
    { value: "tablet", label: "Tablet" },
    { value: "monitor", label: "Monitor" },
    { value: "printer", label: "Printer" },
    { value: "headset", label: "Headset" },
    { value: "keyboard", label: "Keyboard" },
    { value: "mouse", label: "Mouse" },
  ]

  const deviceInventory = {
    laptop: [
      { id: "LAP-001", name: "Dell XPS 13", serial: "DLXPS13001", condition: "Good" },
      { id: "LAP-002", name: "MacBook Pro 14", serial: "MBP14002", condition: "Good" },
      { id: "LAP-003", name: "HP EliteBook", serial: "HPEB003", condition: "Needs Repair" },
      { id: "LAP-004", name: "Lenovo ThinkPad", serial: "LNTK004", condition: "Good" },
    ],
    phone: [
      { id: "PHN-001", name: "iPhone 13", serial: "IPH13001", condition: "Good" },
      { id: "PHN-002", name: "Samsung Galaxy S21", serial: "SGS21002", condition: "Good" },
      { id: "PHN-003", name: "iPhone 12", serial: "IPH12003", condition: "Good" },
    ],
    tablet: [
      { id: "TAB-001", name: "iPad Pro 12.9", serial: "IPD12001", condition: "Good" },
      { id: "TAB-002", name: "Samsung Galaxy Tab", serial: "SGT002", condition: "Good" },
    ],
    monitor: [
      { id: "MON-001", name: "Dell UltraSharp 27", serial: "DUS27001", condition: "Good" },
      { id: "MON-002", name: "LG 4K Monitor", serial: "LG4K002", condition: "Good" },
    ],
    printer: [
      { id: "PRT-001", name: "HP LaserJet Pro", serial: "HLP001", condition: "Good" },
      { id: "PRT-002", name: "Canon ImageClass", serial: "CIC002", condition: "Needs Repair" },
    ],
    headset: [
      { id: "HS-001", name: "Sony WH-1000XM4", serial: "SONY001", condition: "Good" },
      { id: "HS-002", name: "Bose QuietComfort", serial: "BOSE002", condition: "Good" },
    ],
    keyboard: [
      { id: "KB-001", name: "Logitech MX Keys", serial: "LOGKB001", condition: "Good" },
      { id: "KB-002", name: "Apple Magic Keyboard", serial: "APLKB002", condition: "Good" },
    ],
    mouse: [
      { id: "MS-001", name: "Logitech MX Master 3", serial: "LOGMS001", condition: "Good" },
      { id: "MS-002", name: "Apple Magic Mouse", serial: "APLMS002", condition: "Good" },
    ],
  }

  // Form state
  const [formData, setFormData] = useState({
    employeeId: employeeDetails.employeeId,
    employeeName: employeeDetails.name,
    department: employeeDetails.department,
    jobTitle: employeeDetails.jobTitle,
    deviceType: "",
    deviceName: "",
    serialNumber: "",
    deviceCondition: "",
    notes: "",
    photoFile: null,
  })

  const [selectedDevice, setSelectedDevice] = useState(null)

  const handleDeviceTypeChange = (value) => {
    setFormData({
      ...formData,
      deviceType: value,
      deviceName: "",
      serialNumber: "",
    })
    setSelectedDevice(null)
  }

  const handleDeviceNameChange = (value) => {
    const device = deviceInventory[formData.deviceType]?.find(d => d.id === value)
    setSelectedDevice(device)
    setFormData({
      ...formData,
      deviceName: device?.name || "",
      serialNumber: device?.serial || "",
    })
  }

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        photoFile: file,
      })
    }
  }

  const handleSubmit = async () => {
    // Check if today is a weekend
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      alert('Device returns are not allowed on weekends. Please return the device on a weekday.')
      return
    }

    setIsSubmitting(true)
    
    // Create return request
    const returnRequest = {
      id: `RT-${Date.now()}`,
      employeeId: formData.employeeId,
      employeeName: formData.employeeName,
      department: formData.department,
      jobTitle: formData.jobTitle,
      deviceType: formData.deviceType,
      deviceName: formData.deviceName,
      serialNumber: formData.serialNumber,
      deviceCondition: formData.deviceCondition,
      notes: formData.notes,
      photoFile: formData.photoFile?.name || null,
      status: "Pending Approval",
      submittedAt: new Date().toISOString(),
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Store in localStorage for demo purposes
    const existingRequests = JSON.parse(localStorage.getItem('returnRequests') || '[]')
    existingRequests.push(returnRequest)
    localStorage.setItem('returnRequests', JSON.stringify(existingRequests))
    
    // Show success notification
    alert('Device returned successfully. If there is any change or damage, please submit it via the Device Condition Report.')
    
    setIsSubmitting(false)
    setShowConfirmation(false)
    
    // Reset form
    setFormData({
      employeeId: employeeDetails.employeeId,
      employeeName: employeeDetails.name,
      department: employeeDetails.department,
      jobTitle: employeeDetails.jobTitle,
      deviceType: "",
      deviceName: "",
      serialNumber: "",
      deviceCondition: "",
      notes: "",
      photoFile: null,
    })
    setSelectedDevice(null)
  }

  const isFormValid = formData.deviceType && formData.deviceName

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/ams-devices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Device Management
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-navy mb-2">Return Device</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Return your borrowed device. If there are any changes or damages, report them via the Device Condition Report.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Employee Information */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <User className="h-5 w-5" />
                  Employee Information
                </CardTitle>
                <CardDescription>Your details (auto-filled from HRMS)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      value={formData.employeeId}
                      readOnly
                      className="bg-muted font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeName">Employee Name</Label>
                    <Input
                      id="employeeName"
                      value={formData.employeeName}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      value={formData.jobTitle}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Information */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Package className="h-5 w-5" />
                  Device Information
                </CardTitle>
                <CardDescription>Select the device you want to return</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Device Type *</Label>
                    <Select value={formData.deviceType} onValueChange={handleDeviceTypeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select device type" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deviceName">Device Name / Model *</Label>
                    <Select 
                      value={formData.deviceName} 
                      onValueChange={handleDeviceNameChange}
                      disabled={!formData.deviceType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device model" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceInventory[formData.deviceType]?.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Device Pictures</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="flex-1"
                    />
                    <Camera className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {formData.photoFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {formData.photoFile.name}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Submission Section */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Submit Return Request
                </CardTitle>
                <CardDescription>Review your information before submitting</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="w-full gradient-primary text-white hover:opacity-90 transition-opacity h-12 text-lg" 
                      disabled={!isFormValid || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Clock className="h-5 w-5 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Package className="h-5 w-5 mr-2" />
                          Return Device
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Return Request</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to submit this return request? Your supervisor will review and approve it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmit}>
                        Submit Request
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                {!isFormValid && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Please fill in all required fields (*) to submit your request
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}