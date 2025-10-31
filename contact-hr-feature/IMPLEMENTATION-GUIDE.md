# Contact HR Feature - Complete Implementation Guide

## Overview

This is a complete, runnable prototype of the Contact HR feature. It includes:

1. **Contact HR Modal Component** - Full form with validation
2. **Backend API Routes** - Next.js API routes with in-memory storage
3. **My HR Cases Dashboard** - View and manage your tickets
4. **Mobile Responsive** - Works on all screen sizes

## Integration with Existing HRMS

To integrate this into your existing Next.js HRMS project:

### Step 1: Add the Modal Component

Copy `frontend/src/components/ContactHrModal.tsx` to your project at:
`/Users/xspark6/Downloads/xspark-hrms home versition/components/contact-hr-modal.tsx`

### Step 2: Add the API Routes

Create these files in your existing project:

1. `app/api/hr-tickets/route.ts` - GET (my tickets list)
2. `app/api/hr-tickets/[id]/route.ts` - GET (single ticket)
3. `app/api/hr-tickets/route.ts` - POST (create ticket)

### Step 3: Add to Dashboard

In `app/dashboard/page.tsx`, add:

```tsx
import { ContactHrModal } from "@/components/contact-hr-modal"
import { MyHrCases } from "@/components/my-hr-cases"

// In your dashboard JSX:
<ContactHrModal />
<MyHrCases />
```

### Step 4: Add to Sidebar or Quick Actions

In `app/dashboard/page.tsx`, update the "Contact HR" button:

```tsx
<Button 
  className="h-auto flex-col gap-2 py-6 bg-transparent" 
  variant="outline"
  onClick={() => {
    // Trigger modal
    setShowContactHrModal(true)
  }}
>
  <MessageSquare className="h-6 w-6 text-primary" />
  <span>Contact HR</span>
</Button>
```

## Files to Add/Create

### 1. Contact HR Modal Component
`components/contact-hr-modal.tsx`

### 2. My HR Cases Component
`components/my-hr-cases.tsx`

### 3. Case Detail Modal
`components/case-detail-modal.tsx`

### 4. API Client
`lib/api-client.ts`

### 5. API Route Handlers
- `app/api/hr-tickets/route.ts` (POST)
- `app/api/hr-tickets/my-tickets/route.ts` (GET list)
- `app/api/hr-tickets/[id]/route.ts` (GET single)

### 6. Ticket Service
`lib/services/hr-ticket-service.ts`

## Testing

1. Open dashboard
2. Click "Contact HR" button
3. Fill out form and submit
4. View ticket in "My HR Cases"
5. Click on ticket to see details

## API Endpoints

- `POST /api/hr-tickets` - Create new ticket
- `GET /api/hr-tickets/my-tickets` - List user's tickets
- `GET /api/hr-tickets/[id]` - Get single ticket

## Database Schema (Future)

When you're ready to add database persistence:

```sql
CREATE TABLE hr_tickets (
  id VARCHAR(20) PRIMARY KEY,
  employee_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  subject VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  attachments JSONB,
  contact_method VARCHAR(20),
  confidential BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'normal',
  sla_priority VARCHAR(20),
  estimated_sla VARCHAR(50),
  assigned_to UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX idx_employee_tickets ON hr_tickets(employee_id);
CREATE INDEX idx_confidential_tickets ON hr_tickets(confidential, status);
```

## Status: Prototype Complete ✅

All components, API routes, and integrations are ready for testing.

