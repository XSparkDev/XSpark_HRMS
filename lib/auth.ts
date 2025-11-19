export type UserRole =
  | "employee"
  | "supervisor"
  | "junior_hr"
  | "hr_manager"
  | "hr_admin"
  | "manager"
  | "admin"
  | "super_admin"

export interface User {
  id?: string
  email: string
  name: string
  role: UserRole
  employeeId?: string
  id?: string
  roleId?: string
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
  if (!user || !user.role) return false

  const permissions: Record<UserRole, string[]> = {
    employee: [
      "view_own_profile",
      "request_leave",
      "upload_documents",
      "view_payslips",
      // AMS employee capabilities (scoped UI gating)
      "ams_view_devices",
      "ams_book_rooms",
    ],
    supervisor: [
      "*", // Supervisors can perform all AMS employee actions plus approvals/overrides in the AMS context
    ],
    junior_hr: [
      "view_own_profile",
      "request_leave",
      "upload_documents",
      "view_payslips",
      "view_employees",
      "approve_leave",
      "verify_documents",
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
    ],
    hr_admin: ["*"],
    manager: ["*"],
    admin: ["*"],
    super_admin: ["*"], // All permissions
  }

  const userPermissions = permissions[user.role]
  if (!userPermissions || !Array.isArray(userPermissions)) {
    console.warn(`Unknown role: ${user.role}, defaulting to employee permissions`)
    return permissions.employee.includes(permission)
  }

  return userPermissions.includes("*") || userPermissions.includes(permission)
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    employee: "bg-gradient-to-r from-blue-500 to-blue-600",
    supervisor: "bg-gradient-to-r from-indigo-500 to-indigo-600",
    junior_hr: "bg-gradient-to-r from-green-500 to-green-600",
    hr_manager: "gradient-primary",
    hr_admin: "gradient-primary",
    manager: "bg-gradient-to-r from-purple-500 to-purple-600",
    admin: "bg-gradient-to-r from-purple-500 to-purple-600",
    super_admin: "bg-gradient-to-r from-red-500 to-amber-500",
  }
  return colors[role]
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    employee: "Employee",
    supervisor: "Supervisor",
    junior_hr: "Junior HR",
    hr_manager: "HR Manager",
    hr_admin: "HR Admin",
    manager: "Manager",
    admin: "Admin",
    super_admin: "Super Admin",
  }
  return names[role]
}

const roleRoutes: Record<UserRole, string> = {
  employee: "/ams-dashboard",
  supervisor: "/ams-supervisor",
  junior_hr: "/dashboard",
  hr_manager: "/dashboard",
  hr_admin: "/dashboard",
  manager: "/dashboard",
  admin: "/dashboard",
  super_admin: "/dashboard",
}

export function getDefaultRouteForRole(role?: string | null): string {
  if (!role) return "/system-selector"
  const normalized = role.toLowerCase()
  if (normalized in roleRoutes) {
    return roleRoutes[normalized as UserRole]
  }
  return "/system-selector"
}
