import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { searchKnowledgeBase } from '@/lib/sa-labour-law-knowledge'
import { getReferenceContext } from '@/lib/chatbot-reference'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const { message, conversationHistory } = await request.json()

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Step 1: Search your knowledge bases
    const knowledgeResults = searchKnowledgeBase(message)
    const referenceContext = getReferenceContext(message, 3)

    // Step 2: Build context from your sources
    let context = "# Company HR Information\n\n"
    
    if (knowledgeResults.length > 0) {
      context += "## South African Labour Law:\n"
      knowledgeResults.forEach(result => {
        context += `\n### ${result.title}\n${result.content}\n`
      })
    }

    if (referenceContext.relevantSections.length > 0) {
      context += "\n## Company Policies:\n"
      referenceContext.relevantSections.forEach(doc => {
        const title = doc.metadata?.title || doc.name
        context += `\n### ${title}\n${doc.content.slice(0, 2000)}\n`
      })
    }

    // Step 3: Create system prompt that keeps AI on topic
    const systemPrompt = `You are an HR Assistant for a South African company. You ONLY answer questions about:

- South African labour law and employee rights
- Company HR policies and procedures
- Employee compliance and workplace conduct

STRICT RULES:

1. If a question is NOT about HR, labour law, or company policies, politely say: "I can only help with HR and employee-related questions. Please ask about leave, policies, rights, or workplace matters."

2. Always base your answers on the information provided below

3. If you don't have the information, say so clearly

4. Always cite which act or policy you're referencing

5. Be helpful but professional

${context}

Remember: ONLY answer HR and employee-related questions based on the information above.`

    // Step 4: Send to Groq AI
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...(conversationHistory || []),
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile', // Updated to current model
      temperature: 0.3, // Low = more factual
      max_tokens: 1000,
    })

    const reply = completion.choices[0]?.message?.content

    if (!reply) {
      return NextResponse.json(
        { error: 'No response from AI model' },
        { status: 500 }
      )
    }

    // Step 5: Return response
    return NextResponse.json({ 
      reply,
      sources: [
        ...knowledgeResults.map(r => r.title),
        ...referenceContext.relevantSections.map(doc => doc.metadata?.title || doc.name)
      ]
    })

  } catch (error: any) {
    console.error('Chatbot error:', error)
    
    // Provide more specific error messages from Groq API
    let errorMessage = 'Failed to process message'
    let statusCode = 500
    
    if (error?.error?.message && typeof error.error.message === 'string') {
      // Groq API error format
      errorMessage = error.error.message
      statusCode = error.status || 500
    } else if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error)
      } catch {
        errorMessage = 'An unknown error occurred'
      }
    }
    
    // Ensure clean string (trim and limit length)
    errorMessage = String(errorMessage).trim().substring(0, 500)
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}

