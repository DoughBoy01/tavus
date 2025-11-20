import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EmailData {
  to: string;
  subject: string;
  html: string;
  firmName: string;
  leadDetails: {
    name: string;
    email: string;
    phone: string;
    caseDescription: string;
    urgencyScore: number;
    practiceArea: string;
  };
}

async function sendEmail(data: EmailData): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Legal Leads Platform <noreply@yourdomain.com>',
          to: data.to,
          subject: data.subject,
          html: data.html,
        }),
      });

      if (!response.ok) {
        console.error('Resend API error:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Fallback: log to console in development
  console.log('📧 Email would be sent to:', data.to);
  console.log('📧 Subject:', data.subject);
  return true;
}

function generateLeadEmailHTML(data: EmailData): string {
  const urgencyBadge = data.leadDetails.urgencyScore >= 8
    ? '<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">🔥 URGENT</span>'
    : data.leadDetails.urgencyScore >= 6
    ? '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">⚡ High Priority</span>'
    : '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">📌 Standard</span>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .lead-details {
      background: #f8fafc;
      padding: 24px;
      border-radius: 8px;
      margin: 24px 0;
      border: 1px solid #e2e8f0;
    }
    .detail-row {
      margin: 14px 0;
      display: flex;
      align-items: flex-start;
    }
    .label {
      font-weight: 600;
      color: #64748b;
      min-width: 140px;
    }
    .value {
      color: #1e293b;
      flex: 1;
    }
    .case-summary {
      margin-top: 8px;
      padding: 16px;
      background: white;
      border-radius: 6px;
      border-left: 4px solid #22c5fe;
      font-size: 14px;
      line-height: 1.6;
    }
    .cta-button {
      background: #22c5fe;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 6px;
      display: inline-block;
      margin: 24px 0;
      font-weight: bold;
      font-size: 16px;
      transition: background 0.2s;
    }
    .cta-button:hover {
      background: #1ba5d6;
    }
    .warning-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      color: #991b1b;
    }
    .warning-box strong {
      display: block;
      margin-bottom: 8px;
      font-size: 15px;
    }
    .footer {
      text-align: center;
      color: #64748b;
      font-size: 13px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #22c5fe;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New Lead Match!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">A potential client needs your expertise</p>
    </div>

    <div class="content">
      <p style="font-size: 16px; margin-bottom: 8px;">Hi <strong>${data.firmName}</strong>,</p>
      <p>Great news! You've been matched with a new potential client based on your practice areas and expertise.</p>

      <div class="lead-details">
        <div style="margin-bottom: 20px;">
          ${urgencyBadge}
        </div>

        <div class="detail-row">
          <span class="label">Practice Area:</span>
          <span class="value"><strong>${data.leadDetails.practiceArea}</strong></span>
        </div>

        <div class="detail-row">
          <span class="label">Client Name:</span>
          <span class="value">${data.leadDetails.name || '<em>Will be revealed when claimed</em>'}</span>
        </div>

        <div class="detail-row">
          <span class="label">Email:</span>
          <span class="value">${data.leadDetails.email || '<em>Will be revealed when claimed</em>'}</span>
        </div>

        <div class="detail-row">
          <span class="label">Phone:</span>
          <span class="value">${data.leadDetails.phone || '<em>Will be revealed when claimed</em>'}</span>
        </div>

        <div style="margin-top: 20px;">
          <span class="label" style="display: block; margin-bottom: 8px;">Case Summary:</span>
          <div class="case-summary">
            ${data.leadDetails.caseDescription || 'No description provided'}
          </div>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${Deno.env.get('APP_URL') || 'http://localhost:5173'}/admin/leads" class="cta-button">
          👉 Claim This Lead Now
        </a>
      </div>

      <div class="warning-box">
        <strong>⏰ Time-Sensitive Opportunity</strong>
        This lead will be available to other qualified firms if not claimed within 2 hours. First come, first served!
      </div>

      <p style="margin-top: 30px;">Best regards,<br><strong>Your Legal Leads Team</strong></p>
    </div>

    <div class="footer">
      <p>You're receiving this email because you're subscribed to lead notifications for ${data.firmName}.</p>
      <p><a href="${Deno.env.get('APP_URL') || 'http://localhost:5173'}/admin/firm-settings">Manage notification settings</a> | <a href="${Deno.env.get('APP_URL') || 'http://localhost:5173'}/admin/firm-dashboard">View Dashboard</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'Missing matchId parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('📨 Processing lead notification for match:', matchId);

    // Get match details with all related data
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        lead:leads!inner (
          *,
          conversation:conversations!inner (
            *
          ),
          practice_area:practice_areas (
            name
          )
        ),
        law_firm:law_firms!inner (
          *
        )
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      console.error('❌ Error fetching match:', matchError);
      return new Response(
        JSON.stringify({ error: 'Match not found', details: matchError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Match found:', {
      firmId: match.law_firm_id,
      firmName: match.law_firm.name,
      leadId: match.lead_id,
    });

    // Get firm admins to notify
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('role', 'legal_admin')
      .eq('law_firm_id', match.law_firm_id);

    if (adminsError) {
      console.error('❌ Error fetching admins:', adminsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch firm admins' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!admins || admins.length === 0) {
      console.warn('⚠️ No admins found for firm:', match.law_firm_id);

      // Still create a notification for the firm (will be visible when they add admins)
      await supabase.from('notifications').insert({
        law_firm_id: match.law_firm_id,
        type: 'lead_matched',
        title: `New ${match.lead.practice_area?.name || 'Lead'}`,
        message: `You've been matched with a new potential client. Match score: ${(match.match_score * 100).toFixed(0)}%`,
        link: `/admin/leads/${match.lead_id}`,
      });

      return new Response(
        JSON.stringify({
          warning: 'No admins to notify, but notification created',
          notificationCreated: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📧 Sending notifications to ${admins.length} admin(s)`);

    // Send email to each admin and create in-app notification
    const results = await Promise.allSettled(
      admins.map(async (admin) => {
        const emailData: EmailData = {
          to: admin.email,
          subject: `🎯 New ${match.lead.practice_area?.name || 'Legal'} Lead${match.match_score >= 0.8 ? ' - Excellent Match!' : match.match_score >= 0.6 ? ' - Good Match' : ''}`,
          firmName: match.law_firm.name,
          html: '',
          leadDetails: {
            name: match.lead.conversation.name || '',
            email: match.lead.conversation.email || '',
            phone: match.lead.conversation.phone || '',
            caseDescription: match.lead.conversation.case_description || 'No description provided',
            urgencyScore: match.lead.conversation.urgency_score ||
                          match.lead.conversation.openai_urgency_score || 5,
            practiceArea: match.lead.practice_area?.name || 'General Practice',
          },
        };

        emailData.html = generateLeadEmailHTML(emailData);

        // Send email
        const emailSent = await sendEmail(emailData);

        // Create in-app notification
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: admin.id,
            law_firm_id: match.law_firm_id,
            type: 'lead_matched',
            title: `New ${match.lead.practice_area?.name || 'Legal'} Lead`,
            message: `You've been matched with a new potential client. Match score: ${(match.match_score * 100).toFixed(0)}%. ${emailData.leadDetails.urgencyScore >= 8 ? '🔥 URGENT case!' : ''}`,
            link: `/admin/leads/${match.lead_id}`,
            metadata: {
              matchId: match.id,
              matchScore: match.match_score,
              urgency: emailData.leadDetails.urgencyScore,
            },
          });

        if (notifError) {
          console.error('❌ Error creating notification:', notifError);
        }

        return {
          adminEmail: admin.email,
          emailSent,
          notificationCreated: !notifError,
        };
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Notifications complete: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Lead notifications processed',
        matchId,
        notificationsSent: successCount,
        notificationsFailed: failureCount,
        results: results.map(r =>
          r.status === 'fulfilled' ? r.value : { error: r.reason }
        ),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Notification error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
