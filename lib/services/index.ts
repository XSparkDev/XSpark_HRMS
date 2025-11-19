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
  notes2Service,
  type EmployeeNote2,
  type CreateNotes2Input,
  type Notes2AlertLevel,
  type UpdateNotes2Input
} from './notes2-service'

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

export {
  RoomsService,
  roomsService,
  type Room,
  type RoomFilters,
  type CreateRoomInput,
  type UpdateRoomInput
} from './rooms-service'

export {
  ResourcesService,
  resourcesService,
  type ResourceModel,
  type ResourceRecord as BaseResourceRecord,
} from './resources-service'

// Legacy services (to be migrated)
export { notesService as legacyNotesService } from './notes-service'
export { documentsService } from './documents-service'
export { assignedDevicesService } from './assigned-devices-service'

// Import services for ServiceFactory
import { employeeService } from './employee-service'
import { leaveManagementService } from './leave-service'
import { payrollService } from './payroll-service'
import { notesService } from './notes-service-new'
import { storageService } from './storage-service'
import { assignedDevicesService } from './assigned-devices-service'
import { roomsService } from './rooms-service'
import { resourcesService } from './resources-service'
import { notes2Service } from './notes2-service'

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
        case 'notes2':
          this.instances.set(serviceName, notes2Service)
          break
        case 'storage':
          this.instances.set(serviceName, storageService)
          break
        case 'assignedDevices':
          this.instances.set(serviceName, assignedDevicesService)
          break
        case 'rooms':
          this.instances.set(serviceName, roomsService)
          break
        case 'resources':
          this.instances.set(serviceName, resourcesService)
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
  notes2Service,
  storageService,
  roomsService,
  resourcesService,
  ServiceFactory
}
