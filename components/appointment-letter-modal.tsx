"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface AppointmentLetterModalProps {
  open: boolean
  onClose: () => void
}

export function AppointmentLetterModal({ open, onClose }: AppointmentLetterModalProps) {
  const [activeTab, setActiveTab] = useState("search")
  const [searchId, setSearchId] = useState("")

  // Manual Input form state
  const [form, setForm] = useState({
    // Personal Information
    firstName: "",
    middleName: "",
    lastName: "",
    jobTitle: "",
    department: "",
    dateOfJoining: "",
    employmentType: "full_time" as "full_time" | "part_time" | "contract" | "internship",
    workLocation: "",
    // Salary
    basicSalary: "",
    allowances: "",
    totalSalary: "",
    // Reporting
    supervisorName: "",
    supervisorDesignation: "",
    // Letter Details
    appointmentDate: "",
    referenceNumber: "",
    notes: "",
  })

  // Auto-calc total salary as number strings
  useEffect(() => {
    const basic = Number(form.basicSalary || 0)
    const allow = Number(form.allowances || 0)
    const total = basic + allow
    setForm(prev => ({ ...prev, totalSalary: total ? String(total) : "" }))
  }, [form.basicSalary, form.allowances])

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleGenerate = () => {
    // For now just log the payload
    // Fields intentionally mirror uniform widths and structure
    console.log("Generate Appointment Letter payload", form)
    onClose()
  }

  const handleSearch = () => {
    console.log("Search employee by ID:", searchId)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Appointment Letter</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="search">Search by ID</TabsTrigger>
            <TabsTrigger value="manual">Manual Input</TabsTrigger>
          </TabsList>

          {/* Tab 1: Search by ID */}
          <TabsContent value="search" className="pt-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center py-8">
              <div className="w-full sm:max-w-sm">
                <Label htmlFor="employeeId">Enter Employee ID</Label>
                <Input id="employeeId" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="mt-2" placeholder="e.g., XSP25/10/402" />
              </div>
              <Button className="mt-2 sm:mt-8" onClick={handleSearch}>Search Employee</Button>
            </div>
          </TabsContent>

          {/* Tab 2: Manual Input */}
          <TabsContent value="manual" className="pt-4">
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" value={form.firstName} onChange={(e) => handleChange("firstName", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input id="middleName" value={form.middleName} onChange={(e) => handleChange("middleName", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" value={form.lastName} onChange={(e) => handleChange("lastName", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="jobTitle">Job Title *</Label>
                    <Input id="jobTitle" value={form.jobTitle} onChange={(e) => handleChange("jobTitle", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Input id="department" value={form.department} onChange={(e) => handleChange("department", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="dateOfJoining">Date of Joining *</Label>
                    <Input id="dateOfJoining" type="date" value={form.dateOfJoining} onChange={(e) => handleChange("dateOfJoining", e.target.value)} required />
                  </div>
                  <div>
                    <Label>Employment Type</Label>
                    <Select value={form.employmentType} onValueChange={(v) => handleChange("employmentType", v)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-Time</SelectItem>
                        <SelectItem value="part_time">Part-Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="workLocation">Work Location *</Label>
                    <Input id="workLocation" value={form.workLocation} onChange={(e) => handleChange("workLocation", e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Salary & Compensation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy">Salary & Compensation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="basicSalary">Basic Salary *</Label>
                    <Input id="basicSalary" type="number" value={form.basicSalary} onChange={(e) => handleChange("basicSalary", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="allowances">Allowances (optional)</Label>
                    <Input id="allowances" type="number" value={form.allowances} onChange={(e) => handleChange("allowances", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="totalSalary">Total Salary</Label>
                    <Input id="totalSalary" value={form.totalSalary} readOnly className="bg-muted" />
                  </div>
                </div>
              </div>

              {/* Reporting Structure */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy">Reporting Structure</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supervisorName">Supervisor / Manager Name *</Label>
                    <Input id="supervisorName" value={form.supervisorName} onChange={(e) => handleChange("supervisorName", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="supervisorDesignation">Designation *</Label>
                    <Input id="supervisorDesignation" value={form.supervisorDesignation} onChange={(e) => handleChange("supervisorDesignation", e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Letter Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy">Letter Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="appointmentDate">Appointment Date *</Label>
                    <Input id="appointmentDate" type="date" value={form.appointmentDate} onChange={(e) => handleChange("appointmentDate", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="referenceNumber">Reference Number (optional)</Label>
                    <Input id="referenceNumber" value={form.referenceNumber} onChange={(e) => handleChange("referenceNumber", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="notes">Notes / Custom Message</Label>
                    <Textarea id="notes" rows={4} value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Add any special terms or welcome message here..." />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button onClick={handleGenerate}>Generate Appointment Letter</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}


