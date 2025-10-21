/**
 * Test Utilities and Helpers
 * Common mocks, fixtures, and helper functions for testing
 */

import type { Employee } from '@/lib/services/employee-service'
import type { LeaveBalance, LeaveRequest } from '@/lib/services/leave-service'
import type { Payslip, Income } from '@/lib/services/payroll-service'

// ===========================================================================
// MOCK DATA FIXTURES
// ===========================================================================

export const mockEmployee: Partial<Employee> = {
  id: 'emp-1',
  employee_id: 'XSP25/01/001',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@xspark.com',
  phone: '+27123456789',
  dob: '1990-01-01',
  sex: 'male',
  employment_status: 'active',
  is_active: true,
  id_verified: true,
  bank_verified: true,
  work_permit_verified: false,
  nationality: 'South Africa',
  date_hired: '2024-01-01',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockLeaveBalance: Partial<LeaveBalance> = {
  id: 'lb-1',
  employee_id: 'emp-1',
  leave_type: 'annual',
  total_entitled: 21,
  total_taken: 5,
  balance: 16,
  cycle_start_date: '2025-01-01',
  cycle_end_date: '2025-12-31',
  cap_warning_sent: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

export const mockLeaveRequest: Partial<LeaveRequest> = {
  id: 'lr-1',
  employee_id: 'emp-1',
  full_name: 'John Doe',
  employee_number: 'XSP25/01/001',
  id_number: '1234567890123',
  job_title: 'Software Engineer',
  leave_type: 'annual',
  leave_day_from: '2025-02-01',
  leave_day_to: '2025-02-05',
  total_days: 5,
  status: 'pending',
  created_at: '2025-01-15T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
}

export const mockIncome: Partial<Income> = {
  id: 'inc-1',
  employee_id: 'emp-1',
  basic_salary: 50000,
  bonus: 5000,
  commission: 0,
  travel_allowance: 2000,
  cellphone_allowance: 500,
  medical_aid_subsidy: 1000,
  company_car_value: 0,
  overtime: 0,
  paye: 8000,
  uif: 148.72,
  pension_fund: 2500,
  medical_aid_contribution: 1500,
  penalty: 0,
  other_deductions: 0,
  gross_income: 58500,
  total_deductions: 12148.72,
  net_income: 46351.28,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

export const mockPayslip: Partial<Payslip> = {
  id: 'ps-1',
  employee_id: 'emp-1',
  full_name: 'John Doe',
  employee_number: 'XSP25/01/001',
  id_number: '1234567890123',
  email: 'john.doe@xspark.com',
  job_title: 'Software Engineer',
  pay_date: '2025-01-31',
  pay_period_from: '2025-01-01',
  pay_period_to: '2025-01-31',
  basic_salary: 50000,
  bonus: 5000,
  commission: 0,
  travel_allowance: 2000,
  cellphone_allowance: 500,
  medical_aid_subsidy: 1000,
  company_car_value: 0,
  overtime: 0,
  paye: 8000,
  uif: 148.72,
  pension_fund: 2500,
  medical_aid_contribution: 1500,
  penalty: 0,
  other_deductions: 0,
  gross_income: 58500,
  total_deductions: 12148.72,
  net_income: 46351.28,
  payment_method: 'eft',
  created_at: '2025-01-31T00:00:00Z',
  updated_at: '2025-01-31T00:00:00Z',
}

// ===========================================================================
// MOCK QUERY BUILDERS
// ===========================================================================

/**
 * Creates a mock Supabase query builder
 */
export function createMockQuery(returnData: any, error: any = null) {
  const query = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    rangeGt: jest.fn().mockReturnThis(),
    rangeGte: jest.fn().mockReturnThis(),
    rangeLt: jest.fn().mockReturnThis(),
    rangeLte: jest.fn().mockReturnThis(),
    rangeAdjacent: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data: returnData, error }),
  }

  // For queries that don't use .single()
  ;(query as any).then = (resolve: any) => {
    resolve({ data: returnData, error })
    return Promise.resolve({ data: returnData, error })
  }

  return query
}

/**
 * Creates a mock storage client
 */
export function createMockStorage(config: {
  uploadResult?: any
  uploadError?: any
  publicUrl?: string
  signedUrl?: string
  files?: any[]
}) {
  return {
    upload: jest.fn().mockResolvedValue({
      data: config.uploadResult || { path: 'test/file.pdf' },
      error: config.uploadError || null,
    }),
    getPublicUrl: jest.fn().mockReturnValue({
      data: { publicUrl: config.publicUrl || 'https://storage.test/file.pdf' },
    }),
    createSignedUrl: jest.fn().mockResolvedValue({
      data: { signedUrl: config.signedUrl || 'https://storage.test/signed' },
      error: null,
    }),
    remove: jest.fn().mockResolvedValue({ error: null }),
    list: jest.fn().mockResolvedValue({
      data: config.files || [],
      error: null,
    }),
  }
}

// ===========================================================================
// DATE HELPERS
// ===========================================================================

/**
 * Creates a date string in ISO format
 */
export function createISODate(daysFromNow: number = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0]
}

/**
 * Creates a timestamp in ISO format
 */
export function createISOTimestamp(daysFromNow: number = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString()
}

// ===========================================================================
// ASSERTION HELPERS
// ===========================================================================

/**
 * Asserts that a Supabase query was called with specific parameters
 */
export function expectQueryToHaveBeenCalledWith(
  query: any,
  method: string,
  ...args: any[]
) {
  expect(query[method]).toHaveBeenCalledWith(...args)
}

/**
 * Waits for a promise to resolve or reject
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ===========================================================================
// MOCK FILE HELPERS
// ===========================================================================

/**
 * Creates a mock File object for testing
 */
export function createMockFile(
  content: string = 'test content',
  filename: string = 'test.pdf',
  type: string = 'application/pdf'
): File {
  return new File([content], filename, { type })
}

/**
 * Creates a mock FormData with a file
 */
export function createMockFormData(file: File, additionalData?: Record<string, string>): FormData {
  const formData = new FormData()
  formData.append('file', file)
  
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value)
    })
  }
  
  return formData
}

// ===========================================================================
// MOCK REQUEST/RESPONSE HELPERS
// ===========================================================================

/**
 * Creates a mock NextRequest for API route testing
 */
export function createMockRequest(
  method: string = 'GET',
  body?: any,
  searchParams?: Record<string, string>
): any {
  const url = new URL('http://localhost:3000/api/test')
  
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    url: url.toString(),
    json: jest.fn().mockResolvedValue(body),
    formData: jest.fn().mockResolvedValue(body),
    headers: new Headers(),
  }
}

/**
 * Extracts JSON from NextResponse
 */
export async function extractResponseJSON(response: any): Promise<any> {
  const json = await response.json()
  return json
}

// ===========================================================================
// ENVIRONMENT HELPERS
// ===========================================================================

/**
 * Sets up test environment variables
 */
export function setupTestEnv() {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SUPABASE_STORAGE_BUCKET = 'test-bucket'
}

/**
 * Cleans up test environment variables
 */
export function cleanupTestEnv() {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_ANON_KEY
  delete process.env.SUPABASE_STORAGE_BUCKET
}
