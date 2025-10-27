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
import { ArrowLeft, Package, Calendar, User, CheckCircle2, Building2, Mail, Phone } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function BorrowDevicePage() {
  const user = getCurrentUser()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  if (!user) return null

  // Mock HRMS data - in real implementation, this would come from HRMS API
  const employeeDetails = {
    name: user.name,
    employeeId: `XSP/23/10/003`, // Format: XSP/YY/MM/NNN (third employee hired in October 2023)
    department: "Engineering",
    position: user.role === "employee" ? "Software Developer" : "Senior Developer",
    supervisorName: "John Smith",
    contactEmail: user.email,
    phone: "+27 12 345 6789"
  }

  // Mock device inventory data
  const deviceTypes = [
    { value: "laptop", label: "Laptop" },
    { value: "phone", label: "Phone" },
    { value: "tablet", label: "Tablet" },
    { value: "monitor", label: "Monitor" },
    { value: "printer", label: "Printer" },
  ]

  const deviceInventory = {
    laptop: [
      { id: "LAP-001", name: "Dell XPS 13", tag: "LAP-001", serial: "DLXPS13001", condition: "Good", available: true },
      { id: "LAP-002", name: "MacBook Pro 14", tag: "LAP-002", serial: "MBP14002", condition: "Good", available: true },
      { id: "LAP-003", name: "HP EliteBook", tag: "LAP-003", serial: "HPEB003", condition: "Needs Repair", available: false },
      { id: "LAP-004", name: "Lenovo ThinkPad", tag: "LAP-004", serial: "LNTK004", condition: "Good", available: true },
    ],
    phone: [
      { id: "PHN-001", name: "iPhone 13", tag: "PHN-001", serial: "IPH13001", condition: "Good", available: true },
      { id: "PHN-002", name: "Samsung Galaxy S21", tag: "PHN-002", serial: "SGS21002", condition: "Good", available: true },
      { id: "PHN-003", name: "iPhone 12", tag: "PHN-003", serial: "IPH12003", condition: "Fair", available: true },
    ],
    tablet: [
      { id: "TAB-001", name: "iPad Pro 12.9", tag: "TAB-001", serial: "IPD12001", condition: "Good", available: true },
      { id: "TAB-002", name: "Samsung Galaxy Tab", tag: "TAB-002", serial: "SGT002", condition: "Good", available: true },
    ],
    monitor: [
      { id: "MON-001", name: "Dell UltraSharp 27", tag: "MON-001", serial: "DUS27001", condition: "Good", available: true },
      { id: "MON-002", name: "LG 4K Monitor", tag: "MON-002", serial: "LG4K002", condition: "Good", available: true },
    ],
    printer: [
      { id: "PRT-001", name: "HP LaserJet Pro", tag: "PRT-001", serial: "HLP001", condition: "Good", available: true },
      { id: "PRT-002", name: "Canon ImageClass", tag: "PRT-002", serial: "CIC002", condition: "Needs Repair", available: false },
    ],
  }

  // Form state
  const [formData, setFormData] = useState({
    employeeName: employeeDetails.name,
    employeeId: employeeDetails.employeeId,
    department: employeeDetails.department,
    position: employeeDetails.position,
    supervisorName: employeeDetails.supervisorName,
    contactEmail: employeeDetails.contactEmail,
    phone: employeeDetails.phone,
    deviceType: "",
    deviceName: "",
    assetTag: "",
    serialNumber: "",
    availabilityStatus: "",
    deviceCondition: "",
    borrowDate: new Date().toISOString().split('T')[0],
    returnDate: "",
    purpose: "",
    remarks: "",
  })

  const [selectedDevice, setSelectedDevice] = useState(null)

  const handleDeviceTypeChange = (value) => {
    setFormData({
      ...formData,
      deviceType: value,
      deviceName: "",
      assetTag: "",
      serialNumber: "",
      availabilityStatus: "",
      deviceCondition: "",
    })
    setSelectedDevice(null)
  }

  const handleDeviceNameChange = (value) => {
    const device = deviceInventory[formData.deviceType]?.find(d => d.id === value)
    setSelectedDevice(device)
    setFormData({
      ...formData,
      deviceName: device?.name || "",
      assetTag: device?.tag || "",
      serialNumber: device?.serial || "",
      availabilityStatus: device?.available ? "Available" : "Unavailable",
      deviceCondition: device?.condition || "",
    })
  }

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    // Create borrow request with status = "Pending Approval"
    const borrowRequest = {
      id: `BR-${Date.now()}`,
      employeeId: formData.employeeId,
      employeeName: formData.employeeName,
      department: formData.department,
      supervisorName: formData.supervisorName,
      deviceType: formData.deviceType,
      deviceName: formData.deviceName,
      assetTag: formData.assetTag,
      serialNumber: formData.serialNumber,
      borrowDate: formData.borrowDate,
      returnDate: formData.returnDate,
      purpose: formData.purpose,
      remarks: formData.remarks,
      status: "Pending Approval",
      submittedAt: new Date().toISOString(),
    }

    // Simulate API call to save borrow request
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Store in localStorage for demo purposes (in real app, this would go to database)
    const existingRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]')
    existingRequests.push(borrowRequest)
    localStorage.setItem('borrowRequests', JSON.stringify(existingRequests))
    
    // Show success notification
    alert(`Request submitted successfully. Status: Pending supervisor approval.`)
    
    setIsSubmitting(false)
    setShowConfirmation(false)
    
    // Reset form
    setFormData({
      employeeName: employeeDetails.name,
      employeeId: employeeDetails.employeeId,
      department: employeeDetails.department,
      position: employeeDetails.position,
      supervisorName: employeeDetails.supervisorName,
      contactEmail: employeeDetails.contactEmail,
      phone: employeeDetails.phone,
      deviceType: "",
      deviceName: "",
      assetTag: "",
      serialNumber: "",
      availabilityStatus: "",
      deviceCondition: "",
      borrowDate: new Date().toISOString().split('T')[0],
      returnDate: "",
      purpose: "",
      remarks: "",
    })
    setSelectedDevice(null)
    
    // Redirect to supervisor page (pending approvals list)
    router.push('/ams-supervisor/pending-approvals')
  }

  const isFormValid = formData.deviceType && formData.deviceName && formData.returnDate && formData.purpose

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
        <div>
          <h1 className="text-3xl font-bold text-navy">Borrow Device</h1>
          <p className="text-muted-foreground mt-2">
            Submit a request to borrow a company device. Your supervisor will review and approve it.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Employee Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Employee Details
                </CardTitle>
                <CardDescription>Your information from HRMS (auto-filled)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeName">Employee Name</Label>
                    <Input
                      id="employeeName"
                      value={formData.employeeName}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      value={formData.employeeId}
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
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supervisorName">Supervisor Name</Label>
                    <Input
                      id="supervisorName"
                      value={formData.supervisorName}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      value={formData.contactEmail}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Selection Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Device Selection
                </CardTitle>
                <CardDescription>Select the device you want to borrow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Device Type</Label>
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
                    <Label htmlFor="deviceName">Device Name / Model</Label>
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

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assetTag">Asset Tag / ID</Label>
                    <Input
                      id="assetTag"
                      value={formData.assetTag}
                      readOnly
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availabilityStatus">Availability Status</Label>
                    <Input
                      id="availabilityStatus"
                      value={formData.availabilityStatus}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deviceCondition">Device Condition</Label>
                  <Input
                    id="deviceCondition"
                    value={formData.deviceCondition}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Borrowing Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Borrowing Details
                </CardTitle>
                <CardDescription>Provide details about your borrowing request</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="borrowDate">Borrow Date</Label>
                    <Input
                      id="borrowDate"
                      type="date"
                      value={formData.borrowDate}
                      onChange={(e) => handleInputChange("borrowDate", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="returnDate">Expected Return Date *</Label>
                    <Input
                      id="returnDate"
                      type="date"
                      value={formData.returnDate}
                      onChange={(e) => handleInputChange("returnDate", e.target.value)}
                      min={formData.borrowDate}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose of Borrowing *</Label>
                  <Textarea
                    id="purpose"
                    placeholder="e.g., Client demo laptop, Remote work setup, etc."
                    value={formData.purpose}
                    onChange={(e) => handleInputChange("purpose", e.target.value)}
                    required
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks (Optional)</Label>
                  <Textarea
                    id="remarks"
                    placeholder="Additional notes or special requirements..."
                    value={formData.remarks}
                    onChange={(e) => handleInputChange("remarks", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Request Summary Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Request Summary
                </CardTitle>
                <CardDescription>Review your borrowing request</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.deviceName ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Employee:</span>
                        <span className="text-sm font-medium">{formData.employeeName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Employee ID:</span>
                        <span className="text-sm font-medium">{formData.employeeId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Device:</span>
                        <span className="text-sm font-medium">{formData.deviceName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Asset Tag:</span>
                        <span className="text-sm font-medium">{formData.assetTag}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Borrow Date:</span>
                        <span className="text-sm font-medium">{formData.borrowDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Return Date:</span>
                        <span className="text-sm font-medium">{formData.returnDate || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Supervisor:</span>
                        <span className="text-sm font-medium">{formData.supervisorName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant="secondary">Pending Approval</Badge>
                      </div>
                    </div>

                    <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          className="w-full gradient-primary text-white hover:opacity-90 transition-opacity" 
                          disabled={!isFormValid || isSubmitting}
                        >
                          {isSubmitting ? "Submitting..." : "Borrow Device"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Borrow Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to submit this borrowing request? Your supervisor will review and approve it.
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
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Please fill in all required fields to submit your request
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Select a device to see request summary
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}