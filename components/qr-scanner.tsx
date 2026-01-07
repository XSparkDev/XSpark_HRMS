"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { QrCode, X, Camera, CameraOff } from "lucide-react"

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  expectedCode?: string
  className?: string
}

export function QRScanner({ onScan, onError, expectedCode, className = "" }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setIsScanning(false)
  }

  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsScanning(true)

        // Start scanning for QR codes
        startQRDetection()
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to access camera"
      setError(errorMessage)
      onError?.(errorMessage)
      setIsScanning(false)
    }
  }

  const startQRDetection = () => {
    // Simple QR code detection using canvas and image processing
    // For production, you'd use a library like html5-qrcode or @zxing/library
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          const canvas = document.createElement("canvas")
          const video = videoRef.current
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            // For now, we'll use a simple pattern matching
            // In production, integrate a QR library here
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            // Placeholder: In real implementation, use a QR decoder library
          }
        } catch (err) {
          console.error("QR detection error:", err)
        }
      }
    }, 500) // Check every 500ms
  }

  const handleManualInput = (value: string) => {
    if (value.trim()) {
      onScan(value.trim())
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

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
              Start Camera
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stopCamera}
            >
              <CameraOff className="h-4 w-4 mr-2" />
              Stop Camera
            </Button>
          )}
        </div>
      </div>

      {isScanning && (
        <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* Scanning overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-2 border-white/50 rounded-lg m-8">
              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
            </div>
            {/* Scanning line animation */}
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-white/50 animate-pulse"></div>
          </div>
          {/* Instructions */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white text-sm bg-black/50 px-3 py-1 rounded inline-block">
              Position QR code within frame
            </p>
          </div>
        </div>
      )}

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





