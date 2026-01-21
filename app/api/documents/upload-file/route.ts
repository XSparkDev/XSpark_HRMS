import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getRequestUser } from "@/lib/auth/request-user"
import { supabaseAdmin } from "@/lib/supabase-admin"

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

// POST /api/documents/upload-file - Upload file and return permanent URL
export async function POST(req: NextRequest) {
  const user = resolveUserContext(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ message: "Invalid file type. Only PDF, JPG, and PNG are allowed." }, { status: 400 })
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ message: "File size exceeds 10MB limit" }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filePath = `documents/${user.employeeId}/${timestamp}-${sanitizedFileName}`

    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage (using employee-documents bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("employee-documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Error uploading file to storage:", uploadError)
      return NextResponse.json({ message: "Failed to upload file" }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("employee-documents")
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    return NextResponse.json(
      {
        fileUrl: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        filePath,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error in file upload:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}










