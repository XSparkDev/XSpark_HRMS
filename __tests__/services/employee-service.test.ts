/**
 * @jest-environment jsdom
 */
import { EmployeeService, type Employee, type CreateEmployeeData } from '@/lib/services/employee-service'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

describe('EmployeeService', () => {
  let employeeService: EmployeeService
  let mockSupabaseFrom: jest.Mock
  let mockSupabaseRpc: jest.Mock

  beforeEach(() => {
    employeeService = new EmployeeService()
    jest.clearAllMocks()
    
    // Get the mocked functions
    const { supabase } = require('@/lib/supabase')
    mockSupabaseFrom = supabase.from as jest.Mock
    mockSupabaseRpc = supabase.rpc as jest.Mock
  })

  describe('getAllActive', () => {
    it('should fetch all active employees', async () => {
      const mockEmployees: Partial<Employee>[] = [
        {
          id: '1',
          employee_id: 'XSP25/01/001',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@xspark.com',
          is_active: true,
          employment_status: 'active',
        },
        {
          id: '2',
          employee_id: 'XSP25/01/002',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@xspark.com',
          is_active: true,
          employment_status: 'active',
        },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEmployees, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.getAllActive()

      expect(mockSupabaseFrom).toHaveBeenCalledWith('active_employees')
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
      expect(result).toEqual(mockEmployees)
    })

    it('should apply filters when provided', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      await employeeService.getAllActive({
        search: 'john',
        department: 'Engineering',
        limit: 10,
        offset: 0,
      })

      expect(mockQuery.or).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('department', 'Engineering')
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })

    it('should throw error when database query fails', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      await expect(employeeService.getAllActive()).rejects.toThrow('Failed to fetch employees')
    })
  })

  describe('getById', () => {
    it('should fetch employee by ID', async () => {
      const mockEmployee: Partial<Employee> = {
        id: '1',
        employee_id: 'XSP25/01/001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@xspark.com',
      }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockEmployee, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.getById('1')

      expect(mockSupabaseFrom).toHaveBeenCalledWith('employees')
      expect(mockQuery.eq).toHaveBeenCalledWith('id', '1')
      expect(result).toEqual(mockEmployee)
    })

    it('should return null when employee not found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.getById('999')

      expect(result).toBeNull()
    })
  })

  describe('getByEmail', () => {
    it('should fetch employee by email', async () => {
      const mockEmployee: Partial<Employee> = {
        id: '1',
        email: 'john.doe@xspark.com',
        first_name: 'John',
        last_name: 'Doe',
      }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockEmployee, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.getByEmail('john.doe@xspark.com')

      expect(mockQuery.eq).toHaveBeenCalledWith('email', 'john.doe@xspark.com')
      expect(result).toEqual(mockEmployee)
    })
  })

  describe('create', () => {
    it('should create a new employee', async () => {
      const newEmployeeData: CreateEmployeeData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@xspark.com',
        dob: '1990-01-01',
        sex: 'male',
        date_hired: '2025-01-01',
        nationality: 'South Africa',
      }

      const createdEmployee: Partial<Employee> = {
        ...newEmployeeData,
        id: '1',
        employee_id: 'XSP25/01/001',
        is_active: true,
        employment_status: 'probation',
        id_verified: false,
        work_permit_verified: false,
        bank_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdEmployee, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.create(newEmployeeData)

      expect(mockSupabaseFrom).toHaveBeenCalledWith('employees')
      expect(mockQuery.insert).toHaveBeenCalledWith([newEmployeeData])
      expect(result).toEqual(createdEmployee)
    })

    it('should throw error when creation fails', async () => {
      const newEmployeeData: CreateEmployeeData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@xspark.com',
        dob: '1990-01-01',
        sex: 'male',
        date_hired: '2025-01-01',
      }

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('Creation failed') }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      await expect(employeeService.create(newEmployeeData)).rejects.toThrow('Failed to create employee')
    })
  })

  describe('update', () => {
    it('should update an employee', async () => {
      const updateData = {
        first_name: 'John Updated',
        phone: '+27123456789',
      }

      const updatedEmployee: Partial<Employee> = {
        id: '1',
        employee_id: 'XSP25/01/001',
        first_name: 'John Updated',
        last_name: 'Doe',
        email: 'john.doe@xspark.com',
        phone: '+27123456789',
      }

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedEmployee, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.update('1', updateData)

      expect(mockQuery.update).toHaveBeenCalledWith(updateData)
      expect(mockQuery.eq).toHaveBeenCalledWith('id', '1')
      expect(result).toEqual(updatedEmployee)
    })
  })

  describe('archive', () => {
    it('should archive an employee', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: null, error: null })

      const result = await employeeService.archive('1', 'Contract ended')

      expect(mockSupabaseRpc).toHaveBeenCalledWith('archive_employee', {
        emp_id: '1',
        reason: 'Contract ended',
      })
      expect(result).toBe(true)
    })

    it('should throw error when archiving fails', async () => {
      mockSupabaseRpc.mockResolvedValue({ data: null, error: new Error('Archive failed') })

      await expect(employeeService.archive('1')).rejects.toThrow('Failed to archive employee')
    })
  })

  describe('restore', () => {
    it('should restore an archived employee', async () => {
      const restoredEmployee: Partial<Employee> = {
        id: '1',
        employee_id: 'XSP25/01/001',
        is_active: true,
        employment_status: 'active',
      }

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: restoredEmployee, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.restore('1')

      expect(mockQuery.update).toHaveBeenCalledWith({
        is_active: true,
        employment_status: 'active',
        deleted_at: null,
      })
      expect(result).toEqual(restoredEmployee)
    })
  })

  describe('search', () => {
    it('should search employees by query', async () => {
      const mockEmployees: Partial<Employee>[] = [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@xspark.com',
        },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEmployees, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.search('john')

      expect(mockQuery.or).toHaveBeenCalled()
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
      expect(result).toEqual(mockEmployees)
    })
  })

  describe('verification methods', () => {
    it('should verify ID', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.verifyId('1')

      expect(mockQuery.update).toHaveBeenCalledWith({ id_verified: true })
      expect(result).toBe(true)
    })

    it('should verify bank details', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.verifyBank('1')

      expect(mockQuery.update).toHaveBeenCalledWith({ bank_verified: true })
      expect(result).toBe(true)
    })

    it('should verify work permit', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      }

      mockSupabaseFrom.mockReturnValue(mockQuery)

      const result = await employeeService.verifyWorkPermit('1')

      expect(mockQuery.update).toHaveBeenCalledWith({ work_permit_verified: true })
      expect(result).toBe(true)
    })
  })
})
