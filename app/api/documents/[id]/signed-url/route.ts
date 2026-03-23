import { NextRequest, NextResponse } from "next/server"
import { createSignedDocumentUrl } from "@/lib/documents-signed-url"
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

// GET /api/documents/[id]/signed-url - Get a signed URL for preview (and download)
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

    const document = await documentsService.getDocumentById(documentId, user.id, user.role)
    if (!document) {
      return NextResponse.json({ message: "Document not found or access denied" }, { status: 404 })
    }

    const url = await createSignedDocumentUrl(document.file_url, 3600)
    if (!url) {
      return NextResponse.json({ message: "Could not generate access URL" }, { status: 400 })
    }

    return NextResponse.json({ url }, { status: 200 })
  } catch (error) {
    console.error("Error getting signed URL:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
