// ============================================================================
// SEND BRANDED EMAIL — Edge Function
// ============================================================================
// Sends transactional HRMS emails (welcome / contract expiry) via Resend,
// styled to match the X Spark HRMS web app (app/globals.css brand tokens:
// primary gradient #a6206a -> #c9234a, accent red #e31e24, accent gray #808285).
//
// Invoked by:
//  - trg_employees_welcome_email (DB trigger, on new employee row)
//  - check_contract_expiry_reminders() (daily pg_cron job)
// Both call this function via pg_net with the service_role key, so this
// function itself uses the service role to read employee/contract data.
// ============================================================================

// @ts-ignore - Deno std library imports are valid in Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - ESM imports are valid in Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BRAND = {
  gradientStart: '#a6206a',
  gradientEnd: '#c9234a',
  accentRed: '#e31e24',
  accentGray: '#808285',
  textDark: '#241a3a', // approximates oklch(0.25 0.02 265)
  bg: '#f6f5f8',
}

function layout(opts: { preheader: string; title: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }) {
  const { preheader, title, bodyHtml, ctaLabel, ctaUrl } = opts
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg, ${BRAND.gradientStart}, ${BRAND.gradientEnd});padding:28px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">X Spark HRMS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:${BRAND.textDark};font-size:15px;line-height:1.6;">
            <h1 style="font-size:20px;margin:0 0 16px;color:${BRAND.textDark};">${title}</h1>
            ${bodyHtml}
            ${
              ctaLabel && ctaUrl
                ? `<div style="margin-top:28px;">
                     <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg, ${BRAND.gradientStart}, ${BRAND.gradientEnd});color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${ctaLabel}</a>
                   </div>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;">
            <span style="color:${BRAND.accentGray};font-size:12px;">This is an automated message from X Spark HRMS. Please do not reply directly to this email.</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function welcomeEmailHtml(employee: any, appUrl: string) {
  return layout({
    preheader: `Welcome to X Spark HRMS, ${employee.first_name}!`,
    title: `Welcome aboard, ${employee.first_name}! 🎉`,
    bodyHtml: `
      <p>Your employee account has been created in X Spark HRMS.</p>
      <table role="presentation" style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:${BRAND.accentGray};">Employee ID</td><td style="padding:6px 0;font-weight:600;">${employee.employee_id}</td></tr>
        <tr><td style="padding:6px 0;color:${BRAND.accentGray};">Email</td><td style="padding:6px 0;font-weight:600;">${employee.email}</td></tr>
        <tr><td style="padding:6px 0;color:${BRAND.accentGray};">Start date</td><td style="padding:6px 0;font-weight:600;">${employee.date_hired}</td></tr>
      </table>
      <p>Log in to complete your profile, view your leave balance, and access company resources.</p>
    `,
    ctaLabel: 'Go to HRMS',
    ctaUrl: appUrl,
  })
}

function contractExpiryEmailHtml(employee: any, daysRemaining: number, endDate: string, appUrl: string) {
  const urgency = daysRemaining <= 7 ? BRAND.accentRed : BRAND.gradientStart
  return layout({
    preheader: `Your contract expires in ${daysRemaining} days`,
    title: `Your contract is expiring soon`,
    bodyHtml: `
      <p>Hi ${employee.first_name},</p>
      <p>This is a reminder that your employment contract is set to expire in
      <strong style="color:${urgency};">${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>
      (${endDate}).</p>
      <p>Please reach out to HR if you have any questions about renewal or next steps.</p>
    `,
    ctaLabel: 'View my contract',
    ctaUrl: `${appUrl}/profile`,
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@xspark.com'
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://xspark-hrms.vercel.app'

    const supabase = createClient(supabaseUrl, serviceKey)
    const { template, employeeId, daysRemaining } = await req.json()

    if (!employeeId) {
      return new Response(JSON.stringify({ success: false, error: 'employeeId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_id, email, date_hired')
      .eq('id', employeeId)
      .single()

    if (empErr || !employee) {
      return new Response(JSON.stringify({ success: false, error: 'Employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subject = ''
    let html = ''

    if (template === 'welcome') {
      subject = `Welcome to X Spark HRMS, ${employee.first_name}!`
      html = welcomeEmailHtml(employee, appUrl)
    } else if (template === 'contract_expiry') {
      const { data: contract } = await supabase
        .from('contracts')
        .select('end_date')
        .eq('employee_id', employeeId)
        .eq('status', 'active')
        .order('end_date', { ascending: true })
        .limit(1)
        .maybeSingle()

      subject = `Your contract expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
      html = contractExpiryEmailHtml(employee, daysRemaining, contract?.end_date ?? 'soon', appUrl)
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Unknown template' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({ from: fromEmail, to: [employee.email], subject, html }),
    })
    const resendData = await resendResp.json()

    if (!resendResp.ok) {
      return new Response(JSON.stringify({ success: false, error: resendData.message || 'Resend error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mirror into in-app notifications so it also shows in the notification bell.
    await supabase.from('notifications').insert({
      employee_id: employee.id,
      title: subject,
      message: template === 'welcome' ? 'Welcome to X Spark HRMS!' : `Contract expiring in ${daysRemaining} days`,
      notification_type: template,
      email_sent: true,
      email_sent_at: new Date().toISOString(),
      published_by_system: true,
    })

    return new Response(JSON.stringify({ success: true, messageId: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
