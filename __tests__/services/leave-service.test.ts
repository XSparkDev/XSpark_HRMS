/**
 * @jest-environment jsdom
 */
import { LeaveManagementService, type LeaveBalance, type LeaveRequest, type CreateLeaveRequestData } from '@/lib/services/leave-service'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('LeaveManagementService', () => {
  let leaveService: LeaveManagementService
  let mockSupabaseFrom: jest.Mock

  beforeEach(() => {
    leaveService = new LeaveManagementService()
    jest.clearAllMocks()
    
    // Get the mocked functions
    const { supabase } = require('@/lib/supabase')
    mockSupabaseFrom = supabase.from as jest.Mock
  })

  describe('getLeaveBalances', () => {
    it('should fetch leave balances for an employee', async () => {
      const mockBalances: Partial<LeaveBalance>[] = [
        {
          id: '1',
          employee_id: 'emp-1',
          leave_type: 'annual',
          total_entitled: 21,
          total_taken: 5,
          balance: 16,
        },
        {
          id: '2',
          employee_id: 'emp-1',
          leave_type: 'sick',
          total_entitled: 30,
          total_taken: 2,
          balance: 28,
        },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockBalances, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await leaveService.getLeaveBalances('emp-1')

      expect(mockSupabaseFrom).toHaveBeenCalledWith('leave_balances')
      expect(mockQuery.eq).toHaveBeenCalledWith('employee_id', 'emp-1')
      expect(result).toEqual(mockBalances)
    })
  })

  describe('getLeaveBalance', () => {
    it('should fetch specific leave balance', async () => {
      const mockBalance: Partial<LeaveBalance> = {
        id: '1',
        employee_id: 'emp-1',
        leave_type: 'annual',
        total_entitled: 21,
        total_taken: 5,
        balance: 16,
      }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockBalance, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await leaveService.getLeaveBalance('emp-1', 'annual')

      expect(mockQuery.eq).toHaveBeenCalledWith('employee_id', 'emp-1')
      expect(mockQuery.eq).toHaveBeenCalledWith('leave_type', 'annual')
      expect(result).toEqual(mockBalance)
    })
  })

  describe('createLeaveRequest', () => {
    it('should create a leave request when sufficient balance', async () => {
      const requestData: CreateLeaveRequestData = {
        employee_id: 'emp-1',
        full_name: 'John Doe',
        employee_number: 'XSP25/01/001',
        id_number: '1234567890123',
        job_title: 'Software Engineer',
        leave_type: 'annual',
        leave_day_from: '2025-02-01',
        leave_day_to: '2025-02-05',
        total_days: 5,
      }

      const mockBalance: Partial<LeaveBalance> = {
        id: '1',
        employee_id: 'emp-1',
        leave_type: 'annual',
        balance: 16,
      }

      const createdRequest: Partial<LeaveRequest> = {
        ...requestData,
        id: '1',
        status: 'pending',
        leave_balance_before: 16,
      }

      // Mock balance check
      const mockBalanceQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockBalance, error: null }),
      }

      // Mock insert
      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdRequest, error: null }),
      }

      mockSupabaseFrom
        .mockReturnValueOnce(mockBalanceQuery) // First call for balance check
        .mockReturnValueOnce(mockInsertQuery) // Second call for insert

      const result = await leaveService.createLeaveRequest(requestData)

      expect(result).toEqual(createdRequest)
    })

    it('should throw error when insufficient balance', async () => {
      const requestData: CreateLeaveRequestData = {
        employee_id: 'emp-1',
        full_name: 'John Doe',
        employee_number: 'XSP25/01/001',
        id_number: '1234567890123',
        job_title: 'Software Engineer',
        leave_type: 'annual',
        leave_day_from: '2025-02-01',
        leave_day_to: '2025-02-10',
        total_days: 10,
      }

      const mockBalance: Partial<LeaveBalance> = {
        id: '1',
        employee_id: 'emp-1',
        leave_type: 'annual',
        balance: 5, // Insufficient balance
      }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockBalance, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      await expect(leaveService.createLeaveRequest(requestData)).rejects.toThrow('Insufficient leave balance')
    })
  })

  describe('approveLeaveRequest', () => {
    it('should approve a leave request', async () => {
      const approvedRequest: Partial<LeaveRequest> = {
        id: '1',
        employee_id: 'emp-1',
        status: 'approved',
        reviewed_by: 'admin-1',
      }

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: approvedRequest, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await leaveService.approveLeaveRequest('1', 'admin-1')

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved',
        reviewed_by: 'admin-1',
      }))
      expect(result).toEqual(approvedRequest)
    })
  })

  describe('rejectLeaveRequest', () => {
    it('should reject a leave request', async () => {
      const rejectedRequest: Partial<LeaveRequest> = {
        id: '1',
        employee_id: 'emp-1',
        status: 'rejected',
        reviewed_by: 'admin-1',
        rejection_reason: 'Insufficient notice',
      }

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: rejectedRequest, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await leaveService.rejectLeaveRequest('1', 'admin-1', 'Insufficient notice')

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'rejected',
        reviewed_by: 'admin-1',
        rejection_reason: 'Insufficient notice',
      }))
      expect(result).toEqual(rejectedRequest)
    })
  })

  describe('getPendingLeaveRequests', () => {
    it('should fetch pending leave requests', async () => {
      const mockRequests: Partial<LeaveRequest>[] = [
        {
          id: '1',
          employee_id: 'emp-1',
          status: 'pending',
          leave_type: 'annual',
        },
        {
          id: '2',
          employee_id: 'emp-2',
          status: 'pending',
          leave_type: 'sick',
        },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockRequests, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await leaveService.getPendingLeaveRequests()

      expect(mockSupabaseFrom).toHaveBeenCalledWith('pending_leave_requests')
      expect(result).toEqual(mockRequests)
    })
  })

  describe('calculateWorkingDays', () => {
    it('should calculate working days excluding weekends', () => {
      // Monday to Friday (5 days)
      const days1 = leaveService.calculateWorkingDays('2025-02-03', '2025-02-07')
      expect(days1).toBe(5)

      // Monday to Monday (5 working days, excludes weekend)
      const days2 = leaveService.calculateWorkingDays('2025-02-03', '2025-02-10')
      expect(days2).toBe(6)

      // Single day
      const days3 = leaveService.calculateWorkingDays('2025-02-03', '2025-02-03')
      expect(days3).toBe(1)
    })

    it('should return 0 for weekend days only', () => {
      // Saturday to Sunday
      const days = leaveService.calculateWorkingDays('2025-02-01', '2025-02-02')
      expect(days).toBe(0)
    })
  })

  describe('getLeaveStatistics', () => {
    it('should return leave statistics', async () => {
      const mockData = [
        { status: 'pending', total_days: 5 },
        { status: 'approved', total_days: 10 },
        { status: 'rejected', total_days: 3 },
      ]

      const mockQuery = {
        select: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await leaveService.getLeaveStatistics()

      expect(result).toEqual({
        totalRequests: 3,
        pendingRequests: 1,
        approvedRequests: 1,
        rejectedRequests: 1,
        totalDaysTaken: 18,
      })
    })
  })

  describe('initializeLeaveBalances', () => {
    it('should initialize leave balances for new employee', async () => {
      const mockQuery = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      await leaveService.initializeLeaveBalances('emp-1', '2025-01-01', '2025-12-31')

      expect(mockQuery.insert).toHaveBeenCalled()
      const insertedData = mockQuery.insert.mock.calls[0][0]
      expect(insertedData).toHaveLength(5) // 5 leave types
      expect(insertedData[0]).toMatchObject({
        employee_id: 'emp-1',
        cycle_start_date: '2025-01-01',
        cycle_end_date: '2025-12-31',
      })
    })
  })
})
