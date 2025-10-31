"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus, Search, Filter, Edit, Trash2, Eye, MoreHorizontal } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { EmployeeProfile, EmployeeFilters } from "@/lib/types/employee"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [activeAddTab, setActiveAddTab] = useState("manual")
  const [isAppointmentConfirmOpen, setIsAppointmentConfirmOpen] = useState(false)
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false)
  const [gmail, setGmail] = useState("")
  const [gmailError, setGmailError] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null)
  const [filters, setFilters] = useState<EmployeeFilters>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const user = getCurrentUser()

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockEmployees: EmployeeProfile[] = [
        {
          id: "1",
          user_id: "user1",
          first_name: "John",
          last_name: "Doe",
          preferred_name: "Johnny",
          employee_ID: "XSP25/01/001",
          email: "john.doe@company.com",
          phone: "+27 82 123 4567",
          address: "123 Main St, Cape Town",
          dob: "1990-05-15",
          sex: "male",
          gender: "male",
          nationality: "South Africa",
          job_title_id: "developer",
          date_hired: "2023-01-15",
          id_verified: true,
          bank_verified: true,
          work_permit_verified: true,
          created_at: "2023-01-15T00:00:00Z",
          updated_at: "2023-01-15T00:00:00Z"
        },
        {
          id: "2",
          user_id: "user2",
          first_name: "Jane",
          last_name: "Smith",
          employee_ID: "XSP25/01/002",
          email: "jane.smith@company.com",
          phone: "+27 83 234 5678",
          address: "456 Oak Ave, Johannesburg",
          dob: "1988-12-03",
          sex: "female",
          gender: "female",
          nationality: "South Africa",
          job_title_id: "designer",
          date_hired: "2023-02-01",
          id_verified: true,
          bank_verified: false,
          work_permit_verified: true,
          created_at: "2023-02-01T00:00:00Z",
          updated_at: "2023-02-01T00:00:00Z"
        }
      ]
      setEmployees(mockEmployees)
      setFilteredEmployees(mockEmployees)
      setIsLoading(false)
    }, 1000)
  }, [])

  // Filter employees based on search and filters
  useEffect(() => {
    let filtered = employees

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_ID.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(emp => emp.job_title_id === filters.department)
    }

    // Status filter
    if (filters.status) {
      // For now, all employees are active
      filtered = filtered.filter(emp => filters.status === 'active')
    }

    setFilteredEmployees(filtered)
  }, [employees, searchTerm, filters])

  const handleCreateEmployee = () => {
    // Implement create employee logic
    console.log("Creating employee...")
    setIsCreateModalOpen(false)
    setIsAppointmentConfirmOpen(true)
  }

  const handleEditEmployee = (employee: EmployeeProfile) => {
    setSelectedEmployee(employee)
    setIsEditModalOpen(true)
  }

  const handleDeleteEmployee = (employee: EmployeeProfile) => {
    if (confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
      // Implement delete logic
      console.log("Deleting employee:", employee.id)
    }
  }

  const handleViewEmployee = (employee: EmployeeProfile) => {
    // Navigate to employee profile view
    console.log("Viewing employee:", employee.id)
  }

  const generateEmployeeId = () => {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `XSP${year}/${month}/${sequence}`
  }

  // Check if user has HR permissions
  if (!hasPermission(user, "view_employees")) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-navy mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view employee management.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Employee Management</h1>
          <p className="text-muted-foreground mt-2">Manage employee profiles and information</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Add Employee */}
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              {/* Tabs for Search by ID / Manual Input */}
              <Tabs value={activeAddTab} onValueChange={setActiveAddTab} className="mt-2">
                <TabsList>
                  <TabsTrigger value="search">Search by ID</TabsTrigger>
                  <TabsTrigger value="manual">Manual Input</TabsTrigger>
                </TabsList>
                <TabsContent value="search" className="pt-4">
                  <div className="flex flex-col sm:flex-row items-end gap-3 sm:gap-4">
                    <div className="flex-1">
                      <Label htmlFor="searchIdNumber">ID Number</Label>
                      <Input id="searchIdNumber" placeholder="enter ID number" className="mt-2 uniform-input" />
                    </div>
                    <Button
                      className="mt-2 sm:mt-0"
                      onClick={() => {
                        const idInput = (document.getElementById("searchIdNumber") as HTMLInputElement)
                        const idVal = idInput?.value?.trim()
                        if (!idVal) return alert("Please enter an ID Number")
                        console.log({ idNumber: idVal })
                        // Neutral info for now
                        alert("Search would call API — partner integration required")
                      }}
                    >
                      Search Employee
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="manual" className="pt-4">
                  <EmployeeForm 
                    onSubmit={() => {
                      // simulate creation
                      console.log('createEmployeePayload', '...payload from form')
                      setIsCreateModalOpen(false)
                      setIsAppointmentConfirmOpen(true)
                    }}
                    employeeId={generateEmployeeId()}
                  />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 uniform-input"
                />
              </div>
            </div>
            <Select value={filters.department} onValueChange={(value) => setFilters({...filters, department: value})}>
              <SelectTrigger className="w-full md:w-48 uniform-input">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer">Development</SelectItem>
                <SelectItem value="designer">Design</SelectItem>
                <SelectItem value="manager">Management</SelectItem>
                <SelectItem value="hr">Human Resources</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value as 'active' | 'inactive'})}>
              <SelectTrigger className="w-full md:w-48 uniform-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({})}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={employee.images?.[0]} />
                        <AvatarFallback>
                          {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {employee.preferred_name || employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {employee.nationality}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {employee.employee_ID}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {employee.job_title_id}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.phone}</TableCell>
                  <TableCell>
                    <Badge variant="default">Active</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant={employee.id_verified ? "default" : "secondary"} className="text-xs">
                        ID
                      </Badge>
                      <Badge variant={employee.bank_verified ? "default" : "secondary"} className="text-xs">
                        Bank
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewEmployee(employee)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEmployee(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEmployee(employee)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No employees found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Employee Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeForm 
              onSubmit={() => setIsEditModalOpen(false)}
              employee={selectedEmployee}
              isEdit={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Appointment Letter Confirmation */}
      <Dialog open={isAppointmentConfirmOpen} onOpenChange={setIsAppointmentConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment letter has been created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Select an option to proceed:</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAppointmentConfirmOpen(false)}>Close</Button>
            <Button onClick={() => { setIsAppointmentConfirmOpen(false); setIsSendEmailOpen(true) }}>Send to employee</Button>
            <Button>Review Letter</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={isSendEmailOpen} onOpenChange={setIsSendEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send appointment letter</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="gmail">Employee Gmail address</Label>
            <Input id="gmail" placeholder="employee@gmail.com" value={gmail} onChange={(e) => { setGmail(e.target.value); setGmailError("") }} className="mt-2 uniform-input" />
            {gmailError && <p className="text-sm text-red-500 mt-1">{gmailError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsSendEmailOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              const re = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i
              if (!re.test(gmail)) { setGmailError("Please enter a valid Gmail address (example: name@gmail.com)"); return }
              console.log({ sendEmail: gmail, payload: 'appointmentLetterPayload' })
              setIsSendEmailOpen(false)
            }}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Employee Form Component
function EmployeeForm({ 
  onSubmit, 
  employee, 
  isEdit = false, 
  employeeId 
}: { 
  onSubmit: () => void
  employee?: EmployeeProfile
  isEdit?: boolean
  employeeId?: string
}) {
  const [formData, setFormData] = useState({
    first_name: employee?.first_name || "",
    middle_name: employee?.middle_name || "",
    last_name: employee?.last_name || "",
    preferred_name: employee?.preferred_name || "",
    id_number: (employee as any)?.id_number || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    alternative_phone: employee?.alternative_phone || "",
    address: employee?.address || "",
    dob: employee?.dob || "",
    sex: employee?.sex || "male",
    gender: employee?.gender || "male",
    nationality: employee?.nationality || "South Africa",
    job_title_id: employee?.job_title_id || "",
    tax_number: employee?.tax_number || "",
    pronouns: employee?.pronouns || "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted:", formData)
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="middle_name">Middle Name</Label>
            <Input
              id="middle_name"
              value={formData.middle_name}
              onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="preferred_name">Preferred Name</Label>
            <Input
              id="preferred_name"
              value={formData.preferred_name}
              onChange={(e) => setFormData({...formData, preferred_name: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="id_number">ID Number *</Label>
            <Input
              id="id_number"
              value={formData.id_number}
              onChange={(e) => setFormData({...formData, id_number: e.target.value})}
              className="uniform-input"
              required
            />
          </div>
          <div>
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData({...formData, dob: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="sex">Sex *</Label>
            <Select value={formData.sex} onValueChange={(value) => setFormData({...formData, sex: value as 'male' | 'female'})}>
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gender">Gender Identity</Label>
            <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value as any})}>
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer not to say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pronouns">Pronouns</Label>
            <Input
              id="pronouns"
              value={formData.pronouns}
              onChange={(e) => setFormData({...formData, pronouns: e.target.value})}
              placeholder="e.g., he/him, she/her, they/them"
              className="uniform-input"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="alternative_phone">Alternative Phone</Label>
            <Input
              id="alternative_phone"
              value={formData.alternative_phone}
              onChange={(e) => setFormData({...formData, alternative_phone: e.target.value})}
              className="uniform-input"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              required
              className="uniform-input"
            />
          </div>
        </div>
      </div>

      {/* Employment Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">Employment Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employee_id">Employee ID</Label>
            <Input
              id="employee_id"
              value={employeeId || employee?.employee_ID || ""}
              readOnly
              className="bg-muted uniform-input"
            />
          </div>
          <div>
            <Label htmlFor="job_title">Job Title *</Label>
            <Select value={formData.job_title_id} onValueChange={(value) => setFormData({...formData, job_title_id: value})}>
              <SelectTrigger className="uniform-input">
                <SelectValue placeholder="Select job title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer">Software Developer</SelectItem>
                <SelectItem value="designer">UI/UX Designer</SelectItem>
                <SelectItem value="manager">Project Manager</SelectItem>
                <SelectItem value="hr">HR Specialist</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="nationality">Nationality *</Label>
            <Select value={formData.nationality} onValueChange={(value) => setFormData({...formData, nationality: value})}>
              <SelectTrigger className="uniform-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="South Africa">South Africa</SelectItem>
                <SelectItem value="United States">United States</SelectItem>
                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tax_number">Tax Number</Label>
            <Input
              id="tax_number"
              value={formData.tax_number}
              onChange={(e) => setFormData({...formData, tax_number: e.target.value})}
              className="uniform-input"
            />
          </div>
          {/* New fields to meet requirements */}
          <div>
            <Label htmlFor="date_joining">Date of Joining *</Label>
            <Input id="date_joining" type="date" className="uniform-input" required />
          </div>
          <div>
            <Label>Employment Type *</Label>
            <Select defaultValue="full_time">
              <SelectTrigger className="uniform-input">
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
          <div className="md:col-span-2">
            <Label htmlFor="work_location">Work Location *</Label>
            <Input id="work_location" className="uniform-input" required />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="outline" onClick={onSubmit}>
          Cancel
        </Button>
        <Button type="submit">
          {isEdit ? "Update Employee" : "Create Employee"}
        </Button>
      </div>
    </form>
  )
}
