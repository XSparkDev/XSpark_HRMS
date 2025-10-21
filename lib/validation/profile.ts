import { z } from "zod"

// Custom validation functions
const nameRegex = /^[a-zA-Z\s\-']+$/
const phoneRegex = /^[\+]?[0-9\s\(\)\-]{7,15}$/
const taxNumberRegex = /^[0-9]{4,15}$/
const passportNumberRegex = /^[a-zA-Z0-9]{5,20}$/

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
  today.setHours(23, 59, 59, 999) // End of today
  return date <= today
}

// South African ID validation
const validateSAID = (idNumber: string): boolean => {
  if (!/^\d{13}$/.test(idNumber)) return false
  
  // Basic SA ID validation (Luhn-like algorithm)
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

// Profile validation schema
export const profileSchema = z.object({
  // Personal Information
  first_name: z.string()
    .min(1, "First name is required")
    .max(60, "First name must be 60 characters or less")
    .regex(nameRegex, "First name can only contain letters, spaces, hyphens, and apostrophes"),
  
  middle_name: z.string()
    .max(60, "Middle name must be 60 characters or less")
    .regex(nameRegex, "Middle name can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .or(z.literal("")),
  
  last_name: z.string()
    .min(1, "Last name is required")
    .max(60, "Last name must be 60 characters or less")
    .regex(nameRegex, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
  
  preferred_name: z.string()
    .max(60, "Preferred name must be 60 characters or less")
    .regex(nameRegex, "Preferred name can only contain letters, spaces, hyphens, and apostrophes")
    .optional()
    .or(z.literal("")),
  
  // Identity Information
  id_number: z.string()
    .regex(/^\d{13}$/, "ID number must be exactly 13 digits")
    .refine(validateSAID, "Invalid South African ID number format")
    .optional()
    .or(z.literal("")),
  
  dob: z.string()
    .min(1, "Date of birth is required")
    .refine((dateStr) => {
      const date = new Date(dateStr)
      return isDateValid(date)
    }, "Invalid date format")
    .refine((dateStr) => {
      const date = new Date(dateStr)
      return isNotInFuture(date)
    }, "Date of birth cannot be in the future")
    .refine((dateStr) => {
      const date = new Date(dateStr)
      return isAtLeast16YearsOld(date)
    }, "You must be at least 16 years old"),
  
  sex: z.enum(["male", "female"], {
    required_error: "Sex is required"
  }),
  
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"], {
    required_error: "Gender is required"
  }),
  
  pronouns: z.string()
    .max(50, "Pronouns must be 50 characters or less")
    .optional()
    .or(z.literal("")),
  
  // Employee Information
  employee_id: z.string()
    .regex(/^XSP\d{2}\/\d{2}\/\d{3}$/, "Invalid employee ID format")
    .optional(), // Auto-generated, optional for creation
  
  // Job Information
  job_title_id: z.string()
    .min(1, "Job title is required")
    .uuid("Invalid job title selection"),
  
  // Contact Information
  email: z.string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(255, "Email must be 255 characters or less"),
  
  phone: z.string()
    .min(1, "Phone number is required")
    .regex(phoneRegex, "Phone number must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
    .transform((phone) => phone.replace(/\D/g, '')), // Normalize to digits only
  
  alternative_phone: z.string()
    .regex(phoneRegex, "Alternative phone must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
    .transform((phone) => phone.replace(/\D/g, ''))
    .optional()
    .or(z.literal("")),
  
  address: z.string()
    .max(500, "Address must be 500 characters or less")
    .optional()
    .or(z.literal("")),
  
  // Tax and Nationality
  tax_number: z.string()
    .regex(taxNumberRegex, "Tax number must be 4-15 digits only")
    .optional()
    .or(z.literal("")),
  
  nationality: z.enum(["South Africa", "Namibia", "Botswana", "Zimbabwe", "Other"], {
    required_error: "Nationality is required"
  }),
  
  // Foreign National Information
  passport_number: z.string()
    .regex(passportNumberRegex, "Passport number must be 5-20 alphanumeric characters")
    .optional()
    .or(z.literal("")),
  
  passport_document: z.string()
    .url("Invalid passport document URL")
    .optional()
    .or(z.literal("")),
  
  work_permit: z.string()
    .url("Invalid work permit URL")
    .optional()
    .or(z.literal("")),
  
  // Verification Status (read-only, set by admin)
  id_verified: z.boolean().default(false),
  work_permit_verified: z.boolean().default(false),
  bank_verified: z.boolean().default(false),
  
  // Employment Status
  employment_status: z.enum([
    "active", "suspended", "terminated", "probation", "absconded"
  ]).default("probation"),
  
  date_hired: z.string()
    .min(1, "Date hired is required")
    .refine((dateStr) => {
      const date = new Date(dateStr)
      return isDateValid(date)
    }, "Invalid date format")
    .refine((dateStr) => {
      const date = new Date(dateStr)
      return isNotInFuture(date)
    }, "Date hired cannot be in the future"),
  
  // Profile Documents
  profile_picture_url: z.string()
    .url("Invalid profile picture URL")
    .optional()
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
    first_name: z.string()
      .min(1, "Next of kin first name is required")
      .max(60, "First name must be 60 characters or less")
      .regex(nameRegex, "First name can only contain letters, spaces, hyphens, and apostrophes"),
    
    middle_name: z.string()
      .max(60, "Middle name must be 60 characters or less")
      .regex(nameRegex, "Middle name can only contain letters, spaces, hyphens, and apostrophes")
      .optional()
      .or(z.literal("")),
    
    last_name: z.string()
      .min(1, "Next of kin last name is required")
      .max(60, "Last name must be 60 characters or less")
      .regex(nameRegex, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
    
    email: z.string()
      .email("Invalid email format")
      .optional()
      .or(z.literal("")),
    
    phone: z.string()
      .min(1, "Next of kin phone number is required")
      .regex(phoneRegex, "Phone number must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
      .transform((phone) => phone.replace(/\D/g, '')),
    
    alternative_phone: z.string()
      .regex(phoneRegex, "Alternative phone must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
      .transform((phone) => phone.replace(/\D/g, ''))
      .optional()
      .or(z.literal("")),
    
    relationship: z.string()
      .min(1, "Relationship is required")
      .max(100, "Relationship must be 100 characters or less")
  }).optional(),
  
  // Banking Information
  banking_details: z.object({
    full_name: z.string()
      .min(1, "Banking full name is required")
      .max(255, "Full name must be 255 characters or less"),
    
    id_number: z.string()
      .regex(/^\d{13}$/, "ID number must be exactly 13 digits"),
    
    email: z.string()
      .min(1, "Banking email is required")
      .email("Invalid email format"),
    
    phone: z.string()
      .min(1, "Banking phone number is required")
      .regex(phoneRegex, "Phone number must be 7-15 digits with optional +, spaces, parentheses, or hyphens")
      .transform((phone) => phone.replace(/\D/g, '')),
    
    address: z.string()
      .min(1, "Banking address is required")
      .max(500, "Address must be 500 characters or less"),
    
    bank_name: z.string()
      .min(1, "Bank name is required")
      .max(100, "Bank name must be 100 characters or less"),
    
    account_number: z.string()
      .min(1, "Account number is required")
      .max(50, "Account number must be 50 characters or less")
      .regex(/^[0-9]+$/, "Account number must contain only digits"),
    
    branch_number: z.string()
      .max(20, "Branch number must be 20 characters or less")
      .optional()
      .or(z.literal("")),
    
    account_type: z.string()
      .max(50, "Account type must be 50 characters or less")
      .default("Cheque")
  }).optional()
}).superRefine((data, ctx) => {
  // Cross-field validation
  
  // Nationality-specific validation
  if (data.nationality !== "South Africa") {
    if (!data.passport_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passport number is required for non-South African nationals",
        path: ["passport_number"]
      })
    }
    
    if (!data.passport_document) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passport document is required for non-South African nationals",
        path: ["passport_document"]
      })
    }
    
    if (!data.work_permit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Work permit is required for non-South African nationals",
        path: ["work_permit"]
      })
    }
  } else {
    // South African nationals must have ID number
    if (!data.id_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ID number is required for South African nationals",
        path: ["id_number"]
      })
    }
  }
  
  // Date consistency check (optional)
  if (data.id_number && data.dob) {
    const idDateStr = data.id_number.substring(0, 6)
    const year = parseInt("19" + idDateStr.substring(0, 2))
    const month = parseInt(idDateStr.substring(2, 4)) - 1 // JavaScript months are 0-indexed
    const day = parseInt(idDateStr.substring(4, 6))
    
    const idDate = new Date(year, month, day)
    const dobDate = new Date(data.dob)
    
    // Allow some tolerance for date differences
    const timeDiff = Math.abs(idDate.getTime() - dobDate.getTime())
    const daysDiff = timeDiff / (1000 * 3600 * 24)
    
    if (daysDiff > 1) { // More than 1 day difference
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date of birth does not match ID number. Please verify both are correct.",
        path: ["dob"]
      })
    }
  }
})

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(10 * 1024 * 1024), // 10MB default
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

export type ProfileFormData = z.infer<typeof profileSchema>

// Helper functions for validation
export const validateProfile = (data: unknown): { success: boolean; errors?: ValidationError[] } => {
  try {
    profileSchema.parse(data)
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
  // Remove control characters and potential XSS
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
}

export const normalizePhone = (phone: string): string => {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '')
  
  // Ensure + is only at the beginning
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
