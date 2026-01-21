import { NextRequest, NextResponse } from "next/server"
import { documentsService } from "@/lib/services/documents-service"
import { getCurrentUser } from "@/lib/auth"
import { getRequestUser } from "@/lib/auth/request-user"

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

// GET /api/documents/[id]/download - Download document
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = resolveUserContext(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const documentId = params.id

    // Get document and check access
    const document = await documentsService.getDocumentById(documentId, user.id, user.role)
    if (!document) {
      return NextResponse.json({ message: "Document not found or access denied" }, { status: 404 })
    }

    // Get download URL (this would typically be a signed S3 URL)
    const downloadUrl = await documentsService.downloadDocument(documentId, user.id, user.name)

    // In a real implementation, you might want to:
    // 1. Generate a signed S3 URL for direct download
    // 2. Stream the file content
    // 3. Set appropriate headers for file download

    return NextResponse.json({ 
      downloadUrl,
      fileName: document.name,
      fileType: document.file_type,
      fileSize: document.file_size
    }, { status: 200 })

  } catch (error) {
    console.error("Error downloading document:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}
