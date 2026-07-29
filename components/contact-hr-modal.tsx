"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Upload, X } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

interface FileAttachment {
  file: File
  preview: string
}

interface ContactHrModalProps {
  open: boolean
  onClose: () => void
}

const subcategories = {
  leave: ["Request Approval", "Balance Inquiry", "Policy Clarification", "Maternity/Paternity", "Sick Leave", "Other"],
  payroll: ["Payslip Issue", "Salary Error", "Direct Deposit Change", "Tax Query", "Bonus Inquiry", "Other"],
  benefits: ["Medical Aid", "Insurance", "Retirement Fund", "Other Benefits"],
  compliance: ["Policy Violation", "Code of Conduct", "Regulatory Query", "Other"],
  other: []
}

export function ContactHrModal({ open, onClose }: ContactHrModalProps) {
  const { toast } = useToast()
  const [category, setCategory] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [contactMethod, setContactMethod] = useState("email")
  const [confidential, setConfidential] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const user = getCurrentUser()
  const [employeeUuid, setEmployeeUuid] = useState<string | null>(null)

  // hr_tickets.employee_id references employees.id, not the auth user id -
  // resolve the real employee UUID via /api/auth/me (same pattern as my-hr-cases.tsx).
  useEffect(() => {
    if (!open || !user?.id) return

    const fetchEmployeeUuid = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const storedSession = localStorage.getItem("xspark_session")
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch {}

        const res = await fetch("/api/auth/me", { headers })
        const json = await res.json()
        if (res.ok && json.success && json.data?.employee?.id) {
          setEmployeeUuid(json.data.employee.id)
        }
      } catch (error) {
        console.warn("[ContactHrModal] Failed to fetch employee UUID:", error)
      }
    }

    fetchEmployeeUuid()
  }, [open, user?.id])

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!category) {
      newErrors.category = "Category is required"
    }
    if (!subject || subject.length < 5) {
      newErrors.subject = "Subject must be at least 5 characters"
    }
    if (!description || description.length < 20) {
      newErrors.description = "Description must be at least 20 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const files = Array.from(e.target.files)
    
    // Validate file count
    if (attachments.length + files.length > 5) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: "Maximum 5 files allowed"
      })
      return
    }

    // Validate file size and type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png']
    const maxSize = 10 * 1024 * 1024 // 10MB

    files.forEach(file => {
      if (file.size > maxSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`
        })
        return
      }

      if (!validTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: `${file.name} is not a valid file type`
        })
        return
      }

      const preview = URL.createObjectURL(file)
      setAttachments(prev => [...prev, { file, preview }])
    })
  }

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = prev.filter((_, i) => i !== index)
      prev[index].preview && URL.revokeObjectURL(prev[index].preview)
      return newAttachments
    })
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation failed",
        description: "Please fill in all required fields correctly"
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Prepare attachments for upload
      const attachmentData: Array<{ url: string; filename: string; mimetype: string; size: number }> = []
      
      // In a real implementation, you would upload files to S3/storage first
      // For now, we'll just store file metadata
      attachments.forEach(att => {
        attachmentData.push({
          url: att.preview, // Placeholder - in production this would be S3 URL
          filename: att.file.name,
          mimetype: att.file.type,
          size: att.file.size
        })
      })

      const ticketData = {
        employee_id: employeeUuid || user?.id || 'anonymous',
        name: user?.name || 'Unknown User',
        department: 'Engineering', // Get from user profile
        category,
        subcategory: subcategory || null,
        subject,
        description,
        attachments: attachmentData,
        contact_method: contactMethod,
        confidential,
        preferred_datetime: null
      }

      const response = await fetch('/api/hr-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketData),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Request submitted successfully",
          description: `Case ID: ${result.ticket.id}. We'll respond within ${result.ticket.estimated_sla}.`,
        })

        // Clear form
        setCategory("")
        setSubcategory("")
        setSubject("")
        setDescription("")
        setContactMethod("email")
        setConfidential(false)
        setAttachments([])
        setErrors({})

        // Close modal
        onClose()
      } else {
        throw new Error(result.error || 'Failed to submit request')
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error instanceof Error ? error.message : 'An error occurred. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Clean up preview URLs
  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.preview) URL.revokeObjectURL(att.preview)
      })
    }
  }, [])

  const selectedSubcategories = category ? subcategories[category as keyof typeof subcategories] || [] : []

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact HR</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category */}
          <div>
            <Label htmlFor="category">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={(value) => {
              setCategory(value)
              setSubcategory("") // Reset subcategory when category changes
              setErrors(prev => ({ ...prev, category: "" }))
            }}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="benefits">Benefits</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-red-500 mt-1">{errors.category}</p>}
          </div>

          {/* Subcategory */}
          {selectedSubcategories.length > 0 && (
            <div>
              <Label htmlFor="subcategory">Subcategory</Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {selectedSubcategories.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div>
            <Label htmlFor="subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setErrors(prev => ({ ...prev, subject: "" }))
              }}
              maxLength={150}
              className="mt-2"
              placeholder="Brief summary of your request"
            />
            {errors.subject && <p className="text-sm text-red-500 mt-1">{errors.subject}</p>}
            <p className="text-xs text-muted-foreground mt-1">{subject.length}/150 characters</p>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setErrors(prev => ({ ...prev, description: "" }))
              }}
              rows={5}
              maxLength={2000}
              className="mt-2"
              placeholder="Provide detailed information about your request..."
            />
            {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
            <p className="text-xs text-muted-foreground mt-1">{description.length}/2000 characters (minimum 20)</p>
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="attachments">Attachments (Optional)</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="attachments"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="attachments" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-gray-400" />
                <p className="text-sm text-gray-600 mt-2">Click to upload files</p>
                <p className="text-xs text-gray-400 mt-1">Max 5 files, 10MB each (PDF, DOC, XLS, JPG, PNG)</p>
              </label>
            </div>

            {/* Attachment preview */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate">{att.file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact Method and Confidential */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactMethod">Preferred Contact</Label>
              <Select value={contactMethod} onValueChange={setContactMethod}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confidential"
                  checked={confidential}
                  onCheckedChange={(checked) => setConfidential(checked as boolean)}
                />
                <Label htmlFor="confidential" className="cursor-pointer">
                  Mark as confidential
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

