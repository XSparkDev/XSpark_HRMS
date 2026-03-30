"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  MessageSquare,
  X,
  XCircle,
  Minimize2,
  Maximize2,
  Download,
  Send,
  Paperclip,
  HelpCircle,
  Bot,
  User,
  Clock,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { searchKnowledgeBase, formatKnowledgeResponse, getCategoryFromQuery } from "@/lib/sa-labour-law-knowledge"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// Message schema for future AI integration
export interface ChatMessage {
  id: string
  sender: "user" | "assistant" | "system"
  text: string
  created_at: string
  metadata?: Record<string, any>
}

// Widget state management
export interface ChatWidgetState {
  isOpen: boolean
  isMaximized: boolean
  unreadCount: number
  messages: ChatMessage[]
  isTyping: boolean
}

// Event hooks for future AI integration
export interface ChatWidgetHooks {
  onOpen?: () => void
  onClose?: () => void
  onSend?: (message: string) => void
  onMaximize?: () => void
  onRestore?: () => void
  onQuickReplySelected?: (payload: { text: string; action?: string }) => void
  initConversation?: (messages: ChatMessage[]) => void
  setUnreadCount?: (count: number) => void
  connectToSocket?: (url: string, token: string) => void
}

interface AIChatWidgetProps {
  hooks?: ChatWidgetHooks
  initialMessages?: ChatMessage[]
  className?: string
  // Employee identifier used to scope chat sessions per employee
  employeeId: string
}

export function AIChatWidget({ hooks, initialMessages = [], className, employeeId }: AIChatWidgetProps) {
  const [state, setState] = useState<ChatWidgetState>({
    isOpen: false,
    isMaximized: false,
    unreadCount: 0,
    messages: initialMessages,
    isTyping: false,
  })

  const [inputValue, setInputValue] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historySessions, setHistorySessions] = useState<
    { id: string; title: string; created_at: string; updated_at: string; message_count?: number }[]
  >([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Helper: ensure a Supabase chat session exists for this employee
  const ensureSession = useCallback(
    async (titleFromFirstMessage?: string): Promise<string | null> => {
      if (!employeeId) return null

      if (currentSessionId) {
        return currentSessionId
      }

      // Create a new session using the first user message as title if provided
      const title =
        titleFromFirstMessage && titleFromFirstMessage.trim().length > 0
          ? titleFromFirstMessage.trim().slice(0, 120)
          : `Chat started ${new Date().toLocaleString()}`

      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          employee_id: employeeId,
          title,
        })
        .select("id")
        .single()

      if (error || !data || !data.id) {
        console.error("Failed to create chat session:", error)
        return null
      }

      setCurrentSessionId(data.id as string)
      return data.id as string
    },
    [employeeId, currentSessionId]
  )

  // Helper: persist a single message to Supabase
  const persistMessage = useCallback(
    async (msg: ChatMessage, firstUserMessageTextForTitle?: string) => {
      if (!employeeId) return

      const sessionId = await ensureSession(firstUserMessageTextForTitle)
      if (!sessionId) return

      const { error } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        sender: msg.sender,
        text: msg.text,
        created_at: msg.created_at,
      })

      if (error) {
        console.error("Failed to persist chat message:", error)
      }
    },
    [employeeId, ensureSession]
  )

  // Load latest chat session + messages for this employee on mount / employee change
  useEffect(() => {
    if (!employeeId) return

    let isCancelled = false

    const loadLatestSession = async () => {
      setIsLoadingSession(true)
      try {
        const { data: sessions, error: sessionError } = await supabase
          .from("chat_sessions")
          .select("id, title, created_at, updated_at")
          .eq("employee_id", employeeId)
          .order("created_at", { ascending: false })
          .limit(1)

        if (sessionError) {
          console.error("Failed to load chat sessions:", sessionError)
          return
        }

        const latestSession = sessions && sessions.length > 0 ? sessions[0] : null

        if (!latestSession) {
          // No previous session – keep welcome message / empty state
          setCurrentSessionId(null)
          return
        }

        const { data: messages, error: messagesError } = await supabase
          .from("chat_messages")
          .select("id, sender, text, created_at")
          .eq("session_id", latestSession.id)
          .order("created_at", { ascending: true })

        if (messagesError) {
          console.error("Failed to load chat messages:", messagesError)
          return
        }

        if (isCancelled) return

        const loadedMessages: ChatMessage[] =
          messages?.map((m: any) => ({
            id: m.id?.toString() ?? `msg-${m.created_at}`,
            sender: m.sender,
            text: m.text,
            created_at: m.created_at,
          })) ?? []

        setCurrentSessionId(latestSession.id as string)

        if (loadedMessages.length > 0) {
          setState(prev => ({
            ...prev,
            messages: loadedMessages,
            unreadCount: 0,
          }))
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSession(false)
        }
      }
    }

    loadLatestSession()

    return () => {
      isCancelled = true
    }
  }, [employeeId])

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [state.messages, state.isTyping])

  // Focus input when panel opens
  useEffect(() => {
    if (state.isOpen && !state.isMaximized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [state.isOpen, state.isMaximized])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.isOpen) {
        handleClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [state.isOpen])

  const handleOpen = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, unreadCount: 0 }))
    hooks?.onOpen?.()
  }, [hooks])

  const handleClose = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
    hooks?.onClose?.()
  }, [hooks])

  const handleMaximize = useCallback(() => {
    setState(prev => ({ ...prev, isMaximized: true }))
    hooks?.onMaximize?.()
  }, [hooks])

  const handleRestore = useCallback(() => {
    setState(prev => ({ ...prev, isMaximized: false }))
    hooks?.onRestore?.()
  }, [hooks])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || state.isTyping) return

    const userMessage = inputValue.trim()
    setInputValue("")

    // Add user message
    const userChatMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: userMessage,
      created_at: new Date().toISOString(),
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userChatMessage],
      isTyping: true,
    }))

    // Persist user message (first user message can be used as session title)
    void persistMessage(userChatMessage, userMessage)

    try {
      // Convert messages to API format (role/content)
      const conversationHistory = state.messages
        .filter(msg => msg.sender !== "system")
        .map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        }))

      // Call your new API endpoint
      const response = await fetch('/api/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory
        })
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          // If JSON parsing fails, use status text
          throw new Error(`Failed to get response: ${response.status} ${response.statusText}`)
        }
        
        // Extract error message - handle nested error objects
        let errorMessage: string
        
        if (typeof errorData.error?.message === 'string') {
          errorMessage = errorData.error.message
        } else if (typeof errorData.error === 'string') {
          errorMessage = errorData.error
        } else if (typeof errorData.message === 'string') {
          errorMessage = errorData.message
        } else {
          errorMessage = `Failed to get response: ${response.status} ${response.statusText}`
        }
        
        // Ensure it's a clean string (no regex-like patterns)
        errorMessage = String(errorMessage).trim().substring(0, 500)
        
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Add AI response
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: data.reply,
        created_at: new Date().toISOString(),
        metadata: data.sources ? { sources: data.sources } : undefined
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isTyping: false,
      }))

      // Persist AI response
      void persistMessage(aiResponse)

      hooks?.onSend?.(userMessage)
    } catch (error) {
      console.error('Chat error:', error)
      
      // Add error message
      const errorResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorResponse],
        isTyping: false,
      }))

      void persistMessage(errorResponse)
    }
  }, [inputValue, state.messages, state.isTyping, hooks, persistMessage])

  const handleQuickReply = useCallback((text: string, action?: string) => {
    // Don't set input value, instead directly add a response
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: text,
      created_at: new Date().toISOString(),
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isTyping: true,
    }))

    // Persist quick reply as user message (may be first message, so can set title)
    void persistMessage(userMessage, text)

    // Generate contextual response based on action using knowledge base
    setTimeout(() => {
      let response = ""
      
      // Search knowledge base for relevant information based on action
      let searchQuery = ""
      switch(action) {
        case "leave_rights":
          searchQuery = "annual leave sick leave maternity"
          break
        case "workplace_conduct":
          searchQuery = "disciplinary procedure misconduct"
          break
        case "employee_act":
          searchQuery = "employment act employee rights"
          break
        case "disciplinary_process":
          searchQuery = "disciplinary unfair dismissal"
          break
        case "health_safety":
          searchQuery = "health safety ohsa"
          break
      }
      
      const knowledgeEntries = searchKnowledgeBase(searchQuery)
      
      if (knowledgeEntries.length > 0) {
        const knowledge = knowledgeEntries[0]
        response = `👩‍💼 HR Assistant speaking...\n\n${formatKnowledgeResponse(knowledge)}`
        
        if (action === "leave_rights") {
          response += "\n\n• Sick Leave: 30 days over 36-month cycle\n• Family Responsibility Leave: 3 days per year\n• Maternity Leave: 4 consecutive months\n• Leave accrues from your first day of employment"
        }
      } else {
        // Fallback responses
        switch(action) {
          // HR Questions responses
          case "view_payslip":
            response = "👩‍💼 HR Assistant speaking...\n\nTo view your payslip, you can:\n\n• **Navigate to Documents** section in the sidebar\n• **Select 'Payslips'** from the document filter\n• **Click on the payslip** you wish to view\n• **Download** for your records\n\nYour payslips are securely stored and accessible anytime. All payslips include breakdowns of: basic salary, allowances, deductions, tax (PAYE), UIF, and net pay.\n\nNeed help accessing a specific payslip?"
            break
          case "apply_leave":
            response = "👩‍💼 HR Assistant speaking...\n\nTo apply for leave:\n\n1. **Navigate to Leave** section in the sidebar\n2. **Click 'Request Leave'** button\n3. **Select** your leave type (Annual, Sick, Family Responsibility, etc.)\n4. **Choose** your start and end dates\n5. **Provide** reason and any supporting documents\n6. **Submit** for approval\n\nYour leave request will be sent to your direct supervisor for approval. You'll receive a notification once the request is reviewed.\n\nWould you like to apply for leave now?"
            break
          case "check_leave_balance":
            response = "👩‍💼 HR Assistant speaking...\n\nTo check your leave balance:\n\n• **Go to Dashboard** to see your leave balance cards\n• Annual Leave: 12 days remaining (typically 15 days per year)\n• Sick Leave: 8 days remaining (30 days per 36-month cycle)\n• Family Responsibility: 3 days per year\n\nYou can also view detailed leave history in the **Leave** section.\n\nWould you like to view your detailed leave history?"
            break
          case "update_personal_info":
            response = "👩‍💼 HR Assistant speaking...\n\nTo update your personal information:\n\n1. **Go to My Profile** in the sidebar\n2. **Click 'Edit'** on the section you wish to update\n3. **Update** your information (contact details, emergency contacts, banking info, etc.)\n4. **Save** your changes\n\nFor certain changes (like banking details), your changes may require verification. You'll be notified once approved.\n\nNeed help updating a specific section?"
            break
          // Compliance and legal information responses
          case "leave_rights":
            response = "👩‍💼 HR Assistant speaking...\n\nAccording to **Section 20 of the Basic Conditions of Employment Act (Act 75 of 1997)**, employees are entitled to at least 21 consecutive days of annual leave per year. Leave accrues at 1.25 days per month. You also have rights to sick leave (30 days per 36-month cycle), family responsibility leave (3 days per year), and maternity leave (4 consecutive months).\n\nWould you like specific details on any particular leave type?"
            break
          case "workplace_conduct":
            response = "👩‍💼 HR Assistant speaking...\n\nWorkplace conduct must be professional, respectful, and comply with company policies and South African labour law. The Employment Equity Act prohibits unfair discrimination, and the Labour Relations Act ensures fair disciplinary procedures. Our policy emphasizes mutual respect, punctuality, confidentiality, and adherence to all safety protocols.\n\nAny questions about specific conduct expectations?"
            break
          case "employee_act":
            response = "👩‍💼 HR Assistant speaking...\n\nKey South African legislation protecting employees:\n\n**BCEA (Act 75/1997)** - Basic conditions, hours, leave\n**LRA (Act 66/1995)** - Labour relations, fair dismissal\n**OHSA (Act 85/1993)** - Health & safety obligations\n**EEA (Act 55/1998)** - Employment equity, non-discrimination\n**PEA (Act 26/2000)** - Protected disclosures, whistleblowing\n\nAll enforced by the Department of Employment and Labour."
            break
          case "disciplinary_process":
            response = "👩‍💼 HR Assistant speaking...\n\nUnder **Section 188 of the Labour Relations Act (Act 66 of 1995)**, disciplinary procedures must be fair both procedurally and substantively. This includes: written notice (48+ hours), opportunity to respond, right to representation, hearing with evidence presentation, written outcome with reasons, and right to appeal. The CCMA provides dispute resolution if needed. Maximum 30 days to refer disputes.\n\nNeed guidance on a specific situation?"
            break
          case "health_safety":
            response = "👩‍💼 HR Assistant speaking...\n\nUnder **Section 13 of the Occupational Health and Safety Act (Act 85 of 1993)**, employees may refuse dangerous work. Employers must provide: safe working conditions, PPE, training, hazard reporting mechanisms, first aid facilities, and risk assessments. All employees must participate in safety training and report incidents immediately.\n\nNeed to report a safety concern?"
            break
        }
      }
      
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: response,
        created_at: new Date().toISOString(),
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isTyping: false,
      }))

      void persistMessage(aiResponse)
      
      hooks?.onQuickReplySelected?.({ text, action })
    }, 1200)
    
  }, [hooks, persistMessage])

  // Clear current chat, mark session inactive, and prepare for a new one
  const handleClearChat = useCallback(async () => {
    if (!currentSessionId) return

    try {
      // Clear messages and show welcome again
      setCurrentSessionId(null)
      setState(prev => ({
        ...prev,
        messages: [],
        unreadCount: 0,
        isTyping: false,
      }))
      setInputValue("")

      toast({
        title: "Chat saved and closed",
        description: "A new chat will start with your next message.",
      })
    } catch (error) {
      console.error("Error closing chat:", error)
      toast({
        title: "Error",
        description: "Error saving chat. Please try again.",
        variant: "destructive",
      })
    }
  }, [currentSessionId, toast])

  // Download current chat as a .txt file
  const handleDownloadChat = useCallback(() => {
    if (!state.messages.length) return

    const firstUserMessage = state.messages.find(m => m.sender === "user")
    const rawTitle = firstUserMessage?.text || "Chat"

    const title = rawTitle.slice(0, 50).replace(/[^a-z0-9]/gi, "_") || "Chat"

    // Use current date in YYYY-MM-DD format (example: 2026-01-28)
    const datePart = new Date().toISOString().split("T")[0]
    const filename = `${title}_${datePart}.txt`

    let content = ""
    content += `Chat: ${rawTitle}\n`
    content += `Date: ${new Date().toLocaleString()}\n`
    content += `${"=".repeat(18)}\n\n`

    state.messages.forEach(msg => {
      if (msg.sender === "system") return
      const time = new Date(msg.created_at).toLocaleTimeString()
      const role = msg.sender === "user" ? "User" : "Assistant"
      content += `[${time}] ${role}: ${msg.text}\n\n`
    })

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [state.messages])

  // Load history of closed chats for this employee
  const loadHistory = useCallback(async () => {
    if (!employeeId) return

    setIsLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load chat history:", error)
        toast({
          title: "Error",
          description: "Could not load chat history.",
          variant: "destructive",
        })
        return
      }

      setHistorySessions(
        (data || []).map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled chat",
          created_at: s.created_at,
          updated_at: s.updated_at,
        }))
      )
    } finally {
      setIsLoadingHistory(false)
    }
  }, [employeeId, toast])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Quick replies for HR questions
  const quickReplies = [
    { text: "View Payslip", action: "view_payslip" },
    { text: "Apply for Leave", action: "apply_leave" },
    { text: "Check Leave Balance", action: "check_leave_balance" },
    { text: "Update Personal Info", action: "update_personal_info" },
  ]

  // Welcome message for empty state
  const welcomeMessage: ChatMessage = {
    id: "welcome",
    sender: "system",
    text: "Hello there 👋 I'm your HR Assistant — how can I help you today?\n\nI can assist with viewing your payslips, managing leave requests, checking your leave balance, updating your personal information, or answering questions about South African labour law and workplace policies.",
    created_at: new Date().toISOString(),
  }

  const showWelcome = state.messages.length === 0

  return (
    <div className={cn("fixed z-50", className)}>
      {/* Minimized Bubble */}
      {!state.isOpen && (
        <div className="fixed bottom-6 left-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleOpen}
                  size="icon"
                  className="h-14 w-14 rounded-full gradient-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  aria-label="Open AI chat"
                >
                  <MessageSquare className="h-6 w-6" />
                  {state.unreadCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#E31E24] text-white text-xs flex items-center justify-center p-0"
                      aria-label={`${state.unreadCount} unread messages`}
                    >
                      {state.unreadCount > 9 ? "9+" : state.unreadCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Chat with AI</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Chat Panel */}
      {state.isOpen && (
        <div
          className={cn(
            "fixed bottom-6 left-6 transition-all duration-300 ease-out",
            isMobile
              ? "w-[calc(100vw-3rem)] h-[60vh] max-h-[500px]"
              : state.isMaximized
              ? "w-[90vw] h-[90vh] max-w-[1200px]"
              : "w-[380px] h-[480px]"
          )}
        >
          <Card className="h-full flex flex-col shadow-2xl border-0 bg-background/95 backdrop-blur-sm">
            {/* Header */}
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 border-b">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-sm">HR Assistant</h3>
                </div>
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                  SA HR
                </Badge>
              </div>
              
              <div className="flex items-center gap-1">
                {/* View History button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setIsHistoryOpen(true)
                          void loadHistory()
                        }}
                        aria-label="View chat history"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View history</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          // Info about UI-only implementation
                          alert("This is a UI-only implementation. AI integration will be added later.")
                        }}
                        aria-label="About AI chat"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>UI only — AI integration coming soon</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Download chat transcript */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleDownloadChat}
                        aria-label="Download chat transcript"
                        disabled={!state.messages.length}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download chat as text</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {!isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={state.isMaximized ? handleRestore : handleMaximize}
                    aria-label={state.isMaximized ? "Restore panel" : "Maximize panel"}
                  >
                    {state.isMaximized ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* Clear / close current chat session (red X) */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={handleClearChat}
                        aria-label="Clear chat and start new session"
                        disabled={isLoadingSession}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear chat & start new</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Existing close button just hides the widget */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleClose}
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* Welcome Message */}
                  {showWelcome && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                          <p className="text-sm">{welcomeMessage.text}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(welcomeMessage.created_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {state.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-start gap-3",
                        message.sender === "user" ? "flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        message.sender === "user" 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-primary/10 text-primary"
                      )}>
                        {message.sender === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div className={cn(
                        "flex-1",
                        message.sender === "user" ? "flex flex-col items-end" : ""
                      )}>
                        <div className={cn(
                          "rounded-2xl px-4 py-3 max-w-[80%]",
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted/50 rounded-tl-sm"
                        )}>
                          <p className="text-sm">{message.text}</p>
                        </div>
                        <p className={cn(
                          "text-xs text-muted-foreground mt-1",
                          message.sender === "user" ? "text-right" : ""
                        )}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {state.isTyping && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                          <div className="flex items-center gap-1">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs text-muted-foreground ml-2">AI is typing...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Replies */}
                  {showWelcome && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs text-muted-foreground">Select a topic to learn more:</p>
                      <div className="flex flex-wrap gap-2">
                        {quickReplies.map((reply, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 bg-transparent hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleQuickReply(reply.text, reply.action)}
                          >
                            {reply.text}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>

            {/* Input Area */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  disabled
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1"
                  disabled={state.isTyping}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || state.isTyping}
                  size="icon"
                  className="h-8 w-8 gradient-primary text-white"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  🇿🇦 SA Labour Law Compliance
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Available 24/7</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* History dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Past chats</DialogTitle>
            <DialogDescription>
              View your previous HR assistant conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {isLoadingHistory && (
              <p className="text-sm text-muted-foreground">Loading history...</p>
            )}
            {!isLoadingHistory && historySessions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No past chats found yet. Close a chat to save it to history.
              </p>
            )}
            {!isLoadingHistory &&
              historySessions.map(session => (
                <button
                  key={session.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border px-3 py-2 hover:bg-muted transition flex items-center justify-between"
                  onClick={async () => {
                    try {
                      const { data: messages, error } = await supabase
                        .from("chat_messages")
                        .select("id, sender, text, created_at")
                        .eq("session_id", session.id)
                        .order("created_at", { ascending: true })

                      if (error) {
                        console.error("Failed to load chat from history:", error)
                        toast({
                          title: "Error",
                          description: "Could not load this conversation.",
                          variant: "destructive",
                        })
                        return
                      }

                      const loadedMessages: ChatMessage[] =
                        messages?.map((m: any) => ({
                          id: m.id?.toString() ?? `msg-${m.created_at}`,
                          sender: m.sender,
                          text: m.text,
                          created_at: m.created_at,
                        })) ?? []

                      setState(prev => ({
                        ...prev,
                        messages: loadedMessages,
                        unreadCount: 0,
                      }))
                      setCurrentSessionId(session.id)
                      setIsHistoryOpen(false)
                    } catch (error) {
                      console.error("Error loading chat from history:", error)
                      toast({
                        title: "Error",
                        description: "Could not load this conversation.",
                        variant: "destructive",
                      })
                    }
                  }}
                >
                  <div>
                    <p className="text-sm font-medium line-clamp-1">
                      {session.title || "Untitled chat"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleString()}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Hook for managing chat widget state
export function useChatWidget(initialMessages?: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || [])
  const [unreadCount, setUnreadCount] = useState(0)

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const incrementUnread = useCallback(() => {
    setUnreadCount(prev => prev + 1)
  }, [])

  const resetUnread = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return {
    messages,
    unreadCount,
    addMessage,
    clearMessages,
    incrementUnread,
    resetUnread,
  }
}
