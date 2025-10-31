# Tabbed HR Chatbot Implementation

## Overview

The chatbot has been upgraded with a tabbed interface to separate HR Questions from Employee Compliance, making it more organized and user-friendly.

## Features Implemented

### 1. Tabbed Interface
**Two tabs at the top of the chatbot:**
- **HR Questions** - For internal HR tasks and features
- **Employee Compliance** - For South African labour law information

### 2. Tab-Specific Quick Actions

#### HR Questions Tab Quick Actions:
1. **View Payslip** - Instructions on accessing payslips
2. **Apply for Leave** - Step-by-step leave application process
3. **Check Leave Balance** - How to view your leave balance
4. **Update Personal Info** - Guide for updating profile information

#### Employee Compliance Tab Quick Actions:
1. **Understand My Leave Rights** - BCEA leave entitlements
2. **Workplace Conduct Policy** - Professional conduct expectations
3. **Employee Act Guidance** - Overview of SA labour legislation
4. **Disciplinary Process Info** - LRA fair disciplinary procedures
5. **Health & Safety Rules** - OHSA safety rights and obligations

### 3. Updated Greetings
- **Removed "Dumela!"** greeting
- **Professional English greetings** used instead
- **Different greetings** for each tab context:
  - HR Questions: "Hello there 👋 I'm your HR Assistant — how can I help you today?"
  - Employee Compliance: "Hi there! 👋 I'm your HR Compliance Assistant..."

### 4. Tab State Management
- **Remembers active tab** - State persists when switching tabs
- **Smooth transitions** - Border-bottom underline animation
- **Visual feedback** - Active tab highlighted with primary color
- **Responsive design** - Works on both desktop and mobile

### 5. Tab-Specific Responses

#### HR Questions Responses:
- **View Payslip**: Guidance on navigating to payslips in Documents section
- **Apply for Leave**: Step-by-step process for leave requests
- **Check Leave Balance**: Direct link to dashboard balance cards and leave section
- **Update Personal Info**: Instructions for profile updates

#### Employee Compliance Responses:
- **Leave Rights**: BCEA Section 20 with all leave types
- **Conduct Policy**: Professional expectations aligned with labour law
- **Employee Act**: Complete overview of BCEA, LRA, OHSA, EEA, PEA
- **Disciplinary Process**: LRA Section 188 fair procedures and CCMA rights
- **Health & Safety**: OHSA Section 13 rights and employer duties

## UI/UX Enhancements

### Design
- **Clean tab bar** with smooth transitions
- **Active tab styling**: Primary color border-bottom underline
- **Hover effects**: Tab color transition on hover
- **Same color scheme**: Maintains existing brand colors
- **Responsive**: Fully works on mobile and desktop

### User Experience
- **Clear separation** of HR tasks vs compliance information
- **Easy navigation** between different types of assistance
- **Contextual responses** based on active tab
- **Quick access** to commonly needed functions

## Technical Implementation

### State Management
```typescript
const [activeTab, setActiveTab] = useState<"hr" | "compliance">("hr")
```

### Tab-Specific Quick Replies
```typescript
const hrQuickReplies = [...]
const complianceQuickReplies = [...]
const currentQuickReplies = activeTab === "hr" ? hrQuickReplies : complianceQuickReplies
```

### Welcome Messages
```typescript
const welcomeMessage: ChatMessage = {
  text: activeTab === "hr" 
    ? "Hello there 👋 I'm your HR Assistant — how can I help you today?"
    : "Hi there! 👋 I'm your HR Compliance Assistant..."
}
```

### Tab Rendering
```tsx
<div className="border-b px-4 flex items-center gap-1">
  <button onClick={() => setActiveTab("hr")} className={...}>
    HR Questions
  </button>
  <button onClick={() => setActiveTab("compliance")} className={...}>
    Employee Compliance
  </button>
</div>
```

## Usage Flow

### HR Questions Tab:
1. User clicks "View Payslip"
2. Bot provides instructions for navigating to Documents
3. User can follow step-by-step guidance
4. Can ask follow-up questions

### Employee Compliance Tab:
1. User clicks "Health & Safety Rules"
2. Bot provides OHSA Section 13 information
3. Cites specific Act and Section
4. Offers additional help if needed

## Benefits

✅ **Better Organization** - Clear separation of HR tasks vs compliance info  
✅ **User-Friendly** - Easy to find what you need  
✅ **Professional** - Updated greetings, formal tone  
✅ **Comprehensive** - Covers both internal HR and legal compliance  
✅ **Responsive** - Works on all screen sizes  
✅ **Accessible** - Tab navigation with clear visual indicators  

## Files Modified

1. **components/ai-chat-widget.tsx**
   - Added `activeTab` state
   - Added tab-specific quick replies
   - Added tab rendering in UI
   - Updated welcome messages
   - Added HR-specific response handlers
   - Removed "Dumela!" greeting

## Testing Checklist

✅ Tab switching works smoothly  
✅ Quick replies change based on active tab  
✅ Welcome message updates on tab change  
✅ Active tab is visually highlighted  
✅ HR tab responses provide internal task guidance  
✅ Compliance tab responses cite SA labour laws  
✅ Mobile responsive  
✅ No layout breaking  
✅ Smooth transitions  

## Next Steps (Optional Enhancements)

1. **Remember last tab** - Persist across sessions with localStorage
2. **Tab badges** - Show unread counts or notifications per tab
3. **Keyboard shortcuts** - Tab key to switch between tabs
4. **Voice navigation** - "Switch to HR tab" voice command
5. **Analytics** - Track which tab is used most frequently

The chatbot is now a modern, professional, and well-organized dual-purpose assistant! 🎉

