"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { QrCode, X, Camera, CameraOff } from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  expectedCode?: string
  className?: string
}

export function QRScanner({ onScan, onError, expectedCode, className = "" }: QRScannerProps) {
  const qrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerIdRef = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`)
  const isStoppingRef = useRef(false)

  // Extract device ID from URL if scanned code is a URL
  const extractDeviceId = (scannedValue: string): string => {
    const trimmed = scannedValue.trim()
    
    // If it's a URL like "http://localhost:3000/assets/DEV-009" or "/assets/DEV-009"
    const urlMatch = trimmed.match(/(?:^|\/)(?:assets|device)\/([A-Z0-9-]+)/i)
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1]
    }
    
    // If it's just a device ID, return as is
    return trimmed
  }

  const stopCamera = async () => {
    if (isStoppingRef.current) {
      // Already stopping, don't try again
      return
    }

    if (qrCodeRef.current && isScanning) {
      isStoppingRef.current = true
      try {
        // First stop the scanner
        await qrCodeRef.current.stop()
        // Wait a bit to ensure stop is complete
        await new Promise(resolve => setTimeout(resolve, 100))
        // Then clear - only if scanner instance still exists
        if (qrCodeRef.current) {
          await qrCodeRef.current.clear()
        }
      } catch (err: any) {
        // Check if error is about clearing while scanning
        const errorMsg = err?.message || String(err)
        if (errorMsg.includes("Cannot clear while scan is ongoing")) {
          // Try to stop again and wait longer
          try {
            if (qrCodeRef.current) {
              await qrCodeRef.current.stop()
              await new Promise(resolve => setTimeout(resolve, 200))
              if (qrCodeRef.current) {
                await qrCodeRef.current.clear()
              }
            }
          } catch (retryErr) {
            console.debug("Error stopping scanner on retry:", retryErr)
          }
        } else {
          console.debug("Error stopping scanner:", err)
        }
      } finally {
        qrCodeRef.current = null
        setIsScanning(false)
        isStoppingRef.current = false
      }
    } else {
      // If not scanning, just reset state
      setIsScanning(false)
      isStoppingRef.current = false
    }
  }

  const startCamera = async () => {
    try {
      setError(null)
      
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMessage = "Camera not accessible. Please ensure you're using HTTPS or localhost."
        setError(errorMessage)
        onError?.(errorMessage)
        return
      }

      // Create scanner instance if it doesn't exist
      if (!qrCodeRef.current) {
        qrCodeRef.current = new Html5Qrcode(scannerIdRef.current)
      }

      setIsScanning(true)

      // Start scanning with camera constraints instead of specific camera ID
      // This allows html5-qrcode to handle permission requests and camera selection
      await qrCodeRef.current.start(
        {
          facingMode: "environment" // Prefer back camera on mobile
        },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // On successful scan
          const trimmedText = decodedText.trim()
          if (trimmedText) {
            // Stop scanner after successful scan
            stopCamera()
            // Extract device ID from URL if needed
            const deviceId = extractDeviceId(trimmedText)
            // Call the onScan callback to auto-fill and validate
            onScan(deviceId)
          }
        },
        (errorMessage) => {
          // Ignore minor scan errors (QR code not found yet)
          // Only show errors for actual problems
          if (errorMessage && !errorMessage.includes("NotFoundException")) {
            // Don't set error for normal scanning (QR not found yet)
            // Only log for debugging
            console.debug("QR scan error:", errorMessage)
          }
        }
      )
    } catch (err: any) {
      // Handle various error types
      const errorMsg = err?.message || String(err)
      let errorMessage = "Camera not accessible."
      
      if (errorMsg.includes("Permission denied") || errorMsg.includes("NotAllowedError")) {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings and try again."
      } else if (errorMsg.includes("NotReadableError") || errorMsg.includes("NotFoundError")) {
        errorMessage = "Camera not accessible. Please ensure no other application is using the camera."
      } else if (errorMsg.includes("OverconstrainedError")) {
        errorMessage = "Camera constraints not supported. Please try a different camera."
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      onError?.(errorMessage)
      setIsScanning(false)
      // Clean up scanner if it exists
      if (qrCodeRef.current) {
        try {
          // Check if scanner is actually scanning before trying to stop
          const scannerState = (qrCodeRef.current as any).scanState
          if (scannerState && scannerState !== "STOPPED") {
            await qrCodeRef.current.stop()
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          // Only clear if scanner is stopped
          if (qrCodeRef.current) {
            await qrCodeRef.current.clear()
          }
        } catch (cleanupErr: any) {
          // If clear fails because scan is ongoing, just stop
          if (cleanupErr?.message?.includes("Cannot clear while scan is ongoing")) {
            try {
              if (qrCodeRef.current) {
                await qrCodeRef.current.stop()
              }
            } catch {
              // Ignore stop errors during cleanup
            }
          } else {
            // Ignore other cleanup errors
          }
        }
        qrCodeRef.current = null
      }
      isStoppingRef.current = false
    }
  }

  const handleManualInput = (value: string) => {
    if (value.trim()) {
      const deviceId = extractDeviceId(value)
      onScan(deviceId)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrCodeRef.current && isScanning) {
        // Stop scanner first, then clear
        qrCodeRef.current.stop()
          .then(() => {
            // Wait a bit before clearing
            return new Promise(resolve => setTimeout(resolve, 100))
          })
          .then(() => {
            if (qrCodeRef.current) {
              return qrCodeRef.current.clear()
            }
          })
          .catch(() => {
            // Ignore errors during cleanup - scanner might already be stopped
          })
          .finally(() => {
            qrCodeRef.current = null
          })
      } else if (qrCodeRef.current) {
        // If not scanning, just clear safely
        const instance = qrCodeRef.current
        qrCodeRef.current = null
        try {
          const maybePromise = (instance as any).clear?.()
          // If clear() returns a promise, attach a catch to swallow errors
          if (maybePromise && typeof (maybePromise as any).catch === "function") {
            ;(maybePromise as any).catch(() => {
              // Ignore errors during cleanup
            })
          }
        } catch {
          // Ignore synchronous cleanup errors
        }
      }
    }
  }, [isScanning])

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">Scan QR Code</label>
        <div className="flex gap-2">
          {!isScanning ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
            >
              <Camera className="h-4 w-4 mr-2" />
              Start Scan
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stopCamera}
            >
              <CameraOff className="h-4 w-4 mr-2" />
              Stop Scan
            </Button>
          )}
        </div>
      </div>

      {/* QR Scanner Container */}
      <div 
        id={scannerIdRef.current}
        ref={scannerContainerRef}
        className="w-full"
        style={{ minHeight: isScanning ? "300px" : "0px" }}
      />

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            You can enter the QR code manually below
          </p>
        </div>
      )}

      {/* Manual input fallback */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          Or enter QR code manually:
        </label>
        <input
          type="text"
          placeholder="Enter QR code or barcode"
          className="w-full px-3 py-2 border rounded-md text-sm"
          onChange={(e) => handleManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleManualInput(e.currentTarget.value)
            }
          }}
        />
      </div>
    </div>
  )
}
