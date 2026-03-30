// ============================================================================
// BORROW SERVICE - Repository Layer (REBUILT)
// ============================================================================
// Handles CRUD-style operations for the `borrows` table.
// Uses only actual database schema: is_borrowed boolean (false = pending, true = active)
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

import { BaseService } from './base-service'
import { devicesService } from './devices-service'
import { notificationService } from './notification-service'

// ============================================================================
// INTERFACES - Based on actual database schema
// ============================================================================

export interface BorrowRecord {
  borrow_id: string
  device_id: string
  borrowed_by: string
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean | null
  notes?: string | null
  qr_code_url?: string | null
}

export interface BorrowFilters {
  deviceId?: string
  borrowedBy?: string
  isBorrowed?: boolean // false = pending, true = active
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface CreateBorrowInput {
  device_id: string
  borrowed_by: string
  borrow_date?: string | null
  return_date?: string | null
  notes?: string | null
}

export type UpdateBorrowInput = Partial<{
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean
  notes: string | null
}>

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// OLD IMPLEMENTATION - COMMENTED OUT FOR REBUILD
// ============================================================================
/*
export class BorrowService extends BaseService {
  // ... old implementation commented out ...
}
*/

// ============================================================================
// NEW CLEAN IMPLEMENTATION
// ============================================================================

export class BorrowService extends BaseService {
  private readonly table = 'borrows'
  private readonly admin = supabaseAdmin

  /**
   * Resolve borrower identifier (UUID or employee_id) to employee UUID
   */
  private async resolveBorrowerIdentifier(identifier: string): Promise<{ employeeId: string; employeeUuid: string }> {
    const trimmed = identifier?.trim()
    if (!trimmed) {
      throw new Error('borrowed_by is required')
    }

    const column = uuidRegex.test(trimmed) ? 'id' : 'employee_id'
    const { data, error } = await this.admin
      .from('employees')
      .select('id, employee_id')
      .eq(column, trimmed)
      .maybeSingle()

    if (error) {
      console.warn('[BorrowService] Error resolving borrower identifier:', error)
      throw new Error(`Borrower not found: ${error.message || 'Database error'}`)
    }

    if (!data?.id || !data?.employee_id) {
      throw new Error('Borrower not found')
    }

    return {
      employeeUuid: data.id,
      employeeId: data.employee_id,
    }
  }

  /**
   * List borrows with filters
   * is_borrowed = false → pending requests
   * is_borrowed = true → active borrows
   */
  async listBorrows(filters: BorrowFilters = {}): Promise<{ data: BorrowRecord[]; count: number }> {
    try {
      let query = this.admin.from(this.table).select('*', { count: 'exact' })

      if (filters.deviceId) {
        query = query.eq('device_id', filters.deviceId)
      }

      if (filters.borrowedBy) {
        const { employeeUuid } = await this.resolveBorrowerIdentifier(filters.borrowedBy)
        query = query.eq('borrowed_by', employeeUuid)
      }

      // Filter by is_borrowed: false = pending, true = active
      if (typeof filters.isBorrowed === 'boolean') {
        query = query.eq('is_borrowed', filters.isBorrowed)
      }

      if (filters.fromDate) {
        query = query.gte('borrow_date', filters.fromDate)
      }

      if (filters.toDate) {
        query = query.lte('borrow_date', filters.toDate)
      }

      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      } else if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
      }

      const { data, error, count } = await query.order('borrow_date', { ascending: false })

      if (error) {
        console.error('[BorrowService] Query error:', error)
        this.handleError(error, 'list borrows')
      }

      return {
        data: (data as BorrowRecord[]) ?? [],
        count: count ?? 0,
      }
    } catch (error) {
      console.error('[BorrowService] Exception in listBorrows:', error)
      this.handleError(error, 'list borrows')
    }
  }

  /**
   * Get single borrow by ID
   */
  async getBorrowById(borrowId: string): Promise<BorrowRecord | null> {
    return this.executeQuery<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('borrow_id', borrowId)
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'get borrow by id',
    )
  }

  /**
   * Create new borrow request
   * Sets is_borrowed = false (pending)
   */
  async createBorrow(payload: CreateBorrowInput): Promise<BorrowRecord> {
    this.validateRequired(payload, ['device_id', 'borrowed_by'])
    const { employeeUuid } = await this.resolveBorrowerIdentifier(payload.borrowed_by)

    const deviceIdentifier = payload.device_id?.trim()
    if (!deviceIdentifier) {
      throw new Error('device_id is required')
    }

    // Lookup device
    const device = await devicesService.getDeviceByIdentifier(deviceIdentifier)
    if (!device) {
      throw new Error('Device not found')
    }

    // Check if device is already borrowed
      const activeBorrow = await this.getActiveBorrowByDevice(device.device_id)
      if (activeBorrow) {
        throw new Error('Device is currently borrowed and not available')
      }

    // Check device status
    const status = (device.status || '').toLowerCase().trim()
    const blockedStatuses = ['borrowed', 'in_maintenance', 'maintenance', 'repair', 'damaged', 'broken', 'unusable', 'decommissioned']
    const isBlocked = blockedStatuses.some(blocked => status.includes(blocked))
    
    if (isBlocked) {
      throw new Error(`Device is not available for borrowing. Current status: ${device.status || 'unknown'}`)
    }

    // Validate borrow_date is not in the past and not a weekend
    const borrowDate = payload.borrow_date ?? new Date().toISOString()
    if (borrowDate) {
    const borrowDateObj = new Date(borrowDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    borrowDateObj.setHours(0, 0, 0, 0)
    if (borrowDateObj < now) {
      throw new Error('Borrow date cannot be in the past. Please select today or a future date.')
    }
    // Check for weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = borrowDateObj.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error('Borrow date cannot fall on a weekend.')
    }
    }

    // Update device status to "pending borrow"
    try {
      await devicesService.updateDevice(device.device_id, {
        status: 'pending borrow',
      })
    } catch (deviceError) {
      const errorMessage = deviceError instanceof Error ? deviceError.message : 'Failed to update device status'
      throw new Error(`Failed to set device status to pending borrow: ${errorMessage}`)
    }

    // Create borrow record with is_borrowed = false (pending)
    const insertPayload = this.sanitizeInput({
      device_id: device.device_id,
      borrowed_by: employeeUuid,
      notes: payload.notes ?? null,
      is_borrowed: false, // Pending approval
      borrow_date: borrowDate,
      return_date: payload.return_date ?? null,
    })

    const { data, error } = await this.admin
            .from(this.table)
      .insert(insertPayload)
            .select('*')
            .single()
          
    if (error) {
      // Rollback device status
    try {
      await devicesService.updateDevice(device.device_id, {
          status: device.status || 'available',
      })
      } catch (rollbackError) {
        console.error('[BorrowService] Failed to rollback device status:', rollbackError)
      }
      throw new Error(`Failed to create borrow record: ${error.message || 'Database error'}`)
    }

    return data as BorrowRecord
  }

  /**
   * Approve a borrow request
   * Sets is_borrowed = true (active)
   */
  async approveBorrow(borrowId: string, supervisorId: string): Promise<BorrowRecord | null> {
    const borrow = await this.getBorrowById(borrowId)
    if (!borrow) {
      throw new Error('Borrow request not found')
    }
    
    if (borrow.is_borrowed === true) {
      throw new Error('Borrow request is already approved')
    }

    const updated = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            is_borrowed: true, // Mark as active/borrowed
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'approve borrow',
    )

    // Update device status to "borrowed"
    if (updated?.device_id) {
      await devicesService.markDeviceAsBorrowed(updated.device_id, updated.borrowed_by)
    }

    // Send approval notification to employee
    if (updated?.borrowed_by) {
      try {
        // Get device and employee information
        const device = await devicesService.getDeviceByIdentifier(updated.device_id)
        const { data: employee } = await this.admin
          .from('employees')
          .select('id, employee_id, first_name, last_name, preferred_name')
          .eq('id', updated.borrowed_by)
          .maybeSingle()

        const deviceName = device?.model || device?.asset_tag || 'device'
        const assetTag = device?.asset_tag || 'N/A'
        const employeeName = employee?.preferred_name || 
                           `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() ||
                           employee?.employee_id ||
                           'Employee'

        await notificationService.createNotification(
          {
            employee_id: updated.borrowed_by,
            title: 'Borrow Request Approved',
            message: `Your request to borrow ${deviceName} (Asset: ${assetTag}) has been approved. Please collect the device.`,
            notification_type: 'internal',
            published_by: supervisorId,
            is_confidential: false,
          },
          {
            sendEmail: true,
            preventDuplicates: true,
            duplicateWindowMinutes: 5,
          }
        )
        console.log(`[BorrowService] Sent approval notification to employee ${updated.borrowed_by}`)
      } catch (notifError) {
        console.error('[BorrowService] Failed to send approval notification:', notifError)
        // Don't fail the approval if notification fails
      }
    }

    return updated
  }

  /**
   * Reject a borrow request
   * Keep is_borrowed = false, update device status back to available
   */
  async rejectBorrow(borrowId: string, supervisorId: string, reason?: string): Promise<BorrowRecord | null> {
    const borrow = await this.getBorrowById(borrowId)
    if (!borrow) {
      throw new Error('Borrow request not found')
    }
    
    // Update notes with rejection reason
    const updatedNotes = reason
      ? `${borrow.notes || ''}\nRejection reason: ${reason}`.trim()
      : borrow.notes

    const updated = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            notes: updatedNotes,
            // Keep is_borrowed = false (pending/rejected)
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'reject borrow',
    )

    // Make device available again
    if (updated?.device_id) {
      await devicesService.markDeviceAsAvailable(updated.device_id)
    }

    // Send rejection notification to employee
    if (updated?.borrowed_by) {
      try {
        // Get device and employee information
        const device = await devicesService.getDeviceByIdentifier(updated.device_id)
        const { data: employee } = await this.admin
          .from('employees')
          .select('id, employee_id, first_name, last_name, preferred_name')
          .eq('id', updated.borrowed_by)
          .maybeSingle()

        const deviceName = device?.model || device?.asset_tag || 'device'
        const assetTag = device?.asset_tag || 'N/A'
        const rejectionMessage = reason 
          ? `Your request to borrow ${deviceName} (Asset: ${assetTag}) has been rejected. Reason: ${reason}`
          : `Your request to borrow ${deviceName} (Asset: ${assetTag}) has been rejected.`

        await notificationService.createNotification(
          {
            employee_id: updated.borrowed_by,
            title: 'Borrow Request Rejected',
            message: rejectionMessage,
            notification_type: 'internal',
            published_by: supervisorId,
            is_confidential: false,
          },
          {
            sendEmail: true,
            preventDuplicates: true,
            duplicateWindowMinutes: 5,
          }
        )
        console.log(`[BorrowService] Sent rejection notification to employee ${updated.borrowed_by}`)
      } catch (notifError) {
        console.error('[BorrowService] Failed to send rejection notification:', notifError)
        // Don't fail the rejection if notification fails
      }
    }

    return updated
  }

  /**
   * Return a device
   * Sets is_borrowed = false, updates device status to available
   */
  async returnDevice(borrowId: string): Promise<BorrowRecord | null> {
    const now = new Date().toISOString()
    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            is_borrowed: false, // No longer borrowed
            return_date: now,
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'return device',
    )

    if (borrow?.device_id) {
      await devicesService.markDeviceAsAvailable(borrow.device_id)
    }

    return borrow
  }

  /**
   * Get active borrow by device ID
   * Active = is_borrowed = true
   */
  async getActiveBorrowByDevice(deviceId: string): Promise<BorrowRecord | null> {
    try {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('device_id', deviceId)
        .eq('is_borrowed', true) // Active borrows only
          .order('borrow_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (error) {
        console.warn(`[BorrowService] Error checking active borrow for device ${deviceId}:`, error)
        return null
        }
        
      return (data as BorrowRecord | null) ?? null
    } catch (error) {
      console.warn(`[BorrowService] Unexpected error checking active borrow for device ${deviceId}:`, error)
      return null
    }
  }

  /**
   * Get active borrows by multiple device IDs
   */
  async getActiveBorrowsByDeviceIds(deviceIds: string[]): Promise<Map<string, BorrowRecord>> {
    if (!deviceIds || deviceIds.length === 0) {
      return new Map()
    }

    try {
      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .in('device_id', deviceIds)
        .eq('is_borrowed', true) // Active borrows only
        .order('borrow_date', { ascending: false })

      if (error) {
        console.error('[BorrowService] Error fetching active borrows by device IDs:', error)
        return new Map()
      }

      const activeBorrowsMap = new Map<string, BorrowRecord>()
      ;((data as BorrowRecord[]) || []).forEach((borrow) => {
        const existing = activeBorrowsMap.get(borrow.device_id)
        if (!existing || (borrow.borrow_date && existing.borrow_date && borrow.borrow_date > existing.borrow_date)) {
          activeBorrowsMap.set(borrow.device_id, borrow)
        }
      })

      return activeBorrowsMap
    } catch (error) {
      console.error('[BorrowService] Unexpected error in getActiveBorrowsByDeviceIds:', error)
      return new Map()
    }
  }

  /**
   * Get borrows by borrower
   */
  async getBorrowsByBorrower(identifier: string): Promise<BorrowRecord[]> {
    try {
      const { employeeUuid } = await this.resolveBorrowerIdentifier(identifier)

      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .eq('borrowed_by', employeeUuid)
        .order('borrow_date', { ascending: false })

      if (error) {
        console.warn('[BorrowService] Error fetching borrows by borrower:', error)
        return []
      }

      // Filter for active borrows (is_borrowed = true)
      return ((data as BorrowRecord[]) ?? []).filter((borrow) => borrow.is_borrowed === true)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Borrower not found')) {
        console.warn('[BorrowService] Borrower not found:', identifier)
        return []
      }
      console.error('[BorrowService] Error in getBorrowsByBorrower:', error)
      return []
    }
  }

  /**
   * Update borrow record
   */
  async updateBorrow(borrowId: string, updates: UpdateBorrowInput): Promise<BorrowRecord | null> {
    const sanitized = this.sanitizeInput(updates)
    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update(sanitized)
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'update borrow',
    )

    // Sync device status if is_borrowed changed
    if (borrow?.device_id && typeof updates.is_borrowed === 'boolean') {
      if (updates.is_borrowed) {
        await devicesService.markDeviceAsBorrowed(borrow.device_id, borrow.borrowed_by)
      } else {
        await devicesService.markDeviceAsAvailable(borrow.device_id)
      }
    }

    return borrow
  }

  /**
   * Delete borrow record
   */
  async deleteBorrow(borrowId: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    const borrow = await this.getBorrowById(borrowId)
    
      const result = await this.executeDelete(
        async () => {
          const { error } = await this.admin.from(this.table).delete().eq('borrow_id', borrowId)
          return { error }
        },
      'delete borrow',
      )
      
    // Update device status after deletion
      if (result && borrow?.device_id) {
        try {
          await devicesService.markDeviceAsAvailable(borrow.device_id)
        } catch (deviceError) {
          console.error('Failed to update device status after borrow deletion:', deviceError)
        }
      }
      
      return result
    }

  // ============================================================================
  // BACKWARD COMPATIBILITY ALIASES
  // ============================================================================

  /**
   * Alias for approveBorrow (for backward compatibility)
   */
  async approveBorrowRequest(borrowId: string, supervisorId: string): Promise<BorrowRecord | null> {
    return this.approveBorrow(borrowId, supervisorId)
  }

  /**
   * Alias for rejectBorrow (for backward compatibility)
   */
  async rejectBorrowRequest(borrowId: string, supervisorId: string, reason?: string): Promise<BorrowRecord | null> {
    return this.rejectBorrow(borrowId, supervisorId, reason)
  }
}

export const borrowService = new BorrowService()
