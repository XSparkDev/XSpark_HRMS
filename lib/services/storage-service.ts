// ============================================================================
// STORAGE SERVICE - File upload and management
// ============================================================================
// This service handles file uploads to Supabase Storage with proper organization
// ============================================================================

import { supabase, storageConfig } from '@/lib/supabase'

export interface FileUploadOptions {
  bucket: keyof typeof storageConfig.buckets
  path?: string
  upsert?: boolean
}

export interface FileUploadResult {
  success: boolean
  path?: string
  url?: string
  error?: string
}

export interface FileMetadata {
  name: string
  size: number
  type: string
  lastModified: number
}

export class StorageService {
  // ============================================================================
  // FILE UPLOAD OPERATIONS
  // ============================================================================

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    try {
      if (!file || !file.name) {
        return {
          success: false,
          error: 'Invalid file provided'
        }
      }

      const bucketName = storageConfig.buckets[options.bucket]
      
      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const fileExtension = file.name.split('.').pop() || 'file'
      const fileName = `${timestamp}-${randomString}.${fileExtension}`
      
      // Construct full path
      const fullPath = options.path ? `${options.path}/${fileName}` : fileName
      
      // Upload file
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fullPath, file, {
          upsert: options.upsert || false,
          contentType: file.type
        })

      if (error) {
        console.error('File upload error:', error)
        return {
          success: false,
          error: error.message
        }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fullPath)

      return {
        success: true,
        path: data.path,
        url: urlData.publicUrl
      }
    } catch (error) {
      console.error('File upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: File[],
    options: FileUploadOptions
  ): Promise<FileUploadResult[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, options))
    return Promise.all(uploadPromises)
  }

  /**
   * Upload employee document
   */
  async uploadEmployeeDocument(
    file: File,
    employeeId: string,
    documentType: string
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, {
      bucket: 'employeeDocuments',
      path: `${employeeId}/${documentType}`
    })
  }

  /**
   * Upload contract document
   */
  async uploadContract(
    file: File,
    employeeId: string,
    contractVersion: number = 1
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, {
      bucket: 'contracts',
      path: `${employeeId}/v${contractVersion}`
    })
  }

  /**
   * Upload payslip document
   */
  async uploadPayslip(
    file: File,
    employeeId: string,
    payPeriod: string
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, {
      bucket: 'payslips',
      path: `${employeeId}/${payPeriod}`
    })
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(
    file: File,
    employeeId: string
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, {
      bucket: 'profilePictures',
      path: employeeId,
      upsert: true // Replace existing profile picture
    })
  }

  /**
   * Upload supporting document for leave request
   */
  async uploadSupportingDocument(
    file: File,
    employeeId: string,
    leaveRequestId: string
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, {
      bucket: 'supportingDocuments',
      path: `${employeeId}/${leaveRequestId}`
    })
  }

  // ============================================================================
  // FILE MANAGEMENT OPERATIONS
  // ============================================================================

  /**
   * Get file URL
   */
  getFileUrl(bucket: keyof typeof storageConfig.buckets, path: string): string {
    const bucketName = storageConfig.buckets[bucket]
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path)
    
    return data.publicUrl
  }

  /**
   * Get signed URL for private files
   */
  async getSignedUrl(
    bucket: keyof typeof storageConfig.buckets,
    path: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    try {
      const bucketName = storageConfig.buckets[bucket]
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, expiresIn)

      if (error) {
        console.error('Error creating signed URL:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('Error creating signed URL:', error)
      return null
    }
  }

  /**
   * Delete file
   */
  async deleteFile(
    bucket: keyof typeof storageConfig.buckets,
    path: string
  ): Promise<boolean> {
    try {
      const bucketName = storageConfig.buckets[bucket]
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([path])

      if (error) {
        console.error('Error deleting file:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  }

  /**
   * List files in a path
   */
  async listFiles(
    bucket: keyof typeof storageConfig.buckets,
    path: string = ''
  ): Promise<any[]> {
    try {
      const bucketName = storageConfig.buckets[bucket]
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path)

      if (error) {
        console.error('Error listing files:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error listing files:', error)
      return []
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    bucket: keyof typeof storageConfig.buckets,
    path: string
  ): Promise<any | null> {
    try {
      if (!path || typeof path !== 'string') {
        console.error('Invalid path provided to getFileMetadata')
        return null
      }

      const bucketName = storageConfig.buckets[bucket]
      const pathParts = path.split('/').filter(p => p)
      const directoryPath = pathParts.slice(0, -1).join('/')
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(directoryPath || '')

      if (error) {
        console.error('Error getting file metadata:', error)
        return null
      }

      const fileName = pathParts[pathParts.length - 1]
      return data?.find((file: any) => file.name === fileName) || null
    } catch (error) {
      console.error('Error getting file metadata:', error)
      return null
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Validate file type
   */
  validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type)
  }

  /**
   * Validate file size
   */
  validateFileSize(file: File, maxSizeMB: number): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    return file.size <= maxSizeBytes
  }

  /**
   * Get file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Generate file metadata
   */
  generateFileMetadata(file: File): FileMetadata {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }
  }
}

// Export singleton instance
export const storageService = new StorageService()
export default storageService
