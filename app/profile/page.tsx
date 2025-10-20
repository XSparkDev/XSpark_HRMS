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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Upload, User, Mail, Phone, MapPin, CreditCard, Users, Edit } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { EmployeeProfile, BankDetails, NextOfKin } from "@/lib/types/employee"
import { getCurrentUser } from "@/lib/auth"

export default function MyProfilePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [updateRequestOpen, setUpdateRequestOpen] = useState(false)
  const [updateReason, setUpdateReason] = useState("")
  const [date, setDate] = useState<Date>()
  const [user] = useState(getCurrentUser())

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      // Check if user has profile
      const mockProfile: EmployeeProfile | null = null // Set to null to show create form, or provide mock data to show view mode
      setProfile(mockProfile)
      setIsLoading(false)
    }, 1000)
  }, [])

  const handleSaveProfile = async () => {
    // Implement save profile logic
    console.log("Saving profile...")
    setIsEditing(false)
  }

  const handleRequestUpdate = async () => {
    // Implement request update logic
    console.log("Requesting update:", updateReason)
    setUpdateRequestOpen(false)
    setUpdateReason("")
  }

  const generateEmployeeId = () => {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `XSP${year}/${month}/${sequence}`
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
          <h1 className="text-3xl font-bold text-navy">My Profile</h1>
          <p className="text-muted-foreground mt-2">Manage your personal and professional information</p>
        </div>
        {profile && !isEditing && (
          <Dialog open={updateRequestOpen} onOpenChange={setUpdateRequestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Request to Update Profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Profile Update</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reason">Reason for Update</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please explain why you need to update your profile..."
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setUpdateRequestOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRequestUpdate} disabled={!updateReason.trim()}>
                    Submit Request
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!profile ? (
        /* Create Profile Form */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Create Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Image */}
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Photo
                </Button>
                <p className="text-sm text-muted-foreground mt-1">JPG, PNG up to 2MB</p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input id="first_name" placeholder="Enter first name" />
                </div>
                <div>
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input id="middle_name" placeholder="Enter middle name" />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input id="last_name" placeholder="Enter last name" />
                </div>
                <div>
                  <Label htmlFor="preferred_name">Preferred Name</Label>
                  <Input id="preferred_name" placeholder="Name you prefer to be called" />
                </div>
                <div>
                  <Label htmlFor="id_number">ID Number *</Label>
                  <Input id="id_number" placeholder="13-digit South African ID" maxLength={13} />
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="sex">Sex *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="gender">Gender Identity</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
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
                  <Input id="pronouns" placeholder="e.g., he/him, she/her, they/them" />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" type="email" placeholder="your.email@company.com" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" placeholder="+27 XX XXX XXXX" />
                </div>
                <div>
                  <Label htmlFor="alternative_phone">Alternative Phone</Label>
                  <Input id="alternative_phone" placeholder="+27 XX XXX XXXX" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea id="address" placeholder="Enter your full address" rows={3} />
                </div>
              </div>
            </div>

            {/* Employment Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy">Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_id">Employee ID</Label>
                  <Input id="employee_id" value={generateEmployeeId()} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label htmlFor="job_title">Job Title *</Label>
                  <Select>
                    <SelectTrigger>
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
              </div>
            </div>

            {/* Tax and Nationality */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy">Tax and Nationality</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_number">Tax Number</Label>
                  <Input id="tax_number" placeholder="Enter tax number" />
                </div>
                <div>
                  <Label htmlFor="nationality">Nationality *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="South Africa">South Africa</SelectItem>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Bank Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input id="bank_name" placeholder="e.g., Standard Bank" />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input id="account_number" placeholder="Enter account number" />
                </div>
                <div>
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="branch_code">Branch Code</Label>
                  <Input id="branch_code" placeholder="Enter branch code" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="account_holder_name">Account Holder Name</Label>
                  <Input id="account_holder_name" placeholder="Name on bank account" />
                </div>
              </div>
            </div>

            {/* Next of Kin */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                <Users className="h-5 w-5" />
                Next of Kin
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="kin_first_name">First Name</Label>
                  <Input id="kin_first_name" placeholder="Enter first name" />
                </div>
                <div>
                  <Label htmlFor="kin_last_name">Last Name</Label>
                  <Input id="kin_last_name" placeholder="Enter last name" />
                </div>
                <div>
                  <Label htmlFor="kin_email">Email</Label>
                  <Input id="kin_email" type="email" placeholder="email@example.com" />
                </div>
                <div>
                  <Label htmlFor="kin_phone">Phone</Label>
                  <Input id="kin_phone" placeholder="+27 XX XXX XXXX" />
                </div>
                <div>
                  <Label htmlFor="kin_relationship">Relationship</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6">
              <Button onClick={handleSaveProfile} className="px-8">
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* View Profile */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Avatar className="h-24 w-24 mx-auto">
                    <AvatarImage src={profile.images?.[0]} />
                    <AvatarFallback className="text-lg">
                      {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold text-navy">
                      {profile.preferred_name || profile.first_name} {profile.last_name}
                    </h2>
                    <p className="text-muted-foreground">{profile.employee_ID}</p>
                    <Badge variant="secondary" className="mt-2">
                      Active Employee
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                    <p className="text-sm">{profile.first_name} {profile.middle_name} {profile.last_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Preferred Name</Label>
                    <p className="text-sm">{profile.preferred_name || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Date of Birth</Label>
                    <p className="text-sm">{new Date(profile.dob).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Gender</Label>
                    <p className="text-sm capitalize">{profile.gender}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Pronouns</Label>
                    <p className="text-sm">{profile.pronouns || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Nationality</Label>
                    <p className="text-sm">{profile.nationality}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-sm">{profile.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                    <p className="text-sm">{profile.phone}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Alternative Phone</Label>
                    <p className="text-sm">{profile.alternative_phone || "Not provided"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                    <p className="text-sm">{profile.address}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employment Information */}
            <Card>
              <CardHeader>
                <CardTitle>Employment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Employee ID</Label>
                    <p className="text-sm font-mono">{profile.employee_ID}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Date Hired</Label>
                    <p className="text-sm">{new Date(profile.date_hired).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Status */}
            <Card>
              <CardHeader>
                <CardTitle>Verification Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={profile.id_verified ? "default" : "secondary"}>
                    ID Verified {profile.id_verified ? "✓" : "✗"}
                  </Badge>
                  <Badge variant={profile.bank_verified ? "default" : "secondary"}>
                    Bank Verified {profile.bank_verified ? "✓" : "✗"}
                  </Badge>
                  {profile.nationality !== "South Africa" && (
                    <Badge variant={profile.work_permit_verified ? "default" : "secondary"}>
                      Work Permit Verified {profile.work_permit_verified ? "✓" : "✗"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
