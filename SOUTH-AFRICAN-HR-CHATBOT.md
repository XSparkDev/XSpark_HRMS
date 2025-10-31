# South African HR Compliance Assistant

## Overview

The HR chatbot has been upgraded to a comprehensive South African HR Compliance Assistant with intelligent, referenced responses based on actual South African labour law.

## Features Implemented

### 1. Knowledge Base System
**File**: `lib/sa-labour-law-knowledge.ts`

A structured knowledge base containing 12 detailed entries covering:
- **BCEA (Act 75 of 1997)** - Leave entitlements, working hours, overtime
- **LRA (Act 66 of 1995)** - Disciplinary procedures, unfair dismissal, CCMA
- **OHSA (Act 85 of 1993)** - Health & safety rights and obligations
- **EEA (Act 55 of 1998)** - Employment equity, non-discrimination, equal pay
- **PEA (Act 26 of 2000)** - Protected disclosures, whistleblowing

### 2. Intelligent Response System
The chatbot now:
- **Searches the knowledge base** for relevant information based on user queries
- **Cites specific sections** of South African Acts (e.g., "Section 20 of the BCEA")
- **Provides accurate, referenced information** rather than generic responses
- **Handles contextual questions** about leave, disciplinary processes, safety, etc.

### 3. Quick Action Buttons
Five targeted quick actions:
1. **Understand My Leave Rights** → BCEA Section 20 (21 days annual leave)
2. **Workplace Conduct Policy** → Professional conduct aligned with LRA & EEA
3. **Employee Act Guidance** → Overview of all major SA labour laws
4. **Disciplinary Process Info** → LRA Section 188 (fair procedures, CCMA)
5. **Health & Safety Rules** → OHSA Section 13 (right to refuse dangerous work)

### 4. Professional Tone & Personality
- **Voice-style openings**: "👩‍💼 HR Assistant speaking..."
- **Formal yet approachable** language
- **South African context**: "Dumela!" greeting, 🇿🇦 flag emoji
- **Accurate citations**: All responses reference specific Acts and Sections

## Example Responses

### Leave Query
**User**: "How much annual leave am I entitled to?"

**Bot**: "👩‍💼 HR Assistant speaking...

According to Section 20 of the Basic Conditions of Employment Act (Act 75 of 1997), employees are entitled to at least 21 consecutive days of annual leave per annual leave cycle. Annual leave accrues from the first day of employment at a rate of one day for every 17 days worked, or 1.25 days per month.

📖 Reference: Section 20 of the BCEA (Act 75 of 1997)"

### Safety Query
**User**: "What are my health and safety rights?"

**Bot**: "👩‍💼 HR Assistant speaking...

According to Section 13 of the Occupational Health and Safety Act (Act 85 of 1993), an employee may refuse to perform work which he or she reasonably believes is unsafe or unhealthy. The employee must report the danger immediately and the employer must investigate and take corrective action.

📖 Reference: Section 13 of the OHSA (Act 85 of 1993)"

### Disciplinary Query
**User**: "What's a fair disciplinary procedure?"

**Bot**: "👩‍💼 HR Assistant speaking...

According to Section 188 of the Labour Relations Act (Act 66 of 1995), a dismissal is unfair if it is not effected for a fair reason and in accordance with a fair procedure. This includes: substantively fair reasons (misconduct, incapacity, operational requirements) and procedurally fair process (notification, opportunity to respond, hearing, representation).

📖 Reference: Section 188 of the LRA (Act 66 of 1995)"

## Knowledge Base Structure

Each entry contains:
```typescript
{
  id: 'unique-identifier',
  title: 'Short Title',
  content: 'Detailed explanation...',
  act: 'BCEA (Act 75 of 1997)',
  section: 'Section 20',
  keywords: ['leave', 'annual', 'vacation'],
  category: 'leave' | 'disciplinary' | 'safety' | 'rights' | 'conduct' | 'general'
}
```

## Search Algorithm

The chatbot uses intelligent keyword matching:
1. Searches all entries for matching keywords
2. Prioritizes entries with multiple keyword matches
3. Returns most relevant entry with full citation
4. Falls back to general help if no matches found

## Usage Examples

### User Interactions

**Greeting**:
- "Hi" → Welcoming response with overview of capabilities

**Specific Question**:
- "What are my overtime rights?" → BCEA Section 10 response about overtime compensation

**Help Request**:
- "What can you help me with?" → List of topics and capabilities

**Thank You**:
- "Thanks" → Acknowledgment message

### Quick Actions

Clicking "Understand My Leave Rights" provides:
- Annual leave (BCEA Section 20)
- Sick leave (BCEA Section 22)
- Maternity leave (BCEA Section 25)
- Leave accrual information
- When you can take leave

## Design & UX

- **Same visual design** - no layout changes
- **Same position** - bottom-left corner
- **Same interactions** - typing animation, scrolling
- **Enhanced content** - intelligent, referenced responses

## Technical Implementation

### Files Created
1. `lib/sa-labour-law-knowledge.ts` - Knowledge base and search functions

### Files Modified
1. `components/ai-chat-widget.tsx` - Integrated knowledge base, updated response logic

### Key Functions
- `searchKnowledgeBase(query)` - Finds relevant knowledge entries
- `formatKnowledgeResponse(entry)` - Formats response with citation
- `getCategoryFromQuery(query)` - Categorizes user query

## Compliance Notes

All information provided:
- Is based on official South African labour legislation
- Cites specific sections and Act numbers
- Is factual and compliant with actual law
- Includes reference citations (📖)
- Provides accurate, legally sound guidance

## Future Enhancements (Optional)

1. **API Integration** - Connect to actual legal database
2. **Text-to-Speech** - Voice synthesis for responses
3. **Multi-language** - Support for other official SA languages
4. **Case Studies** - Add real-world examples
5. **Document Links** - Link to full Act documents
6. **Search History** - Track frequently asked questions

## Testing Checklist

✅ Knowledge base searches correctly
✅ Responses include proper citations
✅ Quick actions provide relevant information
✅ Fallback responses work for unexpected queries
✅ Greeting and help messages are welcoming
✅ Professional tone maintained throughout
✅ No generic responses, all content is informed
✅ Visual design unchanged

## Benefits

- **Accurate Information** - All responses based on actual South African law
- **Referenced** - Every response cites the relevant Act and Section
- **Comprehensive** - Covers all major employment legislation
- **Professional** - Formal, authoritative tone
- **Accessible** - Available 24/7 for employees
- **Compliant** - Ensures employees understand their rights

The chatbot is now a true HR compliance assistant providing accurate, referenced guidance on South African labour law! 🇿🇦

