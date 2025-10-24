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
  Minimize2,
  Maximize2,
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
}

export function AIChatWidget({ hooks, initialMessages = [], className }: AIChatWidgetProps) {
  const [state, setState] = useState<ChatWidgetState>({
    isOpen: false,
    isMaximized: false,
    unreadCount: 0,
    messages: initialMessages,
    isTyping: false,
  })

  const [inputValue, setInputValue] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: inputValue.trim(),
      created_at: new Date().toISOString(),
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      isTyping: true,
    }))

    // Simulate AI response (UI only)
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: "This is a UI-only implementation. AI integration will be added later. How can I help you with your HR needs?",
        created_at: new Date().toISOString(),
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isTyping: false,
      }))
    }, 1500)

    hooks?.onSend?.(inputValue.trim())
    setInputValue("")
  }, [inputValue, hooks])

  const handleQuickReply = useCallback((text: string, action?: string) => {
    setInputValue(text)
    hooks?.onQuickReplySelected?.({ text, action })
  }, [hooks])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const quickReplies = [
    { text: "How do I request leave?", action: "leave_request" },
    { text: "Upload a document", action: "upload_document" },
    { text: "View my payslips", action: "view_payslips" },
    { text: "Contact HR", action: "contact_hr" },
  ]

  // Welcome message for empty state
  const welcomeMessage: ChatMessage = {
    id: "welcome",
    sender: "system",
    text: "Hi there — how can I help you today?",
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
                  <h3 className="font-semibold text-sm">Help & AI</h3>
                </div>
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                  AI
                </Badge>
              </div>
              
              <div className="flex items-center gap-1">
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
                      <p className="text-xs text-muted-foreground">Quick actions:</p>
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
                  Powered by AI (UI only)
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Always available</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
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
