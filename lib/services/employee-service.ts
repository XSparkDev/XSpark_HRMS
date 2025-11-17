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

export interface NextOfKin {
  id: string
  employee_id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  email?: string | null
  phone: string
  alternative_phone?: string | null
  relationship: string
  is_primary?: boolean
  created_at?: string
  updated_at?: string
}

export interface NextOfKinInput {
  id?: string
  full_name?: string
  name?: string
  first_name?: string
  middle_name?: string
  last_name?: string
  email?: string
  phone: string
  alternative_phone?: string
  relationship: string
  is_primary?: boolean
}

const splitFullName = (fullName: string): {
  firstName: string
  middleName?: string
  lastName: string
} => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }

  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined

  return { firstName, middleName, lastName }
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
      // PREVIOUS QUERY: .select('*')
      // UPDATED QUERY: .select('*, next_of_kin(*)') to keep NOK data in profile payloads.
      const { data, error } = await supabase
        .from('employees')
        .select('*, next_of_kin(*)')
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
        // Encrypt returns base64 string, convert to hex format expected by PostgREST for BYTEA
        const base64Encrypted = encrypt(employeeData.id_number)
        const encryptedBuffer = Buffer.from(base64Encrypted, 'base64')
        encryptedData.encrypted_id_number = '\\x' + encryptedBuffer.toString('hex')
        // Remove plaintext from insert
        delete encryptedData.id_number
      }

      // Encrypt tax_number if provided
      if (employeeData.tax_number) {
        // Encrypt returns base64 string, convert to hex format expected by PostgREST for BYTEA
        const base64Encrypted = encrypt(employeeData.tax_number)
        const encryptedBuffer = Buffer.from(base64Encrypted, 'base64')
        encryptedData.encrypted_tax_number = '\\x' + encryptedBuffer.toString('hex')
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
        const encryptedBuffer = Buffer.from(base64Encrypted, 'base64')
        updateData.encrypted_id_number = '\\x' + encryptedBuffer.toString('hex')
        delete updateData.id_number
      }

      // Encrypt tax_number if being updated
      if ('tax_number' in updateData && updateData.tax_number) {
        const base64Encrypted = encrypt(updateData.tax_number)
        const encryptedBuffer = Buffer.from(base64Encrypted, 'base64')
        updateData.encrypted_tax_number = '\\x' + encryptedBuffer.toString('hex')
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
   * Create or update multiple next of kin records for an employee
   */
  async saveNextOfKins(employeeId: string, nokArray: NextOfKinInput[]): Promise<NextOfKin[]> {
    if (!employeeId) {
      throw new Error('Employee ID is required to save next of kin')
    }

    if (!Array.isArray(nokArray) || nokArray.length === 0) {
      return []
    }

    const savedRecords: NextOfKin[] = []
    const timestamp = new Date().toISOString()

    try {
      for (const nok of nokArray) {
        let firstName = nok.first_name?.trim()
        let middleName = nok.middle_name?.trim()
        let lastName = nok.last_name?.trim()

        const fallbackName = (nok.full_name ?? nok.name ?? '').trim()
        if ((!firstName || !lastName) && fallbackName) {
          const split = splitFullName(fallbackName)
          if (!firstName && split.firstName) firstName = split.firstName
          if (!middleName && split.middleName) middleName = split.middleName
          if (!lastName && split.lastName) lastName = split.lastName
        }

        if (!firstName || !lastName) {
          throw new Error('Next of kin first_name and last_name are required')
        }

        const relationship = nok.relationship?.trim()
        if (!relationship) {
          throw new Error('Next of kin relationship is required')
        }

        const phone = nok.phone?.trim()
        if (!phone) {
          throw new Error('Next of kin phone is required')
        }

        const basePayload: Record<string, any> = {
          employee_id: employeeId,
          first_name: firstName,
          last_name: lastName,
          relationship,
          phone,
          updated_at: timestamp,
          is_primary: typeof nok.is_primary === 'boolean' ? nok.is_primary : false
        }

        if (middleName) basePayload.middle_name = middleName
        if (nok.email) basePayload.email = nok.email.trim()
        if (nok.alternative_phone) basePayload.alternative_phone = nok.alternative_phone.trim()

        if (nok.id) {
          const { data, error } = await supabaseAdmin
            .from('next_of_kin')
            .update(basePayload)
            .eq('id', nok.id)
            .eq('employee_id', employeeId)
            .select()
            .single()

          if (error) {
            console.error('Supabase next_of_kin update error:', error)
            throw new Error('Failed to save next_of_kin')
          }

          if (data) savedRecords.push(data as NextOfKin)
        } else {
          const insertPayload = {
            ...basePayload,
            created_at: timestamp
          }

          const { data, error } = await supabaseAdmin
            .from('next_of_kin')
            .insert([insertPayload])
            .select()
            .single()

          if (error) {
            console.error('Supabase next_of_kin insert error:', error)
            throw new Error('Failed to save next_of_kin')
          }

          if (data) savedRecords.push(data as NextOfKin)
        }
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        console.error('Unexpected error saving next of kin:', error)
        throw new Error('Failed to save next_of_kin')
      }

      if (!error.message.startsWith('Next of kin')) {
        console.error('Error saving next of kin:', error)
        throw new Error('Failed to save next_of_kin')
      }

      throw error
    }

    return savedRecords
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
