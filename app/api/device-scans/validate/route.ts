import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { borrowService } from "@/lib/services"
import { devicesService } from "@/lib/services"

const validateSchema = z.object({
  borrow_id: z.string().optional(),
  device_id: z.string().optional(),
  scanned_code: z.string().min(1, "Scanned code is required"),
  mode: z.enum(["collect", "return"]),
})

export async function POST(request: NextRequest) {
  try {
    const payload = validateSchema.parse(await request.json())
    let { borrow_id, device_id, scanned_code, mode } = payload

    // Extract device ID from URL if scanned code is a URL
    // Handle URLs like "http://localhost:3000/assets/DEV-009" or "/assets/DEV-009"
    const urlMatch = scanned_code.match(/(?:^|\/)(?:assets|device)\/([A-Z0-9-]+)/i)
    if (urlMatch && urlMatch[1]) {
      scanned_code = urlMatch[1]
    }

    // Find device by scanned code (could be asset_tag, serial_number, or device_id)
    const device = await devicesService.getDeviceByIdentifier(scanned_code).catch(() => null)
    
    if (!device) {
      return NextResponse.json(
        { success: false, error: "Device not found with scanned code" },
        { status: 404 }
      )
    }

    // For collect mode
    if (mode === "collect") {
      if (!borrow_id) {
        return NextResponse.json(
          { success: false, error: "Borrow ID is required for collect" },
          { status: 400 }
        )
      }

      // Check if device matches the borrow request
      const borrow = await borrowService.getBorrowById(borrow_id).catch(() => null)
      if (!borrow) {
        return NextResponse.json(
          { success: false, error: "Borrow request not found" },
          { status: 404 }
        )
      }

      // Validate scanned device matches the borrow record
      const borrowDeviceId = borrow.device_id
      const scannedDeviceId = device.device_id

      if (!borrowDeviceId || !scannedDeviceId || scannedDeviceId !== borrowDeviceId) {
        return NextResponse.json(
          { success: false, error: "Incorrect device scanned. Device ID does not match." },
          { status: 400 }
        )
      }

      // Status-first flow:
      // - pending_borrow  -> not collectible (supervisor must approve first)
      // - borrowed        -> collectible (idempotent)
      // - pending_return  -> already in return flow, not collectible
      // - returned/rejected -> not collectible
      const borrowStatus = String((borrow as any).borrow_status || "").toLowerCase().trim()
      if (!borrowStatus) {
        return NextResponse.json(
          { success: false, error: "Borrow record is missing borrow_status. Please migrate statuses first." },
          { status: 409 }
        )
      }
      if (borrowStatus === "pending_borrow") {
        return NextResponse.json(
          { success: false, error: "Borrow request must be approved before collection." },
          { status: 400 }
        )
      }
      if (borrowStatus !== "borrowed") {
        return NextResponse.json(
          { success: false, error: `Borrow is not collectible in status: ${borrowStatus}` },
          { status: 400 }
        )
      }

      // Check device is available
      const deviceStatus = (device.status || "").toLowerCase()
      if (deviceStatus.includes("borrowed") && !deviceStatus.includes("pending")) {
        // If the device is already marked borrowed, treat collect as idempotent success.
        return NextResponse.json({
          success: true,
          data: {
            device_id: device.device_id,
            borrow_id,
            scanned_code,
          },
        })
      }

      // Ensure device status is borrowed (borrow row is already 'borrowed' after approval).
      // We do not update borrow_status here beyond idempotence.

      // Update device status (pickupDevice already does this, but ensure it's set)
      await devicesService.setDeviceStatus(device.device_id, "borrowed").catch(() => {})

      return NextResponse.json({
        success: true,
        data: {
          device_id: device.device_id,
          borrow_id,
          scanned_code,
        },
      })
    }

    // For return mode
    if (mode === "return") {
      if (!borrow_id) {
        return NextResponse.json(
          { success: false, error: "Borrow ID is required for return" },
          { status: 400 }
        )
      }

      // Check if device matches the borrow
      const borrow = await borrowService.getBorrowById(borrow_id).catch(() => null)
      if (!borrow) {
        return NextResponse.json(
          { success: false, error: "Borrow request not found" },
          { status: 404 }
        )
      }

      // Validate scanned device matches the borrow record
      const borrowDeviceId = borrow.device_id
      const scannedDeviceId = device.device_id

      if (!borrowDeviceId || !scannedDeviceId || scannedDeviceId !== borrowDeviceId) {
        return NextResponse.json(
          { success: false, error: "Incorrect device scanned. Device ID does not match." },
          { status: 400 }
        )
      }

      try {
        // Status-first flow: return scan creates a *return request*.
        // Borrow must be currently borrowed; we do NOT set is_returned=true here.
        const borrowStatus = String((borrow as any).borrow_status || "").toLowerCase().trim()
        if (!borrowStatus) {
          return NextResponse.json(
            { success: false, error: "Borrow record is missing borrow_status. Please migrate statuses first." },
            { status: 409 }
          )
        }

        if (borrowStatus === "returned" || borrowStatus === "rejected") {
          return NextResponse.json(
            { success: false, error: `Cannot request return for a ${borrowStatus} borrow.` },
            { status: 400 }
          )
        }

        // If a return request was already created, treat as idempotent success.
        if (borrowStatus === "pending_return") {
          return NextResponse.json({
            success: true,
            data: {
              device_id: device.device_id,
              borrow_id,
              scanned_code,
            },
            message: "Return request already submitted and awaiting supervisor approval.",
          })
        }

        if (borrowStatus !== "borrowed") {
          return NextResponse.json(
            { success: false, error: `Device is not returnable in status: ${borrowStatus}` },
            { status: 400 }
          )
        }

        const now = new Date().toISOString()
        const { supabaseAdmin } = await import("@/lib/supabase-admin")

        // 1) Create return request row (pending approval)
        const { error: returnInsertError } = await supabaseAdmin
          .from("returns")
          .insert({
            employee_id: (borrow as any).borrowed_by,
            device_id: (borrow as any).device_id,
            return_date: now,
            status: "Pending",
            created_at: now,
            updated_at: now,
          } as any)

        if (returnInsertError) {
          console.error("[device-scans] Failed to create return request:", returnInsertError)
          return NextResponse.json(
            { success: false, error: "Failed to submit return request. Please try again." },
            { status: 500 }
          )
        }

        // 2) Mark borrow as pending return (keep is_returned=false)
        const { error: borrowUpdateError } = await supabaseAdmin
          .from("borrows")
          .update({
            borrow_status: "pending_return",
            borrow_request: true,
            is_borrowed: true,
            is_returned: false,
            updated_at: now,
          } as any)
          .eq("borrow_id", borrow_id)

        if (borrowUpdateError) {
          console.error("[device-scans] Failed to update borrow to pending_return:", borrowUpdateError)
          return NextResponse.json(
            { success: false, error: "Return request created, but failed to update borrow status. Please contact support." },
            { status: 500 }
          )
        }
      } catch (err) {
        console.error("[device-scans] Return scan flow failed:", err)
        return NextResponse.json(
          { success: false, error: err instanceof Error ? err.message : "Failed to submit return request" },
          { status: 500 }
        )
      }

      // Keep device as borrowed until supervisor approves the return.

      return NextResponse.json({
        success: true,
        data: {
          device_id: device.device_id,
          borrow_id,
          scanned_code,
        },
        message: "Return request submitted and awaiting supervisor approval.",
      })
    }

    return NextResponse.json(
      { success: false, error: "Invalid mode" },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: error.errors },
        { status: 400 }
      )
    }

    console.error("[device-scans] POST /validate failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to validate scan",
      },
      { status: 500 }
    )
  }
}

