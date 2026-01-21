// Documents service for managing document uploads, access, and versioning
// Integrated with Supabase documents table

import { type Document, type DocumentFormData, type DocumentVersion, type DocumentAccessLog, documentSchema } from "@/lib/validation/documents"
import { supabaseAdmin } from "@/lib/supabase-admin"

// Database table name
const TABLE_NAME = "documents"

// Check if we're running in the browser
const isBrowser = typeof window !== 'undefined'

// Stored headers for browser API calls (set by UI)
let browserApiHeaders: Record<string, string> = {}

export const setDocumentsRequestHeaders = (headers: Record<string, string>) => {
  if (!isBrowser) return
  browserApiHeaders = { ...headers }
}

// Helper to call API routes from browser
const apiCall = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...browserApiHeaders,
      ...options?.headers,
    },
    credentials: 'include',
  })
  
  if (!response.ok) {
    // Attempt to extract error message but fall back gracefully
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.message || errorMessage
    } catch (err) {
      const text = await response.text().catch(() => '')
      if (text) {
        errorMessage = text
      }
    }
    const error = new Error(errorMessage)
    ;(error as any).status = response.status
    throw error
  }
  
  return response
}

type SerializableDocument = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
  id?: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const serializeDocumentForApi = (doc: Omit<Document, 'id'>): SerializableDocument => ({
  ...doc,
  created_at: doc.created_at?.toISOString?.() ?? new Date().toISOString(),
  updated_at: doc.updated_at?.toISOString?.() ?? new Date().toISOString(),
  deleted_at: doc.deleted_at ? doc.deleted_at.toISOString() : null,
})

const parseDocumentFromApi = (data: SerializableDocument): Document => ({
  ...data,
  id: data.id ?? '',
  created_at: data.created_at ? new Date(data.created_at) : new Date(),
  updated_at: data.updated_at ? new Date(data.updated_at) : new Date(),
  deleted_at: data.deleted_at ? new Date(data.deleted_at) : null,
})

// Type for database record (matches Supabase schema)
interface DocumentRecord {
  id: string
  title: string
  filename: string | null
  content: string | null
  uploaded_at: string | null
  source_url: string | null
  search_vector: any | null
}

// Helper to extract filename from URL or name
const extractFilename = (name: string, url?: string): string => {
  if (url) {
    const urlParts = url.split('/')
    const lastPart = urlParts[urlParts.length - 1]
    if (lastPart && lastPart.includes('.')) {
      return lastPart
    }
  }
  // Extract filename from name if it looks like a filename
  if (name.includes('.')) {
    return name
  }
  return name
}

// Map Document to database record
const mapDocumentToRecord = (doc: Omit<Document, "id"> | Document, includeId: boolean = false): Omit<DocumentRecord, "id"> | DocumentRecord => {
  // Store additional metadata in content as JSON
  const metadata = {
    type: doc.type,
    description: doc.description || "",
    tags: doc.tags || "",
    employee_id: doc.employee_id,
    uploaded_by: doc.uploaded_by,
    uploaded_by_name: doc.uploaded_by_name,
    employee_name: doc.employee_name,
    employee_number: doc.employee_number,
    file_size: doc.file_size,
    file_type: doc.file_type,
    is_sensitive: doc.is_sensitive,
    version: doc.version,
    is_active: doc.is_active,
    deleted_at: doc.deleted_at?.toISOString() || null,
    created_at: doc.created_at?.toISOString() || new Date().toISOString(),
    updated_at: doc.updated_at?.toISOString() || new Date().toISOString(),
  }

  const record: any = {
    title: doc.name,
    filename: extractFilename(doc.name, doc.file_url),
    content: JSON.stringify(metadata),
    uploaded_at: doc.created_at?.toISOString() || new Date().toISOString(),
    source_url: doc.file_url,
    search_vector: null, // Will be updated by database trigger if configured
  }

  // Only include id if it exists and includeId is true (for updates)
  if (includeId && "id" in doc && doc.id) {
    record.id = doc.id
  }

  return record
}

// Map database record to Document
const mapRecordToDocument = (record: DocumentRecord): Document => {
  const metadata = record.content ? JSON.parse(record.content) : {}
  
  return {
    id: record.id,
    name: record.title,
    type: metadata.type || "other_personal_documents",
    description: metadata.description || "",
    tags: metadata.tags || "",
    employee_id: metadata.employee_id || "",
    uploaded_by: metadata.uploaded_by || "",
    uploaded_by_name: metadata.uploaded_by_name || "",
    employee_name: metadata.employee_name || "",
    employee_number: metadata.employee_number || "",
    file_size: metadata.file_size || 0,
    file_type: metadata.file_type || "application/pdf",
    file_url: record.source_url || "",
    is_sensitive: metadata.is_sensitive || false,
    version: metadata.version || 1,
    is_active: metadata.is_active !== undefined ? metadata.is_active : true,
    deleted_at: metadata.deleted_at ? new Date(metadata.deleted_at) : null,
    created_at: metadata.created_at ? new Date(metadata.created_at) : new Date(),
    updated_at: metadata.updated_at ? new Date(metadata.updated_at) : new Date(),
  }
}

// Event listeners for real-time updates
const listeners: Array<(documents: Document[]) => void> = []

const notifyListeners = async () => {
  // Fetch current documents and notify listeners
  try {
    let documents: Document[] = []
    
    if (isBrowser) {
      // In browser, use API route
      try {
        const response = await apiCall('/api/documents')
        const result = await response.json()
        documents = Array.isArray(result) ? result.map(parseDocumentFromApi) : []
      } catch (error) {
        console.error("Error fetching documents for listeners:", error)
      }
    } else {
      // On server, use supabaseAdmin
      const { data } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .order("uploaded_at", { ascending: false })
      
      if (data) {
        documents = data.map(mapRecordToDocument).filter((doc: Document) => doc.is_active && !doc.deleted_at)
      }
    }
    
    if (documents.length > 0 || !isBrowser) {
      listeners.forEach(listener => listener(documents))
    }
  } catch (error) {
    console.error("Error notifying listeners:", error)
  }
}

const logDocumentAccess = async (documentId: string, userId: string, userName: string, action: string) => {
  // In a real app, this would be sent to audit logging service
  console.log("Document access logged:", { documentId, userId, userName, action })
}

export const documentsService = {
  // Get all documents (with access control)
  async getAllDocuments(userId?: string, userRole?: string): Promise<Document[]> {
    try {
      // Use API route in browser, direct DB access on server
      if (isBrowser) {
        try {
          const response = await apiCall('/api/documents')
          const result = await response.json()
          const documents = Array.isArray(result) ? result.map(parseDocumentFromApi) : []
          return documents
        } catch (error: any) {
          if (error?.status === 401) {
            console.warn('[documentsService] Unauthorized when fetching documents')
            return []
          }
          throw error
        }
      }

      // Server-side: use supabaseAdmin directly
      let query = supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .order("uploaded_at", { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error("Error fetching documents:", error)
        throw error
      }

      if (!data) {
        return []
      }

      let documents = data.map(mapRecordToDocument).filter((doc: Document) => doc.is_active && !doc.deleted_at)

      // Apply access control
      if (userId && userRole) {
        documents = documents.filter((doc: Document) => {
          if (userRole === "super_admin" || userRole === "hr_admin" || userRole === "admin") {
            return true
          }
          return doc.employee_id === userId
        })
      }

      return documents
    } catch (error) {
      console.error("Error in getAllDocuments:", error)
      throw error
    }
  },

  // Get document by ID
  async getDocumentById(id: string, userId?: string, userRole?: string): Promise<Document | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null
        }
        console.error("Error fetching document:", error)
        throw error
      }

      if (!data) {
        return null
      }

      const doc = mapRecordToDocument(data)

      // Check if document is active and not deleted
      if (!doc.is_active || doc.deleted_at) {
        return null
      }

      // Check access permissions
      if (userId && userRole) {
        const hasAccess = userRole === "super_admin" || userRole === "hr_admin" || userRole === "admin" || doc.employee_id === userId
        if (!hasAccess) return null
      }

      return doc
    } catch (error) {
      console.error("Error in getDocumentById:", error)
      throw error
    }
  },

  // Upload a new document
  async uploadDocument(documentData: Omit<Document, "id">): Promise<Document> {
    try {
      // Validate document data
      const validatedData = documentSchema.parse(documentData)

      // Use API route in browser, direct DB access on server
      if (isBrowser) {
        const payload = serializeDocumentForApi(validatedData)
        const response = await apiCall('/api/documents', {
          method: 'POST',
          body: JSON.stringify({ document: payload }),
        })
        const result = await response.json()
        const newDocument = parseDocumentFromApi(result)
        await notifyListeners()
        return newDocument
      }

      // Server-side: use supabaseAdmin directly
      // Map to database record (without id - let database generate it)
      const record = mapDocumentToRecord(validatedData, false)

      // Insert into database (id will be auto-generated by database)
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .insert([record])
        .select("*")
        .single()

      if (error) {
        console.error("Error inserting document:", error)
        throw error
      }

      if (!data) {
        throw new Error("Failed to create document - no data returned")
      }

      const newDocument = mapRecordToDocument(data)

      // Log upload access
      await logDocumentAccess(newDocument.id, newDocument.uploaded_by, newDocument.uploaded_by_name, "upload")

      await notifyListeners()
      return newDocument
    } catch (error) {
      console.error("Error in uploadDocument:", error)
      throw error
    }
  },

  // Upload new version of existing document
  async uploadNewVersion(documentId: string, newVersionData: Partial<Document>): Promise<Document> {
    try {
      // Get existing document
      const existingDoc = await this.getDocumentById(documentId)
      if (!existingDoc) {
        throw new Error("Document not found")
      }

      // Create updated document
      const updatedDoc: Document = {
        ...existingDoc,
        ...newVersionData,
        version: existingDoc.version + 1,
        updated_at: new Date(),
      }

      // Map to database record and update
      const record = mapDocumentToRecord(updatedDoc, false)

      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .update({
          title: record.title,
          filename: record.filename,
          content: record.content,
          source_url: record.source_url,
          uploaded_at: record.uploaded_at,
        })
        .eq("id", documentId)
        .select("*")
        .single()

      if (error) {
        console.error("Error updating document:", error)
        throw error
      }

      if (!data) {
        throw new Error("Failed to update document - no data returned")
      }

      const result = mapRecordToDocument(data)

      // Log version upload
      await logDocumentAccess(documentId, result.uploaded_by, result.uploaded_by_name, "upload")

      await notifyListeners()
      return result
    } catch (error) {
      console.error("Error in uploadNewVersion:", error)
      throw error
    }
  },

  // Soft delete document
  async deleteDocument(documentId: string, userId?: string, userRole?: string): Promise<void> {
    try {
      // Get existing document
      const doc = await this.getDocumentById(documentId)
      if (!doc) {
        throw new Error("Document not found")
      }

      // Check permissions
      if (userRole !== "super_admin" && userRole !== "hr_admin" && userRole !== "admin") {
        throw new Error("Insufficient permissions to delete document")
      }

      // Soft delete by updating metadata
      const updatedDoc: Document = {
        ...doc,
        deleted_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      }

      const record = mapDocumentToRecord(updatedDoc)

      const { error } = await supabaseAdmin
        .from(TABLE_NAME)
        .update({
          content: record.content,
        })
        .eq("id", documentId)

      if (error) {
        console.error("Error soft deleting document:", error)
        throw error
      }

      // Log deletion
      if (userId) {
        await logDocumentAccess(documentId, userId, "User", "delete")
      }

      await notifyListeners()
    } catch (error) {
      console.error("Error in deleteDocument:", error)
      throw error
    }
  },

  // Permanently delete document (Super Admin only)
  async permanentlyDeleteDocument(documentId: string, userId?: string): Promise<void> {
    try {
      // Check if document exists
      const doc = await this.getDocumentById(documentId)
      if (!doc) {
        throw new Error("Document not found")
      }

      // Permanently delete from database
      const { error } = await supabaseAdmin
        .from(TABLE_NAME)
        .delete()
        .eq("id", documentId)

      if (error) {
        console.error("Error permanently deleting document:", error)
        throw error
      }

      // Log permanent deletion
      if (userId) {
        await logDocumentAccess(documentId, userId, "User", "delete")
      }

      await notifyListeners()
    } catch (error) {
      console.error("Error in permanentlyDeleteDocument:", error)
      throw error
    }
  },

  // Download document (with access logging)
  async downloadDocument(documentId: string, userId?: string, userName?: string): Promise<string> {
    try {
      if (isBrowser) {
        const response = await apiCall(`/api/documents/${documentId}/download`)
        const result = await response.json()
        return result.downloadUrl
      }

      const doc = await this.getDocumentById(documentId)
      if (!doc || !doc.is_active || doc.deleted_at) {
        throw new Error("Document not found")
      }

      // Log download access
      if (userId && userName) {
        await logDocumentAccess(documentId, userId, userName, "download")
      }

      return doc.file_url
    } catch (error) {
      console.error("Error in downloadDocument:", error)
      throw error
    }
  },

  // Get document versions
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    // Note: Version history would require a separate versions table
    // For now, return empty array as versions are not stored separately
    return []
  },

  // Get document access logs
  async getDocumentAccessLogs(documentId: string): Promise<DocumentAccessLog[]> {
    // Note: Access logs would require a separate access_logs table
    // For now, return empty array as logs are only console logged
    return []
  },

  // Search documents
  async searchDocuments(query: string, filters?: any): Promise<Document[]> {
    try {
      let dbQuery = supabaseAdmin
        .from(TABLE_NAME)
        .select("*")

      // Use search_vector if available, otherwise filter in memory
      // For now, fetch all and filter in memory since search_vector may not be configured
      const { data, error } = await dbQuery.order("uploaded_at", { ascending: false })

      if (error) {
        console.error("Error searching documents:", error)
        throw error
      }

      if (!data) {
        return []
      }

      let results = data.map(mapRecordToDocument).filter((doc: Document) => doc.is_active && !doc.deleted_at)

      // Apply text search
      if (query) {
        const searchTerm = query.toLowerCase()
        results = results.filter((doc: Document) => {
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
        })
      }

      // Apply filters
      if (filters) {
        if (filters.type) {
          results = results.filter((doc: Document) => doc.type === filters.type)
        }
        if (filters.employee_id) {
          results = results.filter((doc: Document) => doc.employee_id === filters.employee_id)
        }
        if (filters.is_sensitive !== undefined) {
          results = results.filter((doc: Document) => doc.is_sensitive === filters.is_sensitive)
        }
      }

      return results
    } catch (error) {
      console.error("Error in searchDocuments:", error)
      throw error
    }
  },

  async getAllAccessLogs(): Promise<DocumentAccessLog[]> {
    // Note: Access logs would require a separate access_logs table
    // For now, return empty array as logs are only console logged
    return []
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
    try {
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .order("uploaded_at", { ascending: false })

      if (error) {
        console.error("Error fetching documents by employee:", error)
        throw error
      }

      if (!data) {
        return []
      }

      // Filter by employee_id in metadata
      return data
        .map(mapRecordToDocument)
        .filter((doc: Document) => 
          doc.employee_id === employeeId && 
          doc.is_active && 
          !doc.deleted_at
        )
    } catch (error) {
      console.error("Error in getDocumentsByEmployee:", error)
      throw error
    }
  },

  // Get documents by uploader
  async getDocumentsByUploader(uploaderId: string): Promise<Document[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select("*")
        .order("uploaded_at", { ascending: false })

      if (error) {
        console.error("Error fetching documents by uploader:", error)
        throw error
      }

      if (!data) {
        return []
      }

      // Filter by uploaded_by in metadata
      return data
        .map(mapRecordToDocument)
        .filter((doc: Document) => 
          doc.uploaded_by === uploaderId && 
          doc.is_active && 
          !doc.deleted_at
        )
    } catch (error) {
      console.error("Error in getDocumentsByUploader:", error)
      throw error
    }
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
