import { NextRequest, NextResponse } from "next/server"
import { documentUploadRequestSchema } from "@/lib/validation/documents"
import { documentsService } from "@/lib/services/documents-service"
import { getCurrentUser } from "@/lib/auth"
import { getRequestUser } from "@/lib/auth/request-user"
import { z } from "zod"

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

// POST /api/documents/upload - Generate signed upload URL
export async function POST(req: NextRequest) {
  const user = resolveUserContext(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = documentUploadRequestSchema.parse(body)

    const { fileName, fileType, fileSize, documentType, isSensitive } = validatedData

    // Generate signed upload URL
    const { url, key } = await documentsService.generateSignedUploadUrl(fileName, fileType, fileSize)

    return NextResponse.json({ 
      uploadUrl: url,
      documentKey: key,
      message: "Upload URL generated successfully"
    }, { status: 200 })

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
