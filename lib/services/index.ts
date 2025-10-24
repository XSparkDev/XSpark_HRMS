// ============================================================================
// SERVICES INDEX - Export all services
// ============================================================================
// This file provides a centralized export point for all services
// ============================================================================

// Base service class
export { BaseService } from './base-service'

// Authentication service
export {
  AuthService,
  authService,
  type AuthUser,
  type Session,
  type LoginCredentials,
  type SignupData,
  type AuthResponse,
  type PasswordResetRequest,
  type PasswordChangeRequest
} from './auth-service'

// Core services
export { 
  EmployeeService, 
  employeeService,
  type Employee,
  type CreateEmployeeData,
  type UpdateEmployeeData,
  type EmployeeFilters
} from './employee-service'

export { 
  LeaveManagementService, 
  leaveManagementService,
  type LeaveBalance,
  type LeaveRequest,
  type CreateLeaveRequestData,
  type LeaveRequestFilters
} from './leave-service'

export { 
  PayrollService, 
  payrollService,
  type Income,
  type Payslip,
  type CreatePayslipData,
  type PayslipFilters
} from './payroll-service'

export { 
  NotesService, 
  notesService,
  type Note,
  type CreateNoteData,
  type UpdateNoteData,
  type NoteFilters
} from './notes-service-new'

export { 
  StorageService,
  storageService,
  type FileUploadOptions,
  type FileUploadResult,
  type FileMetadata
} from './storage-service'

// Legacy services (to be migrated)
export { notesService as legacyNotesService } from './notes-service'
export { documentsService } from './documents-service'

// Import services for ServiceFactory
import { authService } from './auth-service'
import { employeeService } from './employee-service'
import { leaveManagementService } from './leave-service'
import { payrollService } from './payroll-service'
import { notesService } from './notes-service-new'
import { storageService } from './storage-service'

// Service factory for dependency injection
export class ServiceFactory {
  private static instances: Map<string, any> = new Map()

  static getService<T>(serviceName: string): T {
    if (!this.instances.has(serviceName)) {
      switch (serviceName) {
        case 'auth':
          this.instances.set(serviceName, authService)
          break
        case 'employee':
          this.instances.set(serviceName, employeeService)
          break
        case 'leave':
          this.instances.set(serviceName, leaveManagementService)
          break
        case 'payroll':
          this.instances.set(serviceName, payrollService)
          break
        case 'notes':
          this.instances.set(serviceName, notesService)
          break
        case 'storage':
          this.instances.set(serviceName, storageService)
          break
        default:
          throw new Error(`Unknown service: ${serviceName}`)
      }
    }
    return this.instances.get(serviceName)
  }
}

// Default exports for convenience
export default {
  authService,
  employeeService,
  leaveManagementService,
  payrollService,
  notesService,
  storageService,
  ServiceFactory
}
