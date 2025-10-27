"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, CheckCircle2, Clock, Package, ArrowRight, QrCode, Camera, Upload, X } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function PendingApprovalsPage() {
  const user = getCurrentUser()

  if (!user) return null

  const [pendingBorrowRequests, setPendingBorrowRequests] = useState([])
  const [pendingReturnRequests, setPendingReturnRequests] = useState([])
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [scanningRequest, setScanningRequest] = useState(null)
  const [scanType, setScanType] = useState('') // 'borrow' or 'return'
  const [scanData, setScanData] = useState({
    qrCode: '',
    deviceCondition: '',
    remarks: '',
    inspectionPhoto: null
  })

  // Load pending requests from localStorage (in real app, this would come from API)
  useEffect(() => {
    const borrowRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]')
    const returnRequests = JSON.parse(localStorage.getItem('returnRequests') || '[]')
    
    setPendingBorrowRequests(borrowRequests.filter(req => req.status === "Pending Approval"))
    setPendingReturnRequests(returnRequests.filter(req => req.status === "Pending Return Approval"))
  }, [])

  const handleScanDevice = (request, type) => {
    setScanningRequest(request)
    setScanType(type)
    setScanData({
      qrCode: '',
      deviceCondition: '',
      remarks: '',
      inspectionPhoto: null
    })
    setShowScanDialog(true)
  }

  const handleScanSubmit = async () => {
    if (!scanData.qrCode || !scanData.deviceCondition) {
      alert('Please scan QR code and select device condition')
      return
    }

    if (scanType === 'borrow') {
      await handleApproveBorrow(scanningRequest.id)
    } else {
      await handleApproveReturn(scanningRequest.id)
    }

    setShowScanDialog(false)
    setScanningRequest(null)
    setScanData({
      qrCode: '',
      deviceCondition: '',
      remarks: '',
      inspectionPhoto: null
    })
  }

  const handleApproveBorrow = async (requestId) => {
    const existingRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]')
    const updatedRequests = existingRequests.map(req => 
      req.id === requestId 
        ? { 
            ...req, 
            status: "Borrowed", 
            approvedAt: new Date().toISOString(),
            scannedQrCode: scanData.qrCode,
            deviceConditionOnBorrow: scanData.deviceCondition,
            supervisorRemarks: scanData.remarks,
            inspectionPhoto: scanData.inspectionPhoto?.name || null
          }
        : req
    )
    localStorage.setItem('borrowRequests', JSON.stringify(updatedRequests))
    
    // Refresh the list
    setPendingBorrowRequests(updatedRequests.filter(req => req.status === "Pending Approval"))
    
    alert("Borrow request approved and device scanned successfully!")
  }

  const handleApproveReturn = async (requestId) => {
    const existingReturns = JSON.parse(localStorage.getItem('returnRequests') || '[]')
    const existingBorrows = JSON.parse(localStorage.getItem('borrowRequests') || '[]')
    
    // Determine final status based on device condition
    const finalStatus = scanData.deviceCondition === 'Damaged' ? 'Under Maintenance' : 'Returned'
    
    // Update return request
    const updatedReturns = existingReturns.map(req => 
      req.id === requestId 
        ? { 
            ...req, 
            status: finalStatus, 
            approvedAt: new Date().toISOString(),
            scannedQrCode: scanData.qrCode,
            deviceConditionOnReturn: scanData.deviceCondition,
            supervisorRemarks: scanData.remarks,
            inspectionPhoto: scanData.inspectionPhoto?.name || null
          }
        : req
    )
    localStorage.setItem('returnRequests', JSON.stringify(updatedReturns))
    
    // Update original borrow request
    const returnRequest = existingReturns.find(req => req.id === requestId)
    const updatedBorrows = existingBorrows.map(req => 
      req.id === returnRequest.borrowRequestId 
        ? { 
            ...req, 
            status: finalStatus, 
            returnedAt: new Date().toISOString(),
            finalDeviceCondition: scanData.deviceCondition
          }
        : req
    )
    localStorage.setItem('borrowRequests', JSON.stringify(updatedBorrows))
    
    // Refresh the list
    setPendingReturnRequests(updatedReturns.filter(req => req.status === "Pending Return Approval"))
    
    alert(`Return request approved and device scanned successfully!\nStatus: ${finalStatus}`)
  }

  const handleRejectRequest = (requestId, type) => {
    if (type === 'borrow') {
      const existingRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]')
      const updatedRequests = existingRequests.map(req => 
        req.id === requestId 
          ? { ...req, status: "Rejected", rejectedAt: new Date().toISOString() }
          : req
      )
      localStorage.setItem('borrowRequests', JSON.stringify(updatedRequests))
      setPendingBorrowRequests(updatedRequests.filter(req => req.status === "Pending Approval"))
    } else {
      const existingReturns = JSON.parse(localStorage.getItem('returnRequests') || '[]')
      const updatedReturns = existingReturns.map(req => 
        req.id === requestId 
          ? { ...req, status: "Rejected", rejectedAt: new Date().toISOString() }
          : req
      )
      localStorage.setItem('returnRequests', JSON.stringify(updatedReturns))
      setPendingReturnRequests(updatedReturns.filter(req => req.status === "Pending Return Approval"))
    }
    
    alert("Request rejected successfully!")
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      setScanData({
        ...scanData,
        inspectionPhoto: file
      })
    }
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/ams-dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AMS Dashboard
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Device Approvals & Scanning</h1>
          <p className="text-muted-foreground mt-2">
            Review, approve, and scan device borrow and return requests
          </p>
        </div>

        {/* Pending Borrow Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pending Borrow Requests
            </CardTitle>
            <CardDescription>Device borrowing requests awaiting your approval and scanning</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingBorrowRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Borrow Date</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingBorrowRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{request.employeeId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{request.deviceName}</TableCell>
                      <TableCell>{request.assetTag}</TableCell>
                      <TableCell>{request.borrowDate}</TableCell>
                      <TableCell className="max-w-xs truncate">{request.purpose}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{request.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="gradient-primary text-white"
                            onClick={() => handleScanDevice(request, 'borrow')}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Scan & Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleRejectRequest(request.id, 'borrow')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-muted-foreground">No pending borrow requests</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Return Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Pending Return Requests
            </CardTitle>
            <CardDescription>Device return requests awaiting your confirmation and scanning</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingReturnRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Return Date</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReturnRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{request.employeeId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{request.deviceName}</TableCell>
                      <TableCell>{request.assetTag}</TableCell>
                      <TableCell>{request.returnDate}</TableCell>
                      <TableCell>
                        <Badge variant={
                          request.deviceCondition === 'Excellent' ? 'default' :
                          request.deviceCondition === 'Good' ? 'secondary' :
                          request.deviceCondition === 'Damaged' ? 'destructive' : 'outline'
                        }>
                          {request.deviceCondition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{request.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="gradient-primary text-white"
                            onClick={() => handleScanDevice(request, 'return')}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Scan & Confirm
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleRejectRequest(request.id, 'return')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-muted-foreground">No pending return requests</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scanning Dialog */}
        <AlertDialog open={showScanDialog} onOpenChange={setShowScanDialog}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Scan Device & Approve Request
              </AlertDialogTitle>
              <AlertDialogDescription>
                Scan the device QR code and confirm its condition to approve this {scanType} request.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4">
              {/* Request Info */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Request Details:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Employee:</strong> {scanningRequest?.employeeName}</div>
                  <div><strong>Device:</strong> {scanningRequest?.deviceName}</div>
                  <div><strong>Asset Tag:</strong> {scanningRequest?.assetTag}</div>
                  <div><strong>Date:</strong> {scanningRequest?.borrowDate || scanningRequest?.returnDate}</div>
                </div>
              </div>

              {/* QR Code Scan */}
              <div className="space-y-2">
                <Label htmlFor="qrCode">Scan QR Code / Barcode *</Label>
                <Input
                  id="qrCode"
                  placeholder="Scan or enter QR code/barcode"
                  value={scanData.qrCode}
                  onChange={(e) => setScanData({ ...scanData, qrCode: e.target.value })}
                />
              </div>

              {/* Device Condition */}
              <div className="space-y-2">
                <Label htmlFor="deviceCondition">Device Condition *</Label>
                <Select 
                  value={scanData.deviceCondition} 
                  onValueChange={(value) => setScanData({ ...scanData, deviceCondition: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Excellent">Excellent</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                    <SelectItem value="Damaged">Damaged</SelectItem>
                    <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label htmlFor="remarks">Supervisor Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Additional notes about the device condition..."
                  value={scanData.remarks}
                  onChange={(e) => setScanData({ ...scanData, remarks: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Inspection Photo */}
              <div className="space-y-2">
                <Label htmlFor="inspectionPhoto">Inspection Photo (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="inspectionPhoto"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </div>
                {scanData.inspectionPhoto && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {scanData.inspectionPhoto.name}
                  </p>
                )}
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleScanSubmit}
                disabled={!scanData.qrCode || !scanData.deviceCondition}
              >
                <QrCode className="h-4 w-4 mr-1" />
                Scan & {scanType === 'borrow' ? 'Approve' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AMSDashboardLayout>
  )
}