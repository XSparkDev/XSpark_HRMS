# Chatbot Reference Knowledge Base

This folder contains reference documents used by the AI chatbot to provide accurate, context-aware responses about South African HR and employment law.

## Available Documents

1. **Disciplinary.md** - Disciplinary Guide on Disciplinary and Incapacity Matters
   - Category: Disciplinary & Procedures
   - Covers disciplinary procedures, incapacity matters, termination procedures

2. **basic-employee-condition.md** - Basic Conditions of Employment Act
   - Category: Employment Law
   - Covers working time, leave, remuneration, termination, employee rights

3. **workplace-conduct.md** - Workplace Conduct and Employment Equity
   - Category: Workplace Conduct & Equity
   - Covers discrimination, affirmative action, workplace conduct throughout employment lifecycle

4. **safety-rules.md** - Occupational Health and Safety Rules
   - Category: Health & Safety
   - Covers workplace safety policies, responsibilities, and procedures

## Usage

### Server-Side (API Routes, Server Components)

```typescript
import { 
  loadAllReferenceDocuments, 
  loadReferenceDocument, 
  searchReferenceDocuments,
  getReferenceContext,
  formatReferencesForPrompt 
} from '@/lib/chatbot-reference';

// Load all documents
const allDocs = loadAllReferenceDocuments();

// Load specific document
const doc = loadReferenceDocument('Disciplinary.md');

// Search documents
const results = searchReferenceDocuments('disciplinary procedure');

// Get formatted context for AI prompt
const context = getReferenceContext('maternity leave');
const formatted = formatReferencesForPrompt(context);
```

### Client-Side (React Components)

```typescript
import { 
  fetchAllReferences,
  fetchReference,
  searchReferences,
  getFormattedReferenceContext 
} from '@/lib/chatbot-reference-client';

// Fetch all documents
const allDocs = await fetchAllReferences();

// Fetch specific document
const doc = await fetchReference('Disciplinary.md');

// Search documents
const results = await searchReferences('disciplinary procedure');

// Get formatted context for AI prompt (recommended)
const formattedContext = await getFormattedReferenceContext('maternity leave');
```

### API Endpoints

```
GET /api/chatbot/references
  - Get all reference documents
  - Query params:
    - ?search=query - Search documents
    - ?filename=name.md - Get specific document
    - ?category=category - Filter by category
```

## Adding New Documents

1. Add the `.md` file to this folder
2. Update the `DOCUMENT_METADATA` in `lib/chatbot-reference.ts`:
   ```typescript
   'new-document.md': {
     title: 'Document Title',
     description: 'Brief description',
     category: 'Category Name'
   }
   ```

## Integration with Chatbot

The chatbot can use these references to provide accurate, context-aware responses. Example:

```typescript
// In your chatbot component
import { getFormattedReferenceContext } from '@/lib/chatbot-reference-client';

const handleSendMessage = async (message: string) => {
  // Get relevant context from reference documents
  const referenceContext = await getFormattedReferenceContext(message, 3);
  
  // Include in AI prompt
  const prompt = `
    ${referenceContext}
    
    User Question: ${message}
    
    Please answer based on the reference documents provided above.
  `;
  
  // Send to AI API...
};
```

