"use client"

import { useState } from "react"
import { AIChatWidget, ChatMessage } from "@/components/ai-chat-widget"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ChatWidgetDemo() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const demoMessages: ChatMessage[] = [
    {
      id: "demo-1",
      sender: "system",
      text: "Welcome to the AI Chat Widget Demo! This showcases all the features.",
      created_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: "demo-2",
      sender: "user",
      text: "How do I request leave?",
      created_at: new Date(Date.now() - 240000).toISOString(),
    },
    {
      id: "demo-3",
      sender: "assistant",
      text: "To request leave, navigate to the Leave section in your dashboard and click 'Request Leave'. Fill out the form with your dates and reason.",
      created_at: new Date(Date.now() - 180000).toISOString(),
    },
    {
      id: "demo-4",
      sender: "user",
      text: "Thanks! Can you help me upload a document?",
      created_at: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: "demo-5",
      sender: "assistant",
      text: "Absolutely! Go to the Documents section and click 'Upload Document'. You can upload PDFs, images, and other file types up to 10MB.",
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
  ]

  const hooks = {
    onOpen: () => {
      console.log("Chat widget opened")
    },
    onClose: () => {
      console.log("Chat widget closed")
    },
    onSend: (message: string) => {
      console.log("Message sent:", message)
      // Simulate adding a message
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: "user",
        text: message,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, newMessage])
    },
    onMaximize: () => {
      console.log("Chat widget maximized")
    },
    onRestore: () => {
      console.log("Chat widget restored")
    },
    onQuickReplySelected: ({ text, action }: { text: string; action?: string }) => {
      console.log("Quick reply selected:", { text, action })
    },
    initConversation: (msgs: ChatMessage[]) => {
      console.log("Initializing conversation with", msgs.length, "messages")
      setMessages(msgs)
    },
    setUnreadCount: (count: number) => {
      console.log("Setting unread count to:", count)
      setUnreadCount(count)
    },
    connectToSocket: (url: string, token: string) => {
      console.log("Connecting to socket:", url, "with token:", token)
    },
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AI Chat Widget Demo
            <Badge variant="secondary">UI Only</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => hooks.setUnreadCount?.(unreadCount + 1)}
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
            >
              <span className="text-lg">🔔</span>
              <span className="text-sm">Add Unread</span>
            </Button>
            
            <Button
              onClick={() => hooks.setUnreadCount?.(0)}
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
            >
              <span className="text-lg">✅</span>
              <span className="text-sm">Clear Unread</span>
            </Button>
            
            <Button
              onClick={() => hooks.initConversation?.(demoMessages)}
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
            >
              <span className="text-lg">💬</span>
              <span className="text-sm">Load Demo Messages</span>
            </Button>
            
            <Button
              onClick={() => hooks.initConversation?.([])}
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
            >
              <span className="text-lg">🗑️</span>
              <span className="text-sm">Clear Messages</span>
            </Button>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Current State:</h4>
            <div className="text-sm space-y-1">
              <p>• Unread Count: {unreadCount}</p>
              <p>• Messages: {messages.length}</p>
              <p>• Check browser console for hook events</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium mb-2">Testing Instructions:</h4>
            <div className="text-sm space-y-1">
              <p>1. Click the chat bubble in bottom-left to open</p>
              <p>2. Try typing and sending messages</p>
              <p>3. Test maximize/restore functionality</p>
              <p>4. Try quick reply buttons</p>
              <p>5. Test keyboard navigation (Tab, Enter, Escape)</p>
              <p>6. Test mobile responsiveness</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The actual chat widget */}
      <AIChatWidget 
        hooks={hooks}
        initialMessages={messages}
      />
    </div>
  )
}
