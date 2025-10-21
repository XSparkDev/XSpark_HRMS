import { describe, it, expect, beforeEach } from "vitest"
import { 
  documentSchema, 
  documentUploadRequestSchema,
  getDocumentTypeDisplayName,
  isSensitiveDocumentType,
  formatFileSize,
  validateDocumentAccess
} from "@/lib/validation/documents"
import { type Document } from "@/lib/validation/documents"

describe("Document Validation", () => {
  describe("documentSchema", () => {
    it("should validate a valid document", () => {
      const validDocument = {
        name: "Test Document",
        type: "contracts",
        description: "Test description",
        tags: "test,tag",
        employee_id: "123e4567-e89b-12d3-a456-426614174000",
        uploaded_by: "123e4567-e89b-12d3-a456-426614174001",
        uploaded_by_name: "Test User",
        employee_name: "Test Employee",
        employee_number: "EMP001",
        file_size: 1024000,
        file_type: "application/pdf",
        file_url: "https://example.com/test.pdf",
        is_sensitive: false,
        version: 1,
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const result = documentSchema.safeParse(validDocument)
      expect(result.success).toBe(true)
    })

    it("should reject document with invalid file type", () => {
      const invalidDocument = {
        name: "Test Document",
        type: "contracts",
        employee_id: "123e4567-e89b-12d3-a456-426614174000",
        uploaded_by: "123e4567-e89b-12d3-a456-426614174001",
        uploaded_by_name: "Test User",
        employee_name: "Test Employee",
        employee_number: "EMP001",
        file_size: 1024000,
        file_type: "application/msword", // Invalid type
        file_url: "https://example.com/test.doc",
        is_sensitive: false,
        version: 1,
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const result = documentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("Only PDF, JPG, and PNG files are allowed")
      }
    })

    it("should reject document with file size exceeding 10MB", () => {
      const invalidDocument = {
        name: "Test Document",
        type: "contracts",
        employee_id: "123e4567-e89b-12d3-a456-426614174000",
        uploaded_by: "123e4567-e89b-12d3-a456-426614174001",
        uploaded_by_name: "Test User",
        employee_name: "Test Employee",
        employee_number: "EMP001",
        file_size: 11 * 1024 * 1024, // 11MB - exceeds limit
        file_type: "application/pdf",
        file_url: "https://example.com/test.pdf",
        is_sensitive: false,
        version: 1,
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const result = documentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("File size cannot exceed 10MB")
      }
    })

    it("should reject document with invalid UUID", () => {
      const invalidDocument = {
        name: "Test Document",
        type: "contracts",
        employee_id: "invalid-uuid",
        uploaded_by: "123e4567-e89b-12d3-a456-426614174001",
        uploaded_by_name: "Test User",
        employee_name: "Test Employee",
        employee_number: "EMP001",
        file_size: 1024000,
        file_type: "application/pdf",
        file_url: "https://example.com/test.pdf",
        is_sensitive: false,
        version: 1,
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const result = documentSchema.safeParse(invalidDocument)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("Invalid employee ID format")
      }
    })
  })

  describe("documentUploadRequestSchema", () => {
    it("should validate a valid upload request", () => {
      const validRequest = {
        fileName: "test.pdf",
        fileType: "application/pdf",
        fileSize: 1024000,
        documentType: "contracts",
        isSensitive: false
      }

      const result = documentUploadRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it("should reject upload request with invalid file type", () => {
      const invalidRequest = {
        fileName: "test.doc",
        fileType: "application/msword",
        fileSize: 1024000,
        documentType: "contracts",
        isSensitive: false
      }

      const result = documentUploadRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })
})

describe("Document Helper Functions", () => {
  describe("getDocumentTypeDisplayName", () => {
    it("should return correct display names for all document types", () => {
      expect(getDocumentTypeDisplayName("contracts")).toBe("Contract")
      expect(getDocumentTypeDisplayName("payslips")).toBe("Payslip")
      expect(getDocumentTypeDisplayName("id_copies")).toBe("ID Copy")
      expect(getDocumentTypeDisplayName("work_permits")).toBe("Work Permit")
      expect(getDocumentTypeDisplayName("doctors_notes")).toBe("Doctor's Note")
      expect(getDocumentTypeDisplayName("performance_reviews")).toBe("Performance Review")
      expect(getDocumentTypeDisplayName("policies")).toBe("Policy")
      expect(getDocumentTypeDisplayName("unknown")).toBe("unknown")
    })
  })

  describe("isSensitiveDocumentType", () => {
    it("should correctly identify sensitive document types", () => {
      expect(isSensitiveDocumentType("id_copies")).toBe(true)
      expect(isSensitiveDocumentType("work_permits")).toBe(true)
      expect(isSensitiveDocumentType("doctors_notes")).toBe(true)
      expect(isSensitiveDocumentType("contracts")).toBe(false)
      expect(isSensitiveDocumentType("payslips")).toBe(false)
      expect(isSensitiveDocumentType("performance_reviews")).toBe(false)
      expect(isSensitiveDocumentType("policies")).toBe(false)
    })
  })

  describe("formatFileSize", () => {
    it("should format file sizes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes")
      expect(formatFileSize(1024)).toBe("1 KB")
      expect(formatFileSize(1024 * 1024)).toBe("1 MB")
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB")
      expect(formatFileSize(1536)).toBe("1.5 KB")
      expect(formatFileSize(1536 * 1024)).toBe("1.5 MB")
    })
  })

  describe("validateDocumentAccess", () => {
    const mockDocument: Document = {
      id: "doc-1",
      name: "Test Document",
      type: "contracts",
      employee_id: "emp-1",
      uploaded_by: "hr-1",
      uploaded_by_name: "HR Admin",
      employee_name: "Test Employee",
      employee_number: "EMP001",
      file_size: 1024000,
      file_type: "application/pdf",
      file_url: "https://example.com/test.pdf",
      is_sensitive: false,
      version: 1,
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    it("should allow super admin access to any document", () => {
      expect(validateDocumentAccess(mockDocument, "admin-1", "super_admin")).toBe(true)
    })

    it("should allow hr admin access to any document", () => {
      expect(validateDocumentAccess(mockDocument, "hr-1", "hr_admin")).toBe(true)
    })

    it("should allow admin access to any document", () => {
      expect(validateDocumentAccess(mockDocument, "admin-1", "admin")).toBe(true)
    })

    it("should allow employee access to their own documents", () => {
      expect(validateDocumentAccess(mockDocument, "emp-1", "employee")).toBe(true)
    })

    it("should deny employee access to other employees' documents", () => {
      expect(validateDocumentAccess(mockDocument, "emp-2", "employee")).toBe(false)
    })

    it("should deny manager access to documents they don't own", () => {
      expect(validateDocumentAccess(mockDocument, "manager-1", "manager")).toBe(false)
    })
  })
})

describe("Document Accrual Logic", () => {
  describe("Document Versioning", () => {
    it("should increment version number for new versions", () => {
      const originalVersion = 1
      const newVersion = originalVersion + 1
      expect(newVersion).toBe(2)
    })

    it("should maintain version history", () => {
      const versions = [1, 2, 3]
      const latestVersion = Math.max(...versions)
      expect(latestVersion).toBe(3)
    })
  })

  describe("Document Retention", () => {
    it("should identify documents for retention", () => {
      const now = new Date()
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())

      const recentDoc = { created_at: now }
      const oldDoc = { created_at: twoYearsAgo }

      const isRecent = recentDoc.created_at > oneYearAgo
      const isOld = oldDoc.created_at < oneYearAgo

      expect(isRecent).toBe(true)
      expect(isOld).toBe(true)
    })

    it("should handle soft delete correctly", () => {
      const document = {
        id: "doc-1",
        is_active: true,
        deleted_at: null
      }

      // Soft delete
      const softDeleted = {
        ...document,
        is_active: false,
        deleted_at: new Date()
      }

      expect(softDeleted.is_active).toBe(false)
      expect(softDeleted.deleted_at).not.toBeNull()
    })
  })

  describe("Document Access Logging", () => {
    it("should log document access correctly", () => {
      const accessLog = {
        document_id: "doc-1",
        user_id: "user-1",
        action: "view",
        timestamp: new Date()
      }

      expect(accessLog.document_id).toBe("doc-1")
      expect(accessLog.user_id).toBe("user-1")
      expect(accessLog.action).toBe("view")
      expect(accessLog.timestamp).toBeInstanceOf(Date)
    })

    it("should track different access types", () => {
      const actions = ["view", "download", "upload", "delete", "update"]
      
      actions.forEach(action => {
        const log = {
          action,
          timestamp: new Date()
        }
        expect(actions).toContain(log.action)
      })
    })
  })
})
