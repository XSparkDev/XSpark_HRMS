export type UserRole = "employee" | "junior_hr" | "hr_manager" | "super_admin"

export interface User {
  email: string
  name: string
  role: UserRole
  employeeId?: string
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null

  const userStr = localStorage.getItem("xspark_user")
  if (!userStr) return null

  return JSON.parse(userStr)
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("xspark_user")
  }
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false

  const permissions: Record<UserRole, string[]> = {
    employee: [
      "view_own_profile", 
      "request_leave", 
      "upload_documents", 
      "view_payslips",
      "borrow_devices",
      "return_devices",
      "view_own_activity",
    ],
    junior_hr: [
      "view_own_profile",
      "request_leave",
      "upload_documents",
      "view_payslips",
      "view_employees",
      "approve_leave",
      "verify_documents",
      "borrow_devices",
      "return_devices",
      "view_own_activity",
      "add_devices",
      "approve_borrow_requests",
      "approve_return_requests",
      "view_all_activity",
      "manage_condition_reports",
    ],
    hr_manager: [
      "view_own_profile",
      "request_leave",
      "upload_documents",
      "view_payslips",
      "view_employees",
      "approve_leave",
      "verify_documents",
      "edit_employees",
      "manage_users",
      "view_reports",
      "borrow_devices",
      "return_devices",
      "view_own_activity",
      "add_devices",
      "approve_borrow_requests",
      "approve_return_requests",
      "view_all_activity",
      "manage_condition_reports",
      "manage_ams_settings",
    ],
    super_admin: ["*"], // All permissions
  }

  const userPermissions = permissions[user.role]
  return userPermissions.includes("*") || userPermissions.includes(permission)
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    employee: "bg-gradient-to-r from-blue-500 to-blue-600",
    junior_hr: "bg-gradient-to-r from-green-500 to-green-600",
    hr_manager: "gradient-primary",
    super_admin: "bg-gradient-to-r from-red-500 to-amber-500",
  }
  return colors[role]
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    employee: "Employee",
    junior_hr: "Junior HR",
    hr_manager: "HR Manager",
    super_admin: "Super Admin",
  }
  return names[role]
}
