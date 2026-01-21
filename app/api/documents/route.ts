import { NextRequest, NextResponse } from "next/server"
import { documentSchema, documentUploadRequestSchema } from "@/lib/validation/documents"
import { documentsService } from "@/lib/services/documents-service"
import { getCurrentUser } from "@/lib/auth"
import { getRequestUser } from "@/lib/auth/request-user"
import { z } from "zod"

// Rate limiter for uploads
const uploadLimiter = new Map<string, { count: number; resetTime: number }>()

const checkRateLimit = (ip: string, maxRequests: number = 10, windowMs: number = 15 * 60 * 1000) => {
  const now = Date.now()
  const userLimit = uploadLimiter.get(ip)
  
  if (!userLimit || now > userLimit.resetTime) {
    uploadLimiter.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (userLimit.count >= maxRequests) {
    return false
  }
  
  userLimit.count++
  return true
}

type ApiUserContext = {
  id: string
  employeeId: string
  role: string
  name: string
}

const resolveUserContext = (req: NextRequest): ApiUserContext | null => {
  const headerUser = getRequestUser(req)
  const currentUser = getCurrentUser(req)

  const id = headerUser?.id ?? currentUser?.id
  const employeeId = headerUser?.employeeId ?? currentUser?.employeeId ?? id ?? null
  const role = headerUser?.role ?? currentUser?.role ?? "employee"
  const name = currentUser?.name ?? currentUser?.email ?? "User"

  if (!id || !employeeId) {
    return null
  }

  return {
    id,
    employeeId,
    role,
    name,
  }
}

// POST /api/documents - Upload new document
export async function POST(req: NextRequest) {
  const user = resolveUserContext(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ message: "Too many upload requests" }, { status: 429 })
  }

  try {
    const body = await req.json()

    // When the client sends a complete document payload, validate and persist it directly.
    if (body?.document) {
      const documentInput = body.document
      const normalizedDocument = {
        ...documentInput,
        deleted_at: documentInput.deleted_at ? new Date(documentInput.deleted_at) : null,
        created_at: documentInput.created_at ? new Date(documentInput.created_at) : new Date(),
        updated_at: documentInput.updated_at ? new Date(documentInput.updated_at) : new Date(),
      }

      const validatedDocument = documentSchema.parse(normalizedDocument)
      const document = await documentsService.uploadDocument(validatedDocument)
      return NextResponse.json(document, { status: 201 })
    }

    const validatedData = documentUploadRequestSchema.parse(body)
    const { fileName, fileType, fileSize, documentType, isSensitive } = validatedData

    // Generate signed upload URL
    const { url, key } = await documentsService.generateSignedUploadUrl(fileName, fileType, fileSize)

    // Create document record
    const documentData = {
      name: fileName,
      type: documentType,
      description: "",
      tags: "",
      employee_id: user.employeeId,
      uploaded_by: user.id,
      uploaded_by_name: user.name,
      employee_name: user.name, // In real app, get from employee data
      employee_number: "XSP2501/001", // In real app, get from employee data
      file_size: fileSize,
      file_type: fileType,
      file_url: url, // This will be updated after actual upload
      is_sensitive: isSensitive,
      version: 1,
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const document = await documentsService.uploadDocument(documentData)

    return NextResponse.json({ 
      message: "Upload URL generated successfully",
      uploadUrl: url,
      documentKey: key,
      documentId: document.id
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        message: "Validation failed", 
        errors: error.errors 
      }, { status: 400 })
    }
    
    console.error("Error generating upload URL:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}

// GET /api/documents - Get all documents
export async function GET(req: NextRequest) {
  const user = resolveUserContext(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const employee_id = searchParams.get("employee_id")
    const is_sensitive = searchParams.get("is_sensitive")

    const filters = {
      ...(type && { type }),
      ...(employee_id && { employee_id }),
      ...(is_sensitive && { is_sensitive: is_sensitive === "true" }),
    }

    let documents
    if (search) {
      documents = await documentsService.searchDocuments(search, filters)
    } else {
      documents = await documentsService.getAllDocuments(user.id, user.role)
    }

    return NextResponse.json(documents, { status: 200 })

  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}

// PUT /api/documents/[id] - Update document
export async function PUT(req: NextRequest) {
  const user = resolveUserContext(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get("id")
    
    if (!documentId) {
      return NextResponse.json({ message: "Document ID is required" }, { status: 400 })
    }

    const body = await req.json()
    const updateData = documentSchema.partial().parse(body)

    // Check if document exists and user has permission
    const existingDoc = await documentsService.getDocumentById(documentId, user.id, user.role)
    if (!existingDoc) {
      return NextResponse.json({ message: "Document not found or access denied" }, { status: 404 })
    }

    // Check permissions for update
    const canUpdate = user.role === "super_admin" || 
                     user.role === "hr_admin" || 
                     user.role === "admin" || 
                     existingDoc.uploaded_by === user.id

    if (!canUpdate) {
      return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 })
    }

    // Update document
    const updatedDoc = await documentsService.uploadNewVersion(documentId, {
      ...updateData,
      updated_at: new Date(),
    })

    return NextResponse.json(updatedDoc, { status: 200 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        message: "Validation failed", 
        errors: error.errors 
      }, { status: 400 })
    }
    
    console.error("Error updating document:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}

// DELETE /api/documents/[id] - Delete document
export async function DELETE(req: Request) {
  const user = getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get("id")
    const permanent = searchParams.get("permanent") === "true"
    
    if (!documentId) {
      return NextResponse.json({ message: "Document ID is required" }, { status: 400 })
    }

    // Check if document exists
    const existingDoc = await documentsService.getDocumentById(documentId, user.id, user.role)
    if (!existingDoc) {
      return NextResponse.json({ message: "Document not found or access denied" }, { status: 404 })
    }

    if (permanent) {
      // Permanent deletion (Super Admin only)
      if (user.role !== "super_admin") {
        return NextResponse.json({ message: "Only Super Admin can permanently delete documents" }, { status: 403 })
      }
      
      await documentsService.permanentlyDeleteDocument(documentId, user.id)
    } else {
      // Soft deletion
      await documentsService.deleteDocument(documentId, user.id, user.role)
    }

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 })

  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}
