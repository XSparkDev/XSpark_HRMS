"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { 
  Upload, 
  FileText, 
  Image, 
  Download, 
  Eye, 
  Trash2, 
  Search, 
  Filter, 
  Plus,
  File,
  Calendar,
  User,
  Clock,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { getCurrentUser } from "@/lib/auth"
import { documentSchema, type DocumentFormData, type Document } from "@/lib/validation/documents"
import { documentsService } from "@/lib/services/documents-service"

export default function DocumentsPage() {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "contracts" | "payslips" | "id_copies" | "work_permits" | "doctors_notes" | "performance_reviews" | "policies">("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"date" | "name" | "type">("date")

  const currentUser = getCurrentUser()
  const isHRAdmin = currentUser?.role === "hr_admin" || currentUser?.role === "admin" || currentUser?.role === "super_admin"
  const isSuperAdmin = currentUser?.role === "super_admin"

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const docs = await documentsService.getAllDocuments()
        setDocuments(docs)
      } catch (error) {
        console.error("Error fetching documents:", error)
        toast({
          title: "Error",
          description: "Failed to load documents",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocuments()

    // Subscribe to real-time updates
    const unsubscribe = documentsService.subscribe((updatedDocs) => {
      setDocuments(updatedDocs)
    })

    return unsubscribe
  }, [toast])

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case "contracts":
        return <FileText className="h-4 w-4 text-blue-600" />
      case "payslips":
        return <FileText className="h-4 w-4 text-green-600" />
      case "id_copies":
        return <FileText className="h-4 w-4 text-purple-600" />
      case "work_permits":
        return <FileText className="h-4 w-4 text-orange-600" />
      case "doctors_notes":
        return <FileText className="h-4 w-4 text-red-600" />
      case "performance_reviews":
        return <FileText className="h-4 w-4 text-indigo-600" />
      case "policies":
        return <FileText className="h-4 w-4 text-gray-600" />
      default:
        return <File className="h-4 w-4 text-gray-600" />
    }
  }

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case "contracts":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "payslips":
        return "bg-green-100 text-green-800 border-green-200"
      case "id_copies":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "work_permits":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "doctors_notes":
        return "bg-red-100 text-red-800 border-red-200"
      case "performance_reviews":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      case "policies":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getDocumentTypeDisplayName = (type: string) => {
    switch (type) {
      case "contracts":
        return "Contract"
      case "payslips":
        return "Payslip"
      case "id_copies":
        return "ID Copy"
      case "work_permits":
        return "Work Permit"
      case "doctors_notes":
        return "Doctor's Note"
      case "performance_reviews":
        return "Performance Review"
      case "policies":
        return "Policy"
      default:
        return type
    }
  }

  const filteredDocuments = documents.filter(doc => {
    if (filter !== "all" && doc.type !== filter) return false
    if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !doc.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name)
      case "type":
        return a.type.localeCompare(b.type)
      case "date":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  const canViewDocument = (doc: Document) => {
    if (isHRAdmin) return true
    return doc.employee_id === currentUser?.id
  }

  const canDeleteDocument = (doc: Document) => {
    if (isSuperAdmin) return true
    if (isHRAdmin && doc.uploaded_by === currentUser?.id) return true
    return false
  }

  const handleUploadDocument = async (data: DocumentFormData) => {
    try {
      await documentsService.uploadDocument({
        ...data,
        employee_id: currentUser?.id || "",
        uploaded_by: currentUser?.id || "",
        uploaded_by_name: currentUser?.name || "",
        employee_name: "Current Employee", // In real app, get from employee data
        employee_number: "XSP2501/001", // In real app, get from employee data
        file_size: 0, // Will be set by service
        file_type: "", // Will be set by service
        file_url: "", // Will be set by service
        is_sensitive: data.type === "id_copies" || data.type === "work_permits" || data.type === "doctors_notes",
        version: 1,
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      
      setIsUploadModalOpen(false)
      
      toast({
        title: "Document Uploaded",
        description: "Your document has been successfully uploaded.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await documentsService.deleteDocument(docId)
      
      toast({
        title: "Document Deleted",
        description: "The document has been successfully deleted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDownloadDocument = async (doc: Document) => {
    try {
      await documentsService.downloadDocument(doc.id)
      
      toast({
        title: "Download Started",
        description: "Your document download has started.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Manage and organize employee documents securely.
          </p>
        </div>
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
            </DialogHeader>
            <DocumentUploadForm 
              onSubmit={handleUploadDocument}
              onCancel={() => setIsUploadModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">Total Documents</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {documents.length}
            </div>
            <p className="text-sm text-muted-foreground">All documents</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="font-semibold">Sensitive</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {documents.filter(doc => doc.is_sensitive).length}
            </div>
            <p className="text-sm text-muted-foreground">Encrypted files</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold">Active</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {documents.filter(doc => doc.is_active).length}
            </div>
            <p className="text-sm text-muted-foreground">Available files</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <span className="font-semibold">This Month</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {documents.filter(doc => {
                const docDate = new Date(doc.created_at)
                const now = new Date()
                return docDate.getMonth() === now.getMonth() && docDate.getFullYear() === now.getFullYear()
              }).length}
            </div>
            <p className="text-sm text-muted-foreground">New uploads</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="contracts">Contracts</SelectItem>
                <SelectItem value="payslips">Payslips</SelectItem>
                <SelectItem value="id_copies">ID Copies</SelectItem>
                <SelectItem value="work_permits">Work Permits</SelectItem>
                <SelectItem value="doctors_notes">Doctor's Notes</SelectItem>
                <SelectItem value="performance_reviews">Performance Reviews</SelectItem>
                <SelectItem value="policies">Policies</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents ({filteredDocuments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredDocuments.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0">
                          {getDocumentTypeIcon(doc.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                            <Badge variant="outline" className={getDocumentTypeColor(doc.type)}>
                              {getDocumentTypeDisplayName(doc.type)}
                            </Badge>
                            {doc.is_sensitive && (
                              <Badge variant="destructive" className="bg-red-100 text-red-800">
                                SENSITIVE
                              </Badge>
                            )}
                            {doc.version > 1 && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                v{doc.version}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground mb-2">
                            {doc.employee_name} ({doc.employee_number})
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Uploaded by {doc.uploaded_by_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(doc.created_at), "MMM dd, yyyy")}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <File className="h-3 w-3" />
                              <span>{(doc.file_size / 1024 / 1024).toFixed(1)} MB</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {canViewDocument(doc) && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewDocument(doc)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadDocument(doc)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {canDeleteDocument(doc) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmDoc(doc.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Modal */}
      <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {previewDocument && (
              <DocumentPreview document={previewDocument} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmDoc} onOpenChange={() => setDeleteConfirmDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDoc(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (deleteConfirmDoc) {
                  handleDeleteDocument(deleteConfirmDoc)
                  setDeleteConfirmDoc(null)
                }
              }}
            >
              Delete Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface DocumentUploadFormProps {
  onSubmit: (data: DocumentFormData) => void
  onCancel: () => void
}

function DocumentUploadForm({ onSubmit, onCancel }: DocumentUploadFormProps) {
  const [formData, setFormData] = useState<Partial<DocumentFormData>>({
    name: "",
    type: "contracts",
    description: "",
    tags: "",
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !formData.name || !formData.type) return
    
    onSubmit({
      name: formData.name,
      type: formData.type as any,
      description: formData.description || "",
      tags: formData.tags || "",
    })
  }

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB")
      return
    }
    
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"]
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF, JPG, and PNG files are allowed")
      return
    }
    
    setSelectedFile(file)
    if (!formData.name) {
      setFormData(prev => ({ ...prev, name: file.name }))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="file">Document File *</Label>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            isDragOver ? "border-primary bg-primary/5" : "border-gray-300",
            selectedFile ? "border-green-300 bg-green-50" : ""
          )}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <FileText className="h-8 w-8 mx-auto text-green-600" />
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-gray-400" />
              <p className="text-sm">Drag and drop your file here, or click to select</p>
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>
          )}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
            className="hidden"
            id="file"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => document.getElementById("file")?.click()}
          >
            Select File
          </Button>
        </div>
      </div>
      
      <div>
        <Label htmlFor="name">Document Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter document name"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="type">Document Type *</Label>
        <Select 
          value={formData.type} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contracts">Contract</SelectItem>
            <SelectItem value="payslips">Payslip</SelectItem>
            <SelectItem value="id_copies">ID Copy</SelectItem>
            <SelectItem value="work_permits">Work Permit</SelectItem>
            <SelectItem value="doctors_notes">Doctor's Note</SelectItem>
            <SelectItem value="performance_reviews">Performance Review</SelectItem>
            <SelectItem value="policies">Policy</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of the document"
        />
      </div>
      
      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          placeholder="e.g., contract, renewal, 2024"
        />
      </div>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!selectedFile || !formData.name || !formData.type}>
          Upload Document
        </Button>
      </div>
    </form>
  )
}

interface DocumentPreviewProps {
  document: Document
}

function DocumentPreview({ document }: DocumentPreviewProps) {
  const isImage = document.file_type.startsWith("image/")
  const isPDF = document.file_type === "application/pdf"

  if (isImage) {
    return (
      <div className="flex justify-center">
        <img
          src={document.file_url}
          alt={document.name}
          className="max-w-full max-h-96 object-contain rounded-lg"
        />
      </div>
    )
  }

  if (isPDF) {
    return (
      <div className="w-full h-96">
        <iframe
          src={document.file_url}
          className="w-full h-full rounded-lg border"
          title={document.name}
        />
      </div>
    )
  }

  return (
    <div className="text-center py-8 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>Preview not available for this file type.</p>
      <p className="text-sm">Please download the file to view it.</p>
    </div>
  )
}
