// ============================================================================
// EMPLOYEE SERVICE - Repository Pattern Implementation
// ============================================================================
// This service acts as the repository layer for employee data operations
// Integrates with the PostgreSQL database schema we created
// ============================================================================

import { supabase } from '@/lib/supabase'

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
      let query = supabase
        .from('active_employees')
        .select('*')

      // Apply filters
      if (filters?.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`)
      }

      if (filters?.department) {
        query = query.eq('department', filters.department)
      }

      if (filters?.employment_status) {
        query = query.eq('employment_status', filters.employment_status)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data || []
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
        .single()

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
   */
  async create(employeeData: CreateEmployeeData): Promise<Employee> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([employeeData])
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
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
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
}

// Export singleton instance
export const employeeService = new EmployeeService()
export default employeeService
