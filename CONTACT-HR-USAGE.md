# Contact HR Feature - Usage Guide

## Quick Start

The Contact HR feature is now fully integrated into your dashboard. No additional setup required!

### How to Use

1. **Open Dashboard**
   - Navigate to `/dashboard`
   - Look for the "Contact HR" button in the Quick Actions section

2. **Submit a Request**
   - Click "Contact HR" button
   - Modal opens with form
   - Select a category (Leave, Payroll, Benefits, Compliance, Other)
   - Subcategory appears automatically
   - Fill in subject (minimum 5 characters)
   - Add description (minimum 20 characters)
   - Optionally upload files (max 5, 10MB each)
   - Choose preferred contact method (Email, Teams, Phone)
   - Check confidential checkbox if needed
   - Click "Submit Request"

3. **View Your Cases**
   - Scroll down to "My HR Cases" section
   - See all your submitted tickets
   - Click on any ticket to view details
   - Status badges show current status

## Features

### Categories
- **Leave**: Time off, leave balance, maternity/paternity
- **Payroll**: Salary issues, payslips, tax queries
- **Benefits**: Medical aid, insurance, retirement fund
- **Compliance**: Policy violations, regulatory queries
- **Other**: General HR inquiries

### Status Types
- **Open** (Magenta badge): New ticket, awaiting HR response
- **In Progress** (Orange badge): Being worked on by HR
- **Resolved** (Green badge): Completed
- **Closed** (Gray badge): No further action needed

### Confidential Tickets
- Mark checkbox if sensitive matter
- Only visible to employee_relations role
- Red banner in detail view

### File Attachments
- Supported: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
- Max 5 files per ticket
- 10MB per file limit
- Preview before upload

## API Endpoints

### Create Ticket
```bash
POST /api/hr-tickets
Content-Type: application/json

{
  "category": "leave",
  "subject": "Leave request approval",
  "description": "Need time off for family emergency...",
  "contact_method": "email",
  "confidential": false
}
```

### List My Tickets
```bash
GET /api/hr-tickets?employee_id=your-id
```

## Design System

Follows dashboard aesthetic:
- **Colors**: White background, magenta/pink gradients (#C51162 → #E91E63)
- **Font**: Inter (clean sans-serif)
- **Cards**: Rounded corners, subtle shadows
- **Grid**: Clean layout with generous padding
- **Responsive**: Mobile and desktop optimized

## Mobile Experience

- Modal adapts to screen size
- Touch-friendly file upload
- Scrollable forms
- Optimized for small screens

## Keyboard Shortcuts

- **Esc**: Close modal
- **Tab**: Navigate between fields
- **Enter**: Submit form (when focused on submit button)

## Troubleshooting

### Modal doesn't open
- Check browser console for errors
- Ensure button click handler is wired correctly

### Form validation fails
- Check all required fields are filled
- Minimum lengths: Subject (5), Description (20)

### Files won't upload
- Check file size (max 10MB)
- Check file type (PDF, DOC, XLS, JPG, PNG only)

### Ticket not showing in My HR Cases
- Refresh page
- Check network tab for API errors
- Verify employee_id in API request

## Status: ✅ Ready to Use

All features are implemented and tested. Happy ticket submitting!

