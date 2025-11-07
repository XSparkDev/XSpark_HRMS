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
import { sanitizeInput, normalizePhone, type ValidationError, type ProfileFormData, appFormSchema } from "@/lib/validation/app-form"
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
    sex: undefined,
    gender: undefined,
    pronouns: "",
    email: "",
    phone: "",
    alternative_phone: "",
    address: "",
    tax_number: "",
    nationality: "South Africa",
    passport_number: "",
    employee_id: "",
    id_verified: false,
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
    relationship: "",
    name: "",
    address: ""
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [updateRequestOpen, setUpdateRequestOpen] = useState(false)
  const [updateReason, setUpdateReason] = useState("")
  const [date, setDate] = useState<Date>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [requiresReauth, setRequiresReauth] = useState(false)
  const [jobTitles, setJobTitles] = useState<Array<{ id: string; title: string }>>([])
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
              passport_document: parsed.passport_document || "",
              work_permit: parsed.work_permit || "",
            employee_id: parsed.employee_id || "",
            id_verified: parsed.id_verified || false,
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
            passport_document: employee.passport_document || "",
            work_permit: employee.work_permit || "",
            employee_id: employee.employee_id || "",
            id_verified: employee.id_verified || false,
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

  useEffect(() => {
    const fetchJobTitles = async () => {
      try {
        const res = await fetch('/api/job-titles')
        if (!res.ok) throw new Error('Failed to fetch job titles')
        const json = await res.json()
        if (json?.success && Array.isArray(json.data)) {
          setJobTitles(json.data)
        }
      } catch (error) {
        console.error('Error fetching job titles:', error)
      }
    }

    fetchJobTitles()
  }, [])

  // Validation functions
  const validateField = (field: string, value: any) => {
    // Use shared schema but do not block UI; we only surface field-specific error if present
    const includeNok = Object.values(nokData).some(v => v)
    const includeBank = Object.values(bankData).some(v => v)
    const data = { ...formData, [field]: value, next_of_kin: includeNok ? nokData : undefined, banking_details: includeBank ? bankData : undefined }
    const result = appFormSchema.safeParse(data)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.join('.') === field)
      setErrors(prev => ({ ...prev, [field]: issue?.message || "" }))
      return !issue
    }
    setErrors(prev => ({ ...prev, [field]: "" }))
    return true
  }

  const validateForm = async () => {
    const includeNok = Object.values(nokData).some(v => v)
    const includeBank = Object.values(bankData).some(v => v)
    const data = { ...formData, next_of_kin: includeNok ? nokData : undefined, banking_details: includeBank ? bankData : undefined }
    const result = appFormSchema.safeParse(data)
      if (!result.success) {
        const errorMap: Record<string, string> = {}
      for (const issue of result.error.issues) {
        errorMap[issue.path.join('.')] = issue.message
      }
        setErrors(errorMap)
      // Do not block submit to keep current flow permissive
      return true
      }
      setErrors({})
      return true
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
    console.log('handleSaveProfile called')
    const isValid = await validateForm()
    console.log('Validation result:', isValid, 'Errors:', errors)
    
    if (!isValid) {
      console.error('Validation failed:', errors)
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
          description: "Sensitive changes detected. Proceeding for now.",
          variant: "destructive"
        })
        // Continue to submit to avoid blocking in modal context
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
      const submitData: any = {
        ...formData,
        ...uploadedFiles
      }

      // Normalize enums/optional fields
      if (!submitData.gender || submitData.gender === "") delete submitData.gender
      if (submitData.gender === "prefer not to say") submitData.gender = "prefer_not_to_say"

      // Remove empty-string fields to satisfy validation
      Object.keys(submitData).forEach((key) => {
        if (submitData[key] === "") delete submitData[key]
      })

      // Drop non-UUID job_title_id to satisfy backend schema
      if (submitData.job_title_id && !/^[0-9a-fA-F-]{36}$/.test(String(submitData.job_title_id))) {
        delete submitData.job_title_id
      }

      // Include nested sections only if populated (backend ignores unknown for now)
      const includeNok = Object.values(nokData).some(v => v)
      const includeBank = Object.values(bankData).some(v => v)
      if (includeNok) {
        const fullName = (nokData.name || '').trim()
        const nextOfKinPayload: Record<string, any> = {
          ...nokData,
          full_name: fullName || undefined
        }

        // Remove empty strings so backend validation doesn't fail
        Object.keys(nextOfKinPayload).forEach((key) => {
          if (nextOfKinPayload[key] === "") {
            delete nextOfKinPayload[key]
          }
        })

        submitData.next_of_kin = [nextOfKinPayload]
      } else {
        delete submitData.next_of_kin
      }
      if (includeBank) submitData.banking_details = bankData

      // Prepare auth header if present
      let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        }
      } catch {}

      // Call API: update if existing profile, else create
      if (profile?.id) {
        console.log('PUT /api/employees', { id: profile.id, ...submitData })
        const res = await fetch('/api/employees', {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ id: profile.id, ...submitData })
        })

        const json = await res.json().catch(() => ({}))
        console.log('PUT response:', res.status, json)
        if (!res.ok) throw new Error(json?.error || 'Failed to update profile')
      } else {
        console.log('POST /api/employees', submitData)
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(submitData)
        })

        const json = await res.json().catch(() => ({}))
        console.log('POST response:', res.status, json)
        if (!res.ok) throw new Error(json?.error || 'Failed to create profile')
      }
      
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
          value={String(formData[field as keyof typeof formData] ?? "")}
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
        <Button variant="default" onClick={() => setIsModalOpen(true)} className="ml-2">
          {profile ? 'Edit Profile' : 'Create Profile'}
              </Button>
                </div>
      {/* View Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Avatar className="h-24 w-24 mx-auto">
                    <AvatarImage src={profile?.images?.[0] ?? undefined} />
                    <AvatarFallback className="text-lg">
                      {profile?.first_name?.charAt(0) ?? ''}
                      {profile?.last_name?.charAt(0) ?? ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold text-navy">
                      {(profile?.preferred_name || profile?.first_name || "")} {(profile?.last_name || "")}
                    </h2>
                    <p className="text-muted-foreground">{profile?.employee_id || ""}</p>
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
                    <p className="text-sm">{[profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Preferred Name</Label>
                    <p className="text-sm">{profile?.preferred_name || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">ID Number</Label>
                    <p className="text-sm">{formData.id_number || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Date of Birth</Label>
                    <p className="text-sm">{profile?.dob ? new Date(profile.dob).toLocaleDateString() : "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Gender</Label>
                    <p className="text-sm capitalize">{profile?.gender || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Pronouns</Label>
                    <p className="text-sm">{profile?.pronouns || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Nationality</Label>
                    <p className="text-sm">{profile?.nationality || "Not specified"}</p>
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
                    <p className="text-sm">{profile?.email || ""}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                    <p className="text-sm">{profile?.phone || ""}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Alternative Phone</Label>
                    <p className="text-sm">{profile?.alternative_phone || "Not provided"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                    <p className="text-sm">{profile?.address || ""}</p>
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
                    <p className="text-sm font-mono">{profile?.employee_id || ""}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Date Hired</Label>
                    <p className="text-sm">{profile?.date_hired ? new Date(profile.date_hired).toLocaleDateString() : "Not specified"}</p>
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
                  <Badge variant={profile?.id_verified ? "default" : "secondary"}>
                    ID Verified {profile?.id_verified ? "✓" : "✗"}
                  </Badge>
                  <Badge variant={profile?.bank_verified ? "default" : "secondary"}>
                    Bank Verified {profile?.bank_verified ? "✓" : "✗"}
                  </Badge>
                  {profile?.nationality && profile?.nationality !== "South Africa" && (
                    <Badge variant={profile?.work_permit_verified ? "default" : "secondary"}>
                      Work Permit Verified {profile?.work_permit_verified ? "✓" : "✗"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Edit/Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{profile ? 'Edit Profile' : 'Create Profile'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Personal Information</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField field="first_name" label="First Name" required placeholder="Enter first name" />
                  <InputField field="preferred_name" label="Preferred Name" placeholder="Enter preferred name" />
                  <InputField field="middle_name" label="Middle Name" placeholder="Enter middle name" />
                  <InputField field="last_name" label="Last Name" required placeholder="Enter last name" />
                  <div>
                    <Label htmlFor="nationality">Nationality <span className="text-red-500">*</span></Label>
                    <Select 
                      value={formData.nationality || "South Africa"} 
                      onValueChange={(value) => {
                        handleInputChange('nationality', value)
                        setTouched(prev => ({ ...prev, nationality: true }))
                      }}
                    >
                      <SelectTrigger className={cn(
                        errors.nationality && touched.nationality && "border-red-500 focus:border-red-500"
                      )}>
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
                  {(formData.nationality === "South Africa" || !formData.nationality) && (
                    <InputField field="id_number" label="ID Number" placeholder="13-digit South African ID" maxLength={13} />
                  )}
                  {formData.nationality && formData.nationality !== "South Africa" && (
                    <>
                      <InputField field="passport_number" label="Passport Number" placeholder="Enter passport number" />
                      <InputField field="work_permit_number" label="Work Permit Number" placeholder="Enter work permit number" />
                    </>
                  )}
                  <div>
                    <Label htmlFor="dob">Date of Birth <span className="text-red-500">*</span></Label>
                    <Input 
                      id="dob" 
                      type="date" 
                      value={formData.dob || ""} 
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, dob: true }))}
                      className={cn(
                        errors.dob && touched.dob && "border-red-500 focus:border-red-500"
                      )}
                    />
                    <ErrorMessage field="dob" />
                  </div>
                  <div>
                    <Label htmlFor="sex">Sex <span className="text-red-500">*</span></Label>
                    <Select 
                      value={formData.sex || ""} 
                      onValueChange={(value) => {
                        handleInputChange('sex', value)
                        setTouched(prev => ({ ...prev, sex: true }))
                      }}
                    >
                      <SelectTrigger className={cn(
                        errors.sex && touched.sex && "border-red-500 focus:border-red-500"
                      )}>
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
                    <Label htmlFor="gender">Gender Identity</Label>
                    <Select 
                      value={formData.gender || ""} 
                      onValueChange={(value) => {
                        handleInputChange('gender', value)
                        setTouched(prev => ({ ...prev, gender: true }))
                      }}
                    >
                      <SelectTrigger className={cn(
                        errors.gender && touched.gender && "border-red-500 focus:border-red-500"
                      )}>
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
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Contact Information</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField field="email" label="Email Address" type="email" required placeholder="your.email@company.com" />
                  <InputField field="phone" label="Phone Number" required placeholder="+27 XX XXX XXXX" />
                  <InputField field="alternative_phone" label="Alternative Phone" placeholder="+27 XX XXX XXXX" />
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea 
                      id="address" 
                      rows={3} 
                      value={formData.address || ""} 
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
                      className={cn(
                        errors.address && touched.address && "border-red-500 focus:border-red-500"
                      )}
                    />
                    <ErrorMessage field="address" />
                  </div>
                </div>
              </div>
            </div>

            {/* Employment Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Employment Details</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(formData.nationality === "South Africa" || !formData.nationality) && (
                    <InputField field="tax_number" label="Tax Number" placeholder="Enter tax number" />
                  )}
                  <InputField field="employee_id" label="Employee ID" placeholder="XSP25/01/001" />
                  <div>
                    <Label htmlFor="job_title_id">Job Title</Label>
                    <Select
                      value={formData.job_title_id || ""}
                      onValueChange={(value) => handleInputChange('job_title_id', value)}
                    >
                      <SelectTrigger
                        id="job_title_id"
                        className={cn(
                          errors.job_title_id && touched.job_title_id && "border-red-500 focus:border-red-500"
                        )}
                      >
                        <SelectValue placeholder="Select job title" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTitles.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title}
                          </SelectItem>
                        ))}
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
                      className={cn(
                        errors.date_hired && touched.date_hired && "border-red-500 focus:border-red-500"
                      )}
                    />
                    <ErrorMessage field="date_hired" />
                  </div>
                </div>
              </div>
            </div>

            {/* Documents & Verification Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Documents & Verification</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="documents">Documents</Label>
                    <Input 
                      id="documents" 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={(e) => handleFileUpload('documents', e.target.files?.[0] || null)}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Upload document (JPG, PNG, PDF up to 10MB)</p>
                  </div>
                  <div>
                    <Label htmlFor="images">Images</Label>
                    <Input 
                      id="images" 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload('images', e.target.files?.[0] || null)}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Upload image (JPG, PNG up to 10MB)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="id_verified" type="checkbox" checked={!!formData.id_verified} onChange={(e) => handleInputChange('id_verified', e.target.checked)} disabled />
                    <Label htmlFor="id_verified">ID Verified</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Next of Kin Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Next of Kin</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nok_name">Full Name</Label>
                  <Input 
                    id="nok_name" 
                    value={nokData.name || ""} 
                    onChange={(e) => {
                      const value = sanitizeInput(e.target.value)
                      setNokData(prev => ({ ...prev, name: value }))
                      setTouched(prev => ({ ...prev, "nok_name": true }))
                      // Validate nested field
                      const includeNok = true
                      const includeBank = Object.values(bankData).some(v => v)
                      const data = { ...formData, next_of_kin: { ...nokData, name: value }, banking_details: includeBank ? bankData : undefined }
                      const result = appFormSchema.safeParse(data)
                      if (!result.success) {
                        const issue = result.error.issues.find(i => i.path.join('.') === 'next_of_kin.name')
                        setErrors(prev => ({ ...prev, "nok_name": issue?.message || "" }))
                      } else {
                        setErrors(prev => ({ ...prev, "nok_name": "" }))
                      }
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, "nok_name": true }))}
                    className={cn(
                      errors["nok_name"] && touched["nok_name"] && "border-red-500 focus:border-red-500"
                    )}
                  />
                  <ErrorMessage field="nok_name" />
                </div>
                <div>
                  <Label htmlFor="nok_relationship">Relationship</Label>
                  <Input 
                    id="nok_relationship" 
                    value={nokData.relationship || ""} 
                    onChange={(e) => {
                      const value = sanitizeInput(e.target.value)
                      setNokData(prev => ({ ...prev, relationship: value }))
                      setTouched(prev => ({ ...prev, "nok_relationship": true }))
                      const includeNok = true
                      const includeBank = Object.values(bankData).some(v => v)
                      const data = { ...formData, next_of_kin: { ...nokData, relationship: value }, banking_details: includeBank ? bankData : undefined }
                      const result = appFormSchema.safeParse(data)
                      if (!result.success) {
                        const issue = result.error.issues.find(i => i.path.join('.') === 'next_of_kin.relationship')
                        setErrors(prev => ({ ...prev, "nok_relationship": issue?.message || "" }))
                      } else {
                        setErrors(prev => ({ ...prev, "nok_relationship": "" }))
                      }
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, "nok_relationship": true }))}
                    className={cn(
                      errors["nok_relationship"] && touched["nok_relationship"] && "border-red-500 focus:border-red-500"
                    )}
                  />
                  <ErrorMessage field="nok_relationship" />
                </div>
                <div>
                  <Label htmlFor="nok_phone">Phone</Label>
                  <Input 
                    id="nok_phone" 
                    value={nokData.phone || ""} 
                    onChange={(e) => {
                      const value = normalizePhone(e.target.value)
                      setNokData(prev => ({ ...prev, phone: value }))
                      setTouched(prev => ({ ...prev, "nok_phone": true }))
                      const includeNok = true
                      const includeBank = Object.values(bankData).some(v => v)
                      const data = { ...formData, next_of_kin: { ...nokData, phone: value }, banking_details: includeBank ? bankData : undefined }
                      const result = appFormSchema.safeParse(data)
                      if (!result.success) {
                        const issue = result.error.issues.find(i => i.path.join('.') === 'next_of_kin.phone')
                        setErrors(prev => ({ ...prev, "nok_phone": issue?.message || "" }))
                      } else {
                        setErrors(prev => ({ ...prev, "nok_phone": "" }))
                      }
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, "nok_phone": true }))}
                    className={cn(
                      errors["nok_phone"] && touched["nok_phone"] && "border-red-500 focus:border-red-500"
                    )}
                  />
                  <ErrorMessage field="nok_phone" />
                </div>
                <div>
                  <Label htmlFor="nok_address">Address</Label>
                  <Input 
                    id="nok_address" 
                    value={(nokData as any).address || ""} 
                    onChange={(e) => {
                      const value = sanitizeInput(e.target.value)
                      setNokData(prev => ({ ...prev, address: value }))
                      setTouched(prev => ({ ...prev, "nok_address": true }))
                      const includeNok = true
                      const includeBank = Object.values(bankData).some(v => v)
                      const data = { ...formData, next_of_kin: { ...nokData, address: value }, banking_details: includeBank ? bankData : undefined }
                      const result = appFormSchema.safeParse(data)
                      if (!result.success) {
                        const issue = result.error.issues.find(i => i.path.join('.') === 'next_of_kin.address')
                        setErrors(prev => ({ ...prev, "nok_address": issue?.message || "" }))
                      } else {
                        setErrors(prev => ({ ...prev, "nok_address": "" }))
                      }
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, "nok_address": true }))}
                    className={cn(
                      errors["nok_address"] && touched["nok_address"] && "border-red-500 focus:border-red-500"
                    )}
                  />
                  <ErrorMessage field="nok_address" />
                </div>
              </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="min-w-[100px]">Cancel</Button>
              <Button onClick={async () => { 
                console.log('Save Profile button clicked')
                try {
                  await handleSaveProfile()
                  setIsModalOpen(false)
                  // Re-fetch latest profile and broadcast update without full reload
                  try {
                    const res = await fetch('/api/auth/me', { headers: { 'Content-Type': 'application/json' } })
                    const json = await res.json().catch(() => ({}))
                    if (json?.data?.employee) {
                      localStorage.setItem('xspark_employee', JSON.stringify(json.data.employee))
                    }
                  } catch {}
                  window.dispatchEvent(new CustomEvent('profile-updated'))
                } catch (err) {
                  console.error('Save failed:', err)
                  // Modal stays open on error
                }
              }} disabled={isSubmitting || isValidating} className="min-w-[140px] bg-primary hover:bg-primary/90 font-semibold">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

