import { NextResponse } from "next/server"

// ============================================================================
// CLEAN-SLATE LEAVE API (EMPLOYEE-FACING)
// ============================================================================
// This endpoint is intentionally minimal. It keeps the same shape and HTTP
// contract so the existing UI continues to function, but it does not
// implement any real leave logic yet.
// The previous implementation is preserved in:
//   app/api/leave/route.legacy.ts
// ============================================================================

export async function POST(req: Request) {
  const _body = await req.json().catch(() => ({}))

  // Always return success placeholder for now
  return NextResponse.json(
    {
      message: "Leave request endpoint is not yet implemented.",
    },
    { status: 501 },
  )
}

export async function GET(_req: Request) {
  // Always return empty list for now
  return NextResponse.json([], { status: 200 })
}

export async function PATCH(_req: Request) {
  return NextResponse.json(
    {
      message: "Leave status update is not yet implemented.",
    },
    { status: 501 },
  )
  }

