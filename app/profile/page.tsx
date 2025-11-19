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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Upload, User, Mail, Phone, MapPin, CreditCard, Users, Edit, AlertCircle, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { sanitizeInput, normalizePhone, type ValidationError, type ProfileFormData, appFormSchema } from "@/lib/validation/app-form"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let browserSupabase: SupabaseClient | null = null
let supabaseWarningLogged = false

const getBrowserSupabase = (): SupabaseClient | null => {
  if (typeof window === "undefined") return null
  if (browserSupabase) return browserSupabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!supabaseWarningLogged) {
      console.info("Next of kin sync falling back to API route because Supabase environment variables are not set.")
      supabaseWarningLogged = true
    }
    return null
  }

  browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: "public",
    },
  })

  return browserSupabase
}
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
  const createEmptyNextOfKin = () => ({
    id: undefined as string | undefined,
    first_name: "",
    middle_name: "",
    last_name: "",
    relationship: "",
    phone: "",
    alternative_phone: "",
    email: "",
    address: "",
    is_primary: false
  })
  const [nokData, setNokData] = useState([createEmptyNextOfKin()])
  const [openPanels, setOpenPanels] = useState<string[]>([])
  type NextOfKinField = Exclude<keyof ReturnType<typeof createEmptyNextOfKin>, "id" | "is_primary">

type NextOfKinUpsertEntry = {
  id?: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string | null
  phone: string
  alternative_phone: string | null
  relationship: string
  is_primary: boolean
}

const mapNokEntryToSchema = (entry: ReturnType<typeof createEmptyNextOfKin>) => {
  const firstName = entry.first_name.trim()
  const middleName = entry.middle_name.trim()
  const lastName = entry.last_name.trim()
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ")

  return {
    name: fullName,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    relationship: entry.relationship.trim(),
    phone: entry.phone.trim(),
    alternative_phone: entry.alternative_phone.trim(),
    address: entry.address.trim(),
    email: entry.email.trim()
  }
}

const mapNokEntryToPayload = (entry: ReturnType<typeof createEmptyNextOfKin>) => {
  const firstName = entry.first_name.trim()
  const middleName = entry.middle_name.trim()
  const lastName = entry.last_name.trim()
  const relationship = entry.relationship.trim()
  const phone = entry.phone.trim()
  const altPhone = entry.alternative_phone.trim()
  const address = entry.address.trim()
  const email = entry.email.trim()
  if (!firstName || !lastName || !relationship || !phone) {
    return null
  }

  const payload: Record<string, any> = {
    id: entry.id,
    first_name: firstName || undefined,
    middle_name: middleName || undefined,
    last_name: lastName || undefined,
    relationship: relationship || undefined,
    phone: phone || undefined,
    alternative_phone: altPhone || undefined,
    address: address || undefined,
    email: email || undefined,
    full_name: [firstName, middleName, lastName].filter(Boolean).join(" ") || undefined,
    is_primary: entry.is_primary ? true : undefined
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") {
      delete payload[key]
    }
  })

  return Object.keys(payload).length ? payload : null
}

const toStringSafe = (value: any) => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

const splitLegacyName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return { first: "", middle: "", last: "" }
  }
  const first = parts[0] || ""
  const last = parts.length > 1 ? parts[parts.length - 1] : ""
  const middle = parts.length > 2 ? parts.slice(1, -1).join(" ") : ""
  return { first, middle, last }
}

const mapProfileNokToState = (entry: any) => {
  const fallbackName = toStringSafe(entry?.full_name ?? entry?.name ?? "")
  const legacyParts = splitLegacyName(fallbackName)

  return {
    id: entry?.id || entry?.next_of_kin_id || entry?.nok_id || undefined,
    first_name: toStringSafe(entry?.first_name ?? legacyParts.first).trim(),
    middle_name: toStringSafe(entry?.middle_name ?? legacyParts.middle).trim(),
    last_name: toStringSafe(entry?.last_name ?? legacyParts.last).trim(),
    relationship: toStringSafe(entry?.relationship).trim(),
    phone: toStringSafe(entry?.phone).trim(),
    alternative_phone: toStringSafe(entry?.alternative_phone ?? "").trim(),
    email: toStringSafe(entry?.email).trim(),
    address: toStringSafe(entry?.address).trim(),
    is_primary: Boolean(entry?.is_primary)
  }
}
  
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

const nokNameRegex = /^[a-zA-Z\s\-']+$/

const NOK_VALIDATORS: Record<string, { regex: RegExp; message: string }> = {
  first_name: {
    regex: nokNameRegex,
    message: "Enter a valid first name."
  },
  last_name: {
    regex: nokNameRegex,
    message: "Enter a valid last name."
  },
  phone: {
    regex: /^\+?\d{7,15}$/,
    message: "Enter a valid phone number (digits only, optional +, 7–15 digits)."
  },
  email: {
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Enter a valid email address."
  }
}

const hasNextOfKinEntries = (data = nokData) =>
  data.some(entry => {
    const valuesToCheck = [
      entry.first_name,
      entry.last_name,
      entry.relationship,
      entry.phone,
      entry.alternative_phone,
      entry.email,
      entry.address
    ]
    return valuesToCheck.some(value => typeof value === "string" ? value.trim() !== "" : Boolean(value))
  })

const getNokErrorKey = (index: number, field: string) => `nok${index + 1}_${field}`

const getPrimaryNokEntry = () => {
  const populated = nokData.find(entry =>
    Object.values(entry).some(value =>
      typeof value === "string" ? value.trim() !== "" : Boolean(value)
    )
  )
  return populated ?? nokData[0]
}

const buildNextOfKinUpsertEntries = (): NextOfKinUpsertEntry[] => {
  return nokData
    .map<NextOfKinUpsertEntry | null>((entry, index) => {
      const firstName = entry.first_name.trim()
      const middleName = entry.middle_name.trim()
      const lastName = entry.last_name.trim()
      const relationship = entry.relationship.trim()
      const phone = entry.phone.trim()
      const altPhone = entry.alternative_phone.trim()
      const email = entry.email.trim()

      if (!firstName && !lastName && !relationship && !phone && !email) {
        return null
      }

      if (!firstName || !lastName || !relationship || !phone) {
        return null
      }

      const upsertEntry: NextOfKinUpsertEntry = {
        id: entry.id,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        email: email || null,
        phone,
        alternative_phone: altPhone || null,
        relationship,
        is_primary: index === 0,
      }

      return upsertEntry
    })
    .filter((entry): entry is NextOfKinUpsertEntry => entry !== null)
}

const handleAddNextOfKin = () => {
  setNokData(prev => {
    const nextIndex = prev.length
    setOpenPanels(current => [...current, `nok-${nextIndex}`])
    return [...prev, createEmptyNextOfKin()]
  })
}

const handlePanelToggle = (value: string) => {
  setOpenPanels(prev => {
    const isOpen = prev.includes(value)
    if (isOpen) {
      const index = Number(value.replace('nok-', ''))
      const entry = nokData[index]
      if (
        entry &&
        !entry.id &&
        !entry.first_name.trim() &&
        !entry.last_name.trim() &&
        !entry.relationship.trim() &&
        !entry.phone.trim() &&
        !entry.alternative_phone.trim() &&
        !entry.email.trim() &&
        !entry.address.trim()
      ) {
        setNokData(data => data.filter((_, i) => i !== index))
        return prev.filter(item => item !== value)
      }
    }
    return prev.includes(value)
      ? prev.filter(item => item !== value)
      : [...prev, value]
  })
}

const upsertNextOfKinViaApi = async (employeeId: string, entries: NextOfKinUpsertEntry[]) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    try {
      const storedSession = localStorage.getItem('xspark_session')
      if (storedSession) {
        const sessionParsed = JSON.parse(storedSession)
        if (sessionParsed?.access_token) {
          headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
        }
      }
    } catch (error) {
      console.warn('Failed to parse session for NOK API:', error)
    }

    const response = await fetch('/api/next-of-kin/upsert', {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId, entries })
    })

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}))
      console.error('Next of Kin API upsert error:', errorJson?.error || response.statusText)
    }
  } catch (error) {
    console.error('Next of Kin API upsert request failed:', error)
  }
}

const upsertNextOfKinRecords = async (employeeId: string) => {
  const client = getBrowserSupabase()
  const entries = buildNextOfKinUpsertEntries()
  if (!entries.length) return

  try {
    if (!client) {
      await upsertNextOfKinViaApi(employeeId, entries)
      return
    }

    const { data: existingNok, error: existingError } = await client
      .from('next_of_kin')
      .select('id')
      .eq('employee_id', employeeId)
      .order('is_primary', { ascending: false })
      .limit(2)

    if (existingError) {
      console.error('Next of Kin lookup error:', existingError)
    }

    const upsertPayload = entries.map((entry, idx) => ({
      ...entry,
      employee_id: employeeId,
      id: existingNok?.[idx]?.id ?? undefined,
    }))

    const { error: upsertError } = await client
      .from('next_of_kin')
      .upsert(upsertPayload, { onConflict: 'id' })

    if (upsertError) {
      console.error('Next of Kin save error:', upsertError)
    }
  } catch (error) {
    console.error('Unexpected Next of Kin upsert error:', error)
  }
}

const validateNokField = (index: number, field: NextOfKinField, value: string) => {
  const validator = NOK_VALIDATORS[field]
  const errorKey = getNokErrorKey(index, field)

  if (!validator) {
    setErrors(prev => ({ ...prev, [errorKey]: "" }))
    return true
  }

  const trimmedValue = (value ?? "").trim()
  if (!trimmedValue) {
    setErrors(prev => ({ ...prev, [errorKey]: "" }))
    return true
  }

  const isValid = validator.regex.test(trimmedValue)
  setErrors(prev => ({ ...prev, [errorKey]: isValid ? "" : validator.message }))
  return isValid
}

const validateAllNokEntries = () => {
  let allValid = true
  const touchedUpdates: Record<string, boolean> = {}
  nokData.forEach((entry, index) => {
    (Object.keys(NOK_VALIDATORS) as Array<keyof typeof NOK_VALIDATORS>).forEach((fieldKey) => {
      const key = getNokErrorKey(index, fieldKey)
      touchedUpdates[key] = true
      const value = entry[fieldKey as NextOfKinField] as string
      const isValid = validateNokField(index, fieldKey as NextOfKinField, value)
      if (!isValid) {
        allValid = false
      }
    })
  })
  if (Object.keys(touchedUpdates).length) {
    setTouched(prev => ({ ...prev, ...touchedUpdates }))
  }
  return allValid
}

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
            if (Array.isArray(parsed.next_of_kin) && parsed.next_of_kin.length) {
              setNokData(parsed.next_of_kin.map(mapProfileNokToState))
            } else {
              setNokData([createEmptyNextOfKin()])
            }
            setOpenPanels([])
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
        console.log('Profile data:', json?.data?.employee, 'Next of kin:', json?.data?.employee?.next_of_kin)

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
          if (Array.isArray(employee.next_of_kin) && employee.next_of_kin.length) {
            setNokData(employee.next_of_kin.map(mapProfileNokToState))
          } else {
            setNokData([createEmptyNextOfKin()])
          }
          setOpenPanels([])

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
    setOpenPanels(prev =>
      prev.filter(value => {
        const index = Number(value.replace("nok-", ""))
        return !Number.isNaN(index) && index < nokData.length
      })
    )
  }, [nokData.length])

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
  const includeNok = hasNextOfKinEntries()
    const includeBank = Object.values(bankData).some(v => v)
  const data: any = { ...formData, [field]: value, banking_details: includeBank ? bankData : undefined }
  if (includeNok) {
    data.next_of_kin = mapNokEntryToSchema(getPrimaryNokEntry())
  }
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
  const includeNok = hasNextOfKinEntries()
    const includeBank = Object.values(bankData).some(v => v)
  const data: any = { ...formData, banking_details: includeBank ? bankData : undefined }
  if (includeNok) {
    data.next_of_kin = mapNokEntryToSchema(getPrimaryNokEntry())
  }
    const result = appFormSchema.safeParse(data)
      if (!result.success) {
        const errorMap: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const pathKey = issue.path.join('.')
        if (pathKey.startsWith('next_of_kin.')) {
          const [, subField] = pathKey.split('.')
          if (subField) {
            const normalisedField = subField === 'full_name'
                ? 'name'
                : subField
            errorMap[getNokErrorKey(0, normalisedField)] = issue.message
          }
        } else {
          errorMap[pathKey] = issue.message
        }
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

const handleNokChange = (index: number, field: NextOfKinField, value: any) => {
  let newValue = value
  if (typeof newValue === 'string') {
    newValue = field === 'phone' ? normalizePhone(newValue) : sanitizeInput(newValue)
    }

  const coercedValue = typeof newValue === "string" ? newValue : toStringSafe(newValue)

  setNokData(prev => {
    const updated = [...prev]
    updated[index] = { ...updated[index], [field]: coercedValue }
    return updated
  })

  const errorKey = getNokErrorKey(index, field)
  setTouched(prev => ({ ...prev, [errorKey]: true }))

  if (field in NOK_VALIDATORS) {
    validateNokField(index, field, coercedValue)
  } else {
    setErrors(prev => ({ ...prev, [errorKey]: "" }))
  }
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
  let savedEmployeeId = profile?.id ?? ""
  const nokValid = validateAllNokEntries()
    const isValid = await validateForm()
  const overallValid = nokValid && isValid
  console.log('Validation result:', overallValid, 'Errors:', errors)
    
  if (!overallValid) {
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
      const includeNok = hasNextOfKinEntries()
      const includeBank = Object.values(bankData).some(v => v)
      if (includeNok) {
        const nextOfKinPayload = nokData
          .map(mapNokEntryToPayload)
          .filter((entry): entry is Record<string, any> => !!entry)

        if (nextOfKinPayload.length) {
          submitData.next_of_kin = nextOfKinPayload
        } else {
          delete submitData.next_of_kin
        }
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
        savedEmployeeId = json?.data?.employee?.id || json?.data?.id || savedEmployeeId
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
        savedEmployeeId = json?.data?.employee?.id || json?.data?.id || savedEmployeeId
      }

      if (savedEmployeeId) {
        await upsertNextOfKinRecords(savedEmployeeId)
      } else {
        console.warn('Unable to determine employee ID for Next of Kin upsert')
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">My Profile</h1>
          <p className="text-muted-foreground mt-2">Manage your personal and professional information</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" onClick={() => setIsModalOpen(true)}>
            {profile ? "Edit Profile" : "Create Profile"}
          </Button>
          {profile && !isEditing && (
            <Dialog open={updateRequestOpen} onOpenChange={setUpdateRequestOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Request to Update Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Request Profile Changes</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Submit your change request to HR. You can include supporting documents or extra details in the next
                  screen.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="secondary" onClick={() => setUpdateRequestOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => setUpdateRequestOpen(false)} className="gradient-primary text-white">
                    Got it
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {profile && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.profile_picture_url || undefined} alt={profile.first_name} />
              <AvatarFallback>
                {(profile.first_name?.[0] || "U")}
                {(profile.last_name?.[0] || "N")}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">
                {[profile.first_name, profile.last_name].filter(Boolean).join(" ")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Employee ID</Label>
              <Input readOnly value={profile.employee_id || ""} />
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input readOnly value={profile.department || ""} />
            </div>
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input readOnly value={[profile.first_name, profile.last_name].filter(Boolean).join(" ")} />
            </div>
          </CardContent>
        </Card>
      )}

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
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <Badge className="bg-green-100 text-green-800 border border-green-200">
                        Active Employee
                      </Badge>
                      <Badge variant={profile?.id_verified ? "default" : "secondary"}>
                        ID Verified {profile?.id_verified ? "✓" : "✗"}
                      </Badge>
                      <Badge variant={profile?.bank_verified ? "default" : "secondary"}>
                        Bank Verified {profile?.bank_verified ? "✓" : "✗"}
                      </Badge>
                    </div>
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

            {/* Next of Kin */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Next of Kin
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.isArray(profile?.next_of_kin) && profile?.next_of_kin.length ? (
                  <div className="space-y-4">
                    {profile.next_of_kin.map((kin: any, index: number) => (
                      <div key={kin.id || index} className="rounded-lg border border-gray-200 p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Next of Kin {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {[kin.first_name, kin.middle_name, kin.last_name].filter(Boolean).join(" ") ||
                                kin.full_name ||
                                "Not specified"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{kin.relationship || "Relationship not specified"}</Badge>
                            {kin.is_primary && <Badge variant="default">Primary Contact</Badge>}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                            <p className="text-sm">{kin.phone || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Alternative Phone</Label>
                            <p className="text-sm">{kin.alternative_phone || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                            <p className="text-sm">{kin.email || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Relationship</Label>
                            <p className="text-sm">{kin.relationship || "Not specified"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                            <p className="text-sm">{kin.address || "Not specified"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No next of kin information available.</p>
                )}
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
                  <Badge
                    variant={profile.id_verified ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    {profile.id_verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    <span>ID Verified</span>
                  </Badge>
                  <Badge
                    variant={profile.bank_verified ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    {profile.bank_verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    <span>Bank Verified</span>
                  </Badge>
                  {profile.nationality !== "South Africa" && (
                    <Badge
                      variant={profile.work_permit_verified ? "default" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {profile.work_permit_verified ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      <span>Work Permit Verified</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Edit/Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{profile ? 'Edit Profile' : 'Create Profile'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-8 overflow-y-auto pr-2">
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
                  <InputField field="pronouns" label="Pronouns" placeholder="e.g. They/Them" />
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
              <div className="border-b border-gray-200 pb-2">
                <h3 className="text-lg font-semibold text-gray-900">Next of Kin</h3>
              </div>

              <Accordion
                type="multiple"
                value={openPanels}
                onValueChange={(value) => {
                  setOpenPanels(current => {
                    const next = Array.isArray(value) ? value : []
                    const closed = current.filter(item => !next.includes(item))
                    closed.forEach(item => {
                      const index = Number(item.replace('nok-', ''))
                      const entry = nokData[index]
                      if (
                        entry &&
                        !entry.id &&
                        !entry.first_name.trim() &&
                        !entry.last_name.trim() &&
                        !entry.relationship.trim() &&
                        !entry.phone.trim() &&
                        !entry.alternative_phone.trim() &&
                        !entry.email.trim() &&
                        !entry.address.trim()
                      ) {
                        setNokData(data => data.filter((_, i) => i !== index))
                      }
                    })
                    return next
                  })
                }}
                className="space-y-3"
              >
                {nokData.map((entry, index) => {
                  if (!entry) return null
                  const value = `nok-${index}`
                  const getKey = (field: NextOfKinField) => getNokErrorKey(index, field)
                  const summaryName = [entry.first_name, entry.middle_name, entry.last_name].filter(Boolean).join(" ") || "Details not provided"
                  const summaryRelationship = entry.relationship?.trim()

                  return (
                    <AccordionItem key={value} value={value} className="rounded-lg border border-gray-200">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:hidden">
                        <div className="flex w-full items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Next of Kin {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {summaryName}
                              {summaryRelationship ? ` (${summaryRelationship})` : ""}
                            </p>
                          </div>
                          <span className="pointer-events-none rounded-md border border-primary/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                            {openPanels.includes(value) ? "Hide" : "View / Edit"}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`${value}_first_name`}>
                                First Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`${value}_first_name`}
                                name={`${value}_first_name`}
                                value={entry.first_name}
                                onChange={(e) => handleNokChange(index, "first_name", e.target.value)}
                                onBlur={() => {
                                  setTouched(prev => ({ ...prev, [getKey("first_name")]: true }))
                                  validateNokField(index, "first_name", entry.first_name)
                                }}
                                className={cn(
                                  errors[getKey("first_name")] && touched[getKey("first_name")] && "border-red-500 focus:border-red-500"
                                )}
                              />
                              <ErrorMessage field={getKey("first_name")} />
                            </div>
                            <div>
                              <Label htmlFor={`${value}_middle_name`}>Middle Name (Optional)</Label>
                              <Input
                                id={`${value}_middle_name`}
                                name={`${value}_middle_name`}
                                value={entry.middle_name}
                                onChange={(e) => handleNokChange(index, "middle_name", e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`${value}_last_name`}>
                                Last Name / Surname <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`${value}_last_name`}
                                name={`${value}_last_name`}
                                value={entry.last_name}
                                onChange={(e) => handleNokChange(index, "last_name", e.target.value)}
                                onBlur={() => {
                                  setTouched(prev => ({ ...prev, [getKey("last_name")]: true }))
                                  validateNokField(index, "last_name", entry.last_name)
                                }}
                                className={cn(
                                  errors[getKey("last_name")] && touched[getKey("last_name")] && "border-red-500 focus:border-red-500"
                                )}
                              />
                              <ErrorMessage field={getKey("last_name")} />
                            </div>
                            <div>
                              <Label htmlFor={`${value}_relationship`}>
                                Relationship <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`${value}_relationship`}
                                name={`${value}_relationship`}
                                value={entry.relationship}
                                onChange={(e) => handleNokChange(index, "relationship", e.target.value)}
                                onBlur={() => {
                                  setTouched(prev => ({ ...prev, [getKey("relationship")]: true }))
                                  validateNokField(index, "relationship", entry.relationship)
                                }}
                                className={cn(
                                  errors[getKey("relationship")] &&
                                    touched[getKey("relationship")] &&
                                    "border-red-500 focus:border-red-500"
                                )}
                              />
                              <ErrorMessage field={getKey("relationship")} />
                            </div>
                            <div>
                              <Label htmlFor={`${value}_phone`}>
                                Phone <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`${value}_phone`}
                                name={`${value}_phone`}
                                value={entry.phone}
                                onChange={(e) => handleNokChange(index, "phone", e.target.value)}
                                onBlur={() => {
                                  setTouched(prev => ({ ...prev, [getKey("phone")]: true }))
                                  validateNokField(index, "phone", entry.phone)
                                }}
                                className={cn(
                                  errors[getKey("phone")] && touched[getKey("phone")] && "border-red-500 focus:border-red-500"
                                )}
                              />
                              <ErrorMessage field={getKey("phone")} />
                            </div>
                            <div>
                              <Label htmlFor={`${value}_alternative_phone`}>Alternative Phone (Optional)</Label>
                              <Input
                                id={`${value}_alternative_phone`}
                                name={`${value}_alternative_phone`}
                                value={entry.alternative_phone}
                                onChange={(e) => handleNokChange(index, "alternative_phone", e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`${value}_email`}>Email</Label>
                              <Input
                                id={`${value}_email`}
                                name={`${value}_email`}
                                value={entry.email}
                                onChange={(e) => handleNokChange(index, "email", e.target.value)}
                                onBlur={() => {
                                  setTouched(prev => ({ ...prev, [getKey("email")]: true }))
                                  validateNokField(index, "email", entry.email)
                                }}
                                className={cn(
                                  errors[getKey("email")] && touched[getKey("email")] && "border-red-500 focus:border-red-500"
                                )}
                              />
                              <ErrorMessage field={getKey("email")} />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor={`${value}_address`}>Address</Label>
                              <Textarea
                                id={`${value}_address`}
                                name={`${value}_address`}
                                rows={3}
                                value={entry.address}
                                onChange={(e) => handleNokChange(index, "address", e.target.value)}
                                onBlur={() => {
                                  setTouched(prev => ({ ...prev, [getKey("address")]: true }))
                                  validateNokField(index, "address", entry.address)
                                }}
                                className={cn(
                                  errors[getKey("address")] && touched[getKey("address")] && "border-red-500 focus:border-red-500"
                                )}
                              />
                              <ErrorMessage field={getKey("address")} />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>

              <Button
                type="button"
                variant="outline"
                onClick={handleAddNextOfKin}
                className="w-full border-dashed text-sm font-medium"
              >
                + Add Next of Kin
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-background">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="min-w-[100px]">Cancel</Button>
              <Button onClick={async () => { 
                console.log('Save Profile button clicked')
                try {
                  await handleSaveProfile()
                  setIsModalOpen(false)
                  // Re-fetch latest profile and broadcast update without full reload
                  try {
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                    try {
                      const storedSession = localStorage.getItem('xspark_session')
                      if (storedSession) {
                        const sessionParsed = JSON.parse(storedSession)
                        if (sessionParsed?.access_token) {
                          headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
                        }
                      }
                    } catch (error) {
                      console.warn('Failed to parse session for refresh:', error)
                    }
                    const res = await fetch('/api/auth/me', { headers })
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

