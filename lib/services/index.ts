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
  type UpdateRoomInput,
} from './rooms-service'

export {
  ResourcesService,
  resourcesService,
  type ResourceModel,
  type ResourceRecord as BaseResourceRecord,
} from './resources-service'

export {
  DevicesService,
  devicesService,
  type DeviceRecord,
  type DeviceFilters,
  type CreateDeviceInput,
  type UpdateDeviceInput,
} from './devices-service'

export {
  BorrowService,
  borrowService,
  type BorrowRecord,
  type BorrowFilters,
  type CreateBorrowInput,
  type UpdateBorrowInput,
} from './borrow-service'

export {
  IncidentsService,
  incidentsService,
  type IncidentRecord,
  type IncidentFilters,
  type CreateIncidentInput,
  type UpdateIncidentInput,
} from './incidents-service'

export {
  MaintenanceService,
  maintenanceService,
  type MaintenanceRequestRecord,
  type MaintenanceRequestFilters,
  type CreateMaintenanceRequestInput,
  type UpdateMaintenanceRequestInput,
} from './maintenance-service'

export {
  BookingsService,
  bookingsService,
  type BookingRecord,
  type BookingFilters,
  type CreateBookingInput,
  type UpdateBookingInput,
} from './bookings-service'

export {
  NotificationService,
  notificationService,
  type NotificationRecord,
  type CreateNotificationInput,
  type NotificationRealtimeHandlers,
} from './notification-service'

export {
  EmailService,
  emailService,
  type EmailOptions,
  type SendEmailResult,
} from './email-service'

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
import { devicesService } from './devices-service'
import { bookingsService } from './bookings-service'
import { borrowService } from './borrow-service'
import { incidentsService } from './incidents-service'
import { maintenanceService } from './maintenance-service'
import { notificationService } from './notification-service'
import { emailService } from './email-service'

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
        case 'assignedDevices':
          this.instances.set(serviceName, assignedDevicesService)
          break
        case 'rooms':
          this.instances.set(serviceName, roomsService)
          break
        case 'resources':
          this.instances.set(serviceName, resourcesService)
          break
        case 'devices':
          this.instances.set(serviceName, devicesService)
          break
        case 'borrows':
          this.instances.set(serviceName, borrowService)
          break
        case 'incidents':
          this.instances.set(serviceName, incidentsService)
          break
        case 'maintenance':
          this.instances.set(serviceName, maintenanceService)
          break
        case 'bookings':
          this.instances.set(serviceName, bookingsService)
          break
        case 'notifications':
          this.instances.set(serviceName, notificationService)
          break
        case 'email':
          this.instances.set(serviceName, emailService)
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
  roomsService,
  resourcesService,
  devicesService,
  borrowService,
  incidentsService,
  maintenanceService,
  bookingsService,
  notificationService,
  emailService,
  ServiceFactory
}
