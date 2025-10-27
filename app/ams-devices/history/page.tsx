"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, Download, Calendar, Package, Clock, CheckCircle2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function DeviceHistoryPage() {
  const user = getCurrentUser()
  const [deviceHistory, setDeviceHistory] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  if (!user) return null

  // Mock HRMS data - in real implementation, this would come from HRMS API
  const employeeDetails = {
    name: user.name,
    employeeId: `XSP/23/10/003`, // Format: XSP/YY/MM/NNN
    department: "Engineering",
    position: user.role === "employee" ? "Software Developer" : "Senior Developer",
    supervisorName: "John Smith",
    contactEmail: user.email,
    phone: "+27 12 345 6789"
  }


  // Load device history from localStorage (in real app, this would come from API)
  useEffect(() => {
    const borrowRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]')
    const returnRequests = JSON.parse(localStorage.getItem('returnRequests') || '[]')
    
    // Filter to only show history for the current user
    const userBorrowRequests = borrowRequests.filter(req => req.employeeId === employeeDetails.employeeId)
    const userReturnRequests = returnRequests.filter(req => req.employeeId === employeeDetails.employeeId)
    
    // Create a map of return requests by borrow request ID for quick lookup
    const returnMap = new Map()
    userReturnRequests.forEach(returnReq => {
      returnMap.set(returnReq.borrowRequestId, returnReq)
    })
    
    // Combine borrow and return data
    const allHistory = userBorrowRequests.map(borrowReq => {
      const returnReq = returnMap.get(borrowReq.id)
      const today = new Date()
      const returnDate = returnReq ? new Date(returnReq.returnDate) : null
      const expectedReturnDate = new Date(borrowReq.returnDate)
      
      // Determine if overdue
      let isOverdue = false
      let isPending = false
      
      if (borrowReq.status === "Borrowed" && !returnReq) {
        if (today > expectedReturnDate) {
          isOverdue = true
        } else {
          isPending = true
        }
      }
      
      return {
        id: borrowReq.id,
        borrowDate: borrowReq.borrowDate,
        returnDate: returnReq ? returnReq.returnDate : null,
        deviceType: borrowReq.deviceType,
        deviceName: borrowReq.deviceName,
        serialNumber: borrowReq.serialNumber || borrowReq.assetTag,
        notes: borrowReq.purpose,
        status: borrowReq.status,
        isOverdue,
        isPending,
        expectedReturnDate: borrowReq.returnDate
      }
    }).sort((a, b) => new Date(b.borrowDate) - new Date(a.borrowDate)) // Sort by borrow date, newest first

    setDeviceHistory(allHistory)
  }, [])



  const exportToCSV = () => {
    const csvContent = [
      ["Borrow Date", "Return Date", "Device Type", "Device Name", "Serial Number", "Notes"],
      ...deviceHistory.map(item => [
        new Date(item.borrowDate).toLocaleDateString(),
        item.returnDate ? new Date(item.returnDate).toLocaleDateString() : "Not returned",
        item.deviceType,
        item.deviceName,
        item.serialNumber,
        item.notes
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `my-device-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusBadge = (item) => {
    if (item.returnDate) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Returned</Badge>
    } else if (item.isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>
    } else if (item.isPending) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Return</Badge>
    } else {
      return <Badge variant="outline">Active</Badge>
    }
  }

  const getRowClassName = (item) => {
    if (item.isOverdue) {
      return "bg-red-50 border-l-4 border-l-red-500"
    } else if (item.isPending) {
      return "bg-yellow-50 border-l-4 border-l-yellow-500"
    }
    return ""
  }

  // Pagination
  const totalPages = Math.ceil(deviceHistory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentHistory = deviceHistory.slice(startIndex, endIndex)

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/ams-devices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Device Management
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-navy mb-2">Device History</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            View all devices you have borrowed, along with dates and notes.
          </p>
        </div>


        {/* Device History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Borrowing History
            </CardTitle>
            <CardDescription>Your personal device borrowing history</CardDescription>
          </CardHeader>
          <CardContent>
            {currentHistory.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrow Date</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Device Type</TableHead>
                        <TableHead>Device Name</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentHistory.map((item) => (
                        <TableRow key={item.id} className={getRowClassName(item)}>
                          <TableCell>{new Date(item.borrowDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {item.returnDate ? (
                              <span className="text-green-600 font-medium">
                                {new Date(item.returnDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Not returned</span>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{item.deviceType}</TableCell>
                          <TableCell className="font-medium">{item.deviceName}</TableCell>
                          <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.notes}</TableCell>
                          <TableCell>{getStatusBadge(item)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {startIndex + 1} to {Math.min(endIndex, deviceHistory.length)} of {deviceHistory.length} entries
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-navy mb-2">No History Found</h3>
                <p className="text-muted-foreground mb-4">
                  {deviceHistory.length === 0 
                    ? "You haven't borrowed any devices yet."
                    : "No records match your current filters."
                  }
                </p>
                {deviceHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Your borrowing history will appear here when you borrow devices from the company.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}