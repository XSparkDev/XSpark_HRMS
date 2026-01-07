import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const logSchema = z.object({
  borrow_id: z.string().optional(),
  scanned_code: z.string().min(1, "Scanned code is required"),
  scan_type: z.enum(["collect", "return"]),
})

export async function POST(request: NextRequest) {
  try {
    const payload = logSchema.parse(await request.json())
    
    // Stub function - log scan to scan_history
    // In production, this would insert into scan_history table
    console.log("[device-scans] Log scan:", payload)
    
    return NextResponse.json({
      success: true,
      data: {
        scan_id: `scan-${Date.now()}`,
        ...payload,
        scanned_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: error.errors },
        { status: 400 }
      )
    }

    console.error("[device-scans] POST /log failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to log scan",
      },
      { status: 500 }
    )
  }
}

