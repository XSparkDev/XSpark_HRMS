"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, addDays, isWeekend, eachDayOfInterval } from "date-fns"
import { CalendarIcon, RocketIcon, Clock, User, FileText, CheckCircle2, AlertCircle } from "lucide-react"

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
import { useToast } from "@/hooks/use-toast"
import { AnimatePresence, motion } from "framer-motion"

import { 
  leaveRequestSchema, 
  LeaveRequestFormData, 
  calculateLeaveBalance, 
  calculateWorkingDays,
  getLeaveTypeDisplayName,
  validateLeaveRequest,
  checkLeaveEligibility
} from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth"

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
  const [employeeProfile, setEmployeeProfile] = useState<typeof mockEmployeeProfile | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
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
    // Load employee profile data
    const user = getCurrentUser()
    if (user) {
      // Mock data - replace with actual API call
      setEmployeeProfile(mockEmployeeProfile)
      
      // Auto-fill form with profile data
      setValue("employee_id", mockEmployeeProfile.id)
      setValue("full_name", `${mockEmployeeProfile.first_name} ${mockEmployeeProfile.middle_name} ${mockEmployeeProfile.last_name}`.trim())
      setValue("employee_number", mockEmployeeProfile.employee_id)
      setValue("id_number", mockEmployeeProfile.id_number)
      setValue("job_title", mockEmployeeProfile.job_title)
      setValue("department", mockEmployeeProfile.department)
      setValue("email", mockEmployeeProfile.email)
      setValue("direct_superior", mockEmployeeProfile.direct_superior)
    } else {
      router.replace("/login")
    }
  }, [router, setValue])

  useEffect(() => {
    if (leaveDayFrom && leaveDayTo) {
      const days = calculateWorkingDays(leaveDayFrom, leaveDayTo)
      setValue("total_days", days)
      trigger("total_days")
    } else {
      setValue("total_days", 0)
    }
  }, [leaveDayFrom, leaveDayTo, setValue, trigger])

  const getLeaveBalance = (type: string) => {
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
      if (data.total_days > currentBalance && data.leave_type !== "unpaid") {
        toast({
          title: "Leave Request Failed",
          description: `Insufficient leave balance for ${getLeaveTypeDisplayName(data.leave_type)}. Available: ${currentBalance} days.`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Set balance before/after
      setValue("leave_balance_before", currentBalance)
      setValue("leave_balance_after", currentBalance - data.total_days)

      // Submit to API
      const response = await fetch("/api/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to submit leave request.")
      }

      toast({
        title: "Leave Request Submitted",
        description: "Your leave request has been successfully submitted for approval.",
      })
      
      setShowConfirmation(true)
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!employeeProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (showConfirmation) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-navy mb-2">Leave Request Submitted!</h2>
              <p className="text-muted-foreground">
                Your leave request has been successfully submitted and is pending approval.
              </p>
            </div>
            <div className="space-y-4">
              <Button 
                onClick={() => router.push("/dashboard")} 
                className="w-full"
              >
                Return to Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push("/leave/history")} 
                className="w-full"
              >
                View My Leave History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date <span className="text-red-500">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < addDays(new Date(), -1)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="leave_day_to"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date <span className="text-red-500">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < (leaveDayFrom || addDays(new Date(), -1))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
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
              {leaveType !== "unpaid" && leaveDayFrom && leaveDayTo && (
                <AnimatePresence>
                  {form.watch("total_days") > getLeaveBalance(leaveType) && (
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
                        You are requesting {form.watch("total_days")} days but only have {getLeaveBalance(leaveType)} days available for {getLeaveTypeDisplayName(leaveType)}.
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
    </div>
  )
}
