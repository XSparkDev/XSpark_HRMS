// ============================================================================
// SERVICES INDEX - Export all services
// ============================================================================
// This file provides a centralized export point for all services
// ============================================================================

// Base service class
export { BaseService } from './base-service'

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
  createEmployeeNote,
  getEmployeeNotesByEmployee,
  getEmployeeNoteById,
  updateEmployeeNote,
  deleteEmployeeNote,
  type EmployeeNote,
  type CreateEmployeeNoteData,
  type UpdateEmployeeNoteData
} from './employee-notes-service'

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

// AMS services
export { 
  ResourcesService, 
  resourcesService,
  type Resource,
  type CreateResourceData,
  type UpdateResourceData,
  type ResourceFilters
} from './resources-service'

export { 
  BookingsService, 
  bookingsService,
  type Booking,
  type CreateBookingData,
  type UpdateBookingData,
  type BookingFilters
} from './bookings-service'

export { 
  ScanLogsService, 
  scanLogsService,
  type ScanLog,
  type CreateScanLogData,
  type ScanLogFilters
} from './scan-logs-service'

export { 
  IncidentsService, 
  incidentsService,
  type Incident,
  type CreateIncidentData,
  type UpdateIncidentData,
  type IncidentFilters
} from './incidents-service'

// Import services for ServiceFactory
import { employeeService } from './employee-service'
import { leaveManagementService } from './leave-service'
import { payrollService } from './payroll-service'
import { notesService } from './notes-service-new'
import { storageService } from './storage-service'
import { resourcesService } from './resources-service'
import { bookingsService } from './bookings-service'
import { scanLogsService } from './scan-logs-service'
import { incidentsService } from './incidents-service'

// Service factory for dependency injection
export class ServiceFactory {
  private static instances: Map<string, any> = new Map()

  static getService<T>(serviceName: string): T {
    if (!this.instances.has(serviceName)) {
      switch (serviceName) {
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
        case 'resources':
          this.instances.set(serviceName, resourcesService)
          break
        case 'bookings':
          this.instances.set(serviceName, bookingsService)
          break
        case 'scanLogs':
          this.instances.set(serviceName, scanLogsService)
          break
        case 'incidents':
          this.instances.set(serviceName, incidentsService)
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
  employeeService,
  leaveManagementService,
  payrollService,
  notesService,
  storageService,
  resourcesService,
  bookingsService,
  scanLogsService,
  incidentsService,
  ServiceFactory
}
