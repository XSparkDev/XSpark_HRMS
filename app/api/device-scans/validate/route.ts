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
    const { borrow_id, device_id, scanned_code, mode } = payload

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

      // Validate device ID matches
      const borrowDeviceId = borrow.device_id || borrow.asset_tag || borrow.serial_number
      const scannedDeviceId = device.device_id || device.asset_tag || device.serial_number

      if (borrowDeviceId !== scannedDeviceId && device.device_id !== borrow.device_id) {
        return NextResponse.json(
          { success: false, error: "Incorrect device scanned. Device ID does not match." },
          { status: 400 }
        )
      }

      // Check borrow status is "Approved – Awaiting Scan" or similar
      const status = (borrow.status || "").toLowerCase()
      if (!status.includes("approved") && !status.includes("pending")) {
        return NextResponse.json(
          { success: false, error: "Borrow request is not in approved state" },
          { status: 400 }
        )
      }

      // Check device is available
      const deviceStatus = (device.status || "").toLowerCase()
      if (deviceStatus.includes("borrowed") && !deviceStatus.includes("pending")) {
        return NextResponse.json(
          { success: false, error: "Device is not available" },
          { status: 400 }
        )
      }

      // Update status to "Borrowed"
      await borrowService.updateBorrow(borrow_id, {
        status: "borrowed",
        approval_status: "approved",
      }).catch(() => {})

      // Update device status
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

      // Validate device ID matches
      const borrowDeviceId = borrow.device_id || borrow.asset_tag || borrow.serial_number
      const scannedDeviceId = device.device_id || device.asset_tag || device.serial_number

      if (borrowDeviceId !== scannedDeviceId && device.device_id !== borrow.device_id) {
        return NextResponse.json(
          { success: false, error: "Incorrect device scanned. Device ID does not match." },
          { status: 400 }
        )
      }

      // Check borrow status is "Awaiting Return"
      const status = (borrow.status || "").toLowerCase()
      if (!status.includes("awaiting return") && status !== "borrowed") {
        return NextResponse.json(
          { success: false, error: "Device is not in awaiting return state" },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          device_id: device.device_id,
          borrow_id,
          scanned_code,
        },
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

