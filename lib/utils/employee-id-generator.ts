// ============================================================================
// EMPLOYEE ID GENERATOR - XSP Format Implementation
// ============================================================================
// Generates Employee IDs in the format: XSP/YY/MM/NNN
// Where:
// - YY = year hired (last two digits)
// - MM = month hired
// - NNN = sequential number hired that month
// Example: XSP/23/10/003 → third employee hired in October 2023
// ============================================================================

export interface EmployeeIdData {
  year: number
  month: number
  sequenceNumber: number
}

export class EmployeeIdGenerator {
  /**
   * Generate Employee ID in XSP/YY/MM/NNN format
   */
  static generate(hireDate: Date, sequenceNumber: number): string {
    const year = hireDate.getFullYear() % 100 // Last two digits
    const month = hireDate.getMonth() + 1 // Month (1-12)
    
    return `XSP/${year.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${sequenceNumber.toString().padStart(3, '0')}`
  }

  /**
   * Parse Employee ID to extract components
   */
  static parse(employeeId: string): EmployeeIdData | null {
    const pattern = /^XSP\/(\d{2})\/(\d{2})\/(\d{3})$/
    const match = employeeId.match(pattern)
    
    if (!match) return null
    
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      sequenceNumber: parseInt(match[3], 10)
    }
  }

  /**
   * Validate Employee ID format
   */
  static validate(employeeId: string): boolean {
    const pattern = /^XSP\/(\d{2})\/(\d{2})\/(\d{3})$/
    return pattern.test(employeeId)
  }

  /**
   * Get next sequence number for a given month/year
   */
  static getNextSequenceNumber(year: number, month: number, existingIds: string[]): number {
    const yearStr = year.toString().padStart(2, '0')
    const monthStr = month.toString().padStart(2, '0')
    const pattern = new RegExp(`^XSP/${yearStr}/${monthStr}/(\\d{3})$`)
    
    let maxSequence = 0
    
    existingIds.forEach(id => {
      const match = id.match(pattern)
      if (match) {
        const sequence = parseInt(match[1], 10)
        if (sequence > maxSequence) {
          maxSequence = sequence
        }
      }
    })
    
    return maxSequence + 1
  }

  /**
   * Format Employee ID for display
   */
  static formatForDisplay(employeeId: string): string {
    if (!this.validate(employeeId)) return employeeId
    
    const parsed = this.parse(employeeId)
    if (!parsed) return employeeId
    
    const fullYear = 2000 + parsed.year
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    
    return `${employeeId} (${monthNames[parsed.month - 1]} ${fullYear}, #${parsed.sequenceNumber})`
  }
}

// Export singleton instance
export const employeeIdGenerator = EmployeeIdGenerator
export default EmployeeIdGenerator




























