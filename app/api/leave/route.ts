import { NextResponse } from "next/server"
import { leaveRequestSchema, validateLeaveRequest } from "@/lib/validation/leave"
import { z } from "zod"
import { isWithinInterval, parseISO } from "date-fns"

// In-memory store for leave requests (replace with database in production)
interface LeaveRequest extends z.infer<typeof leaveRequestSchema> {
  id: string
  createdAt: Date
  updatedAt: Date
}

const leaveRequests: LeaveRequest[] = []
let nextId = 1

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validatedData = leaveRequestSchema.parse(body)

    // Check for overlapping leave requests for the same employee
    const hasOverlap = leaveRequests.some(request => 
      request.employee_id === validatedData.employee_id &&
      request.status !== "rejected" && // Only check against active/pending leaves
      (
        isWithinInterval(validatedData.leave_day_from, { 
          start: parseISO(request.leave_day_from as any), 
          end: parseISO(request.leave_day_to as any) 
        }) ||
        isWithinInterval(validatedData.leave_day_to, { 
          start: parseISO(request.leave_day_from as any), 
          end: parseISO(request.leave_day_to as any) 
        }) ||
        (validatedData.leave_day_from <= parseISO(request.leave_day_from as any) && 
         validatedData.leave_day_to >= parseISO(request.leave_day_to as any))
      )
    )

    if (hasOverlap) {
      return NextResponse.json({ 
        message: "Overlapping leave request detected for this employee." 
      }, { status: 400 })
    }

    const newRequest: LeaveRequest = {
      id: (nextId++).toString(),
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    leaveRequests.push(newRequest)

    return NextResponse.json(newRequest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        message: "Validation failed", 
        errors: error.errors 
      }, { status: 400 })
    }
    console.error("Error submitting leave request:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employee_id")
  const status = searchParams.get("status")

  let filteredRequests = leaveRequests

  if (employeeId) {
    filteredRequests = filteredRequests.filter(req => req.employee_id === employeeId)
  }
  if (status) {
    filteredRequests = filteredRequests.filter(req => req.status === status)
  }

  return NextResponse.json(filteredRequests, { status: 200 })
}

export async function PATCH(req: Request) {
  try {
    const { id, status, rejection_reason, approver_comment, reviewed_by } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ 
        message: "Request ID and status are required." 
      }, { status: 400 })
    }

    const requestIndex = leaveRequests.findIndex(r => r.id === id)

    if (requestIndex === -1) {
      return NextResponse.json({ 
        message: "Leave request not found." 
      }, { status: 404 })
    }

    const request = leaveRequests[requestIndex]

    // Basic authorization check (in a real app, this would be more robust)
    // For example, only HR/Admin can approve/reject
    // if (!hasPermission(reviewed_by, "approve_leave")) {
    //   return NextResponse.json({ message: "Unauthorized to approve/reject leave." }, { status: 403 });
    // }

    request.status = status
    request.rejection_reason = status === "rejected" ? rejection_reason : undefined
    request.approver_comment = approver_comment
    request.reviewed_by = reviewed_by
    request.reviewed_at = new Date()
    request.updatedAt = new Date()

    return NextResponse.json(request, { status: 200 })
  } catch (error) {
    console.error("Error updating leave request status:", error)
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 })
  }
}
