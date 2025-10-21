// ============================================================================
// BASE SERVICE CLASS - Common functionality for all services
// ============================================================================
// This provides common database operations and error handling
// ============================================================================

import { supabase } from '@/lib/supabase'

export abstract class BaseService {
  protected supabase = supabase

  /**
   * Handle database errors consistently
   */
  protected handleError(error: any, operation: string): never {
    console.error(`Error in ${operation}:`, error)
    
    // Extract meaningful error message
    let message = 'An unexpected error occurred'
    
    if (error?.message) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }
    
    throw new Error(`${operation} failed: ${message}`)
  }

  /**
   * Execute a database query with error handling
   */
  protected async executeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    operation: string
  ): Promise<T | null> {
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      return data
    } catch (error) {
      this.handleError(error, operation)
    }
  }

  /**
   * Execute a database query that returns an array
   */
  protected async executeQueryArray<T>(
    queryFn: () => Promise<{ data: T[] | null; error: any }>,
    operation: string
  ): Promise<T[]> {
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      return data || []
    } catch (error) {
      this.handleError(error, operation)
    }
  }

  /**
   * Execute a database insert operation
   */
  protected async executeInsert<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    operation: string
  ): Promise<T> {
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      if (!data) {
        throw new Error(`${operation} returned no data`)
      }
      
      return data
    } catch (error) {
      this.handleError(error, operation)
    }
  }

  /**
   * Execute a database update operation
   */
  protected async executeUpdate<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    operation: string
  ): Promise<T | null> {
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      return data
    } catch (error) {
      this.handleError(error, operation)
    }
  }

  /**
   * Execute a database delete operation
   */
  protected async executeDelete(
    queryFn: () => Promise<{ error: any }>,
    operation: string
  ): Promise<boolean> {
    try {
      const { error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      return true
    } catch (error) {
      this.handleError(error, operation)
    }
  }

  /**
   * Execute a transaction
   */
  protected async executeTransaction<T>(
    operations: (() => Promise<any>)[],
    operation: string
  ): Promise<T[]> {
    try {
      const results = []
      
      for (const op of operations) {
        const result = await op()
        results.push(result)
      }
      
      return results
    } catch (error) {
      this.handleError(error, operation)
    }
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    )
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }
  }

  /**
   * Sanitize input data
   */
  protected sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data.trim()
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item))
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value)
      }
      return sanitized
    }
    
    return data
  }

  /**
   * Format date for database
   */
  protected formatDate(date: string | Date): string {
    if (typeof date === 'string') {
      return new Date(date).toISOString()
    }
    return date.toISOString()
  }

  /**
   * Check if user has permission for operation
   */
  protected async checkPermission(
    userId: string, 
    requiredRole: string, 
    operation: string
  ): Promise<boolean> {
    try {
      const { data: employee, error } = await this.supabase
        .from('employees')
        .select('roles(role_name)')
        .eq('auth_user_id', userId)
        .single()

      if (error) {
        console.error('Error checking permission:', error)
        return false
      }

      const userRole = employee?.roles?.role_name
      const roleHierarchy = ['employee', 'junior_hr', 'hr_manager', 'admin', 'super_admin']
      
      const userRoleIndex = roleHierarchy.indexOf(userRole)
      const requiredRoleIndex = roleHierarchy.indexOf(requiredRole)
      
      return userRoleIndex >= requiredRoleIndex
    } catch (error) {
      console.error('Error checking permission:', error)
      return false
    }
  }
}
