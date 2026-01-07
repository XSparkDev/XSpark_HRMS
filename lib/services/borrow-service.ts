// ============================================================================
// BORROW SERVICE - Repository Layer
// ============================================================================
// Handles CRUD-style operations for the `borrows` table and keeps device
// assignment state in sync whenever a borrow record is created or completed.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

import { BaseService } from './base-service'
import { devicesService } from './devices-service'

export interface BorrowRecord {
  borrow_id: string
  device_id: string
  borrowed_by: string
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean | null
  notes?: string | null
  status?: 'pending' | 'approved' | 'borrowed' | 'returned' | 'rejected' | 'cancelled' | null
  approval_status?: 'pending_approval' | 'approved' | 'rejected' | null
  approved_by?: string | null
  approved_at?: string | null
  picked_up_at?: string | null
  returned_at?: string | null
}

export interface BorrowFilters {
  deviceId?: string
  borrowedBy?: string
  isBorrowed?: boolean
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
  status?: 'pending' | 'approved' | 'borrowed' | null
  approval_status?: 'pending_approval' | 'approved' | 'rejected' | null
}

export type UpdateBorrowInput = Partial<{
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean
  notes: string | null
  status?: 'pending' | 'approved' | 'borrowed' | 'returned' | 'rejected' | 'cancelled'
  approval_status?: 'pending_approval' | 'approved' | 'rejected'
  approved_by?: string | null
  approved_at?: string | null
  picked_up_at?: string | null
  returned_at?: string | null
}>

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class BorrowService extends BaseService {
  private readonly table = 'borrows'
  private readonly admin = supabaseAdmin

  private async resolveBorrowerIdentifier(identifier: string): Promise<{ employeeId: string; employeeUuid: string }> {
    const trimmed = identifier?.trim()
    if (!trimmed) {
      throw new Error('borrowed_by is required')
    }

    const column = uuidRegex.test(trimmed) ? 'id' : 'employee_id'
    const { data, error } = await this.admin.from('employees').select('id, employee_id').eq(column, trimmed).maybeSingle()

    if (error) {
      // Don't throw here - let the caller handle the error gracefully
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

  async listBorrows(filters: BorrowFilters = {}): Promise<{ data: BorrowRecord[]; count: number }> {
    try {
      let query = this.admin.from(this.table).select('*', { count: 'exact' })

      // Note: deleted_at column doesn't exist in borrows table, so we don't filter by it

      if (filters.deviceId) {
        query = query.eq('device_id', filters.deviceId)
      }

      if (filters.borrowedBy) {
        const { employeeUuid } = await this.resolveBorrowerIdentifier(filters.borrowedBy)
        query = query.eq('borrowed_by', employeeUuid)
      }

      // CRITICAL: Only return active borrows when checking for borrowed status
      if (typeof filters.isBorrowed === 'boolean') {
        query = query.eq('is_borrowed', filters.isBorrowed)
        // When looking for active borrows, also ensure return_date is null or in the future
        if (filters.isBorrowed === true) {
          query = query.or('return_date.is.null,return_date.gte.' + new Date().toISOString())
        }
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
        this.handleError(error, 'list borrows')
      }

      // CRITICAL: Filter out any records where is_borrowed is false or return_date is in the past
      const now = new Date().toISOString()
      const activeBorrows = ((data as BorrowRecord[]) ?? []).filter((borrow) => {
        if (borrow.is_borrowed === false) return false
        if (borrow.return_date && borrow.return_date < now) return false
        return true
      })

      return {
        data: activeBorrows,
        count: count ?? activeBorrows.length,
      }
    } catch (error) {
      this.handleError(error, 'list borrows')
    }
  }

  async getBorrowById(borrowId: string): Promise<BorrowRecord | null> {
    return this.executeQuery<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin.from(this.table).select('*').eq('borrow_id', borrowId).maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'get borrow by id',
    )
  }

  async createBorrow(payload: CreateBorrowInput): Promise<BorrowRecord> {
    this.validateRequired(payload, ['device_id', 'borrowed_by'])
    const { employeeId, employeeUuid } = await this.resolveBorrowerIdentifier(payload.borrowed_by)

    const deviceIdentifier = payload.device_id?.trim()
    if (!deviceIdentifier) {
      throw new Error('device_id is required')
    }

    // Use devicesService to lookup device by identifier (device_id, id, asset_tag, or serial_number)
    const device = await devicesService.getDeviceByIdentifier(deviceIdentifier)
    if (!device) {
      throw new Error('Device not found')
    }

    // Check for active borrows first - if device is already borrowed, it's not available
    try {
      const activeBorrow = await this.getActiveBorrowByDevice(device.device_id)
      if (activeBorrow) {
        throw new Error('Device is currently borrowed and not available')
      }
    } catch (borrowCheckError) {
      // If checking for active borrows fails, log warning but continue
      // (we don't want to block borrow creation if the check fails)
      console.warn('[BorrowService] Failed to check for active borrows, continuing:', borrowCheckError)
      // Don't throw - allow the borrow to proceed if the check fails
    }

    // Check device status - allow if available, null/empty, or assigned (when no active borrow)
    // Block if device is in maintenance, damaged, or explicitly borrowed
    const status = (device.status || '').toLowerCase().trim()
    const blockedStatuses = ['borrowed', 'in_maintenance', 'maintenance', 'repair', 'damaged', 'broken', 'unusable', 'decommissioned']
    const isBlocked = blockedStatuses.some(blocked => status.includes(blocked))
    
    if (isBlocked) {
      throw new Error(`Device is not available for borrowing. Current status: ${device.status || 'unknown'}`)
    }

    // Allow if status is 'available', null, empty, or 'assigned' (assigned devices without active borrow can be borrowed)
    const allowedStatuses = ['available', 'assigned', '']
    if (status && !allowedStatuses.includes(status)) {
      // For other statuses, be more permissive but log a warning
      // Only block if it's explicitly blocked
      if (!isBlocked) {
        // Allow the borrow but could log a warning
        console.warn(`[BorrowService] Borrowing device with non-standard status: ${device.status}`)
      }
    }

    // Build insert payload with only required fields first
    const insertPayload: any = {
      device_id: device.device_id,
      borrowed_by: employeeUuid,
      notes: payload.notes ?? null,
      is_borrowed: false, // CRITICAL: Not borrowed yet, just pending
      borrow_date: payload.borrow_date ?? new Date().toISOString(),
      return_date: payload.return_date ?? null,
    }

    // Add status fields (will try with these first, fallback without if columns don't exist)
    insertPayload.status = 'pending' // CRITICAL: Default to pending
    insertPayload.approval_status = 'pending_approval' // CRITICAL: Requires approval

    const sanitized = this.sanitizeInput(insertPayload)

    let borrow: BorrowRecord
    try {
      // Try insert with status fields first
        const { data, error } = await this.admin.from(this.table).insert(sanitized).select('*').single()
      
      if (error) {
        // Log detailed error for debugging
        console.error('[BorrowService] Insert error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          insertPayload: sanitized,
        })
        
        // Check if error is about missing columns
        const errorMsg = error.message || String(error)
        const isColumnError = error.code === '42703' || // PostgreSQL undefined_column
          errorMsg.includes('column') && errorMsg.includes('does not exist') ||
          errorMsg.includes('status') ||
          errorMsg.includes('approval_status')
        
        if (isColumnError) {
          // Retry without status fields
          console.warn('[BorrowService] Retrying insert without status fields (columns may not exist)')
          const fallbackPayload = this.sanitizeInput({
            device_id: device.device_id,
            borrowed_by: employeeUuid,
            notes: payload.notes ?? null,
            is_borrowed: false,
            borrow_date: payload.borrow_date ?? new Date().toISOString(),
            return_date: payload.return_date ?? null,
          })
          
          const { data: fallbackData, error: fallbackError } = await this.admin
            .from(this.table)
            .insert(fallbackPayload)
            .select('*')
            .single()
          
          if (fallbackError) {
            console.error('[BorrowService] Fallback insert also failed:', fallbackError)
            throw new Error(`Failed to create borrow record: ${fallbackError.message || error.message}`)
          }
          
          borrow = fallbackData as BorrowRecord
        } else {
          throw new Error(`Failed to create borrow record: ${error.message || 'Database error'}`)
        }
      } else {
        borrow = data as BorrowRecord
      }
    } catch (insertError: any) {
      // This catch handles unexpected errors from the try block above
      // Most errors should already be handled in the if(error) block
      const errorMessage = insertError instanceof Error ? insertError.message : String(insertError)
      console.error('[BorrowService] Unexpected insert exception:', insertError)
      throw new Error(`Failed to create borrow record: ${errorMessage}`)
    }

    // Update device status to pending_borrow (not borrowed yet)
    try {
      await devicesService.updateDevice(device.device_id, {
        status: 'pending_borrow', // Device awaits approval, not borrowed yet
      })
    } catch (deviceError) {
      // If device status update fails, rollback the borrow record
      try {
      await this.admin.from(this.table).delete().eq('borrow_id', borrow.borrow_id)
      } catch (deleteError) {
        console.error('[BorrowService] Failed to rollback borrow record after device update failure:', deleteError)
      }
      
      const errorMessage = deviceError instanceof Error ? deviceError.message : 'Failed to update device status'
      throw new Error(`Failed to update device status: ${errorMessage}. Borrow record was not created.`)
    }

    return borrow
  }

  async returnDevice(borrowId: string): Promise<BorrowRecord | null> {
    const now = new Date().toISOString()
    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({ 
            is_borrowed: false, 
            return_date: now,
            status: 'returned',
            returned_at: now,
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

  // Approve a device booking (supervisor action)
  async approveBorrowRequest(borrowId: string, supervisorId: string): Promise<BorrowRecord | null> {
    const now = new Date().toISOString()
    
    // Get the current borrow record
    const existingBorrow = await this.getBorrowById(borrowId)
    if (!existingBorrow) {
      throw new Error('Borrow request not found')
    }
    
    if (existingBorrow.status !== 'pending') {
      throw new Error(`Borrow request cannot be approved. Current status: ${existingBorrow.status}`)
    }

    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            status: 'approved',
            approval_status: 'approved',
            approved_by: supervisorId,
            approved_at: now,
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'approve borrow request',
    )

    // Device status stays as 'pending_borrow' - user can now scan to pickup
    // Don't update device status yet, wait for pickup

    return borrow
  }

  // Pickup device (user scans device after approval)
  async pickupDevice(borrowId: string): Promise<BorrowRecord | null> {
    const now = new Date().toISOString()
    
    // Get the current borrow record
    const existingBorrow = await this.getBorrowById(borrowId)
    if (!existingBorrow) {
      throw new Error('Borrow request not found')
    }
    
    if (existingBorrow.approval_status !== 'approved' || existingBorrow.status !== 'approved') {
      throw new Error('Booking must be approved before pickup')
    }

    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            status: 'borrowed',
            is_borrowed: true,
            picked_up_at: now,
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'pickup device',
    )

    // Update device to borrowed
    if (borrow?.device_id) {
      await devicesService.markDeviceAsBorrowed(borrow.device_id, borrow.borrowed_by)
    }

    return borrow
  }

  // Reject a device booking (supervisor action)
  async rejectBorrowRequest(borrowId: string, supervisorId: string, reason?: string): Promise<BorrowRecord | null> {
    const now = new Date().toISOString()
    
    // Get the current borrow record
    const existingBorrow = await this.getBorrowById(borrowId)
    if (!existingBorrow) {
      throw new Error('Borrow request not found')
    }

    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            status: 'rejected',
            approval_status: 'rejected',
            approved_by: supervisorId,
            approved_at: now,
            notes: reason ? `${existingBorrow.notes || ''}\nRejection reason: ${reason}`.trim() : existingBorrow.notes,
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'reject borrow request',
    )

    // Make device available again
    if (borrow?.device_id) {
      await devicesService.markDeviceAsAvailable(borrow.device_id)
    }

    return borrow
  }

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

    if (borrow?.device_id && typeof updates.is_borrowed === 'boolean') {
      if (updates.is_borrowed) {
        const { employeeUuid } = await this.resolveBorrowerIdentifier(borrow.borrowed_by)
        await devicesService.markDeviceAsBorrowed(borrow.device_id, employeeUuid)
      } else {
        await devicesService.markDeviceAsAvailable(borrow.device_id)
      }
    }

    return borrow
  }

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
        return [] // Return empty array on error instead of throwing
      }

        // CRITICAL: Filter out inactive borrows
        const now = new Date().toISOString()
        const activeBorrows = ((data as BorrowRecord[]) ?? []).filter((borrow) => {
          if (borrow.is_borrowed === false) return false
          if (borrow.return_date && borrow.return_date < now) return false
          return true
        })

      return activeBorrows
    } catch (error) {
      // If borrower not found or any other error, return empty array
      if (error instanceof Error && error.message.includes('Borrower not found')) {
        console.warn('[BorrowService] Borrower not found:', identifier)
        return []
      }
      
      console.error('[BorrowService] Error in getBorrowsByBorrower:', error)
      return [] // Return empty array instead of throwing
    }
  }

  // CRITICAL: New method to check if a device has an active borrow
  async getActiveBorrowByDevice(deviceId: string): Promise<BorrowRecord | null> {
    try {
        const now = new Date().toISOString()
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('device_id', deviceId)
          .eq('is_borrowed', true)
          .or(`return_date.is.null,return_date.gte.${now}`)
          .order('borrow_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (error) {
        // Log error but don't throw - return null to indicate no active borrow found
        console.warn(`[BorrowService] Error checking active borrow for device ${deviceId}:`, error)
        return null
        }
        
        // Double-check the borrow is still active
        if (data && data.return_date && data.return_date < now) {
        return null
        }
        
      return (data as BorrowRecord | null) ?? null
    } catch (error) {
      // Catch any unexpected errors and return null (assume no active borrow)
      console.warn(`[BorrowService] Unexpected error checking active borrow for device ${deviceId}:`, error)
      return null
    }
  }

  // CRITICAL: Batch fetch active borrows for multiple devices (performance optimization)
  async getActiveBorrowsByDeviceIds(deviceIds: string[]): Promise<Map<string, BorrowRecord>> {
    if (!deviceIds || deviceIds.length === 0) {
      return new Map()
    }

    try {
      const now = new Date().toISOString()
      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .in('device_id', deviceIds)
        .eq('is_borrowed', true)
        .or(`return_date.is.null,return_date.gte.${now}`)
        .order('borrow_date', { ascending: false })

      if (error) {
        console.error('[BorrowService] Error fetching active borrows by device IDs:', error)
        return new Map()
      }

      // Filter by return date and create a map (device_id -> most recent active borrow)
      const activeBorrowsMap = new Map<string, BorrowRecord>()
      const nowDate = new Date(now)

      ;(data as BorrowRecord[] || []).forEach((borrow) => {
        // Double-check the borrow is still active
        if (borrow.return_date) {
          const returnDate = new Date(borrow.return_date)
          if (returnDate < nowDate) {
            return // Skip expired borrows
          }
        }

        // Keep only the most recent borrow per device
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

  async deleteBorrow(borrowId: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    // CRITICAL: Always use hard delete to ensure records are completely removed
    // First get the borrow record to update device status
    const borrow = await this.getBorrowById(borrowId)
    
    if (options.hardDelete || true) { // Always hard delete
      const result = await this.executeDelete(
        async () => {
          const { error } = await this.admin.from(this.table).delete().eq('borrow_id', borrowId)
          return { error }
        },
        'hard delete borrow',
      )
      
      // CRITICAL: Update device status after deletion
      if (result && borrow?.device_id) {
        try {
          await devicesService.markDeviceAsAvailable(borrow.device_id)
        } catch (deviceError) {
          console.error('Failed to update device status after borrow deletion:', deviceError)
        }
      }
      
      return result
    }

    const returnResult = await this.returnDevice(borrowId)
    return Boolean(returnResult)
  }
}

export const borrowService = new BorrowService()

