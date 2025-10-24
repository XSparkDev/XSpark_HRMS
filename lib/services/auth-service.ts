// ============================================================================
// AUTHENTICATION SERVICE - Supabase Auth Integration
// ============================================================================
// This service handles user authentication, session management, and
// integration with the employee system
// ============================================================================

import { supabase } from '@/lib/supabase'
import { BaseService } from './base-service'
import { employeeService, Employee } from './employee-service'

// Types
export interface AuthUser {
  id: string
  email: string
  created_at: string
  email_confirmed_at?: string
  phone?: string
  user_metadata?: any
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  token_type: string
  user: AuthUser
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  metadata?: any
}

export interface AuthResponse {
  user: AuthUser | null
  session: Session | null
  employee?: Employee | null
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string
}

export class AuthService extends BaseService {
  // ============================================================================
  // AUTHENTICATION OPERATIONS
  // ============================================================================

  /**
   * Sign up a new user with Supabase Auth
   * Note: This creates auth user but NOT employee record
   * Use createEmployeeWithAuth() to create both
   */
  async signup(signupData: SignupData): Promise<AuthResponse> {
    try {
      const { email, password, first_name, last_name, phone, metadata } = signupData

      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name,
            last_name,
            phone,
            ...metadata
          }
        }
      })

      if (error) throw error

      return {
        user: data.user as AuthUser,
        session: data.session as Session
      }
    } catch (error) {
      console.error('Error during signup:', error)
      throw new Error('Signup failed')
    }
  }

  /**
   * Log in with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { email, password } = credentials

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      // Get employee record linked to this auth user
      let employee = null
      if (data.user) {
        employee = await employeeService.getByAuthUserId(data.user.id)
      }

      return {
        user: data.user as AuthUser,
        session: data.session as Session,
        employee: employee || undefined
      }
    } catch (error) {
      console.error('Error during login:', error)
      throw new Error('Login failed. Please check your credentials.')
    }
  }

  /**
   * Log out current user
   */
  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error during logout:', error)
      throw new Error('Logout failed')
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user as AuthUser
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session as Session
    } catch (error) {
      console.error('Error getting current session:', error)
      return null
    }
  }

  /**
   * Get current user with employee data
   */
  async getCurrentUserWithEmployee(): Promise<AuthResponse> {
    try {
      const user = await this.getCurrentUser()
      const session = await this.getCurrentSession()

      let employee = null
      if (user) {
        employee = await employeeService.getByAuthUserId(user.id)
      }

      return {
        user,
        session,
        employee: employee || undefined
      }
    } catch (error) {
      console.error('Error getting current user with employee:', error)
      throw new Error('Failed to get user data')
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      return data.session as Session
    } catch (error) {
      console.error('Error refreshing session:', error)
      return null
    }
  }

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
      })

      if (error) throw error
    } catch (error) {
      console.error('Error requesting password reset:', error)
      throw new Error('Failed to send password reset email')
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error
    } catch (error) {
      console.error('Error updating password:', error)
      throw new Error('Failed to update password')
    }
  }

  /**
   * Verify and change password
   */
  async changePassword(request: PasswordChangeRequest): Promise<void> {
    try {
      const { currentPassword, newPassword } = request

      // Get current user
      const user = await this.getCurrentUser()
      if (!user) throw new Error('No authenticated user')

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      })

      if (verifyError) throw new Error('Current password is incorrect')

      // Update to new password
      await this.updatePassword(newPassword)
    } catch (error) {
      console.error('Error changing password:', error)
      throw error
    }
  }

  // ============================================================================
  // EMPLOYEE INTEGRATION
  // ============================================================================

  /**
   * Create employee with Supabase Auth user
   * This is the recommended way to create employees who need login access
   */
  async createEmployeeWithAuth(
    employeeData: any,
    password: string,
    sendEmail: boolean = true
  ): Promise<{ employee: Employee; authUser: AuthUser }> {
    try {
      // Validate required fields
      this.validateRequired(employeeData, ['first_name', 'last_name', 'email', 'dob', 'sex', 'date_hired'])

      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: employeeData.email,
        password,
        email_confirm: !sendEmail, // Auto-confirm if not sending email
        user_metadata: {
          first_name: employeeData.first_name,
          last_name: employeeData.last_name,
          phone: employeeData.phone
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create auth user')

      // Create employee record with auth_user_id
      const employee = await employeeService.create({
        ...employeeData,
        auth_user_id: authData.user.id
      })

      return {
        employee,
        authUser: authData.user as AuthUser
      }
    } catch (error) {
      console.error('Error creating employee with auth:', error)
      throw new Error('Failed to create employee with authentication')
    }
  }

  /**
   * Link existing employee to Supabase Auth user
   */
  async linkEmployeeToAuth(
    employeeId: string,
    password: string
  ): Promise<{ employee: Employee; authUser: AuthUser }> {
    try {
      // Get employee
      const employee = await employeeService.getById(employeeId)
      if (!employee) throw new Error('Employee not found')

      // Check if already has auth user
      if (employee.auth_user_id) {
        throw new Error('Employee already has authentication')
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: employee.email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: employee.first_name,
          last_name: employee.last_name,
          phone: employee.phone,
          employee_id: employee.employee_id
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create auth user')

      // Update employee with auth_user_id
      const updatedEmployee = await employeeService.update(employeeId, {
        auth_user_id: authData.user.id
      })

      if (!updatedEmployee) throw new Error('Failed to update employee')

      return {
        employee: updatedEmployee,
        authUser: authData.user as AuthUser
      }
    } catch (error) {
      console.error('Error linking employee to auth:', error)
      throw error
    }
  }

  /**
   * Remove auth access for employee (disable login)
   */
  async unlinkEmployeeFromAuth(employeeId: string): Promise<void> {
    try {
      // Get employee
      const employee = await employeeService.getById(employeeId)
      if (!employee) throw new Error('Employee not found')

      if (!employee.auth_user_id) {
        throw new Error('Employee has no authentication')
      }

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(employee.auth_user_id)
      if (error) throw error

      // Remove auth_user_id from employee
      await employeeService.update(employeeId, {
        auth_user_id: undefined
      })
    } catch (error) {
      console.error('Error unlinking employee from auth:', error)
      throw error
    }
  }

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  /**
   * Get all auth users (admin only)
   */
  async getAllAuthUsers(page: number = 1, perPage: number = 50): Promise<{ users: AuthUser[]; total: number }> {
    try {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage
      })

      if (error) throw error

      return {
        users: data.users as AuthUser[],
        total: data.users.length
      }
    } catch (error) {
      console.error('Error getting auth users:', error)
      throw new Error('Failed to get auth users')
    }
  }

  /**
   * Delete auth user (admin only)
   */
  async deleteAuthUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) throw error
    } catch (error) {
      console.error('Error deleting auth user:', error)
      throw new Error('Failed to delete auth user')
    }
  }

  /**
   * Update user email (admin only)
   */
  async updateUserEmail(userId: string, newEmail: string): Promise<void> {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email: newEmail
      })

      if (error) throw error
    } catch (error) {
      console.error('Error updating user email:', error)
      throw new Error('Failed to update user email')
    }
  }

  /**
   * Reset user password (admin only)
   */
  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      })

      if (error) throw error
    } catch (error) {
      console.error('Error resetting user password:', error)
      throw new Error('Failed to reset user password')
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if email is already registered
   */
  async isEmailRegistered(email: string): Promise<boolean> {
    try {
      const employee = await employeeService.getByEmail(email)
      return !!employee
    } catch (error) {
      console.error('Error checking email:', error)
      return false
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate random password
   */
  generateRandomPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    const allChars = uppercase + lowercase + numbers + special

    let password = ''
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }
}

// Export singleton instance
export const authService = new AuthService()
export default authService

