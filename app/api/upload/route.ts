// ============================================================================
// FILE UPLOAD API ROUTE - Handle file uploads to Supabase Storage
// ============================================================================
// This route handles file uploads with proper validation and organization
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { storageService } from '@/lib/services'
import { z } from 'zod'

// Validation schemas
const FileUploadSchema = z.object({
  bucket: z.enum(['employeeDocuments', 'contracts', 'payslips', 'profilePictures', 'supportingDocuments']),
  path: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  documentType: z.string().optional(),
  contractVersion: z.number().optional(),
  payPeriod: z.string().optional(),
  leaveRequestId: z.string().uuid().optional()
})

// File type validation
const ALLOWED_FILE_TYPES = {
  employeeDocuments: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif'
  ],
  contracts: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  payslips: ['application/pdf'],
  profilePictures: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  supportingDocuments: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
}

const MAX_FILE_SIZES = {
  employeeDocuments: 10, // 10MB
  contracts: 5, // 5MB
  payslips: 2, // 2MB
  profilePictures: 5, // 5MB
  supportingDocuments: 5 // 5MB
}

// ============================================================================
// POST /api/upload - Upload a file
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const uploadData = JSON.parse(formData.get('data') as string || '{}')

    // Validate file
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    // Validate upload data
    const validatedData = FileUploadSchema.parse(uploadData)

    // Validate file type
    const allowedTypes = ALLOWED_FILE_TYPES[validatedData.bucket]
    if (!storageService.validateFileType(file, allowedTypes)) {
      return NextResponse.json({
        success: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      }, { status: 400 })
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZES[validatedData.bucket]
    if (!storageService.validateFileSize(file, maxSize)) {
      return NextResponse.json({
        success: false,
        error: `File too large. Maximum size: ${maxSize}MB`
      }, { status: 400 })
    }

    // Upload file based on bucket type
    let uploadResult

    switch (validatedData.bucket) {
      case 'employeeDocuments':
        if (!validatedData.employeeId || !validatedData.documentType) {
          return NextResponse.json({
            success: false,
            error: 'Employee ID and document type required for employee documents'
          }, { status: 400 })
        }
        uploadResult = await storageService.uploadEmployeeDocument(
          file,
          validatedData.employeeId,
          validatedData.documentType
        )
        break

      case 'contracts':
        if (!validatedData.employeeId) {
          return NextResponse.json({
            success: false,
            error: 'Employee ID required for contracts'
          }, { status: 400 })
        }
        uploadResult = await storageService.uploadContract(
          file,
          validatedData.employeeId,
          validatedData.contractVersion || 1
        )
        break

      case 'payslips':
        if (!validatedData.employeeId || !validatedData.payPeriod) {
          return NextResponse.json({
            success: false,
            error: 'Employee ID and pay period required for payslips'
          }, { status: 400 })
        }
        uploadResult = await storageService.uploadPayslip(
          file,
          validatedData.employeeId,
          validatedData.payPeriod
        )
        break

      case 'profilePictures':
        if (!validatedData.employeeId) {
          return NextResponse.json({
            success: false,
            error: 'Employee ID required for profile pictures'
          }, { status: 400 })
        }
        uploadResult = await storageService.uploadProfilePicture(
          file,
          validatedData.employeeId
        )
        break

      case 'supportingDocuments':
        if (!validatedData.employeeId || !validatedData.leaveRequestId) {
          return NextResponse.json({
            success: false,
            error: 'Employee ID and leave request ID required for supporting documents'
          }, { status: 400 })
        }
        uploadResult = await storageService.uploadSupportingDocument(
          file,
          validatedData.employeeId,
          validatedData.leaveRequestId
        )
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid bucket type'
        }, { status: 400 })
    }

    if (!uploadResult.success) {
      return NextResponse.json({
        success: false,
        error: uploadResult.error || 'Upload failed'
      }, { status: 500 })
    }

    // Generate file metadata
    const metadata = storageService.generateFileMetadata(file)

    return NextResponse.json({
      success: true,
      data: {
        path: uploadResult.path,
        url: uploadResult.url,
        metadata: {
          ...metadata,
          sizeFormatted: storageService.formatFileSize(metadata.size)
        }
      },
      message: 'File uploaded successfully'
    })
  } catch (error) {
    console.error('File upload error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid upload data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'File upload failed'
    }, { status: 500 })
  }
}

// ============================================================================
// DELETE /api/upload - Delete a file
// ============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket') as keyof typeof ALLOWED_FILE_TYPES
    const path = searchParams.get('path')

    if (!bucket || !path) {
      return NextResponse.json({
        success: false,
        error: 'Bucket and path parameters required'
      }, { status: 400 })
    }

    // Validate bucket
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(bucket)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid bucket type'
      }, { status: 400 })
    }

    // Delete file
    const success = await storageService.deleteFile(bucket, path)

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete file'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })
  } catch (error) {
    console.error('File deletion error:', error)

    return NextResponse.json({
      success: false,
      error: 'File deletion failed'
    }, { status: 500 })
  }
}