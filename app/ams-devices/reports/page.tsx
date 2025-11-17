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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, Search, AlertTriangle, CheckCircle2, Clock, Camera, Upload, FileText, Calendar, User, Package } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, ChangeEvent } from "react"

type DeviceType =
  | "laptop"
  | "phone"
  | "tablet"
  | "monitor"
  | "printer"
  | "headset"
  | "keyboard"
  | "mouse"

interface DeviceRecord {
  id: string
  name: string
  serial: string
  department: string
  assignedTo: string
}

type DeviceInventory = Record<DeviceType, DeviceRecord[]>

type DeviceConditionStatus = "Pending" | "Reviewed" | "Resolved"
type DeviceCondition = "Good" | "Minor Damage" | "Major Damage" | "Needs Repair" | ""

interface DeviceConditionFormState {
  deviceType: DeviceType | ""
  deviceName: string
  serialNumber: string
  department: string
  assignedEmployee: string
  deviceCondition: DeviceCondition
  reportedIssues: string
  photos: File[] | null
  status: DeviceConditionStatus
}

interface ConditionReportRecord {
  id: string
  deviceType: DeviceType | ""
  deviceName: string
  serialNumber: string
  department: string
  assignedEmployee: string
  deviceCondition: DeviceCondition
  reportedIssues: string
  photos: string[]
  status: DeviceConditionStatus
  reportedBy: string
  reportedAt: string
}

export default function DeviceConditionReportPage() {
  const user = getCurrentUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [conditionHistory, setConditionHistory] = useState<ConditionReportRecord[]>([])

  if (!user) return null

  // Mock device inventory data
  const deviceTypes: { value: DeviceType; label: string }[] = [
    { value: "laptop", label: "Laptop" },
    { value: "phone", label: "Phone" },
    { value: "tablet", label: "Tablet" },
    { value: "monitor", label: "Monitor" },
    { value: "printer", label: "Printer" },
    { value: "headset", label: "Headset" },
    { value: "keyboard", label: "Keyboard" },
    { value: "mouse", label: "Mouse" },
  ]

  const deviceInventory: DeviceInventory = {
    laptop: [
      { id: "LAP-001", name: "Dell XPS 13", serial: "DLXPS13001", department: "Engineering", assignedTo: "John Smith" },
      { id: "LAP-002", name: "MacBook Pro 14", serial: "MBP14002", department: "Design", assignedTo: "Sarah Johnson" },
      { id: "LAP-003", name: "HP EliteBook", serial: "HPEB003", department: "Engineering", assignedTo: "Mike Wilson" },
      { id: "LAP-004", name: "Lenovo ThinkPad", serial: "LNTK004", department: "Marketing", assignedTo: "Lisa Brown" },
    ],
    phone: [
      { id: "PHN-001", name: "iPhone 13", serial: "IPH13001", department: "Engineering", assignedTo: "John Smith" },
      { id: "PHN-002", name: "Samsung Galaxy S21", serial: "SGS21002", department: "Design", assignedTo: "Sarah Johnson" },
      { id: "PHN-003", name: "iPhone 12", serial: "IPH12003", department: "Marketing", assignedTo: "Lisa Brown" },
    ],
    tablet: [
      { id: "TAB-001", name: "iPad Pro 12.9", serial: "IPD12001", department: "Design", assignedTo: "Sarah Johnson" },
      { id: "TAB-002", name: "Samsung Galaxy Tab", serial: "SGT002", department: "Engineering", assignedTo: "Mike Wilson" },
    ],
    monitor: [
      { id: "MON-001", name: "Dell UltraSharp 27", serial: "DUS27001", department: "Engineering", assignedTo: "John Smith" },
      { id: "MON-002", name: "LG 4K Monitor", serial: "LG4K002", department: "Design", assignedTo: "Sarah Johnson" },
    ],
    printer: [
      { id: "PRT-001", name: "HP LaserJet Pro", serial: "HLP001", department: "Engineering", assignedTo: "Mike Wilson" },
      { id: "PRT-002", name: "Canon ImageClass", serial: "CIC002", department: "Marketing", assignedTo: "Lisa Brown" },
    ],
    headset: [
      { id: "HS-001", name: "Sony WH-1000XM4", serial: "SONY001", department: "Engineering", assignedTo: "John Smith" },
      { id: "HS-002", name: "Bose QuietComfort", serial: "BOSE002", department: "Design", assignedTo: "Sarah Johnson" },
    ],
    keyboard: [
      { id: "KB-001", name: "Logitech MX Keys", serial: "LOGKB001", department: "Engineering", assignedTo: "Mike Wilson" },
      { id: "KB-002", name: "Apple Magic Keyboard", serial: "APLKB002", department: "Design", assignedTo: "Sarah Johnson" },
    ],
    mouse: [
      { id: "MS-001", name: "Logitech MX Master 3", serial: "LOGMS001", department: "Engineering", assignedTo: "John Smith" },
      { id: "MS-002", name: "Apple Magic Mouse", serial: "APLMS002", department: "Design", assignedTo: "Sarah Johnson" },
    ],
  }

  // Form state
  const [formData, setFormData] = useState<DeviceConditionFormState>({
    deviceType: "",
    deviceName: "",
    serialNumber: "",
    department: "",
    assignedEmployee: "",
    deviceCondition: "",
    reportedIssues: "",
    photos: null,
    status: "Pending",
  })

  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null)

  // Load condition history
  useEffect(() => {
    const existingReports = JSON.parse(localStorage.getItem('deviceConditionReports') || '[]') as ConditionReportRecord[]
    setConditionHistory(existingReports)
  }, [])

  const handleDeviceTypeChange = (value: DeviceType) => {
    setFormData({
      ...formData,
      deviceType: value,
      deviceName: "",
      serialNumber: "",
      department: "",
      assignedEmployee: "",
    })
    setSelectedDevice(null)
  }

  const handleDeviceNameChange = (value: string) => {
    if (!formData.deviceType) {
      setSelectedDevice(null)
      return
    }
    const inventory = deviceInventory[formData.deviceType]
    const device = inventory?.find((d) => d.id === value) || null
    setSelectedDevice(device)
    setFormData({
      ...formData,
      deviceName: device?.name || "",
      serialNumber: device?.serial || "",
      department: device?.department || "",
      assignedEmployee: device?.assignedTo || "",
    })
  }

  const handleInputChange = <K extends keyof DeviceConditionFormState>(
    field: K,
    value: DeviceConditionFormState[K],
  ) => {
    setFormData({
      ...formData,
      [field]: value,
    })
  }


  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    setFormData({
      ...formData,
      photos: files,
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    // Create condition report
    const conditionReport: ConditionReportRecord = {
      id: `DCR-${Date.now()}`,
      deviceType: formData.deviceType,
      deviceName: formData.deviceName,
      serialNumber: formData.serialNumber,
      department: formData.department,
      assignedEmployee: formData.assignedEmployee,
      deviceCondition: formData.deviceCondition,
      reportedIssues: formData.reportedIssues,
      photos: formData.photos?.map((f) => f.name) || [],
      status: formData.status,
      reportedBy: user.name,
      reportedAt: new Date().toISOString(),
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Store in localStorage for demo purposes
    const existingReports = JSON.parse(localStorage.getItem('deviceConditionReports') || '[]') as ConditionReportRecord[]
    existingReports.push(conditionReport)
    localStorage.setItem('deviceConditionReports', JSON.stringify(existingReports))
    
    // Show success notification
    alert('Device condition report submitted successfully.')
    
    setIsSubmitting(false)
    setShowConfirmation(false)
    
    // Reset form
    setFormData({
      deviceType: "",
      deviceName: "",
      serialNumber: "",
      department: "",
      assignedEmployee: "",
      deviceCondition: "",
      reportedIssues: "",
      photos: null,
      status: "Pending",
    })
    setSelectedDevice(null)
    
    // Refresh history
    setConditionHistory(existingReports)
  }

  const isFormValid = Boolean(formData.deviceType && formData.deviceName && formData.deviceCondition)
  const availableDevices: DeviceRecord[] = formData.deviceType ? deviceInventory[formData.deviceType] : []

  const getConditionBadge = (condition: DeviceCondition) => {
    switch (condition) {
      case 'Good':
        return <Badge variant="default" className="bg-green-100 text-green-800">Good</Badge>
      case 'Minor Damage':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Minor Damage</Badge>
      case 'Major Damage':
        return <Badge variant="destructive">Major Damage</Badge>
      case 'Needs Repair':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800">Needs Repair</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusBadge = (status: DeviceConditionStatus) => {
    switch (status) {
      case 'Resolved':
        return <Badge variant="default" className="bg-green-100 text-green-800">Resolved</Badge>
      case 'Reviewed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Reviewed</Badge>
      case 'Pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }


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
          <h1 className="text-3xl font-bold text-navy mb-2">Device Condition Report</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Report any changes or damages to company devices.
          </p>
        </div>

        <div className="space-y-6">
            {/* Device Selection Section */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Search className="h-5 w-5" />
                  Device Selection
                </CardTitle>
                <CardDescription>Select the device you want to report on</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Device Type *</Label>
                    <Select
                      value={formData.deviceType}
                      onValueChange={(value) => handleDeviceTypeChange(value as DeviceType)}
                    >
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
                        {availableDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label htmlFor="assignedEmployee">Assigned Employee</Label>
                    <Input
                      id="assignedEmployee"
                      value={formData.assignedEmployee}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Condition Details Section */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                  Device Condition Details
                </CardTitle>
                <CardDescription>Report the current condition and any issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceCondition">Device Condition *</Label>
                  <Select
                    value={formData.deviceCondition}
                    onValueChange={(value) => handleInputChange("deviceCondition", value as DeviceCondition)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select device condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Minor Damage">Minor Damage</SelectItem>
                      <SelectItem value="Major Damage">Major Damage</SelectItem>
                      <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportedIssues">Reported Issues / Notes</Label>
                  <Textarea
                    id="reportedIssues"
                    placeholder="Describe any issues, damage, or maintenance needs in detail..."
                    value={formData.reportedIssues}
                    onChange={(e) => handleInputChange("reportedIssues", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photos">Device Pictures</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="photos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="flex-1"
                    />
                    <Camera className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {formData.photos && formData.photos.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Selected {formData.photos.length} file(s): {formData.photos.map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange("status", value as DeviceConditionStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Reviewed">Reviewed</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Submission Section */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <FileText className="h-5 w-5" />
                  Submit Report
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
                          <FileText className="h-5 w-5 mr-2" />
                          Submit Report
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Report Submission</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to submit this device condition report? It will be reviewed by the maintenance team.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmit}>
                        Submit Report
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                {!isFormValid && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Please fill in all required fields (*) to submit your report
                  </p>
                )}
              </CardContent>
            </Card>
        </div>

        {/* Device Condition History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Device Condition History
            </CardTitle>
            <CardDescription>Recent device condition reports and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {conditionHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Device Type</TableHead>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reported By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conditionHistory.map((report) => (
                      <TableRow 
                        key={report.id} 
                        className={report.deviceCondition === 'Major Damage' ? 'bg-red-50' : ''}
                      >
                        <TableCell>{new Date(report.reportedAt).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{report.deviceType}</TableCell>
                        <TableCell className="font-medium">{report.deviceName}</TableCell>
                        <TableCell>{getConditionBadge(report.deviceCondition)}</TableCell>
                        <TableCell className="max-w-xs truncate">{report.reportedIssues}</TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell>{report.reportedBy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-navy mb-2">No Reports Found</h3>
                <p className="text-muted-foreground mb-4">
                  {conditionHistory.length === 0 
                    ? "No device condition reports have been submitted yet."
                    : "No reports match your current filters."
                  }
                </p>
                {conditionHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Submit your first device condition report above.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}