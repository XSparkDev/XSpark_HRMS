type EmployeeVerificationLike = {
  id_verified?: boolean | null
  bank_verified?: boolean | null
  work_permit_verified?: boolean | null
}

/**
 * Employee is considered "verified" when both ID and bank are verified.
 * (Work permit verification may be tracked separately.)
 */
export function isEmployeeFullyVerified(employee?: EmployeeVerificationLike | null): boolean {
  if (!employee) return false

  const idVerified = Boolean(employee.id_verified)
  const bankVerified = Boolean(employee.bank_verified)
  return idVerified && bankVerified
}
