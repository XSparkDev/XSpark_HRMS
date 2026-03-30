"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, addDays, isWeekend, eachDayOfInterval, isWithinInterval, startOfDay } from "date-fns"
import { CalendarIcon, RocketIcon, Clock, User, FileText, CheckCircle2, AlertCircle, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { AnimatePresence, motion } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { 
  leaveRequestSchema, 
  LeaveRequestFormData, 
  calculateLeaveBalance, 
  calculateWorkingDays,
  getLeaveTypeDisplayName,
  validateLeaveRequest,
  checkLeaveEligibility,
  getLeaveStatusInfo
} from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth"
import { isEmployeeFullyVerified } from "@/lib/employee-verification"

// Mock employee profile data - replace with actual API call
const mockEmployeeProfile = {
  id: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  first_name: "John",
  middle_name: "Michael",
  last_name: "Doe",
  employee_id: "XSP2501/001",
  id_number: "9001015000087",
  job_title: "Software Engineer",
  department: "Engineering",
  direct_superior: "Jane Smith",
  email: "john.doe@xspark.com",
  date_hired: new Date("2024-01-15"), // Required for leave calculations
  leave_balances: [
    { type: "annual", balance: 15 },
    { type: "sick", balance: 30 },
    { type: "family_responsibility", balance: 3 },
    { type: "maternity", balance: 120 },
    { type: "paternity", balance: 10 },
    { type: "unpaid", balance: 999 },
  ],
}

export default function LeaveRequestPage() {
  const router = useRouter()
  const { toast } = useToast()
  const user = getCurrentUser()
  const [employeeProfile, setEmployeeProfile] = useState<typeof mockEmployeeProfile | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<any[]>([])
  const [availableBalances, setAvailableBalances] = useState<Record<string, number>>({})
  const [blockedLeaveDates, setBlockedLeaveDates] = useState<Array<{ start: Date; end: Date }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // History tab state
  const [leaveHistory, setLeaveHistory] = useState<any[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("request")

  useEffect(() => {
    if (user?.role !== "employee") return

    const enforceVerificationAccess = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            headers.Authorization = `Bearer ${sessionParsed.access_token}`
          }
        }

        const res = await fetch("/api/auth/me", { headers })
        const json = await res.json().catch(() => ({}))
        const profile = json?.data?.employee
        if (!isEmployeeFullyVerified(profile)) {
          toast({
            title: "Verification required",
            description: "Complete your profile verification to access Leave Requests.",
            variant: "destructive",
          })
          router.replace("/dashboard")
        }
      } catch {
        router.replace("/dashboard")
      }
    }

    enforceVerificationAccess()
  }, [router, toast, user?.role])

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      employee_id: "",
      full_name: "",
      employee_number: "",
      id_number: "",
      job_title: "",
      direct_superior: "",
      leave_type: "annual",
      leave_type_other: "",
      reason: "",
      leave_day_from: undefined,
      leave_day_to: undefined,
      total_days: 0,
      leave_balance_before: undefined,
      leave_balance_after: undefined,
      supporting_document_url: "",
      employee_signature: "",
      employer_signature: "",
      status: "pending",
      rejection_reason: "",
      approver_comment: "",
      reviewed_by: undefined,
      reviewed_at: undefined,
      created_at: new Date(),
      updated_at: new Date(),
    },
  })

  const { watch, setValue, trigger, formState: { errors } } = form
  const leaveType = watch("leave_type")
  const leaveDayFrom = watch("leave_day_from")
  const leaveDayTo = watch("leave_day_to")

  useEffect(() => {
    // Fetch employee profile data from API
    const fetchEmployeeData = async () => {
      setIsLoading(true)
      try {
        // Get auth token from localStorage
        let authHeaders: Record<string, string> = {}
        const storedSession = localStorage.getItem('xspark_session')
        if (storedSession) {
          try {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
            }
          } catch {}
        }

        // Fetch employee data
        const response = await fetch('/api/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          }
        })

        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login")
            return
          }
          throw new Error('Failed to fetch employee data')
        }

        const json = await response.json()

        if (json.success && json.data?.employee) {
          const employee = json.data.employee
          
          // Extract job title from employee data (included via join in /api/auth/me)
          let jobTitle = ""
          if (employee.job_titles && Array.isArray(employee.job_titles) && employee.job_titles.length > 0) {
            jobTitle = employee.job_titles[0].title || ""
          } else if (employee.job_titles && typeof employee.job_titles === 'object' && employee.job_titles.title) {
            jobTitle = employee.job_titles.title || ""
          }

          // Build full name
          const fullName = [employee.first_name, employee.middle_name, employee.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()

          // Auto-fill form with employee data
          setValue("employee_id", employee.id)
          setValue("full_name", fullName)
          setValue("employee_number", employee.employee_id || "")
          setValue("id_number", employee.id_number || "")
          setValue("job_title", jobTitle)
          setValue("department", "") // Not available in current schema
          setValue("email", employee.email || "")
          setValue("direct_superior", "") // Not available in current schema

          const profile = {
            id: employee.id,
            first_name: employee.first_name,
            middle_name: employee.middle_name || "",
            last_name: employee.last_name,
            employee_id: employee.employee_id || "",
            id_number: employee.id_number || "",
            job_title: jobTitle,
            department: "",
            direct_superior: "",
            email: employee.email || "",
            date_hired: employee.date_hired ? new Date(employee.date_hired) : new Date(),
            leave_balances: [],
          }

          // Set employee profile
          setEmployeeProfile(profile)

          // Fetch live leave balances from Supabase-backed API
          try {
            const balancesRes = await fetch(`/api/leave/balances?employee_id=${employee.id}`)
            if (balancesRes.ok) {
              const balancesJson = await balancesRes.json()
              if (balancesJson?.success && Array.isArray(balancesJson.data)) {
                setLeaveBalances(balancesJson.data)
              }
            }
          } catch (balanceError) {
            console.error('Error fetching leave balances:', balanceError)
          }

          // Fetch available balances for all leave types
          const leaveTypes = ['annual', 'sick', 'family_responsibility', 'maternity', 'paternity', 'unpaid', 'other']
          const balancePromises = leaveTypes.map(async (leaveType) => {
            try {
              const res = await fetch(
                `/api/leave/requests/balances/available?employee_id=${employee.id}&leave_type=${leaveType}`
              )
              if (res.ok) {
                const json = await res.json()
                if (json.success && json.data?.available_balance !== undefined) {
                  return { leaveType, balance: json.data.available_balance }
                }
              }
            } catch (error) {
              console.error(`Error fetching available balance for ${leaveType}:`, error)
            }
            return { leaveType, balance: 0 }
          })

          const balanceResults = await Promise.all(balancePromises)
          const balancesMap: Record<string, number> = {}
          balanceResults.forEach(({ leaveType, balance }) => {
            balancesMap[leaveType] = balance
          })
          setAvailableBalances(balancesMap)

          // Fetch leave requests to block dates (pending and approved only, not rejected)
          try {
            const requestsRes = await fetch(`/api/leave/requests?employee_id=${employee.id}`, {
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders
              }
            })
            if (requestsRes.ok) {
              const requestsData = await requestsRes.json()
              if (requestsData?.success && Array.isArray(requestsData.data)) {
                // Filter for pending and approved requests only (exclude rejected/cancelled)
                const activeRequests = requestsData.data.filter((req: any) => 
                  req.status === 'pending' || req.status === 'approved'
                )
                
                // Extract date ranges
                const blockedRanges = activeRequests.map((req: any) => {
                  const startDate = req.start_date || req.leave_day_from
                  const endDate = req.end_date || req.leave_day_to
                  if (startDate && endDate) {
                    return {
                      start: startOfDay(new Date(startDate)),
                      end: startOfDay(new Date(endDate))
                    }
                  }
                  return null
                }).filter((range: any) => range !== null) as Array<{ start: Date; end: Date }>
                
                setBlockedLeaveDates(blockedRanges)
              }
            }
          } catch (error) {
            console.error('Error fetching leave requests for date blocking:', error)
          }
        } else {
          router.replace("/login")
        }
      } catch (error) {
        console.error('Error fetching employee data:', error)
        toast({
          title: "Error",
          description: "Failed to load employee data. Please try again.",
          variant: "destructive",
        })
        router.replace("/login")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployeeData()
  }, [router, setValue, toast])

  // Function to calculate working days using API (or fallback)
  const calculateTotalDays = async (startDate: Date, endDate: Date): Promise<number> => {
    try {
      // Format dates as YYYY-MM-DD strings
      const startStr = format(startDate, 'yyyy-MM-dd')
      const endStr = format(endDate, 'yyyy-MM-dd')

      // Try to calculate via API using the service's calculateWorkingDays
      // Since we can't call the service directly from client, we'll use a fallback
      // The API will recalculate anyway, so we use a simple calculation here
      // The actual calculation happens server-side in the API
      const days = calculateWorkingDays(startDate, endDate)
      return days
    } catch (error) {
      console.error('Error calculating working days:', error)
      // Fallback to simple date difference
      return calculateWorkingDays(startDate, endDate)
    }
  }

  useEffect(() => {
    if (leaveDayFrom && leaveDayTo) {
      // Calculate total days asynchronously
      calculateTotalDays(leaveDayFrom, leaveDayTo).then((days) => {
        setValue("total_days", days)
        trigger("total_days")
      })
    } else {
      setValue("total_days", 0)
    }
  }, [leaveDayFrom, leaveDayTo, setValue, trigger])

  const getLeaveBalance = (type: string) => {
    // Prefer available balance from API (most accurate - includes pending deductions)
    if (availableBalances[type] !== undefined) {
      return availableBalances[type]
    }

    // Fallback to live balances from API
    const apiBalance = leaveBalances.find((b) => b.leave_type === type)
    if (apiBalance && typeof apiBalance.balance === "number") {
      return apiBalance.balance
    }

    // Final fallback to local calculation (currently minimal)
    return calculateLeaveBalance(employeeProfile?.id || "", type, employeeProfile?.date_hired)
  }

  const getLeaveTypeOptions = () => [
    { value: "annual", label: "Annual Leave" },
    { value: "sick", label: "Sick Leave" },
    { value: "family_responsibility", label: "Family Responsibility Leave" },
    { value: "maternity", label: "Maternity Leave" },
    { value: "paternity", label: "Paternity Leave" },
    { value: "unpaid", label: "Unpaid Leave" },
    { value: "other", label: "Other" },
  ]

  async function onSubmit(data: LeaveRequestFormData) {
    setIsSubmitting(true)
    
    try {
      // Validate required fields
      if (!employeeProfile?.id) {
        throw new Error("Employee information not loaded. Please refresh the page.")
      }

      if (!data.leave_day_from || !data.leave_day_to) {
        throw new Error("Please select both start and end dates.")
      }

      // Calculate total days if not already set
      let totalDays = data.total_days ?? 0
      if (totalDays === 0 && data.leave_day_from && data.leave_day_to) {
        totalDays = await calculateTotalDays(data.leave_day_from, data.leave_day_to)
      }

      // Check leave eligibility
      const eligibility = checkLeaveEligibility(data.leave_type, employeeProfile?.date_hired)
      if (!eligibility.eligible) {
        toast({
          title: "Leave Request Failed",
          description: eligibility.reason || "You are not eligible for this leave type.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Validate leave balance
      const currentBalance = getLeaveBalance(data.leave_type)
      if (totalDays > currentBalance && data.leave_type !== "unpaid") {
        toast({
          title: "Leave Request Failed",
          description: `Insufficient leave balance for ${getLeaveTypeDisplayName(data.leave_type)}. Available: ${currentBalance} days.`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Format dates as YYYY-MM-DD strings
      const startDate = format(data.leave_day_from!, 'yyyy-MM-dd')
      const endDate = format(data.leave_day_to!, 'yyyy-MM-dd')

      // Prepare payload for API
      const payload = {
        employee_id: employeeProfile.id, // Current user's employee UUID
        leave_type: data.leave_type, // Key from leave_types table
        start_date: startDate, // YYYY-MM-DD format
        end_date: endDate, // YYYY-MM-DD format
        total_days: totalDays, // Calculated working days
        reason: data.reason || undefined,
        document_url: data.supporting_document_url || undefined,
        document_required: false, // Can be enhanced later
        submitted_by: employeeProfile.id, // Current user's employee UUID
      }

      // Get auth token from localStorage
      let authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const storedSession = localStorage.getItem('xspark_session')
      if (storedSession) {
        try {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        } catch {}
      }

      // Submit to API
      const response = await fetch("/api/leave/requests", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || "Failed to submit leave request.")
      }

      const responseData = await response.json()

      toast({
        title: "Leave Request Submitted",
        description: responseData.message || "Your leave request has been successfully submitted for approval.",
      })
      
      setShowConfirmation(true)
      
      // Refresh history after successful submission
      if (employeeProfile?.id) {
        fetchLeaveHistory(employeeProfile.id)
      }
      
    } catch (error: any) {
      console.error('Error submitting leave request:', error)
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch leave history
  const fetchLeaveHistory = async (employeeId: string) => {
    try {
      setIsHistoryLoading(true)
      
      // Get auth token from localStorage
      let authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const storedSession = localStorage.getItem('xspark_session')
      if (storedSession) {
        try {
          const sessionParsed = JSON.parse(storedSession)
          if (sessionParsed?.access_token) {
            authHeaders['Authorization'] = `Bearer ${sessionParsed.access_token}`
          }
        } catch {}
      }

      // Fetch all leave requests for this employee
      const response = await fetch(`/api/leave/requests?employee_id=${employeeId}&limit=100`, {
        headers: authHeaders,
      })

      if (!response.ok) {
        throw new Error('Failed to fetch leave requests')
      }

      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        // Map API response
        const mappedRequests = json.data.map((request: any) => {
          const leaveType = request.leave_types || request.leave_type || (Array.isArray(request.leave_types) ? request.leave_types[0] : null)
          const leaveTypeKey = leaveType?.key || 'unknown'
          
          return {
            ...request,
            leave_type: leaveTypeKey,
            leave_types: leaveType,
          }
        })
        
        // Sort by created_at descending (newest first)
        mappedRequests.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || a.submitted_at || 0).getTime()
          const dateB = new Date(b.created_at || b.submitted_at || 0).getTime()
          return dateB - dateA
        })
        
        setLeaveHistory(mappedRequests)
      } else {
        setLeaveHistory([])
      }
    } catch (error) {
      console.error('Error fetching leave history:', error)
      setLeaveHistory([])
    } finally {
      setIsHistoryLoading(false)
    }
  }

  // Fetch history when employee profile is loaded
  useEffect(() => {
    if (employeeProfile?.id) {
      fetchLeaveHistory(employeeProfile.id)
    }
  }, [employeeProfile?.id])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  if (isLoading || !employeeProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">
            Submit new leave requests and view your leave history
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="request">New Request</TabsTrigger>
          <TabsTrigger value="history">Leave History</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-navy flex items-center gap-2">
                <RocketIcon className="h-6 w-6" />
                Leave Request Form
              </CardTitle>
            </CardHeader>
            <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Profile Information (Read-only) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Your Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employee_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="job_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="direct_superior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direct Superior</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Leave Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Leave Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leave_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leave Type <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select leave type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getLeaveTypeOptions().map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <AnimatePresence>
                    {leaveType === "other" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <FormField
                          control={form.control}
                          name="leave_type_other"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Specify Leave Type <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Study Leave" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Reason for Leave <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Briefly describe your reason for leave" 
                            rows={3} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="leave_day_from"
                    render={({ field }) => (
                      <FormItem className="flex flex-col md:col-span-2">
                        <FormLabel>Leave Dates <span className="text-red-500">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !(leaveDayFrom && leaveDayTo) && "text-muted-foreground"
                                )}
                              >
                                {leaveDayFrom && leaveDayTo ? (
                                  `${format(leaveDayFrom, "PPP")} - ${format(leaveDayTo, "PPP")}`
                                ) : (
                                  <span>Select date range</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={{
                                from: leaveDayFrom ?? undefined,
                                to: leaveDayTo ?? undefined,
                              }}
                              defaultMonth={leaveDayFrom ?? undefined}
                              onSelect={(range) => {
                                const fromDate = range?.from
                                const toDate = range?.to
                                field.onChange(fromDate)
                                setValue("leave_day_to", toDate ?? undefined, { shouldValidate: true })
                                trigger(["leave_day_from", "leave_day_to"])
                              }}
                              disabled={(date) => {
                                // Disable past dates
                                if (date < addDays(new Date(), -1)) return true
                                
                                // Disable dates that are in blocked leave request ranges
                                const dateToCheck = startOfDay(date)
                                return blockedLeaveDates.some(range => 
                                  isWithinInterval(dateToCheck, { start: range.start, end: range.end })
                                )
                              }}
                              modifiers={{
                                blocked: (date) => {
                                  const dateToCheck = startOfDay(date)
                                  return blockedLeaveDates.some(range => 
                                    isWithinInterval(dateToCheck, { start: range.start, end: range.end })
                                  )
                                }
                              }}
                              modifiersClassNames={{
                                blocked: "bg-red-100 text-red-600 hover:bg-red-200 cursor-not-allowed opacity-60"
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                        {errors.leave_day_to && (
                          <p className="text-sm font-medium text-destructive mt-1">
                            {errors.leave_day_to.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="total_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Days (Working Days)</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex flex-col space-y-1.5">
                    <Label>Available Balance ({getLeaveTypeDisplayName(leaveType)})</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={getLeaveBalance(leaveType)}
                        readOnly
                        className="bg-gray-100"
                      />
                      <Badge variant={getLeaveBalance(leaveType) > 0 ? "default" : "destructive"}>
                        {getLeaveBalance(leaveType) > 0 ? "Available" : "No Balance"}
                      </Badge>
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="supporting_document_url"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Supporting Document (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                // In a real app, upload file to S3 and get URL
                                field.onChange("https://example.com/document.pdf")
                              } else {
                                field.onChange("")
                              }
                            }}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Upload supporting documents (JPG, PNG, PDF up to 10MB)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Leave Eligibility Warning */}
              <AnimatePresence>
                {leaveType && (() => {
                  const eligibility = checkLeaveEligibility(leaveType, employeeProfile?.date_hired)
                  return !eligibility.eligible && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Leave Eligibility Issue</span>
                      </div>
                      <p className="text-yellow-700 mt-1">
                        {eligibility.reason}
                      </p>
                    </motion.div>
                  )
                })()}
              </AnimatePresence>

              {/* Leave Balance Warning */}
              {leaveType && leaveType !== "unpaid" && leaveDayFrom && leaveDayTo && (
                <AnimatePresence>
                  {((form.watch("total_days") ?? 0) > getLeaveBalance(leaveType)) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="bg-red-50 border border-red-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Insufficient Leave Balance</span>
                      </div>
                      <p className="text-red-700 mt-1">
                        You are requesting {form.watch("total_days") ?? 0} days but only have {getLeaveBalance(leaveType)} days available for {getLeaveTypeDisplayName(leaveType)}.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Signatures Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Digital Signatures
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employee_signature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Signature</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                field.onChange("signature_uploaded")
                              } else {
                                field.onChange("")
                              }
                            }}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Upload your digital signature (PNG, JPG)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex flex-col space-y-1.5">
                    <Label>Employer Signature</Label>
                    <Input 
                      placeholder="Will be filled by HR/Admin" 
                      readOnly 
                      className="bg-gray-100" 
                    />
                    <p className="text-sm text-muted-foreground">
                      This will be completed during the approval process
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-6">
                <Button 
                  type="submit" 
                  className="px-8"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <RocketIcon className="h-4 w-4 mr-2" />
                      Submit Leave Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Confirmation Popup */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Leave Request Submitted!</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-muted-foreground">
              Your leave request has been successfully submitted and is pending approval.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => {
                  setShowConfirmation(false)
                  router.push("/dashboard")
                }}
              >
                Return to Dashboard
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowConfirmation(false)
                  setActiveTab("history")
                }}
              >
                View My Leave History
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {/* Leave Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">Approved</span>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {leaveHistory.filter(req => req.status === "approved").length}
                </div>
                <p className="text-sm text-muted-foreground">Total approved requests</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold">Pending</span>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {leaveHistory.filter(req => req.status === "pending").length}
                </div>
                <p className="text-sm text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-semibold">Rejected</span>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {leaveHistory.filter(req => req.status === "rejected").length}
                </div>
                <p className="text-sm text-muted-foreground">Total rejected requests</p>
              </CardContent>
            </Card>
          </div>

          {/* Leave History Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Leave Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : leaveHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    No Leave Requests Found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't submitted any leave requests yet.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveHistory.map((request) => {
                      const statusInfo = getLeaveStatusInfo(request.status)
                      return (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {getLeaveTypeDisplayName(request.leave_type)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.reason || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <CalendarIcon className="h-4 w-4" />
                              {format(new Date(request.start_date), "MMM dd")} - {format(new Date(request.end_date), "MMM dd, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {request.total_days} day{request.total_days !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(request.status)}
                              <Badge variant={statusInfo.variant}>
                                {statusInfo.name}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(request.created_at || request.submitted_at || ''), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request)
                                setIsDetailsDialogOpen(true)
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Leave Request Details Dialog */}
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Leave Request Details</DialogTitle>
              </DialogHeader>
              {selectedRequest && (
                <ScrollArea className="max-h-[70vh]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Leave Type</Label>
                        <p className="text-sm">{getLeaveTypeDisplayName(selectedRequest.leave_type || 'unknown')}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(selectedRequest.status)}
                          <Badge variant={getLeaveStatusInfo(selectedRequest.status).variant}>
                            {getLeaveStatusInfo(selectedRequest.status).name}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                        <p className="text-sm">{format(new Date(selectedRequest.start_date), "PPP")}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                        <p className="text-sm">{format(new Date(selectedRequest.end_date), "PPP")}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                        <p className="text-sm">{selectedRequest.total_days} day{selectedRequest.total_days !== 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Submitted</Label>
                        <p className="text-sm">{format(new Date(selectedRequest.created_at || selectedRequest.submitted_at || ''), "PPP 'at' p")}</p>
                      </div>
                      {selectedRequest.reviewed_at && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Reviewed</Label>
                          <p className="text-sm">{format(new Date(selectedRequest.reviewed_at), "PPP 'at' p")}</p>
                        </div>
                      )}
                    </div>
                    
                    {selectedRequest.reason && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground mb-2">Reason for Leave</Label>
                        <p className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.reason}</p>
                      </div>
                    )}
                    
                    {selectedRequest.review_notes && selectedRequest.status === 'approved' && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground mb-2">Approver Comment</Label>
                        <p className="text-sm bg-blue-50 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.review_notes}</p>
                      </div>
                    )}
                    
                    {selectedRequest.review_notes && selectedRequest.status === 'rejected' && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground mb-2">Rejection Reason</Label>
                        <p className="text-sm bg-red-50 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.review_notes}</p>
                      </div>
                    )}
                    
                    {selectedRequest.document_url && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground mb-2">Supporting Document</Label>
                        <p className="text-sm">
                          <a 
                            href={selectedRequest.document_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline"
                          >
                            View Document
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}