/**
 * @jest-environment jsdom
 */
import { StorageService } from '@/lib/services/storage-service'

// Mock Supabase storage
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
  storageConfig: {
    bucket: 'test-bucket',
    buckets: {
      employeeDocuments: 'employee-documents',
      contracts: 'contracts',
      payslips: 'payslips',
      profilePictures: 'profile-pictures',
      supportingDocuments: 'supporting-documents',
    },
  },
}))

describe('StorageService', () => {
  let storageService: StorageService
  let mockStorageFrom: jest.Mock

  beforeEach(() => {
    storageService = new StorageService()
    jest.clearAllMocks()
    
    // Get the mocked functions
    const { supabase } = require('@/lib/supabase')
    mockStorageFrom = supabase.storage.from as jest.Mock
  })

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      
      const mockUploadResult = {
        data: { path: 'employee-documents/test.pdf' },
        error: null,
      }

      const mockPublicUrl = {
        data: { publicUrl: 'https://storage.supabase.co/employee-documents/test.pdf' },
      }

      const mockStorage = {
        upload: jest.fn().mockResolvedValue(mockUploadResult),
        getPublicUrl: jest.fn().mockReturnValue(mockPublicUrl),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.uploadFile(mockFile, {
        bucket: 'employeeDocuments',
      })

      expect(result.success).toBe(true)
      expect(result.path).toBeDefined()
      expect(result.url).toBeDefined()
      expect(mockStorage.upload).toHaveBeenCalled()
    })

    it('should return error when upload fails', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

      const mockUploadResult = {
        data: null,
        error: new Error('Upload failed'),
      }

      const mockStorage = {
        upload: jest.fn().mockResolvedValue(mockUploadResult),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.uploadFile(mockFile, {
        bucket: 'employeeDocuments',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Upload failed')
    })
  })

  describe('uploadEmployeeDocument', () => {
    it('should upload employee document with correct path', async () => {
      const mockFile = new File(['test content'], 'id.pdf', { type: 'application/pdf' })

      const mockUploadResult = {
        data: { path: 'employee-documents/emp-1/id_copy/file.pdf' },
        error: null,
      }

      const mockPublicUrl = {
        data: { publicUrl: 'https://storage.supabase.co/file.pdf' },
      }

      const mockStorage = {
        upload: jest.fn().mockResolvedValue(mockUploadResult),
        getPublicUrl: jest.fn().mockReturnValue(mockPublicUrl),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.uploadEmployeeDocument(mockFile, 'emp-1', 'id_copy')

      expect(result.success).toBe(true)
      expect(mockStorage.upload).toHaveBeenCalled()
      
      // Check that the path includes employee ID and document type
      const uploadCall = mockStorage.upload.mock.calls[0]
      expect(uploadCall[0]).toContain('emp-1')
      expect(uploadCall[0]).toContain('id_copy')
    })
  })

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const mockStorage = {
        remove: jest.fn().mockResolvedValue({ error: null }),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.deleteFile('employeeDocuments', 'test/file.pdf')

      expect(result).toBe(true)
      expect(mockStorage.remove).toHaveBeenCalledWith(['test/file.pdf'])
    })

    it('should return false when delete fails', async () => {
      const mockStorage = {
        remove: jest.fn().mockResolvedValue({ error: new Error('Delete failed') }),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.deleteFile('employeeDocuments', 'test/file.pdf')

      expect(result).toBe(false)
    })
  })

  describe('getSignedUrl', () => {
    it('should create signed URL for private file', async () => {
      const mockStorage = {
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.supabase.co/signed-url' },
          error: null,
        }),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.getSignedUrl('employeeDocuments', 'test/file.pdf', 3600)

      expect(result).toBe('https://storage.supabase.co/signed-url')
      expect(mockStorage.createSignedUrl).toHaveBeenCalledWith('test/file.pdf', 3600)
    })

    it('should return null when signed URL creation fails', async () => {
      const mockStorage = {
        createSignedUrl: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Failed to create signed URL'),
        }),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.getSignedUrl('employeeDocuments', 'test/file.pdf')

      expect(result).toBeNull()
    })
  })

  describe('listFiles', () => {
    it('should list files in a path', async () => {
      const mockFiles = [
        { name: 'file1.pdf', size: 1024 },
        { name: 'file2.pdf', size: 2048 },
      ]

      const mockStorage = {
        list: jest.fn().mockResolvedValue({
          data: mockFiles,
          error: null,
        }),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.listFiles('employeeDocuments', 'emp-1')

      expect(result).toEqual(mockFiles)
      expect(mockStorage.list).toHaveBeenCalledWith('emp-1')
    })

    it('should return empty array when listing fails', async () => {
      const mockStorage = {
        list: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('List failed'),
        }),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.listFiles('employeeDocuments')

      expect(result).toEqual([])
    })
  })

  describe('validateFileType', () => {
    it('should validate allowed file types', () => {
      const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const jpgFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' })

      const allowedTypes = ['application/pdf', 'image/jpeg']

      expect(storageService.validateFileType(pdfFile, allowedTypes)).toBe(true)
      expect(storageService.validateFileType(jpgFile, allowedTypes)).toBe(true)
      expect(storageService.validateFileType(txtFile, allowedTypes)).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('should validate file size', () => {
      const smallFile = new File(['a'.repeat(1024)], 'small.txt') // 1KB
      const largeFile = new File(['a'.repeat(1024 * 1024 * 6)], 'large.txt') // 6MB

      expect(storageService.validateFileSize(smallFile, 5)).toBe(true) // 1KB < 5MB
      expect(storageService.validateFileSize(largeFile, 5)).toBe(false) // 6MB > 5MB
      expect(storageService.validateFileSize(largeFile, 10)).toBe(true) // 6MB < 10MB
    })
  })

  describe('formatFileSize', () => {
    it('should format file size correctly', () => {
      expect(storageService.formatFileSize(0)).toBe('0 Bytes')
      expect(storageService.formatFileSize(1024)).toBe('1 KB')
      expect(storageService.formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(storageService.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      expect(storageService.formatFileSize(1536)).toBe('1.5 KB')
    })
  })

  describe('generateFileMetadata', () => {
    it('should generate file metadata', () => {
      const file = new File(['test content'], 'test.pdf', { 
        type: 'application/pdf',
        lastModified: 1234567890,
      })

      const metadata = storageService.generateFileMetadata(file)

      expect(metadata).toEqual({
        name: 'test.pdf',
        size: file.size,
        type: 'application/pdf',
        lastModified: 1234567890,
      })
    })
  })

  describe('uploadProfilePicture', () => {
    it('should upload profile picture with upsert enabled', async () => {
      const mockFile = new File(['image data'], 'profile.jpg', { type: 'image/jpeg' })

      const mockUploadResult = {
        data: { path: 'profile-pictures/emp-1.jpg' },
        error: null,
      }

      const mockPublicUrl = {
        data: { publicUrl: 'https://storage.supabase.co/profile.jpg' },
      }

      const mockStorage = {
        upload: jest.fn().mockResolvedValue(mockUploadResult),
        getPublicUrl: jest.fn().mockReturnValue(mockPublicUrl),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.uploadProfilePicture(mockFile, 'emp-1')

      expect(result.success).toBe(true)
      
      // Check that upsert was enabled
      const uploadCall = mockStorage.upload.mock.calls[0]
      expect(uploadCall[2]).toMatchObject({ upsert: true })
    })
  })

  describe('uploadContract', () => {
    it('should upload contract with version in path', async () => {
      const mockFile = new File(['contract content'], 'contract.pdf', { type: 'application/pdf' })

      const mockUploadResult = {
        data: { path: 'contracts/emp-1/v2/contract.pdf' },
        error: null,
      }

      const mockPublicUrl = {
        data: { publicUrl: 'https://storage.supabase.co/contract.pdf' },
      }

      const mockStorage = {
        upload: jest.fn().mockResolvedValue(mockUploadResult),
        getPublicUrl: jest.fn().mockReturnValue(mockPublicUrl),
      }

      mockStorageFrom.mockReturnValue(mockStorage)

      const result = await storageService.uploadContract(mockFile, 'emp-1', 2)

      expect(result.success).toBe(true)
      
      // Check that version is in path
      const uploadCall = mockStorage.upload.mock.calls[0]
      expect(uploadCall[0]).toContain('v2')
    })
  })
})
