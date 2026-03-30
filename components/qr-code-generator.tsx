"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { QrCode, Download, Copy, Check, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface QRCodeGeneratorProps {
  deviceId?: string
  deviceName?: string
  onGenerate?: (qrData: string) => void
  className?: string
}

export function QRCodeGenerator({ 
  deviceId, 
  deviceName,
  onGenerate,
  className = "" 
}: QRCodeGeneratorProps) {
  const [qrValue, setQrValue] = useState(deviceId || "")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  // Generate QR code URL using a QR code API service
  // In production, you might want to use a library like qrcode.react
  const generateQRCode = (value: string) => {
    if (!value) {
      setQrCodeUrl("")
      return
    }

    // Construct the URL that the QR code should point to
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const qrData = `${baseUrl}/assets/${value}`
    
    // Use a QR code API service (free tier available)
    // Alternative: Use qrcode.react library for client-side generation
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`
    setQrCodeUrl(qrApiUrl)
    
    onGenerate?.(qrData)
  }

  useEffect(() => {
    if (deviceId) {
      setQrValue(deviceId)
      generateQRCode(deviceId)
    }
  }, [deviceId])

  const handleGenerate = () => {
    if (!qrValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter a device ID or value",
        variant: "destructive",
      })
      return
    }
    generateQRCode(qrValue.trim())
  }

  const handleCopy = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const url = `${baseUrl}/assets/${qrValue}`
    
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "QR code URL copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleDownload = () => {
    if (!qrCodeUrl) return

    const link = document.createElement("a")
    link.href = qrCodeUrl
    link.download = `qr-code-${qrValue || "device"}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Downloaded",
      description: "QR code image downloaded",
    })
  }

  const handleOpenLink = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const url = `${baseUrl}/assets/${qrValue}`
    window.open(url, "_blank")
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Generator
          </CardTitle>
          <CardDescription>
            Generate a QR code for device access
            {deviceName && ` - ${deviceName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-input">Device ID or Value</Label>
            <div className="flex gap-2">
              <Input
                id="qr-input"
                value={qrValue}
                onChange={(e) => setQrValue(e.target.value)}
                placeholder="e.g., DEV-019"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGenerate()
                  }
                }}
              />
              <Button onClick={handleGenerate} disabled={!qrValue.trim()}>
                Generate
              </Button>
            </div>
          </div>

          {qrCodeUrl && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-lg border-2 border-dashed">
                <img
                  src={qrCodeUrl}
                  alt={`QR Code for ${qrValue}`}
                  className="w-64 h-64 object-contain"
                />
                <p className="mt-4 text-sm font-mono text-muted-foreground">
                  {typeof window !== "undefined" ? window.location.origin : ""}/assets/{qrValue}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy URL
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenLink}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Link
                </Button>
              </div>
            </div>
          )}

          {!qrCodeUrl && qrValue && (
            <div className="text-center py-8 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click Generate to create QR code</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Dialog version for modal display
export function QRCodeGeneratorDialog({
  open,
  onOpenChange,
  deviceId,
  deviceName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId?: string
  deviceName?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate QR Code</DialogTitle>
          <DialogDescription>
            Create a QR code for quick device access
          </DialogDescription>
        </DialogHeader>
        <QRCodeGenerator deviceId={deviceId} deviceName={deviceName} />
      </DialogContent>
    </Dialog>
  )
}
