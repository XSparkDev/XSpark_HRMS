export interface EmployeeProfile {
  id: string
  user_id: string
  
  // Personal Information
  first_name: string
  middle_name?: string
  last_name: string
  preferred_name?: string
  id_number: string // Encrypted
  dob: string
  sex: 'male' | 'female'
  gender: 'male' | 'female' | 'other' | 'prefer not to say'
  pronouns?: string
  
  // Employment Details
  employee_ID: string // Format: XSP<YEAR/MONTH>/<NNN>
  job_title_id: string
  date_hired: string
  
  // Contact Details
  email: string
  phone: string
  alternative_phone?: string
  address: string
  
  // Tax and Nationality
  tax_number?: string // Encrypted
  nationality: string
  passport_number?: string
  passport_document?: string
  work_permit?: string
  id_verified: boolean
  work_permit_verified: boolean
  
  // Bank and Verification
  bank_details?: BankDetails
  bank_verified: boolean
  
  // Documents and Images
  documents?: string[]
  images?: string[]
  
  // Next of Kin
  next_of_kin?: NextOfKin
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface BankDetails {
  bank_name: string
  account_number: string
  account_type: 'savings' | 'cheque' | 'business'
  branch_code: string
  account_holder_name: string
}

export interface NextOfKin {
  first_name: string
  middle_name?: string
  last_name: string
  email: string
  phone: string
  alternative_phone?: string
  relationship: string
}

export interface JobTitle {
  id: string
  title: string
  department: string
  description?: string
  salary_range_min?: number
  salary_range_max?: number
}

export interface ProfileUpdateRequest {
  id: string
  employee_id: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at?: string
  reviewed_by?: string
}

export interface EmployeeFilters {
  search?: string
  department?: string
  job_title?: string
  status?: 'active' | 'inactive'
  nationality?: string
}
