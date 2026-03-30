// ============================================================================
// HR MANAGEMENT SYSTEM EMAIL TEMPLATES
// ============================================================================

import { emailService } from '../services/email-service'

// Placeholder structure for HRMS email templates
// Add specific templates as needed for HR Management System

const getBaseEmailTemplate = (content: string, title: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #92278F 0%, #BE1E2D 100%);
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
      margin: -30px -30px 30px -30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      margin: 20px 0;
    }
    .info-box {
      background-color: #f9fafb;
      border-left: 4px solid #92278F;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #6b7280;
    }
    .info-value {
      color: #1f2937;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #92278F 0%, #BE1E2D 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>X Spark HR Management</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated email from X Spark HR Management System.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Add HRMS-specific email template functions here as needed
// Example structure:
// export async function sendLeaveRequestEmail(data: LeaveRequestData): Promise<{ success: boolean; error?: string }> {
//   // Implementation
// }
