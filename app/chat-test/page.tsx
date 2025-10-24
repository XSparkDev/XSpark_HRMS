"use client"

import { ChatWidgetDemo } from "@/components/chat-widget-demo"

export default function ChatWidgetTestPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy mb-2">AI Chat Widget Testing</h1>
          <p className="text-muted-foreground">
            This page demonstrates all features of the AI Chat Widget implementation.
          </p>
        </div>
        
        <ChatWidgetDemo />
      </div>
    </div>
  )
}
