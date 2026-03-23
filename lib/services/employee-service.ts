// ============================================================================
// EMPLOYEE SERVICE - Repository Pattern Implementation
// ============================================================================
// This service acts as the repository layer for employee data operations
// Integrates with the PostgreSQL database schema we created
// ============================================================================

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { encrypt } from '@/lib/crypto'

// Database types matching our schema
export interface Employee {
  id: string
  auth_user_id?: string
  first_name: string
  middle_name?: string
  last_name: string
  preferred_name?: string
  id_number?: string
  dob: string
  sex: 'male' | 'female'
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  pronouns?: string
  employee_id: string
  job_title_id?: string
  role_id?: string
  email: string
  phone?: string
  alternative_phone?: string
  address?: string
  tax_number?: string
  nationality: string
  passport_number?: string
  passport_document_url?: string
  work_permit_url?: string
  id_verified: boolean
  work_permit_verified: boolean
  bank_verified: boolean
  employment_status: 'active' | 'suspended' | 'terminated' | 'probation' | 'absconded' | 'archived'
  date_hired: string
  date_terminated?: string
  termination_reason?: string
  confidentiality_acknowledged_at?: string
  profile_picture_url?: string
  documents?: any[]
  is_active: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
}

export interface CreateEmployeeData {
  auth_user_id?: string
  first_name: string
  middle_name?: string
  last_name: string
  preferred_name?: string
  id_number?: string
  dob: string
  sex: 'male' | 'female'
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  pronouns?: string
  job_title_id?: string
  role_id?: string
  email: string
  phone?: string
  alternative_phone?: string
  address?: string
  tax_number?: string
  nationality?: string
  passport_number?: string
  passport_document_url?: string
  work_permit_url?: string
  employment_status?: 'active' | 'suspended' | 'terminated' | 'probation' | 'absconded' | 'archived'
  date_hired: string
  profile_picture_url?: string
  documents?: any[]
}

export interface UpdateEmployeeData extends Partial<CreateEmployeeData> {
  id: string
}

export interface EmployeeFilters {
  search?: string
  department?: string
  job_title?: string
  employment_status?: string
  nationality?: string
  is_active?: boolean
  limit?: number
  offset?: number
}

export class EmployeeService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get all active employees with optional filtering
   */
  async getAllActive(filters?: EmployeeFilters): Promise<Employee[]> {
    try {
      const buildQuery = (source: 'active_employees' | 'employees') => {
        let query = supabase.from(source).select('*')

        // Apply filters
        if (filters?.search) {
          query = query.or(
            `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`,
          )
        }

        if (filters?.department) {
          query = query.eq('department', filters.department)
        }

        if (filters?.employment_status) {
          query = query.eq('employment_status', filters.employment_status)
        }

        // When using base employees table, enforce active flag
        if (source === 'employees') {
          query = query.eq('is_active', true)
        }

        if (typeof filters?.limit === 'number') {
          query = query.limit(filters.limit)
        }

        if (typeof filters?.offset === 'number') {
          const offset = filters.offset || 0
          const limit = filters.limit || 50
          query = query.range(offset, offset + limit - 1)
        }

        return query.order('created_at', { ascending: false })
      }

      // First try the materialized/view `active_employees`
      let { data, error } = await buildQuery('active_employees')

      // If the view doesn't exist or errors (common in local dev), fall back to base table
      if (error) {
        console.warn(
          '[EmployeeService] active_employees view unavailable, falling back to employees table:',
          error,
        )
        ;({ data, error } = await buildQuery('employees'))
      }

      if (error) throw error
      return (data as Employee[]) || []
    } catch (error) {
      console.error('Error fetching active employees:', error)
      throw new Error('Failed to fetch employees')
    }
  }

  /**
   * Get employee by ID
   */
  async getById(id: string): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching employee by ID:', error)
      return null
    }
  }

  /**
   * Get employee by employee_id (XSP format)
   */
  async getByEmployeeId(employeeId: string): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', employeeId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching employee by employee ID:', error)
      return null
    }
  }

  /**
   * Get employee by email
   */
  async getByEmail(email: string): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching employee by email:', error)
      return null
    }
  }

  /**
   * Get employee by auth_user_id (Supabase auth)
   */
  async getByAuthUserId(authUserId: string): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching employee by auth user ID:', error)
      return null
    }
  }

  /**
   * Get employees by department
   */
  async getByDepartment(department: string): Promise<Employee[]> {
    try {
      const { data, error } = await supabase
        .from('active_employees')
        .select('*')
        .eq('department', department)
        .eq('is_active', true)
        .order('last_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching employees by department:', error)
      throw new Error('Failed to fetch employees by department')
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Create a new employee
   * This will trigger the employee_id generation trigger automatically
   * Encrypts sensitive fields (id_number, tax_number) before storage
   */
  async create(employeeData: CreateEmployeeData): Promise<Employee> {
    try {
      // Prepare data with encryption for sensitive fields
      const encryptedData: any = { ...employeeData }

      // Encrypt id_number if provided
      if (employeeData.id_number) {
        // Encrypt returns base64 string, convert to Buffer for BYTEA storage
        const base64Encrypted = encrypt(employeeData.id_number)
        encryptedData.encrypted_id_number = Buffer.from(base64Encrypted, 'base64')
        // Remove plaintext from insert
        delete encryptedData.id_number
      }

      // Encrypt tax_number if provided
      if (employeeData.tax_number) {
        // Encrypt returns base64 string, convert to Buffer for BYTEA storage
        const base64Encrypted = encrypt(employeeData.tax_number)
        encryptedData.encrypted_tax_number = Buffer.from(base64Encrypted, 'base64')
        // Remove plaintext from insert
        delete encryptedData.tax_number
      }

      const { data, error } = await supabaseAdmin
        .from('employees')
        .insert([encryptedData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating employee:', error)
      throw new Error('Failed to create employee')
    }
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update employee data
   */
  async update(id: string, updates: Partial<UpdateEmployeeData>): Promise<Employee | null> {
    try {
      // Handle encryption for sensitive fields if being updated
      const updateData: any = { ...updates }

      // Encrypt id_number if being updated
      if ('id_number' in updateData && updateData.id_number) {
        const base64Encrypted = encrypt(updateData.id_number)
        updateData.encrypted_id_number = Buffer.from(base64Encrypted, 'base64')
        delete updateData.id_number
      }

      // Encrypt tax_number if being updated
      if ('tax_number' in updateData && updateData.tax_number) {
        const base64Encrypted = encrypt(updateData.tax_number)
        updateData.encrypted_tax_number = Buffer.from(base64Encrypted, 'base64')
        delete updateData.tax_number
      }

      const { data, error } = await supabaseAdmin
        .from('employees')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating employee:', error)
      throw new Error('Failed to update employee')
    }
  }

  /**
   * Archive employee (soft delete)
   */
  async archive(id: string, reason?: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('archive_employee', {
        emp_id: id,
        reason: reason || null
      })

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error archiving employee:', error)
      throw new Error('Failed to archive employee')
    }
  }

  /**
   * Restore archived employee
   */
  async restore(id: string): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update({
          is_active: true,
          employment_status: 'active',
          deleted_at: null
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error restoring employee:', error)
      throw new Error('Failed to restore employee')
    }
  }

  // ============================================================================
  // VERIFICATION OPERATIONS
  // ============================================================================

  /**
   * Mark ID as verified
   */
  async verifyId(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ id_verified: true })
        .eq('id', id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error verifying ID:', error)
      throw new Error('Failed to verify ID')
    }
  }

  /**
   * Mark bank details as verified
   */
  async verifyBank(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ bank_verified: true })
        .eq('id', id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error verifying bank details:', error)
      throw new Error('Failed to verify bank details')
    }
  }

  /**
   * Mark work permit as verified
   */
  async verifyWorkPermit(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ work_permit_verified: true })
        .eq('id', id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error verifying work permit:', error)
      throw new Error('Failed to verify work permit')
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get employee count by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('employment_status')
        .eq('is_active', true)

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, employee: { employment_status: string }) => {
        acc[employee.employment_status] = (acc[employee.employment_status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting employee count by status:', error)
      throw new Error('Failed to get employee count by status')
    }
  }

  /**
   * Search employees by name or email
   */
  async search(query: string, limit: number = 10): Promise<Employee[]> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(limit)
        .order('last_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching employees:', error)
      throw new Error('Failed to search employees')
    }
  }

  /**
   * Retroactively assign default "employee" role to employees without role_id
   * This utility function should be run once to fix existing employee records
   */
  async assignDefaultRoleToEmployeesWithoutRole(): Promise<{ updated: number; errors: number }> {
    try {
      // Get the "employee" role_id
      const { data: roleData, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('role_name', 'employee')
        .single()

      if (roleError || !roleData) {
        throw new Error(`Failed to fetch employee role_id: ${roleError?.message || 'Role not found'}`)
      }

      const employeeRoleId = roleData.id

      // Find all employees without a role_id
      const { data: employees, error: fetchError } = await supabaseAdmin
        .from('employees')
        .select('id')
        .is('role_id', null)

      if (fetchError) throw fetchError

      if (!employees || employees.length === 0) {
        return { updated: 0, errors: 0 }
      }

      // Update all employees without role_id
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('employees')
        .update({ role_id: employeeRoleId })
        .is('role_id', null)
        .select('id')

      if (updateError) throw updateError

      return {
        updated: updatedData?.length || 0,
        errors: (employees?.length || 0) - (updatedData?.length || 0)
      }
    } catch (error) {
      console.error('Error assigning default role to employees:', error)
      throw new Error('Failed to assign default role to employees')
    }
  }
}

// Export singleton instance
export const employeeService = new EmployeeService()
export default employeeService
