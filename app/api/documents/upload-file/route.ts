import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getRequestUser } from "@/lib/auth/request-user"
import { storageConfig } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"

const DOCUMENTS_BUCKET = storageConfig.buckets.employeeDocuments

/** Ensure the employee-documents bucket exists; create it if missing (idempotent). */
async function ensureDocumentsBucket(): Promise<void> {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    console.error("Error listing storage buckets:", listError)
    throw new Error("Storage unavailable")
  }
  const exists = buckets?.some((b: { name: string }) => b.name === DOCUMENTS_BUCKET)
  if (exists) return

  const { error: createError } = await supabaseAdmin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  })
  if (createError) {
    console.error("Error creating storage bucket:", createError)
    throw new Error("Could not create documents bucket")
  }
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

    // Ensure bucket exists (create if missing)
    await ensureDocumentsBucket()

    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage (using employee-documents bucket)
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Error uploading file to storage:", uploadError)
      return NextResponse.json({ message: "Failed to upload file" }, { status: 500 })
    }

    // Generate a signed URL for the private bucket (valid 1 hour for immediate use after upload)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, 3600)

    if (signedUrlError) {
      console.error("Error creating signed URL:", signedUrlError)
      return NextResponse.json({ message: "Failed to get file URL" }, { status: 500 })
    }

    const fileUrl = signedUrlData.signedUrl

    return NextResponse.json(
      {
        fileUrl,
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

























