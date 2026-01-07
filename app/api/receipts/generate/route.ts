import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const generateSchema = z.object({
  type: z.enum(["borrow", "return"]),
  borrow_id: z.string().optional(),
  employee_email: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const payload = generateSchema.parse(await request.json())
    
    // Stub function - generate receipt and email stub to employee
    // In production, this would:
    // 1. Generate PDF receipt with employee name, devices list, borrow datetime, return due date
    // 2. Send email to employee_email
    console.log("[receipts] Generate receipt stub:", payload)
    
    return NextResponse.json({
      success: true,
      data: {
        receipt_id: `receipt-${Date.now()}`,
        ...payload,
        generated_at: new Date().toISOString(),
      },
      message: "Receipt generated and emailed (stub)",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: error.errors },
        { status: 400 }
      )
    }

    console.error("[receipts] POST /generate failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate receipt",
      },
      { status: 500 }
    )
  }
}

