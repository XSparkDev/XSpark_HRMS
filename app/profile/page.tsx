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
import { CalendarIcon, Upload, User, Mail, Phone, MapPin, CreditCard, Users, Edit, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { profileSchema, validateProfile, sanitizeInput, normalizePhone, type ValidationError, type ProfileFormData } from "@/lib/validation/profile"
import { getCurrentUser } from "@/lib/auth"

export default function MyProfilePage() {
  const { toast } = useToast()
  const [user] = useState(getCurrentUser())
  
  // Form state
  const [formData, setFormData] = useState<Partial<ProfileFormData>>({
    first_name: "",
    middle_name: "",
    last_name: "",
    preferred_name: "",
    id_number: "",
    dob: "",
    sex: "",
    gender: "",
    pronouns: "",
    email: "",
    phone: "",
    alternative_phone: "",
    address: "",
    tax_number: "",
    nationality: "South Africa",
    passport_number: "",
    job_title_id: "",
    date_hired: "",
    employment_status: "probation"
  })
  
  // Next of Kin state
  const [nokData, setNokData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    alternative_phone: "",
    relationship: ""
  })
  
  // Banking state
  const [bankData, setBankData] = useState({
    full_name: "",
    id_number: "",
    email: "",
    phone: "",
    address: "",
    bank_name: "",
    account_number: "",
    branch_number: "",
    account_type: "Cheque"
  })
  
  // UI state
  const [profile, setProfile] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [updateRequestOpen, setUpdateRequestOpen] = useState(false)
  const [updateReason, setUpdateReason] = useState("")
  const [date, setDate] = useState<Date>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [requiresReauth, setRequiresReauth] = useState(false)
  const [fileUploads, setFileUploads] = useState<Record<string, File | null>>({
    profile_picture: null,
    passport_document: null,
    work_permit: null
  })

  // Fetch employee data from backend
  useEffect(() => {
    const fetchEmployeeData = async () => {
      setIsLoading(true)
      try {
        // Get current employee from localStorage first (for quick display)
        const storedEmployee = localStorage.getItem('xspark_employee')
        if (storedEmployee) {
          try {
            const parsed = JSON.parse(storedEmployee)
            setProfile(parsed)
            // Prepopulate form with stored data
            setFormData({
              first_name: parsed.first_name || "",
              middle_name: parsed.middle_name || "",
              last_name: parsed.last_name || "",
              preferred_name: parsed.preferred_name || "",
              id_number: parsed.id_number || "",
              dob: parsed.dob || "",
              sex: parsed.sex || "",
              gender: parsed.gender || "",
              pronouns: parsed.pronouns || "",
              email: parsed.email || "",
              phone: parsed.phone || "",
              alternative_phone: parsed.alternative_phone || "",
              address: parsed.address || "",
              tax_number: parsed.tax_number || "",
              nationality: parsed.nationality || "South Africa",
              passport_number: parsed.passport_number || "",
              passport_document_url: parsed.passport_document_url || "",
              work_permit_url: parsed.work_permit_url || "",
              job_title_id: parsed.job_title_id || "",
              date_hired: parsed.date_hired || "",
              employment_status: parsed.employment_status || "probation"
            })
            // Set date for DOB picker if available
            if (parsed.dob) {
              setDate(new Date(parsed.dob))
            }
          } catch (e) {
            console.error('Error parsing stored employee:', e)
          }
        }

        // Fetch fresh data from API, include token if available
        let authHeaders: Record<string, string> = {}
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          try {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
            }
          } catch {}
        }

        const response = await fetch('/api/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          }
        })
        const json = await response.json()

        if (response.ok && json.success && json.data?.employee) {
          const employee = json.data.employee
          setProfile(employee)
          
          // Update localStorage with fresh data
          localStorage.setItem('xspark_employee', JSON.stringify(employee))

          // Prepopulate form with fetched data
          setFormData({
            first_name: employee.first_name || "",
            middle_name: employee.middle_name || "",
            last_name: employee.last_name || "",
            preferred_name: employee.preferred_name || "",
            id_number: employee.id_number || "",
            dob: employee.dob || "",
            sex: employee.sex || "",
            gender: employee.gender || "",
            pronouns: employee.pronouns || "",
            email: employee.email || "",
            phone: employee.phone || "",
            alternative_phone: employee.alternative_phone || "",
            address: employee.address || "",
            tax_number: employee.tax_number || "",
            nationality: employee.nationality || "South Africa",
            passport_number: employee.passport_number || "",
            passport_document_url: employee.passport_document_url || "",
            work_permit_url: employee.work_permit_url || "",
            job_title_id: employee.job_title_id || "",
            date_hired: employee.date_hired || "",
            employment_status: employee.employment_status || "probation"
          })

          // Set date for DOB picker if available
          if (employee.dob) {
            setDate(new Date(employee.dob))
          }

          // Fetch decrypted sensitive fields (id_number, tax_number)
          try {
            const decResponse = await fetch('/api/profile/decrypted', {
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders
              }
            })
            const decJson = await decResponse.json()

            if (decResponse.ok && decJson.success && decJson.data) {
              // Update form data with decrypted sensitive fields
              setFormData(prev => ({
                ...prev,
                id_number: decJson.data.id_number || prev.id_number || "",
                tax_number: decJson.data.tax_number || prev.tax_number || ""
              }))
            }
          } catch (error) {
            console.error('Error fetching decrypted fields:', error)
            // Silently continue - user may not have permission
          }
        } else if (response.status === 401) {
          // Not authenticated - redirect to login or show create form
          setProfile(null)
        } else if (response.status === 404 || !json.data?.employee) {
          // Employee not found - show create form
          setProfile(null)
        }
      } catch (error) {
        console.error('Error fetching employee data:', error)
        // On error, check if we have stored data, otherwise show create form
        const storedEmployee = localStorage.getItem('xspark_employee')
        if (!storedEmployee) {
          setProfile(null)
        }
      } finally {
      setIsLoading(false)
      }
    }

    fetchEmployeeData()
  }, [])

  // Validation functions
  const validateField = (field: string, value: any) => {
    const fieldErrors: Record<string, string> = {}
    
    try {
      // Create a partial schema for the specific field
      const fieldSchema = profileSchema.pick({ [field]: true } as any)
      fieldSchema.parse({ [field]: value })
    } catch (error: any) {
      if (error.errors && error.errors.length > 0) {
        fieldErrors[field] = error.errors[0].message
      }
    }
    
    setErrors(prev => ({ ...prev, ...fieldErrors }))
    return Object.keys(fieldErrors).length === 0
  }

  const validateForm = async () => {
    setIsValidating(true)
    
    try {
      const fullData = {
        ...formData,
        next_of_kin: Object.values(nokData).some(v => v) ? nokData : undefined,
        banking_details: Object.values(bankData).some(v => v) ? bankData : undefined
      }
      
      const result = validateProfile(fullData)
      
      if (!result.success) {
        const errorMap: Record<string, string> = {}
        result.errors?.forEach(error => {
          errorMap[error.field] = error.message
        })
        setErrors(errorMap)
        return false
      }
      
      setErrors({})
      return true
    } catch (error) {
      console.error("Validation error:", error)
      return false
    } finally {
      setIsValidating(false)
    }
  }

  // Input handlers with validation
  const handleInputChange = (field: string, value: any) => {
    // Sanitize input for text fields
    if (typeof value === 'string' && field !== 'id_number' && field !== 'tax_number' && field !== 'account_number') {
      value = sanitizeInput(value)
    }
    
    // Normalize phone numbers
    if (field.includes('phone')) {
      value = normalizePhone(value)
    }
    
    setFormData(prev => ({ ...prev, [field]: value }))
    setTouched(prev => ({ ...prev, [field]: true }))
    
    // Real-time validation
    if (touched[field]) {
      validateField(field, value)
    }
  }

  const handleNokChange = (field: string, value: any) => {
    if (typeof value === 'string') {
      value = sanitizeInput(value)
    }
    if (field.includes('phone')) {
      value = normalizePhone(value)
    }
    
    setNokData(prev => ({ ...prev, [field]: value }))
    setTouched(prev => ({ ...prev, [`nok_${field}`]: true }))
  }

  const handleBankChange = (field: string, value: any) => {
    if (typeof value === 'string') {
      value = sanitizeInput(value)
    }
    if (field.includes('phone')) {
      value = normalizePhone(value)
    }
    
    setBankData(prev => ({ ...prev, [field]: value }))
    setTouched(prev => ({ ...prev, [`bank_${field}`]: true }))
  }

  const handleFileUpload = (field: string, file: File | null) => {
    if (file) {
      // Validate file
      const maxSize = 10 * 1024 * 1024 // 10MB
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"]
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "File must be less than 10MB",
          variant: "destructive"
        })
        return
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "File must be an image (JPEG, PNG, GIF) or PDF",
          variant: "destructive"
        })
        return
      }
    }
    
    setFileUploads(prev => ({ ...prev, [field]: file }))
  }

  const handleSaveProfile = async () => {
    const isValid = await validateForm()
    
    if (!isValid) {
      toast({
        title: "Validation failed",
        description: "Please fix the errors before submitting",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      // Check if sensitive fields are being updated
      const sensitiveFields = ['id_number', 'tax_number', 'passport_number', 'account_number']
      const hasSensitiveChanges = sensitiveFields.some(field => 
        formData[field as keyof typeof formData] !== profile?.[field]
      )
      
      if (hasSensitiveChanges && !requiresReauth) {
        setRequiresReauth(true)
        toast({
          title: "Re-authentication required",
          description: "Please re-authenticate to update sensitive information",
          variant: "destructive"
        })
        return
      }
      
      // Upload files first
      const uploadedFiles: Record<string, string> = {}
      for (const [field, file] of Object.entries(fileUploads)) {
        if (file) {
          // TODO: Implement S3 upload
          uploadedFiles[field] = `https://s3.example.com/${field}/${file.name}`
        }
      }
      
      // Prepare data for API
      const submitData = {
        ...formData,
        ...uploadedFiles,
        next_of_kin: Object.values(nokData).some(v => v) ? nokData : undefined,
        banking_details: Object.values(bankData).some(v => v) ? bankData : undefined
      }
      
      // TODO: Implement API call
      console.log("Submitting profile:", submitData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast({
        title: "Profile saved successfully",
        description: "Your profile has been updated",
      })
      
      setIsEditing(false)
      setRequiresReauth(false)
      
    } catch (error) {
      console.error("Error saving profile:", error)
      toast({
        title: "Error saving profile",
        description: "Please try again later",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestUpdate = async () => {
    if (!updateReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for the update request",
        variant: "destructive"
      })
      return
    }
    
    try {
      // TODO: Implement API call for update request
      console.log("Requesting update:", updateReason)
      
      toast({
        title: "Update request submitted",
        description: "Your request has been sent to HR for review",
      })
      
      setUpdateRequestOpen(false)
      setUpdateReason("")
    } catch (error) {
      toast({
        title: "Error submitting request",
        description: "Please try again later",
        variant: "destructive"
      })
    }
  }

  const generateEmployeeId = () => {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `XSP${year}${month}/${sequence}`
  }

  const ErrorMessage = ({ field }: { field: string }) => {
    const error = errors[field]
    if (!error || !touched[field]) return null
    
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-1 text-sm text-red-600 mt-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </motion.div>
      </AnimatePresence>
    )
  }

  const InputField = ({ 
    field, 
    label, 
    type = "text", 
    required = false, 
    placeholder, 
    maxLength,
    children 
  }: {
    field: string
    label: string
    type?: string
    required?: boolean
    placeholder?: string
    maxLength?: number
    children?: React.ReactNode
  }) => (
    <div>
      <Label htmlFor={field}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children || (
        <Input
          id={field}
          type={type}
          placeholder={placeholder}
          maxLength={maxLength}
          value={formData[field as keyof typeof formData] || ""}
          onChange={(e) => handleInputChange(field, e.target.value)}
          onBlur={() => setTouched(prev => ({ ...prev, [field]: true }))}
          className={cn(
            errors[field] && touched[field] && "border-red-500 focus:border-red-500"
          )}
        />
      )}
      <ErrorMessage field={field} />
    </div>
  )

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
                <AvatarImage src={fileUploads.profile_picture ? URL.createObjectURL(fileUploads.profile_picture) : ""} />
                <AvatarFallback className="text-lg">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => document.getElementById('profile-picture')?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload Photo
                </Button>
                <input
                  id="profile-picture"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload('profile_picture', e.target.files?.[0] || null)}
                />
                <p className="text-sm text-muted-foreground mt-1">JPG, PNG up to 10MB</p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField field="first_name" label="First Name" required placeholder="Enter first name" />
                <InputField field="middle_name" label="Middle Name" placeholder="Enter middle name" />
                <InputField field="last_name" label="Last Name" required placeholder="Enter last name" />
                <InputField field="preferred_name" label="Preferred Name" placeholder="Name you prefer to be called" />
                
                {/* ID Number and Nationality Row */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ID Number Field */}
                  <AnimatePresence>
                    {formData.nationality === "South Africa" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="transition-opacity duration-300 ease-in-out"
                      >
                        <Label htmlFor="id_number">
                          ID Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="id_number"
                          placeholder="13-digit South African ID"
                          maxLength={13}
                          value={formData.id_number || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '') // Only digits
                            handleInputChange('id_number', value)
                          }}
                          onBlur={() => setTouched(prev => ({ ...prev, id_number: true }))}
                          className={cn(
                            errors.id_number && touched.id_number && "border-red-500 focus:border-red-500"
                          )}
                        />
                        <ErrorMessage field="id_number" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Nationality Field */}
                  <div>
                    <Label htmlFor="nationality">Nationality <span className="text-red-500">*</span></Label>
                    <Select value={formData.nationality || ""} onValueChange={(value) => {
                      handleInputChange('nationality', value)
                      if (value === "South Africa") {
                        handleInputChange('passport_number', "")
                        setFileUploads(prev => ({ ...prev, passport_document: null, work_permit: null }))
                      }
                    }}>
                      <SelectTrigger className={cn(errors.nationality && touched.nationality && "border-red-500")}>
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="South Africa">South Africa</SelectItem>
                        <SelectItem value="Namibia">Namibia</SelectItem>
                        <SelectItem value="Botswana">Botswana</SelectItem>
                        <SelectItem value="Zimbabwe">Zimbabwe</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <ErrorMessage field="nationality" />
                  </div>
                </div>
                
                {/* Foreign National Fields - Dynamic based on nationality */}
                <AnimatePresence>
                  {formData.nationality !== "South Africa" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="md:col-span-2 space-y-4 transition-opacity duration-300 ease-in-out"
                    >
                      <div>
                        <Label htmlFor="passport_number">Passport Number <span className="text-red-500">*</span></Label>
                        <Input
                          id="passport_number"
                          placeholder="Enter passport number"
                          value={formData.passport_number || ""}
                          onChange={(e) => handleInputChange('passport_number', e.target.value)}
                          onBlur={() => setTouched(prev => ({ ...prev, passport_number: true }))}
                          className={cn(errors.passport_number && touched.passport_number && "border-red-500 focus:border-red-500")}
                        />
                        <ErrorMessage field="passport_number" />
                      </div>
                      <div>
                        <Label htmlFor="passport_document">Upload Passport Document <span className="text-red-500">*</span></Label>
                        <Input
                          id="passport_document"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileUpload('passport_document', e.target.files?.[0] || null)}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Upload passport document (JPG, PNG, PDF up to 10MB) - Private, encrypted storage
                        </p>
                        <ErrorMessage field="passport_document" />
                      </div>
                      <div>
                        <Label htmlFor="work_permit">Upload Work Permit <span className="text-red-500">*</span></Label>
                        <Input
                          id="work_permit"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileUpload('work_permit', e.target.files?.[0] || null)}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Upload work permit document (JPG, PNG, PDF up to 10MB) - Private, encrypted storage
                        </p>
                        <ErrorMessage field="work_permit" />
                      </div>
                      <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-blue-800">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-medium">Foreign National Verification</span>
                        </div>
                        <p className="text-blue-700 mt-1">
                          ID-based verification is disabled for non-South African nationals. 
                          Verification will be done via work permit and passport documents.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div>
                  <Label htmlFor="dob">Date of Birth <span className="text-red-500">*</span></Label>
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
                        onSelect={(selectedDate) => {
                          setDate(selectedDate)
                          handleInputChange('dob', selectedDate?.toISOString().split('T')[0] || "")
                        }}
                        initialFocus
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      />
                    </PopoverContent>
                  </Popover>
                  <ErrorMessage field="dob" />
                </div>
                
                <div>
                  <Label htmlFor="sex">Sex <span className="text-red-500">*</span></Label>
                  <Select value={formData.sex || ""} onValueChange={(value) => handleInputChange('sex', value)}>
                    <SelectTrigger className={cn(errors.sex && touched.sex && "border-red-500")}>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <ErrorMessage field="sex" />
                </div>
                
                <div>
                  <Label htmlFor="gender">Gender Identity <span className="text-red-500">*</span></Label>
                  <Select value={formData.gender || ""} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger className={cn(errors.gender && touched.gender && "border-red-500")}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  <ErrorMessage field="gender" />
                </div>
                
                <InputField field="pronouns" label="Pronouns" placeholder="e.g., he/him, she/her, they/them" />
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField field="email" label="Email Address" type="email" required placeholder="your.email@company.com" />
                <InputField field="phone" label="Phone Number" required placeholder="+27 XX XXX XXXX" />
                <InputField field="alternative_phone" label="Alternative Phone" placeholder="+27 XX XXX XXXX" />
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter your full address"
                    rows={3}
                    value={formData.address || ""}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
                    className={cn(errors.address && touched.address && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="address" />
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
                  <Label htmlFor="job_title">Job Title <span className="text-red-500">*</span></Label>
                  <Select value={formData.job_title_id || ""} onValueChange={(value) => handleInputChange('job_title_id', value)}>
                    <SelectTrigger className={cn(errors.job_title_id && touched.job_title_id && "border-red-500")}>
                      <SelectValue placeholder="Select job title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="developer">Software Developer</SelectItem>
                      <SelectItem value="designer">UI/UX Designer</SelectItem>
                      <SelectItem value="manager">Project Manager</SelectItem>
                      <SelectItem value="hr">HR Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                  <ErrorMessage field="job_title_id" />
                </div>
                <div>
                  <Label htmlFor="date_hired">Date Hired <span className="text-red-500">*</span></Label>
                  <Input
                    id="date_hired"
                    type="date"
                    value={formData.date_hired || ""}
                    onChange={(e) => handleInputChange('date_hired', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, date_hired: true }))}
                    className={cn(errors.date_hired && touched.date_hired && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="date_hired" />
                </div>
              </div>
            </div>

            {/* Tax Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy">Tax Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_number">Tax Number</Label>
                  <Input
                    id="tax_number"
                    placeholder="Enter tax number"
                    value={formData.tax_number || ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '') // Only digits
                      handleInputChange('tax_number', value)
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, tax_number: true }))}
                    className={cn(errors.tax_number && touched.tax_number && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="tax_number" />
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
                  <Label htmlFor="nok_first_name">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="nok_first_name"
                    placeholder="Enter first name"
                    value={nokData.first_name}
                    onChange={(e) => handleNokChange('first_name', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, nok_first_name: true }))}
                    className={cn(errors.nok_first_name && touched.nok_first_name && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="nok_first_name" />
                </div>
                <div>
                  <Label htmlFor="nok_middle_name">Middle Name</Label>
                  <Input
                    id="nok_middle_name"
                    placeholder="Enter middle name"
                    value={nokData.middle_name}
                    onChange={(e) => handleNokChange('middle_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nok_last_name">Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="nok_last_name"
                    placeholder="Enter last name"
                    value={nokData.last_name}
                    onChange={(e) => handleNokChange('last_name', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, nok_last_name: true }))}
                    className={cn(errors.nok_last_name && touched.nok_last_name && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="nok_last_name" />
                </div>
                <div>
                  <Label htmlFor="nok_email">Email</Label>
                  <Input
                    id="nok_email"
                    type="email"
                    placeholder="email@example.com"
                    value={nokData.email}
                    onChange={(e) => handleNokChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nok_phone">Phone <span className="text-red-500">*</span></Label>
                  <Input
                    id="nok_phone"
                    placeholder="+27 XX XXX XXXX"
                    value={nokData.phone}
                    onChange={(e) => handleNokChange('phone', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, nok_phone: true }))}
                    className={cn(errors.nok_phone && touched.nok_phone && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="nok_phone" />
                </div>
                <div>
                  <Label htmlFor="nok_relationship">Relationship <span className="text-red-500">*</span></Label>
                  <Select value={nokData.relationship} onValueChange={(value) => handleNokChange('relationship', value)}>
                    <SelectTrigger className={cn(errors.nok_relationship && touched.nok_relationship && "border-red-500")}>
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
                  <ErrorMessage field="nok_relationship" />
                </div>
              </div>
            </div>

            {/* Banking Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Banking Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bank_full_name">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="bank_full_name"
                    placeholder="Name on bank account"
                    value={bankData.full_name}
                    onChange={(e) => handleBankChange('full_name', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, bank_full_name: true }))}
                    className={cn(errors.bank_full_name && touched.bank_full_name && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="bank_full_name" />
                </div>
                <div>
                  <Label htmlFor="bank_id_number">ID Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="bank_id_number"
                    placeholder="13-digit South African ID"
                    maxLength={13}
                    value={bankData.id_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      handleBankChange('id_number', value)
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, bank_id_number: true }))}
                    className={cn(errors.bank_id_number && touched.bank_id_number && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="bank_id_number" />
                </div>
                <div>
                  <Label htmlFor="bank_email">Email <span className="text-red-500">*</span></Label>
                  <Input
                    id="bank_email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={bankData.email}
                    onChange={(e) => handleBankChange('email', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, bank_email: true }))}
                    className={cn(errors.bank_email && touched.bank_email && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="bank_email" />
                </div>
                <div>
                  <Label htmlFor="bank_phone">Phone <span className="text-red-500">*</span></Label>
                  <Input
                    id="bank_phone"
                    placeholder="+27 XX XXX XXXX"
                    value={bankData.phone}
                    onChange={(e) => handleBankChange('phone', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, bank_phone: true }))}
                    className={cn(errors.bank_phone && touched.bank_phone && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="bank_phone" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="bank_address">Address <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="bank_address"
                    placeholder="Enter your full address"
                    rows={3}
                    value={bankData.address}
                    onChange={(e) => handleBankChange('address', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, bank_address: true }))}
                    className={cn(errors.bank_address && touched.bank_address && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="bank_address" />
                </div>
                <div>
                  <Label htmlFor="bank_name">Bank Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="bank_name"
                    placeholder="e.g., Standard Bank"
                    value={bankData.bank_name}
                    onChange={(e) => handleBankChange('bank_name', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, bank_name: true }))}
                    className={cn(errors.bank_name && touched.bank_name && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="bank_name" />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="account_number"
                    placeholder="Enter account number"
                    value={bankData.account_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      handleBankChange('account_number', value)
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, account_number: true }))}
                    className={cn(errors.account_number && touched.account_number && "border-red-500 focus:border-red-500")}
                  />
                  <ErrorMessage field="account_number" />
                </div>
                <div>
                  <Label htmlFor="branch_number">Branch Code</Label>
                  <Input
                    id="branch_number"
                    placeholder="Enter branch code"
                    value={bankData.branch_number}
                    onChange={(e) => handleBankChange('branch_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select value={bankData.account_type} onValueChange={(value) => handleBankChange('account_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Savings">Savings</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Re-authentication Warning */}
            {requiresReauth && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Re-authentication Required</span>
                </div>
                <p className="text-yellow-700 mt-1">
                  You're updating sensitive information. Please re-authenticate to continue.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setRequiresReauth(false)}
                >
                  Re-authenticate
                </Button>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-6">
              <Button 
                onClick={handleSaveProfile} 
                disabled={isSubmitting || isValidating}
                className="px-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* View Profile - Keep existing view mode */
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
                    <p className="text-muted-foreground">{profile.employee_id}</p>
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
                    <Label className="text-sm font-medium text-muted-foreground">ID Number</Label>
                    <p className="text-sm">{formData.id_number || "Not specified"}</p>
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
                    <p className="text-sm font-mono">{profile.employee_id}</p>
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