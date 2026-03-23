/**
 * Server-only: generate signed URLs for private employee-documents storage.
 * Use from API routes only (uses supabaseAdmin).
 */

import { storageConfig } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"

const DOCUMENTS_BUCKET = storageConfig.buckets.employeeDocuments

/** Default expiry for signed URLs (1 hour) */
const DEFAULT_EXPIRES_IN = 3600

/**
 * Extract storage object path from a Supabase storage URL (public or signed).
 * Returns null if the URL is not a recognized Supabase employee-documents URL.
 */
export function getStoragePathFromFileUrl(fileUrl: string): string | null {
  if (!fileUrl || typeof fileUrl !== "string") return null
  const trimmed = fileUrl.trim()
  // Already a relative path (e.g. "documents/XSP25/10/001/file.png")
  if (!trimmed.startsWith("http")) {
    return trimmed.startsWith("documents/") ? trimmed : null
  }
  // Supabase URL: .../object/public/employee-documents/PATH or .../object/sign/employee-documents/PATH?...
  const bucketSegment = `/employee-documents/`
  const idx = trimmed.indexOf(bucketSegment)
  if (idx === -1) return null
  const path = trimmed.slice(idx + bucketSegment.length)
  const q = path.indexOf("?")
  return q === -1 ? path : path.slice(0, q)
}

/**
 * Create a signed URL for a document stored in employee-documents bucket.
 * @param fileUrl - Stored file_url (Supabase public/signed URL or path)
 * @param expiresInSeconds - Optional expiry (default 3600)
 * @returns Signed URL or null if path could not be resolved
 */
export async function createSignedDocumentUrl(
  fileUrl: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN
): Promise<string | null> {
  const path = getStoragePathFromFileUrl(fileUrl)
  if (!path) return null
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) {
    console.error("createSignedDocumentUrl error:", error)
    return null
  }
  return data?.signedUrl ?? null
}
