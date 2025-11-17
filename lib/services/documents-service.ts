// Documents service for managing document uploads, access, and versioning
// This will be replaced with actual Supabase integration

import { type Document, type DocumentFormData, type DocumentVersion, type DocumentAccessLog, documentSchema } from "@/lib/validation/documents"

// Mock data store - replace with Supabase tables
let documentsStore: Document[] = [
  {
    id: "doc-1",
    name: "Employment Contract - John Doe",
    type: "contracts",
    description: "Initial employment contract",
    tags: "contract,employment,2024",
    employee_id: "emp-1",
    uploaded_by: "hr-admin-1",
    uploaded_by_name: "HR Admin",
    employee_name: "John Doe",
    employee_number: "XSP2501/001",
    file_size: 2048576, // 2MB
    file_type: "application/pdf",
    file_url: "https://example.com/contracts/john-doe-contract.pdf",
    is_sensitive: false,
    version: 1,
    is_active: true,
    deleted_at: null,
    created_at: new Date("2024-01-15T10:00:00Z"),
    updated_at: new Date("2024-01-15T10:00:00Z"),
  },
  {
    id: "doc-2",
    name: "ID Copy - Jane Smith",
    type: "id_copies",
    description: "South African ID document",
    tags: "id,verification,personal",
    employee_id: "emp-2",
    uploaded_by: "hr-admin-1",
    uploaded_by_name: "HR Admin",
    employee_name: "Jane Smith",
    employee_number: "XSP2501/002",
    file_size: 1024000, // 1MB
    file_type: "image/jpeg",
    file_url: "https://example.com/id-copies/jane-smith-id.jpg",
    is_sensitive: true,
    version: 1,
    is_active: true,
    deleted_at: null,
    created_at: new Date("2024-01-20T14:30:00Z"),
    updated_at: new Date("2024-01-20T14:30:00Z"),
  },
  {
    id: "doc-3",
    name: "Payslip - March 2024",
    type: "payslips",
    description: "Monthly payslip for March 2024",
    tags: "payslip,salary,2024,march",
    employee_id: "emp-1",
    uploaded_by: "hr-admin-1",
    uploaded_by_name: "HR Admin",
    employee_name: "John Doe",
    employee_number: "XSP2501/001",
    file_size: 512000, // 512KB
    file_type: "application/pdf",
    file_url: "https://example.com/payslips/john-doe-march-2024.pdf",
    is_sensitive: false,
    version: 1,
    is_active: true,
    deleted_at: null,
    created_at: new Date("2024-03-31T16:00:00Z"),
    updated_at: new Date("2024-03-31T16:00:00Z"),
  },
  {
    id: "doc-4",
    name: "Work Permit - Mike Johnson",
    type: "work_permits",
    description: "Work permit for foreign national",
    tags: "work-permit,foreign-national,immigration",
    employee_id: "emp-3",
    uploaded_by: "hr-admin-1",
    uploaded_by_name: "HR Admin",
    employee_name: "Mike Johnson",
    employee_number: "XSP2501/003",
    file_size: 1536000, // 1.5MB
    file_type: "application/pdf",
    file_url: "https://example.com/work-permits/mike-johnson-permit.pdf",
    is_sensitive: true,
    version: 1,
    is_active: true,
    deleted_at: null,
    created_at: new Date("2024-02-10T09:15:00Z"),
    updated_at: new Date("2024-02-10T09:15:00Z"),
  },
  {
    id: "doc-5",
    name: "Performance Review Q1 2024",
    type: "performance_reviews",
    description: "Quarterly performance review",
    tags: "performance,review,q1,2024",
    employee_id: "emp-2",
    uploaded_by: "manager-1",
    uploaded_by_name: "Manager",
    employee_name: "Jane Smith",
    employee_number: "XSP2501/002",
    file_size: 768000, // 768KB
    file_type: "application/pdf",
    file_url: "https://example.com/performance/jane-smith-q1-2024.pdf",
    is_sensitive: false,
    version: 1,
    is_active: true,
    deleted_at: null,
    created_at: new Date("2024-04-15T11:30:00Z"),
    updated_at: new Date("2024-04-15T11:30:00Z"),
  }
]

let documentVersionsStore: DocumentVersion[] = []
let documentAccessLogStore: DocumentAccessLog[] = []

// Event listeners for real-time updates
const listeners: Array<(documents: Document[]) => void> = []

const notifyListeners = () => {
  listeners.forEach(listener => listener([...documentsStore]))
}

const logDocumentAccess = async (documentId: string, userId: string, userName: string, action: string) => {
  const accessLog: DocumentAccessLog = {
    id: `log-${Date.now()}`,
    document_id: documentId,
    user_id: userId,
    user_name: userName,
    action: action as any,
    created_at: new Date(),
  }
  
  documentAccessLogStore.push(accessLog)
  
  // In a real app, this would be sent to audit logging service
  console.log("Document access logged:", accessLog)
}

export const documentsService = {
  // Get all documents (with access control)
  async getAllDocuments(userId?: string, userRole?: string): Promise<Document[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    let filteredDocs = documentsStore.filter(doc => doc.is_active && !doc.deleted_at)
    
    // Apply access control
    if (userId && userRole) {
      filteredDocs = filteredDocs.filter(doc => {
        if (userRole === "super_admin" || userRole === "hr_admin" || userRole === "admin") {
          return true
        }
        return doc.employee_id === userId
      })
    }
    
    return filteredDocs
  },

  // Get document by ID
  async getDocumentById(id: string, userId?: string, userRole?: string): Promise<Document | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const doc = documentsStore.find(d => d.id === id && d.is_active && !d.deleted_at)
    if (!doc) return null
    
    // Check access permissions
    if (userId && userRole) {
      const hasAccess = userRole === "super_admin" || userRole === "hr_admin" || userRole === "admin" || doc.employee_id === userId
      if (!hasAccess) return null
    }
    
    return doc
  },

  // Upload a new document
  async uploadDocument(documentData: Omit<Document, "id">): Promise<Document> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Validate document data
    const validatedData = documentSchema.parse(documentData)
    
    const newDocument: Document = {
      id: `doc-${Date.now()}`,
      ...validatedData,
    }
    
    documentsStore.push(newDocument)
    
    // Log upload access
    await logDocumentAccess(newDocument.id, newDocument.uploaded_by, newDocument.uploaded_by_name, "upload")
    
    notifyListeners()
    return newDocument
  },

  // Upload new version of existing document
  async uploadNewVersion(documentId: string, newVersionData: Partial<Document>): Promise<Document> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const existingDoc = documentsStore.find(d => d.id === documentId)
    if (!existingDoc) {
      throw new Error("Document not found")
    }
    
    // Create version record
    const versionRecord: DocumentVersion = {
      id: `version-${Date.now()}`,
      document_id: documentId,
      version: existingDoc.version,
      file_url: existingDoc.file_url,
      file_size: existingDoc.file_size,
      file_type: existingDoc.file_type,
      uploaded_by: existingDoc.uploaded_by,
      uploaded_by_name: existingDoc.uploaded_by_name,
      created_at: existingDoc.created_at,
      is_active: false, // Old version is archived
    }
    
    documentVersionsStore.push(versionRecord)
    
    // Update document with new version
    const updatedDoc: Document = {
      ...existingDoc,
      ...newVersionData,
      version: existingDoc.version + 1,
      updated_at: new Date(),
    }
    
    const index = documentsStore.findIndex(d => d.id === documentId)
    documentsStore[index] = updatedDoc
    
    // Log version upload
    await logDocumentAccess(documentId, updatedDoc.uploaded_by, updatedDoc.uploaded_by_name, "upload")
    
    notifyListeners()
    return updatedDoc
  },

  // Soft delete document
  async deleteDocument(documentId: string, userId?: string, userRole?: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const doc = documentsStore.find(d => d.id === documentId)
    if (!doc) {
      throw new Error("Document not found")
    }
    
    // Check permissions
    if (userRole !== "super_admin" && userRole !== "hr_admin" && userRole !== "admin") {
      throw new Error("Insufficient permissions to delete document")
    }
    
    // Soft delete
    doc.deleted_at = new Date()
    doc.is_active = false
    doc.updated_at = new Date()
    
    // Log deletion
    if (userId) {
      await logDocumentAccess(documentId, userId, "User", "delete")
    }
    
    notifyListeners()
  },

  // Permanently delete document (Super Admin only)
  async permanentlyDeleteDocument(documentId: string, userId?: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const index = documentsStore.findIndex(d => d.id === documentId)
    if (index === -1) {
      throw new Error("Document not found")
    }
    
    // Remove from store
    documentsStore.splice(index, 1)
    
    // Remove versions
    documentVersionsStore = documentVersionsStore.filter(v => v.document_id !== documentId)
    
    // Log permanent deletion
    if (userId) {
      await logDocumentAccess(documentId, userId, "User", "delete")
    }
    
    notifyListeners()
  },

  // Download document (with access logging)
  async downloadDocument(documentId: string, userId?: string, userName?: string): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const doc = documentsStore.find(d => d.id === documentId && d.is_active && !d.deleted_at)
    if (!doc) {
      throw new Error("Document not found")
    }
    
    // Log download access
    if (userId && userName) {
      await logDocumentAccess(documentId, userId, userName, "download")
    }
    
    return doc.file_url
  },

  // Get document versions
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return documentVersionsStore.filter(v => v.document_id === documentId)
  },

  // Get document access logs
  async getDocumentAccessLogs(documentId: string): Promise<DocumentAccessLog[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return documentAccessLogStore.filter(log => log.document_id === documentId)
  },

  // Search documents
  async searchDocuments(query: string, filters?: any): Promise<Document[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    let results = documentsStore.filter(doc => doc.is_active && !doc.deleted_at)
    
    if (query) {
      const searchTerm = query.toLowerCase()
      results = results.filter(doc => {
        const description = typeof doc.description === "string" ? doc.description.toLowerCase() : ""
        const tagsValue = Array.isArray(doc.tags)
          ? doc.tags.join(" ").toLowerCase()
          : typeof doc.tags === "string"
            ? doc.tags.toLowerCase()
            : ""

        return (
          doc.name.toLowerCase().includes(searchTerm) ||
          description.includes(searchTerm) ||
          tagsValue.includes(searchTerm) ||
          doc.employee_name.toLowerCase().includes(searchTerm)
        )
      }
      )
    }
    
    if (filters) {
      if (filters.type) {
        results = results.filter(doc => doc.type === filters.type)
      }
      if (filters.employee_id) {
        results = results.filter(doc => doc.employee_id === filters.employee_id)
      }
      if (filters.is_sensitive !== undefined) {
        results = results.filter(doc => doc.is_sensitive === filters.is_sensitive)
      }
    }
    
    return results
  },

  // Subscribe to real-time updates
  subscribe(listener: (documents: Document[]) => void): () => void {
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  },

  // Get documents by employee
  async getDocumentsByEmployee(employeeId: string): Promise<Document[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return documentsStore.filter(doc => 
      doc.employee_id === employeeId && 
      doc.is_active && 
      !doc.deleted_at
    )
  },

  // Get documents by uploader
  async getDocumentsByUploader(uploaderId: string): Promise<Document[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return documentsStore.filter(doc => 
      doc.uploaded_by === uploaderId && 
      doc.is_active && 
      !doc.deleted_at
    )
  },

  // Generate signed upload URL (mock implementation)
  async generateSignedUploadUrl(fileName: string, fileType: string, fileSize: number): Promise<{ url: string; key: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // In a real app, this would generate a signed S3 URL
    const key = `documents/${Date.now()}-${fileName}`
    const url = `https://example-s3-bucket.s3.amazonaws.com/${key}`
    
    return { url, key }
  }
}
