import { z } from "zod"

// Custom validation functions
const nameRegex = /^[a-zA-Z\s\-']+$/
const nameLettersSpacesOnlyRegex = /^[a-zA-Z\s]+$/
const relationshipRegex = /^[a-zA-Z\s]+$/
const phoneRegex = /^[\+]?[0-9\s\(\)\-]{7,15}$/
const saPhoneRegex = /^(0[\s\-]?[\d\s\-]{9,}|\+27[\s\-]?[\d\s\-]{9,})$/
const taxNumberRegex = /^[0-9]{4,15}$/
const passportNumberRegex = /^[a-zA-Z0-9]{5,20}$/
const workPermitNumberRegex = /^[A-Z0-9]{6,20}$/
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// Date validation helpers
const isDateValid = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime())
}

const isAtLeast16YearsOld = (date: Date): boolean => {
  const today = new Date()
  const age = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    return age - 1 >= 16
  }
  return age >= 16
}

const isNotInFuture = (date: Date): boolean => {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date <= today
}

// South African ID validation
const validateSAID = (idNumber: string): boolean => {
  if (!/^[0-9]{13}$/.test(idNumber)) return false
  
  let sum = 0
  let alt = false
  
  for (let i = idNumber.length - 1; i >= 0; i--) {
    let n = parseInt(idNumber.charAt(i), 10)
    
    if (alt) {
      n *= 2
      if (n > 9) {
        n = (n % 10) + 1
      }
    }
    
    sum += n
    alt = !alt
  }
  
  return sum % 10 === 0
}

// Parse SA ID and derive DOB (returns YYYY-MM-DD format)
export const deriveDOBFromSAID = (idNumber: string): string | null => {
  if (!idNumber || !/^[0-9]{13}$/.test(idNumber) || !validateSAID(idNumber)) {
    return null
  }
  
  // Extract YYMMDD (first 6 digits)
  const yy = parseInt(idNumber.substring(0, 2), 10)
  const mm = parseInt(idNumber.substring(2, 4), 10)
  const dd = parseInt(idNumber.substring(4, 6), 10)
  
  // Century resolution: YY > currentYY → 19YY, otherwise 20YY
  const currentYY = new Date().getFullYear() % 100
  const fullYear = yy > currentYY ? 1900 + yy : 2000 + yy
  
  // Validate month and day
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return null
  }
  
  // Format as YYYY-MM-DD
  const month = String(mm).padStart(2, '0')
  const day = String(dd).padStart(2, '0')
  
  return `${fullYear}-${month}-${day}`
}

// Parse SA ID and derive sex (returns "male" or "female")
export const deriveSexFromSAID = (idNumber: string): "male" | "female" | null => {
  if (!idNumber || !/^[0-9]{13}$/.test(idNumber) || !validateSAID(idNumber)) {
    return null
  }
  
  // Extract SSSS (gender sequence, digits 7-10, 0-indexed: 6-9)
  const ssss = parseInt(idNumber.substring(6, 10), 10)
  
  // 0000-4999 = female, 5000-9999 = male
  return ssss >= 5000 ? "male" : "female"
}

// Small helper: trim + collapse internal whitespace for string fields
// Chainable string helper that returns a real ZodString and supports .max(), .regex(), etc.
// Note: Null/undefined are handled via .optional().nullable() at each field usage.
// If you need space collapsing, apply it at usage sites with a .transform after validation.
export const trimmed = (): z.ZodString => z.string().trim()

// Canonical App Form validation schema (single source of truth)
// NOTE: Fields are OPTIONAL by default. Contexts (admin/onboarding) can enforce required rules separately.
export const appFormSchema = z.object({
  // Personal Information
  first_name: trimmed()
    .max(60, "First name must be 60 characters or less")
    .regex(nameRegex, "First name can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  middle_name: trimmed()
    .max(60, "Middle name must be 60 characters or less")
    .regex(nameRegex, "Middle name can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // last_name: optional, same constraints as first_name if present
  last_name: trimmed()
    .max(60, "Last name must be 60 characters or less")
    .regex(nameRegex, "Last name can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  preferred_name: trimmed()
    .max(50, "Preferred name must be 50 characters or less")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Identity Information
  id_number: trimmed()
    .regex(/^[0-9]{13}$/, "ID number must be exactly 13 digits")
    .refine(validateSAID, "Invalid South African ID number format")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // dob: optional; format/age checks applied only if present
  dob: trimmed()
    .refine((dateStr) => {
      if (!dateStr) return true
      const date = new Date(dateStr as string)
      return isDateValid(date)
    }, "Invalid date format")
    .refine((dateStr) => {
      if (!dateStr) return true
      const date = new Date(dateStr as string)
      return isNotInFuture(date)
    }, "Date of birth cannot be in the future")
    .refine((dateStr) => {
      if (!dateStr) return true
      const date = new Date(dateStr as string)
      return isAtLeast16YearsOld(date)
    }, "You must be at least 16 years old")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // sex: optional enum
  sex: z.enum(["male", "female"]).optional().nullable(),
  
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]) 
    .optional()
    .nullable()
    .or(z.literal("")),
  
  pronouns: trimmed()
    .max(50, "Pronouns must be 50 characters or less")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Employee Information
  employee_id: trimmed()
    .regex(/^XSP\d{2}\/\d{2}\/\d{3}$/, "Invalid employee ID format")
    .optional()
    .nullable(),
  
  // Job Information
  job_title_id: trimmed()
    .regex(uuidRegex, "Job title ID must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Contact Information
  email: trimmed()
    .email("Invalid email format")
    .max(255, "Email must be 255 characters or less")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  phone: trimmed()
    .regex(phoneRegex, "Phone number must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
    .transform((phone) => phone.replace(/\D/g, ''))
    .optional()
    .nullable()
    .or(z.literal("")),
  
  alternative_phone: trimmed()
    .regex(phoneRegex, "Alternative phone must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
    .transform((phone) => phone.replace(/\D/g, ''))
    .optional()
    .nullable()
    .or(z.literal("")),
  
  address: trimmed()
    .max(500, "Address must be 500 characters or less")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Tax and Nationality
  tax_number: trimmed()
    .regex(taxNumberRegex, "Tax number must be 4–15 digits only")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  nationality: z.enum(["South Africa", "Namibia", "Botswana", "Zimbabwe", "Other"]).optional().nullable(),
  
  // Foreign National Information
  passport_number: trimmed()
    .regex(passportNumberRegex, "Passport number must be 5-20 alphanumeric characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Work permit number (alphanumeric identifier)
  work_permit_number: trimmed()
    .regex(workPermitNumberRegex, "Work permit number must be 6-20 uppercase letters and numbers")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Passport document URL (optional) - legacy name
  passport_document: trimmed()
    .url("Invalid passport document URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Work permit URL (optional) - legacy name
  work_permit: trimmed()
    .url("Invalid work permit URL")
    .optional()
    .nullable()
    .or(z.literal("")),

  // Newer explicit naming (optional)
  work_permit_url: trimmed()
    .url("Invalid work permit URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Verification Status (read-only, set by admin)
  id_verified: z.boolean().default(false),
  work_permit_verified: z.boolean().default(false),
  bank_verified: z.boolean().default(false),
  
  // Employment Status
  employment_status: z.enum([
    "active", "suspended", "terminated", "probation", "absconded"
  ]).default("probation"),
  
  // date_hired: optional; not in future if provided
  date_hired: trimmed()
    .refine((dateStr) => {
      if (!dateStr) return true
      const date = new Date(dateStr as string)
      return isDateValid(date)
    }, "Invalid date format")
    .refine((dateStr) => {
      if (!dateStr) return true
      const date = new Date(dateStr as string)
      return isNotInFuture(date)
    }, "Date hired cannot be in the future")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  // Profile Documents
  profile_picture_url: trimmed()
    .url("Invalid profile picture URL")
    .max(500, "Profile picture URL must be 500 characters or less")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  documents: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
    size: z.number(),
    uploaded_at: z.string()
  })).default([]),
  
  // Next of Kin Information
  next_of_kin: z.object({
    // Required fields with validation
    name: trimmed()
      .min(1, "Full name is required")
      .max(60, "Full name must be 60 characters or less")
      .regex(nameLettersSpacesOnlyRegex, "Full name can only contain letters and spaces"),
    
    first_name: trimmed()
      .min(1, "First name is required")
      .max(60, "First name must be 60 characters or less")
      .regex(nameRegex, "First name can only contain letters, spaces, hyphens, and apostrophes"),
    
    middle_name: trimmed()
      .max(60, "Middle name must be 60 characters or less")
      .regex(nameRegex, "Middle name can only contain letters, spaces, hyphens, and apostrophes")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    last_name: trimmed()
      .min(1, "Last name is required")
      .max(60, "Last name must be 60 characters or less")
      .regex(nameRegex, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
    
    email: trimmed()
      .email("Invalid email format")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    phone: trimmed()
      .min(1, "Phone number is required")
      .regex(saPhoneRegex, "Phone must be in South African format: 0XXXXXXXXX or +27XXXXXXXXX")
      .refine((phone) => {
        // Ensure exactly 9 digits after prefix
        const cleaned = phone.replace(/\s/g, '')
        const digitsOnly = cleaned.replace(/\D/g, '')
        if (cleaned.startsWith('+27')) {
          return digitsOnly.length === 12 // +27 + 9 digits
        }
        if (cleaned.startsWith('0')) {
          return digitsOnly.length === 10 // 0 + 9 digits
        }
        return false
      }, "Phone must have exactly 9 digits after the prefix (0 or +27)")
      .transform((phone) => {
        // Normalize to SA format: keep +27 or 0 prefix, remove spaces/formatting
        const cleaned = phone.replace(/\s/g, '')
        if (cleaned.startsWith('+27')) {
          return '+27' + cleaned.slice(3).replace(/\D/g, '')
        }
        if (cleaned.startsWith('0')) {
          return '0' + cleaned.slice(1).replace(/\D/g, '')
        }
        return cleaned.replace(/\D/g, '')
      }),
    
    alternative_phone: trimmed()
      .regex(phoneRegex, "Alternative phone must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
      .transform((phone) => phone.replace(/\D/g, ''))
      .optional()
      .nullable()
      .or(z.literal("")),
    
    relationship: trimmed()
      .min(3, "Relationship must be at least 3 characters")
      .max(40, "Relationship must be 40 characters or less")
      .regex(relationshipRegex, "Relationship can only contain letters and spaces"),
    
    address: trimmed()
      .min(5, "Address must be at least 5 characters")
      .max(500, "Address must be 500 characters or less")
  }).optional(),
  
  // Banking Information
  banking_details: z.object({
    full_name: trimmed()
      .max(255, "Full name must be 255 characters or less")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    id_number: trimmed()
      .regex(/^\d{13}$/, "ID number must be exactly 13 digits")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    email: trimmed()
      .email("Invalid email format")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    phone: trimmed()
      .regex(phoneRegex, "Phone number must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
      .transform((phone) => phone.replace(/\D/g, ''))
      .optional()
      .nullable()
      .or(z.literal("")),
    
    address: trimmed()
      .max(500, "Address must be 500 characters or less")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    bank_name: trimmed()
      .max(100, "Bank name must be 100 characters or less")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    account_number: trimmed()
      .max(50, "Account number must be 50 characters or less")
      .regex(/^[0-9]+$/, "Account number must contain only digits")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    branch_number: trimmed()
      .max(20, "Branch number must be 20 characters or less")
      .optional()
      .nullable()
      .or(z.literal("")),
    
    account_type: trimmed()
      .max(50, "Account type must be 50 characters or less")
      .optional()
      .nullable()
      .or(z.literal(""))
  }).optional()
}).refine((data) => {
  // Cross-field validation: if id_number is valid and dob is provided, they must match
  if (data.id_number && data.dob) {
    const idStr = String(data.id_number).trim()
    if (idStr && /^[0-9]{13}$/.test(idStr) && validateSAID(idStr)) {
      const derivedDOB = deriveDOBFromSAID(idStr)
      if (derivedDOB && data.dob !== derivedDOB) {
        return false
      }
    }
  }
  return true
}, {
  message: "Date of birth does not match the ID number",
  path: ["dob"]
})

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(10 * 1024 * 1024),
  allowedTypes: z.array(z.string()).default(["image/jpeg", "image/png", "image/gif", "application/pdf"])
}).refine((data) => {
  return data.file.size <= data.maxSize
}, {
  message: "File size must be less than 10MB",
  path: ["file"]
}).refine((data) => {
  return data.allowedTypes.includes(data.file.type)
}, {
  message: "File must be an image (JPEG, PNG, GIF) or PDF",
  path: ["file"]
})

// Validation error types for UI
export type ValidationError = {
  field: string
  message: string
  code: string
}

export type ProfileFormData = z.infer<typeof appFormSchema>
export type Profile = z.infer<typeof appFormSchema>

// Helper functions for validation
export const validateProfile = (data: unknown): { success: boolean; errors?: ValidationError[] } => {
  try {
    appFormSchema.parse(data)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
      return { success: false, errors }
    }
    return { success: false, errors: [{ field: 'general', message: 'Validation failed', code: 'unknown' }] }
  }
}

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

export const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '')
  }
  return cleaned.replace(/\D/g, '')
}

export const formatEmployeeId = (): string => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  
  return `XSP${year}${month}/${sequence}`
}


















