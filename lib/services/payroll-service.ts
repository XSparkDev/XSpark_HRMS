// ============================================================================
// PAYROLL SERVICE - Repository Pattern Implementation
// ============================================================================
// This service handles all payroll-related operations including income,
// payslips, deductions, and calculations
// ============================================================================

import { supabase } from '@/lib/supabase'

// Database types matching our schema
export interface Income {
  id: string
  employee_id: string
  basic_salary: number
  bonus: number
  commission: number
  travel_allowance: number
  cellphone_allowance: number
  medical_aid_subsidy: number
  company_car_value: number
  paye: number
  uif: number
  pension_fund: number
  medical_aid_contribution: number
  penalty: number
  other_deductions: number
  overtime: number
  gross_income: number
  total_deductions: number
  net_income: number
  created_at: string
  updated_at: string
}

export interface Payslip {
  id: string
  employee_id: string
  full_name: string
  employee_number: string
  id_number: string
  tax_number?: string
  email: string
  phone?: string
  address?: string
  job_title: string
  pay_date: string
  pay_period_from: string
  pay_period_to: string
  basic_salary: number
  bonus: number
  commission: number
  travel_allowance: number
  cellphone_allowance: number
  medical_aid_subsidy: number
  company_car_value: number
  overtime: number
  paye: number
  uif: number
  pension_fund: number
  medical_aid_contribution: number
  penalty: number
  other_deductions: number
  gross_income: number
  total_deductions: number
  net_income: number
  payment_method: 'eft' | 'cash' | 'cheque'
  payslip_document_url?: string
  created_at: string
  updated_at: string
}

export interface CreatePayslipData {
  employee_id: string
  full_name: string
  employee_number: string
  id_number: string
  tax_number?: string
  email: string
  phone?: string
  address?: string
  job_title: string
  pay_date: string
  pay_period_from: string
  pay_period_to: string
  basic_salary: number
  bonus?: number
  commission?: number
  travel_allowance?: number
  cellphone_allowance?: number
  medical_aid_subsidy?: number
  company_car_value?: number
  overtime?: number
  paye?: number
  uif?: number
  pension_fund?: number
  medical_aid_contribution?: number
  penalty?: number
  other_deductions?: number
  gross_income: number
  total_deductions: number
  net_income: number
  payment_method?: 'eft' | 'cash' | 'cheque'
  payslip_document_url?: string
}

export interface PayslipFilters {
  employee_id?: string
  pay_date_from?: string
  pay_date_to?: string
  pay_period_from?: string
  pay_period_to?: string
  limit?: number
  offset?: number
}

export class PayrollService {
  // ============================================================================
  // INCOME OPERATIONS
  // ============================================================================

  /**
   * Get income details for an employee
   */
  async getIncome(employeeId: string): Promise<Income | null> {
    try {
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .eq('employee_id', employeeId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching income:', error)
      return null
    }
  }

  /**
   * Create or update income details
   */
  async upsertIncome(incomeData: Partial<Income>): Promise<Income> {
    try {
      const { data, error } = await supabase
        .from('income')
        .upsert(incomeData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error upserting income:', error)
      throw new Error('Failed to update income')
    }
  }

  /**
   * Update basic salary
   */
  async updateBasicSalary(employeeId: string, newSalary: number): Promise<Income | null> {
    try {
      const { data, error } = await supabase
        .from('income')
        .update({ basic_salary: newSalary })
        .eq('employee_id', employeeId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating basic salary:', error)
      throw new Error('Failed to update basic salary')
    }
  }

  /**
   * Add bonus
   */
  async addBonus(employeeId: string, bonusAmount: number): Promise<Income | null> {
    try {
      const { data, error } = await supabase
        .from('income')
        .update({ bonus: bonusAmount })
        .eq('employee_id', employeeId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding bonus:', error)
      throw new Error('Failed to add bonus')
    }
  }

  /**
   * Add overtime
   */
  async addOvertime(employeeId: string, overtimeAmount: number): Promise<Income | null> {
    try {
      const { data, error } = await supabase
        .from('income')
        .update({ overtime: overtimeAmount })
        .eq('employee_id', employeeId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding overtime:', error)
      throw new Error('Failed to add overtime')
    }
  }

  // ============================================================================
  // PAYSLIP OPERATIONS
  // ============================================================================

  /**
   * Get all payslips with optional filtering
   */
  async getPayslips(filters?: PayslipFilters): Promise<Payslip[]> {
    try {
      let query = supabase
        .from('payslips')
        .select('*')

      // Apply filters
      if (filters?.employee_id) {
        query = query.eq('employee_id', filters.employee_id)
      }

      if (filters?.pay_date_from) {
        query = query.gte('pay_date', filters.pay_date_from)
      }

      if (filters?.pay_date_to) {
        query = query.lte('pay_date', filters.pay_date_to)
      }

      if (filters?.pay_period_from) {
        query = query.gte('pay_period_from', filters.pay_period_from)
      }

      if (filters?.pay_period_to) {
        query = query.lte('pay_period_to', filters.pay_period_to)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('pay_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching payslips:', error)
      throw new Error('Failed to fetch payslips')
    }
  }

  /**
   * Get payslip by ID
   */
  async getPayslipById(id: string): Promise<Payslip | null> {
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching payslip by ID:', error)
      return null
    }
  }

  /**
   * Get payslips for an employee
   */
  async getPayslipsByEmployee(employeeId: string, limit: number = 12): Promise<Payslip[]> {
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', employeeId)
        .order('pay_date', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching payslips by employee:', error)
      throw new Error('Failed to fetch payslips by employee')
    }
  }

  /**
   * Get latest payslip for an employee
   */
  async getLatestPayslip(employeeId: string): Promise<Payslip | null> {
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', employeeId)
        .order('pay_date', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching latest payslip:', error)
      return null
    }
  }

  /**
   * Generate payslip for an employee
   */
  async generatePayslip(employeeId: string, payPeriod: { from: string; to: string }, payDate: string): Promise<Payslip> {
    try {
      // Get employee income details
      const income = await this.getIncome(employeeId)
      if (!income) {
        throw new Error('Employee income details not found')
      }

      // Get employee details
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('first_name, last_name, employee_id, id_number, tax_number, email, phone, address')
        .eq('id', employeeId)
        .single()

      if (employeeError) throw employeeError

      // Get job title
      const { data: jobTitle, error: jobError } = await supabase
        .from('employees')
        .select('job_titles(title)')
        .eq('id', employeeId)
        .single()

      if (jobError) throw jobError

      // Calculate deductions (simplified - in real app, use proper tax calculations)
      const paye = this.calculatePAYE(income.gross_income)
      const uif = this.calculateUIF(income.gross_income)

      const payslipData: CreatePayslipData = {
        employee_id: employeeId,
        full_name: `${employee.first_name} ${employee.last_name}`,
        employee_number: employee.employee_id,
        id_number: employee.id_number,
        tax_number: employee.tax_number,
        email: employee.email,
        phone: employee.phone,
        address: employee.address,
        job_title: jobTitle.job_titles?.[0]?.title || 'Unknown',
        pay_date: payDate,
        pay_period_from: payPeriod.from,
        pay_period_to: payPeriod.to,
        basic_salary: income.basic_salary,
        bonus: income.bonus,
        commission: income.commission,
        travel_allowance: income.travel_allowance,
        cellphone_allowance: income.cellphone_allowance,
        medical_aid_subsidy: income.medical_aid_subsidy,
        company_car_value: income.company_car_value,
        overtime: income.overtime,
        paye: paye,
        uif: uif,
        pension_fund: income.pension_fund,
        medical_aid_contribution: income.medical_aid_contribution,
        penalty: income.penalty,
        other_deductions: income.other_deductions,
        gross_income: income.gross_income,
        total_deductions: paye + uif + income.pension_fund + income.medical_aid_contribution + income.penalty + income.other_deductions,
        net_income: income.gross_income - (paye + uif + income.pension_fund + income.medical_aid_contribution + income.penalty + income.other_deductions),
        payment_method: 'eft'
      }

      const { data, error } = await supabase
        .from('payslips')
        .insert([payslipData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error generating payslip:', error)
      throw error
    }
  }

  /**
   * Generate payslips for all employees
   */
  async generateAllPayslips(payPeriod: { from: string; to: string }, payDate: string): Promise<Payslip[]> {
    try {
      // Get all active employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)

      if (employeesError) throw employeesError

      const payslips: Payslip[] = []

      for (const employee of employees || []) {
        try {
          const payslip = await this.generatePayslip(employee.id, payPeriod, payDate)
          payslips.push(payslip)
        } catch (error) {
          console.error(`Error generating payslip for employee ${employee.id}:`, error)
          // Continue with other employees
        }
      }

      return payslips
    } catch (error) {
      console.error('Error generating all payslips:', error)
      throw new Error('Failed to generate all payslips')
    }
  }

  // ============================================================================
  // CALCULATION OPERATIONS
  // ============================================================================

  /**
   * Calculate PAYE (simplified South African tax calculation)
   */
  private calculatePAYE(grossIncome: number): number {
    // Simplified PAYE calculation - in real app, use proper tax tables
    const annualIncome = grossIncome * 12
    
    if (annualIncome <= 237000) {
      return 0 // No tax below threshold
    } else if (annualIncome <= 370500) {
      return ((annualIncome - 237000) * 0.18) / 12
    } else if (annualIncome <= 512800) {
      return ((annualIncome - 370500) * 0.26 + 24030) / 12
    } else if (annualIncome <= 673000) {
      return ((annualIncome - 512800) * 0.31 + 61098) / 12
    } else if (annualIncome <= 857900) {
      return ((annualIncome - 673000) * 0.36 + 110630) / 12
    } else if (annualIncome <= 1817000) {
      return ((annualIncome - 857900) * 0.39 + 177038) / 12
    } else {
      return ((annualIncome - 1817000) * 0.45 + 551178) / 12
    }
  }

  /**
   * Calculate UIF (Unemployment Insurance Fund)
   */
  private calculateUIF(grossIncome: number): number {
    // UIF is 1% of gross income, capped at R148.72 per month
    const uifAmount = grossIncome * 0.01
    return Math.min(uifAmount, 148.72)
  }

  /**
   * Calculate net income
   */
  calculateNetIncome(grossIncome: number, deductions: {
    paye: number
    uif: number
    pension_fund: number
    medical_aid_contribution: number
    penalty: number
    other_deductions: number
  }): number {
    const totalDeductions = deductions.paye + deductions.uif + deductions.pension_fund + 
                           deductions.medical_aid_contribution + deductions.penalty + deductions.other_deductions
    return grossIncome - totalDeductions
  }

  // ============================================================================
  // REPORTING OPERATIONS
  // ============================================================================

  /**
   * Get payroll summary for a period
   */
  async getPayrollSummary(payPeriod: { from: string; to: string }): Promise<{
    totalEmployees: number
    totalGrossPay: number
    totalDeductions: number
    totalNetPay: number
    averageGrossPay: number
    averageNetPay: number
  }> {
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select('gross_income, total_deductions, net_income')
        .gte('pay_period_from', payPeriod.from)
        .lte('pay_period_to', payPeriod.to)

      if (error) throw error

      const summary = data.reduce((acc: any, payslip: { gross_income: number; total_deductions: number; net_income: number }) => {
        acc.totalEmployees++
        acc.totalGrossPay += payslip.gross_income
        acc.totalDeductions += payslip.total_deductions
        acc.totalNetPay += payslip.net_income
        return acc
      }, {
        totalEmployees: 0,
        totalGrossPay: 0,
        totalDeductions: 0,
        totalNetPay: 0,
        averageGrossPay: 0,
        averageNetPay: 0
      })

      if (summary.totalEmployees > 0) {
        summary.averageGrossPay = summary.totalGrossPay / summary.totalEmployees
        summary.averageNetPay = summary.totalNetPay / summary.totalEmployees
      }

      return summary
    } catch (error) {
      console.error('Error fetching payroll summary:', error)
      throw new Error('Failed to fetch payroll summary')
    }
  }

  /**
   * Get payslip statistics
   */
  async getPayslipStatistics(): Promise<{
    totalPayslips: number
    totalGrossPay: number
    totalDeductions: number
    totalNetPay: number
    averageGrossPay: number
    averageNetPay: number
  }> {
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select('gross_income, total_deductions, net_income')

      if (error) throw error

      const stats = data.reduce((acc: any, payslip: { gross_income: number; total_deductions: number; net_income: number }) => {
        acc.totalPayslips++
        acc.totalGrossPay += payslip.gross_income
        acc.totalDeductions += payslip.total_deductions
        acc.totalNetPay += payslip.net_income
        return acc
      }, {
        totalPayslips: 0,
        totalGrossPay: 0,
        totalDeductions: 0,
        totalNetPay: 0,
        averageGrossPay: 0,
        averageNetPay: 0
      })

      if (stats.totalPayslips > 0) {
        stats.averageGrossPay = stats.totalGrossPay / stats.totalPayslips
        stats.averageNetPay = stats.totalNetPay / stats.totalPayslips
      }

      return stats
    } catch (error) {
      console.error('Error fetching payslip statistics:', error)
      throw new Error('Failed to fetch payslip statistics')
    }
  }
}

// Export singleton instance
export const payrollService = new PayrollService()
export default payrollService
