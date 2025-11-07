import { NextRequest } from "next/server"

export interface RequestUser {
  id: string
  employeeId: string
  role: string
}

export function getRequestUser(req: NextRequest): RequestUser | null {
  const userId = req.headers.get("x-user-id") || req.headers.get("X-User-Id")
  const employeeId = req.headers.get("x-employee-id") || req.headers.get("X-Employee-Id")
  const role = req.headers.get("x-user-role") || req.headers.get("X-User-Role") || "employee"

  if (!userId || !employeeId) {
    return null
  }

  return {
    id: userId,
    employeeId,
    role,
  }
}

