export type UserRole =
  | "employee"
  | "supervisor"
  | "junior_hr"
  | "hr_manager"
  | "super_admin"
  | "admin"

export interface User {
  email: string
  name: string
  role: UserRole
  employeeId?: string
  roleId?: string
  twoFactorEnabled?: boolean
}

type HeadersLike = Pick<Headers, "get">
type ServerReadableRequest = { headers: HeadersLike }

const validRoles: UserRole[] = [
  "employee",
  "supervisor",
  "junior_hr",
  "hr_manager",
  "hr_admin",
  "manager",
  "admin",
  "super_admin",
]

const normalizeRole = (role?: string | null): UserRole => {
  if (!role || typeof role !== "string") return "employee"
  const lower = role.toLowerCase() as UserRole
  return validRoles.includes(lower) ? lower : "employee"
}

const toStringOrUndefined = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

const tryParseJson = (value?: string | null): Record<string, unknown> | null => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const extractCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(";")
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.trim().split("=")
    if (cookieName === name && rest.length > 0) {
      return decodeURIComponent(rest.join("="))
    }
  }
  return null
}

const buildUserFromRecord = (record: Record<string, unknown> | null | undefined): User | null => {
  if (!record || typeof record !== "object") return null

  const userMetadata = record.user_metadata as Record<string, unknown> | undefined
  const id =
    toStringOrUndefined(record.id) ||
    toStringOrUndefined(record.user_id) ||
    toStringOrUndefined(record.sub) ||
    toStringOrUndefined(record.auth_user_id)

  const email =
    toStringOrUndefined(record.email) ||
    toStringOrUndefined(userMetadata?.email) ||
    ""

  const firstName =
    toStringOrUndefined(record.first_name) ??
    toStringOrUndefined(userMetadata?.first_name)
  const lastName =
    toStringOrUndefined(record.last_name) ??
    toStringOrUndefined(userMetadata?.last_name)
  const derivedName = [firstName, lastName].filter(Boolean).join(" ").trim()
  const name =
    toStringOrUndefined(record.name) ||
    derivedName ||
    email ||
    "User"

  const role =
    normalizeRole(
      (record.role as string | undefined) ??
        (userMetadata?.role as string | undefined) ??
        (record.role_name as string | undefined) ??
        (toStringOrUndefined((record.app_metadata as Record<string, unknown> | undefined)?.role))
    )

  const employeeId =
    toStringOrUndefined(record.employeeId) ||
    toStringOrUndefined(record.employee_id) ||
    toStringOrUndefined(userMetadata?.employee_id)

  const roleId =
    toStringOrUndefined(record.roleId) ||
    toStringOrUndefined(record.role_id) ||
    toStringOrUndefined(userMetadata?.role_id)

  const twoFactorEnabled = Boolean(
    record.twoFactorEnabled ??
      record.two_factor_enabled ??
      record.mfa_enabled ??
      record.is_mfa_enabled ??
      userMetadata?.twoFactorEnabled ??
      userMetadata?.two_factor_enabled
  )

  return {
    id,
    email,
    name,
    role,
    employeeId,
    roleId,
    twoFactorEnabled,
  }
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const payload = parts[1]
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padLength = 4 - (normalized.length % 4 || 4)
    const padded = normalized + "=".repeat(padLength === 4 ? 0 : padLength)
    const json = Buffer.from(padded, "base64").toString("utf-8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

const userFromAuthorizationHeader = (headers: HeadersLike | null): User | null => {
  if (!headers) return null
  const authHeader = headers.get("authorization") || headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  return buildUserFromRecord(payload)
}

const userFromJsonHeader = (headers: HeadersLike | null): User | null => {
  if (!headers) return null
  const headerValue = headers.get("x-user-json") || headers.get("x-user")
  if (!headerValue) return null
  return buildUserFromRecord(tryParseJson(headerValue))
}

const userFromStructuredHeaders = (headers: HeadersLike | null): User | null => {
  if (!headers) return null
  const id = headers.get("x-user-id") || headers.get("X-User-Id")
  const email = headers.get("x-user-email") || headers.get("X-User-Email")
  const name = headers.get("x-user-name") || headers.get("X-User-Name")
  const role = headers.get("x-user-role") || headers.get("X-User-Role")
  const employeeId = headers.get("x-employee-id") || headers.get("X-Employee-Id")

  if (!id && !email && !employeeId) return null

  return buildUserFromRecord({
    id: id ?? undefined,
    email: email ?? undefined,
    name: name ?? undefined,
    role: role ?? undefined,
    employee_id: employeeId ?? undefined,
  })
}

const userFromCookie = (headers: HeadersLike | null): User | null => {
  if (!headers) return null
  const cookieHeader = headers.get("cookie")
  const cookieValue = extractCookieValue(cookieHeader, "xspark_user")
  if (!cookieValue) return null
  return buildUserFromRecord(tryParseJson(cookieValue))
}

const getServerUser = (req?: ServerReadableRequest): User | null => {
  const headers = req?.headers ?? null
  if (!headers) return null

  return (
    userFromCookie(headers) ||
    userFromJsonHeader(headers) ||
    userFromStructuredHeaders(headers) ||
    userFromAuthorizationHeader(headers) ||
    null
  )
}

export function getCurrentUser(req?: ServerReadableRequest): User | null {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem("xspark_user")
    if (!userStr) return null
    return tryParseJson(userStr) as User | null
  }

  return getServerUser(req)
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
    admin: "Admin",
    super_admin: "Super Admin",
  }
  return names[role]
}

const roleRoutes: Record<UserRole, string> = {
  // Default all users to the main HR dashboard; AMS can be accessed via switcher
  employee: "/dashboard",
  supervisor: "/ams-supervisor",
  junior_hr: "/dashboard",
  hr_manager: "/dashboard",
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
