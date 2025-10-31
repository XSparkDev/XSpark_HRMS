import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const TAG_LENGTH = 16 // 128 bits

// Get encryption key from environment
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
  
  if (key === 'default-key-change-in-production') {
    console.warn('⚠️  Using default encryption key. Change ENCRYPTION_KEY in production!')
  }
  
  // Ensure key is exactly 32 bytes
  return crypto.scryptSync(key, 'salt', KEY_LENGTH)
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param text - The text to encrypt
 * @returns Base64 encoded encrypted data with IV and tag
 */
export const encrypt = (text: string): string => {
  if (!text) return ''
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    cipher.setAAD(Buffer.from('xspark-hrms', 'utf8'))
    
    let encrypted = cipher.update(text, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    const tag = cipher.getAuthTag()
    
    // Combine IV + tag + encrypted data
    const combined = Buffer.concat([iv, tag, encrypted])
    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts sensitive data using AES-256-GCM
 * @param encryptedData - Base64 encoded encrypted data
 * @returns Decrypted text
 */
export const decrypt = (encryptedData: string): string => {
  if (!encryptedData) return ''
  
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedData, 'base64')
    
    // Extract IV, tag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH)
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(Buffer.from('xspark-hrms', 'utf8'))
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hashes sensitive data for verification purposes
 * @param data - The data to hash
 * @returns SHA-256 hash
 */
export const hash = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Generates a secure random token
 * @param length - Token length in bytes
 * @returns Base64 encoded random token
 */
export const generateToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('base64')
}

/**
 * Verifies if a value matches its hash
 * @param value - The original value
 * @param hash - The hash to verify against
 * @returns True if hash matches
 */
export const verifyHash = (value: string, hash: string): boolean => {
  return hash === hash(value)
}

/**
 * Sanitizes input to prevent XSS and injection attacks
 * @param input - The input to sanitize
 * @returns Sanitized input
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocols
    .replace(/vbscript:/gi, '') // Remove vbscript: protocols
    .trim()
}

/**
 * Validates file upload security
 * @param file - The file to validate
 * @param options - Validation options
 * @returns Validation result
 */
export const validateFileUpload = (file: {
  name: string
  size: number
  type: string
  buffer?: Buffer
}, options: {
  maxSize?: number
  allowedTypes?: string[]
  allowedExtensions?: string[]
  scanForViruses?: boolean
} = {}): { valid: boolean; error?: string } => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
    scanForViruses = false
  } = options
  
  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` }
  }
  
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' }
  }
  
  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' }
  }
  
  // Check for suspicious file names
  const suspiciousPatterns = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.scr$/i,
    /\.pif$/i,
    /\.com$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.jar$/i
  ]
  
  if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
    return { valid: false, error: 'Suspicious file type detected' }
  }
  
  // Basic virus scanning (placeholder - implement proper virus scanning)
  if (scanForViruses && file.buffer) {
    // Check for common malware signatures
    const malwareSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x50, 0x4B]), // ZIP/Office document
    ]
    
    for (const signature of malwareSignatures) {
      if (file.buffer.includes(signature)) {
        return { valid: false, error: 'Potential malware detected' }
      }
    }
  }
  
  return { valid: true }
}

/**
 * Rate limiting helper
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum requests per window
 * @returns Rate limit status
 */
export const checkRateLimit = (
  identifier: string,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100
): { allowed: boolean; remaining: number; resetTime: number } => {
  // This is a simple in-memory rate limiter
  // In production, use Redis or similar for distributed rate limiting
  
  const now = Date.now()
  const windowStart = now - windowMs
  
  // Clean up old entries (this would be handled by Redis TTL in production)
  if (typeof global.rateLimitStore === 'undefined') {
    global.rateLimitStore = new Map()
  }
  
  const store = global.rateLimitStore as Map<string, number[]>
  
  // Get existing requests for this identifier
  const requests = store.get(identifier) || []
  
  // Filter requests within the current window
  const recentRequests = requests.filter(timestamp => timestamp > windowStart)
  
  // Check if limit exceeded
  if (recentRequests.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.min(...recentRequests) + windowMs
    }
  }
  
  // Add current request
  recentRequests.push(now)
  store.set(identifier, recentRequests)
  
  return {
    allowed: true,
    remaining: maxRequests - recentRequests.length,
    resetTime: now + windowMs
  }
}

/**
 * Audit logging helper
 * @param action - The action performed
 * @param details - Additional details
 * @param userId - User performing the action
 * @param severity - Log severity level
 */
export const logAuditEvent = (
  action: string,
  details: Record<string, any>,
  userId?: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
): void => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    details,
    severity,
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown'
  }
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('AUDIT:', auditLog)
  }
  
  // In production, send to logging service (e.g., Winston, CloudWatch, etc.)
  // logger.info('Audit event', auditLog)
}

// Type definitions for global rate limiting store
declare global {
  var rateLimitStore: Map<string, number[]> | undefined
}
