# Contact HR Feature - Working Prototype

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (Next.js with API routes)
npm run dev

# Visit http://localhost:3000
```

## Features

- ✅ Contact HR modal with form validation
- ✅ File upload support (5 files, 10MB max each)
- ✅ In-memory backend API (no database required)
- ✅ My HR Cases dashboard section
- ✅ Mobile responsive design
- ✅ Accessibility support (ARIA, keyboard navigation)

## Project Structure

```
contact-hr-feature/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ContactHrModal.tsx
│       │   ├── MyHrCases.tsx
│       │   └── CaseDetailModal.tsx
│       └── lib/
│           └── api.ts
├── backend/
│   ├── routes/
│   │   └── hr-tickets.js
│   └── middleware/
│       └── validation.js
└── package.json
```

## Usage

1. Click "Contact HR" button on dashboard
2. Fill out the form (category, subject, description required)
3. Upload files if needed (optional)
4. Submit to create ticket
5. View your cases in "My HR Cases" section

## Tech Stack

- Next.js 14 (App Router)
- React 19
- Tailwind CSS
- Express.js (API routes)

