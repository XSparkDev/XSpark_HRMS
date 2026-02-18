"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, RefreshCw, Loader2, Users, CheckCircle2, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type Employee = {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  department?: string | null
  job_title?: string | null
  employment_status?: string | null
  phone_number?: string | null
}

type TechnicianAvailability = {
  employee: Employee
  activeRequests: number
  isAvailable: boolean
}

interface AvailableTechniciansDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AvailableTechniciansDialog({ open, onOpenChange }: AvailableTechniciansDialogProps) {
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<TechnicianAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchTechnicians = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all active employees
      const employeesResponse = await fetch(`/api/employees?limit=500&is_active=true`, {
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      })
      
      const employeesJson = await employeesResponse.json()
      
      if (!employeesResponse.ok || !employeesJson.success) {
        throw new Error(employeesJson.error || "Failed to fetch employees")
      }
      
      const employees: Employee[] = employeesJson.data || []
      
      // Fetch active maintenance requests to check assignments
      const [inProgressResponse, submittedResponse] = await Promise.all([
        fetch(`/api/maintenance-requests?limit=500&status=in_progress`, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),
        fetch(`/api/maintenance-requests?limit=500&status=submitted`, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),
      ])
      
      const inProgressJson = await inProgressResponse.json()
      const submittedJson = await submittedResponse.json()
      
      const inProgressRequests = inProgressResponse.ok && inProgressJson.success ? (inProgressJson.data || []) : []
      const submittedRequests = submittedResponse.ok && submittedJson.success ? (submittedJson.data || []) : []
      
      // Count active requests per technician
      const requestCounts = new Map<string, number>()
      
      // Combine all active requests
      const allActiveRequests = inProgressRequests.concat(submittedRequests)
      
      allActiveRequests.forEach((request: any) => {
        if (request.assigned_to) {
          const count = requestCounts.get(request.assigned_to) || 0
          requestCounts.set(request.assigned_to, count + 1)
        }
      })
      
      // Map employees to technician availability
      const techniciansData: TechnicianAvailability[] = employees.map((employee) => {
        const activeRequests = requestCounts.get(employee.id) || 0
        return {
          employee,
          activeRequests,
          isAvailable: activeRequests < 5, // Consider available if less than 5 active requests
        }
      })
      
      // Sort by availability (available first), then by name
      techniciansData.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1
        }
        const nameA = `${a.employee.first_name} ${a.employee.last_name}`.toLowerCase()
        const nameB = `${b.employee.first_name} ${b.employee.last_name}`.toLowerCase()
        return nameA.localeCompare(nameB)
      })
      
      setTechnicians(techniciansData)
    } catch (error) {
      console.error("Failed to fetch technicians:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch available technicians",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) {
      fetchTechnicians()
    }
  }, [open, fetchTechnicians])

  const filteredTechnicians = useMemo(() => {
    if (!searchTerm) return technicians
    
    const searchLower = searchTerm.toLowerCase()
    return technicians.filter((tech) => {
      const fullName = `${tech.employee.first_name} ${tech.employee.last_name}`.toLowerCase()
      const email = tech.employee.email?.toLowerCase() || ""
      const department = tech.employee.department?.toLowerCase() || ""
      const jobTitle = tech.employee.job_title?.toLowerCase() || ""
      const employeeId = tech.employee.employee_id?.toLowerCase() || ""
      
      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        department.includes(searchLower) ||
        jobTitle.includes(searchLower) ||
        employeeId.includes(searchLower)
      )
    })
  }, [technicians, searchTerm])

  const availableCount = filteredTechnicians.filter((t) => t.isAvailable).length
  const busyCount = filteredTechnicians.filter((t) => !t.isAvailable).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Available Technicians
          </DialogTitle>
          <DialogDescription>
            View all technicians and their current workload
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{filteredTechnicians.length}</div>
                <div className="text-sm text-muted-foreground">Total Technicians</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-emerald-600">{availableCount}</div>
                <div className="text-sm text-muted-foreground">Available</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{busyCount}</div>
                <div className="text-sm text-muted-foreground">Busy</div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Refresh */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name, email, department, or employee ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={fetchTechnicians}
                  disabled={loading}
                  className="w-full md:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTechnicians.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  {searchTerm ? "No technicians found matching your search." : "No technicians available."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Active Requests</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTechnicians.map((tech) => (
                      <TableRow key={tech.employee.id}>
                        <TableCell className="font-mono text-xs">
                          {tech.employee.employee_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tech.employee.first_name} {tech.employee.last_name}
                        </TableCell>
                        <TableCell className="text-sm">{tech.employee.email}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {tech.employee.department || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {tech.employee.job_title || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tech.activeRequests}</span>
                            {tech.activeRequests > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {tech.activeRequests === 1 ? "request" : "requests"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tech.isAvailable ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Busy
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Summary */}
          {!loading && filteredTechnicians.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Showing {filteredTechnicians.length} of {technicians.length} technicians
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
