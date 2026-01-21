import { z } from "zod"

// Document type enum
export const documentTypeEnum = z.enum([
  "contracts",
  "payslips", 
  "id_copies",
  "work_permits",
  "doctors_notes",
  "performance_reviews",
  "policies",
  "qualifications",
  "proof_of_address",
  "other_personal_documents",
  "offer_letters",
  "company_policies",
  "reports",
  "resignation_letters",
  "official_hr_documents",
])

// Document status enum
export const documentStatusEnum = z.enum([
  "active",
  "archived",
  "deleted"
])

// Document form validation schema
export const documentSchema = z.object({
  name: z.string().min(1, "Document name is required.").max(255, "Document name cannot exceed 255 characters."),
  type: documentTypeEnum,
  description: z.string().max(1000, "Description cannot exceed 1000 characters.").optional(),
  tags: z.string().max(500, "Tags cannot exceed 500 characters.").optional(),
  employee_id: z.string().uuid("Invalid employee ID format."),
  uploaded_by: z.string().uuid("Invalid uploader ID format."),
  uploaded_by_name: z.string().min(1, "Uploader name is required."),
  employee_name: z.string().min(1, "Employee name is required."),
  employee_number: z.string().min(1, "Employee number is required."),
  file_size: z.number().min(1, "File size must be greater than 0.").max(10 * 1024 * 1024, "File size cannot exceed 10MB."),
  file_type: z.string().refine(type => 
    ["application/pdf", "image/jpeg", "image/png"].includes(type), 
    "Only PDF, JPG, and PNG files are allowed."
  ),
  file_url: z.string().url("Invalid file URL format."),
  is_sensitive: z.boolean().default(false),
  version: z.number().min(1, "Version must be at least 1.").default(1),
  is_active: z.boolean().default(true),
  deleted_at: z.date().nullable().default(null),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
})

// Document form data type (for upload forms)
export type DocumentFormData = Pick<z.infer<typeof documentSchema>, "name" | "type" | "description" | "tags">

// Full document type
export type Document = z.infer<typeof documentSchema> & {
  id: string
}

// Document upload request schema
export const documentUploadRequestSchema = z.object({
  fileName: z.string().min(1, "File name is required."),
  fileType: z.string().refine(type => 
    ["application/pdf", "image/jpeg", "image/png"].includes(type), 
    "Only PDF, JPG, and PNG files are allowed."
  ),
  fileSize: z.number().min(1, "File size must be greater than 0.").max(10 * 1024 * 1024, "File size cannot exceed 10MB."),
  documentType: documentTypeEnum,
  isSensitive: z.boolean().default(false),
})

// Document search/filter schema
export const documentFilterSchema = z.object({
  type: documentTypeEnum.optional(),
  employee_id: z.string().uuid().optional(),
  uploaded_by: z.string().uuid().optional(),
  is_sensitive: z.boolean().optional(),
  is_active: z.boolean().optional(),
  date_from: z.date().optional(),
  date_to: z.date().optional(),
  search: z.string().optional(),
})

export type DocumentFilter = z.infer<typeof documentFilterSchema>

// Document version schema
export const documentVersionSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  version: z.number().min(1),
  file_url: z.string().url(),
  file_size: z.number().min(1),
  file_type: z.string(),
  uploaded_by: z.string().uuid(),
  uploaded_by_name: z.string(),
  created_at: z.date(),
  is_active: z.boolean().default(true),
})

export type DocumentVersion = z.infer<typeof documentVersionSchema>

// Document access log schema
export const documentAccessLogSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  user_id: z.string().uuid(),
  user_name: z.string(),
  action: z.enum(["view", "download", "upload", "delete", "update"]),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().optional(),
  created_at: z.date().default(() => new Date()),
})

export type DocumentAccessLog = z.infer<typeof documentAccessLogSchema>

// Helper functions
export const getDocumentTypeDisplayName = (type: string): string => {
  switch (type) {
    case "contracts":
      return "Contract"
    case "payslips":
      return "Payslip"
    case "id_copies":
      return "ID Copy"
    case "work_permits":
      return "Work Permit"
    case "doctors_notes":
      return "Doctor's Note"
    case "performance_reviews":
      return "Performance Review"
    case "policies":
      return "Policy"
    case "qualifications":
      return "Qualification"
    case "proof_of_address":
      return "Proof of Address"
    case "other_personal_documents":
      return "Other Personal"
    case "offer_letters":
      return "Offer Letter"
    case "company_policies":
      return "Company Policy"
    case "reports":
      return "Report"
    case "resignation_letters":
      return "Resignation Letter"
    case "official_hr_documents":
      return "Official HR Document"
    default:
      return type
  }
}

export const isSensitiveDocumentType = (type: string): boolean => {
  return ["id_copies", "work_permits", "doctors_notes", "proof_of_address", "other_personal_documents"].includes(type)
}

export const getDocumentTypeIcon = (type: string): string => {
  switch (type) {
    case "contracts":
      return "📄"
    case "payslips":
      return "💰"
    case "id_copies":
      return "🆔"
    case "work_permits":
      return "📋"
    case "doctors_notes":
      return "🏥"
    case "performance_reviews":
      return "📊"
    case "policies":
      return "📜"
    case "qualifications":
      return "🎓"
    case "proof_of_address":
      return "🏠"
    case "other_personal_documents":
      return "🗂️"
    case "offer_letters":
      return "✉️"
    case "company_policies":
      return "🏛️"
    case "reports":
      return "📑"
    case "resignation_letters":
      return "📝"
    case "official_hr_documents":
      return "📁"
    default:
      return "📄"
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const validateDocumentAccess = (
  document: Document,
  userId: string,
  userRole: string
): boolean => {
  // Super Admin can access all documents
  if (userRole === "super_admin") return true
  
  // HR Admin can access all documents
  if (userRole === "hr_admin" || userRole === "admin") return true
  
  // Employees can only access their own documents
  return document.employee_id === userId
}
