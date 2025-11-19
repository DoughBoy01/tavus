# Implementation Guide - Critical Features

This guide provides step-by-step implementation instructions for the most critical missing features.

---

## 1. Fix Database Schema Issues

### Step 1.1: Add Missing Columns Migration

Create: `supabase/migrations/20250119_fix_conversations_schema.sql`

```sql
-- Add missing columns to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS transcript text,
ADD COLUMN IF NOT EXISTS case_category text,
ADD COLUMN IF NOT EXISTS firm_location text,
ADD COLUMN IF NOT EXISTS openai_urgency_score integer;

-- Add lead claiming columns
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS lead_value decimal DEFAULT 0,
ADD COLUMN IF NOT EXISTS claimed_at timestamp,
ADD COLUMN IF NOT EXISTS claimed_by_firm_id uuid REFERENCES law_firms(id),
ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES profiles(id);

-- Add subscription columns to law_firms
ALTER TABLE law_firms
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS monthly_lead_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS leads_used_this_month integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  read_at timestamp
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_firm ON notifications(law_firm_id);
CREATE INDEX IF NOT EXISTS idx_leads_claimed ON leads(claimed_by_firm_id, claimed_at);
CREATE INDEX IF NOT EXISTS idx_conversations_category ON conversations(case_category);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Legal admins can view firm notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'legal_admin'
      AND profiles.law_firm_id = notifications.law_firm_id
    )
  );
```

### Step 1.2: Update Database Types

```bash
# Generate new TypeScript types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

---

## 2. Lead Notification System

### Step 2.1: Create Email Notification Edge Function

Create: `supabase/functions/send-lead-notification/index.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

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
  // Option 1: Use Resend (recommended)
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  if (RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Legal Leads <noreply@yourdomain.com>',
        to: data.to,
        subject: data.subject,
        html: data.html,
      }),
    });

    return response.ok;
  }

  // Option 2: Fallback to console log for development
  console.log('📧 Email would be sent:', { to: data.to, subject: data.subject });
  return true;
}

function generateLeadEmailHTML(data: EmailData): string {
  const urgencyBadge = data.leadDetails.urgencyScore >= 8
    ? '<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px;">🔥 URGENT</span>'
    : data.leadDetails.urgencyScore >= 6
    ? '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px;">⚡ High Priority</span>'
    : '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 4px;">Standard</span>';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .lead-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { margin: 12px 0; }
    .label { font-weight: bold; color: #64748b; }
    .value { color: #1e293b; margin-left: 10px; }
    .cta-button { background: #22c5fe; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: bold; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New Lead Match!</h1>
    </div>
    <div class="content">
      <p>Hi ${data.firmName},</p>
      <p>Great news! You've been matched with a new potential client who needs your expertise.</p>

      <div class="lead-details">
        <div style="margin-bottom: 15px;">
          ${urgencyBadge}
        </div>

        <div class="detail-row">
          <span class="label">Practice Area:</span>
          <span class="value">${data.leadDetails.practiceArea}</span>
        </div>

        <div class="detail-row">
          <span class="label">Client Name:</span>
          <span class="value">${data.leadDetails.name || 'Not provided'}</span>
        </div>

        <div class="detail-row">
          <span class="label">Email:</span>
          <span class="value">${data.leadDetails.email || 'Not provided'}</span>
        </div>

        <div class="detail-row">
          <span class="label">Phone:</span>
          <span class="value">${data.leadDetails.phone || 'Not provided'}</span>
        </div>

        <div class="detail-row">
          <span class="label">Case Summary:</span>
          <div class="value" style="margin-top: 8px; padding: 12px; background: #f1f5f9; border-radius: 4px;">
            ${data.leadDetails.caseDescription}
          </div>
        </div>
      </div>

      <a href="${Deno.env.get('APP_URL')}/admin/leads" class="cta-button">
        👉 Claim This Lead Now
      </a>

      <p style="color: #ef4444; font-weight: bold;">⏰ This lead will be available to other firms in 2 hours if not claimed.</p>

      <p>Best regards,<br>Your Legal Leads Team</p>
    </div>
    <div class="footer">
      <p>You're receiving this because you're subscribed to lead notifications.</p>
      <p><a href="${Deno.env.get('APP_URL')}/admin/firm-settings">Manage notification settings</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return new Response(JSON.stringify({ error: 'Missing matchId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
      console.error('Error fetching match:', matchError);
      return new Response(JSON.stringify({ error: 'Match not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get firm admins to notify
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('role', 'legal_admin')
      .eq('law_firm_id', match.law_firm_id);

    if (!admins || admins.length === 0) {
      console.warn('No admins found for firm:', match.law_firm_id);
      return new Response(JSON.stringify({ warning: 'No admins to notify' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send email to each admin
    const emailPromises = admins.map(async (admin) => {
      const emailData: EmailData = {
        to: admin.email,
        subject: `🎯 New ${match.lead.practice_area?.name} Lead - ${match.match_score >= 0.8 ? 'Excellent Match!' : 'Good Match'}`,
        firmName: match.law_firm.name,
        html: '',
        leadDetails: {
          name: match.lead.conversation.name,
          email: match.lead.conversation.email,
          phone: match.lead.conversation.phone,
          caseDescription: match.lead.conversation.case_description,
          urgencyScore: match.lead.conversation.urgency_score || match.lead.conversation.openai_urgency_score || 5,
          practiceArea: match.lead.practice_area?.name || 'General',
        },
      };

      emailData.html = generateLeadEmailHTML(emailData);

      // Send email
      const emailSent = await sendEmail(emailData);

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id: admin.id,
        law_firm_id: match.law_firm_id,
        type: 'lead_matched',
        title: `New ${match.lead.practice_area?.name} Lead`,
        message: `You've been matched with a new potential client. Match score: ${(match.match_score * 100).toFixed(0)}%`,
        link: `/admin/leads/${match.lead_id}`,
      });

      return emailSent;
    });

    await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({ message: 'Notifications sent successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 2.2: Trigger Notification After Match Creation

Update: `supabase/migrations/20250119_add_match_notification_trigger.sql`

```sql
-- Function to send notification after match is created
CREATE OR REPLACE FUNCTION notify_law_firm_of_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the edge function asynchronously
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-lead-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
    ),
    body := jsonb_build_object('matchId', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on new matches
CREATE TRIGGER match_notification_trigger
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_law_firm_of_match();
```

---

## 3. Legal Admin Lead Management Screen

Create: `src/screens/admin/LeadManagement.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  ExternalLink
} from 'lucide-react';

interface Lead {
  id: string;
  status: string;
  created_at: string;
  claimed_at: string | null;
  conversation: {
    name: string;
    email: string;
    phone: string;
    case_description: string;
    case_category: string;
    urgency_score: number;
  };
  practice_area: {
    name: string;
  };
  matches: Array<{
    id: string;
    match_score: number;
    status: string;
  }>;
}

export const LeadManagement = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'claimed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    fetchLeads();
  }, [filter]);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);

      // Get user's law firm
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.law_firm_id) {
        console.error('User not associated with a law firm');
        return;
      }

      // Build query
      let query = supabase
        .from('leads')
        .select(`
          *,
          conversation:conversations!inner (
            name,
            email,
            phone,
            case_description,
            case_category,
            urgency_score,
            openai_urgency_score
          ),
          practice_area:practice_areas (
            name
          ),
          matches!inner (
            id,
            match_score,
            status,
            law_firm_id
          )
        `)
        .eq('matches.law_firm_id', profile.law_firm_id)
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter === 'pending') {
        query = query.is('claimed_at', null);
      } else if (filter === 'claimed') {
        query = query.not('claimed_at', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const claimLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
          claimed_by_user_id: user?.id,
        })
        .eq('id', leadId);

      if (error) throw error;

      // Refresh leads
      await fetchLeads();

      alert('Lead claimed successfully! Client contact information is now available.');
    } catch (error) {
      console.error('Error claiming lead:', error);
      alert('Failed to claim lead. Please try again.');
    }
  };

  const getUrgencyBadge = (score: number) => {
    if (score >= 8) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Urgent</Badge>;
    } else if (score >= 6) {
      return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" /> High</Badge>;
    } else {
      return <Badge variant="secondary">Standard</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Lead Management</h2>

        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All Leads
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
          >
            Available
          </Button>
          <Button
            variant={filter === 'claimed' ? 'default' : 'outline'}
            onClick={() => setFilter('claimed')}
          >
            My Leads
          </Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-400">No leads found. Check back soon!</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practice Area</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Case Summary</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Match Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const match = lead.matches[0];
                const isClaimed = lead.claimed_at !== null;

                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.practice_area?.name || 'General'}
                    </TableCell>

                    <TableCell>
                      {isClaimed ? (
                        <div>
                          <p className="font-medium">{lead.conversation.name}</p>
                          <p className="text-sm text-zinc-400">{lead.conversation.case_category}</p>
                        </div>
                      ) : (
                        <p className="text-zinc-500">Claim to reveal</p>
                      )}
                    </TableCell>

                    <TableCell>
                      {isClaimed ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${lead.conversation.email}`} className="text-cyan-400 hover:underline">
                              {lead.conversation.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${lead.conversation.phone}`} className="text-cyan-400 hover:underline">
                              {lead.conversation.phone}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-zinc-500">Claim to reveal</p>
                      )}
                    </TableCell>

                    <TableCell className="max-w-xs">
                      <p className="line-clamp-2 text-sm text-zinc-300">
                        {lead.conversation.case_description}
                      </p>
                    </TableCell>

                    <TableCell>
                      {getUrgencyBadge(lead.conversation.urgency_score || lead.conversation.openai_urgency_score || 5)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400"
                            style={{ width: `${(match?.match_score || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {((match?.match_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isClaimed ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle className="h-3 w-3" /> Claimed
                        </Badge>
                      ) : (
                        <Badge variant="outline">Available</Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {!isClaimed ? (
                        <Button
                          size="sm"
                          onClick={() => claimLead(lead.id)}
                        >
                          Claim Lead
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `/admin/leads/${lead.id}`}
                        >
                          View Details
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
```

### Step 3.2: Add Route

Update: `src/App.tsx`

```typescript
// Add import
import { LeadManagement } from './screens/admin/LeadManagement';

// Add route inside LegalAdminRoute
<Route path="/admin/leads" element={<LeadManagement />} />
```

---

## 4. Post-Conversation Thank You Screen

Update: `src/screens/Conversation.tsx`

```typescript
// In the leaveConversation function, change:
// From:
setScreenState({ currentScreen: "intro" });

// To:
setScreenState({ currentScreen: "final" });
```

Update: `src/screens/FinalScreen.tsx`

```typescript
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { screenAtom } from '@/store/screens';
import { useAtom } from 'jotai';
import { CheckCircle, Mail, Clock } from 'lucide-react';

export const FinalScreen = () => {
  const [email, setEmail] = useState('');
  const [, setScreenState] = useAtom(screenAtom);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleEmailSubmit = async () => {
    if (email) {
      // TODO: Save email to follow-up list
      setEmailSubmitted(true);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-6">
      <div className="max-w-2xl text-center space-y-8">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-400">
          <CheckCircle className="h-10 w-10" />
        </div>

        <h1 className="text-4xl font-bold text-white">
          Thank You for Sharing Your Case!
        </h1>

        <div className="space-y-4 text-lg text-zinc-300">
          <p>
            We've received your information and our AI is analyzing your case to find the best legal match.
          </p>

          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-6 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-cyan-400 mt-1" />
              <div className="text-left">
                <p className="font-semibold text-white">What happens next?</p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li>✓ We're matching you with qualified law firms (takes 2-5 minutes)</li>
                  <li>✓ Selected firms will review your case details</li>
                  <li>✓ You'll receive a call or email within 24 hours</li>
                  <li>✓ Average response time: <span className="font-semibold text-cyan-400">4 hours</span></li>
                </ul>
              </div>
            </div>
          </div>

          {!emailSubmitted ? (
            <div className="mt-8 space-y-3">
              <p className="text-sm text-zinc-400">
                Want case status updates?
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="max-w-xs mx-auto"
                />
                <Button onClick={handleEmailSubmit}>
                  <Mail className="mr-2 h-4 w-4" />
                  Get Updates
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-sm text-green-400">
              ✓ We'll send updates to {email}
            </div>
          )}
        </div>

        <div className="pt-8 space-y-4">
          <p className="text-sm text-zinc-400">
            Case Reference: <span className="font-mono text-cyan-400">{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
          </p>

          <Button
            variant="outline"
            onClick={() => setScreenState({ currentScreen: 'intro' })}
          >
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};
```

---

## 5. Quick Deployment Checklist

### Environment Variables Needed

```bash
# .env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# For email notifications
RESEND_API_KEY=your_resend_key

# For OpenAI
OPENAI_API_KEY=your_openai_key

# App URL for email links
APP_URL=https://yourdomain.com
```

### Deployment Steps

1. **Apply Database Migrations**
   ```bash
   supabase db push
   ```

2. **Deploy Edge Functions**
   ```bash
   supabase functions deploy send-lead-notification
   supabase functions deploy tavus-webhook
   supabase functions deploy process-lead-extraction
   ```

3. **Set Function Secrets**
   ```bash
   supabase secrets set RESEND_API_KEY=your_key
   supabase secrets set OPENAI_API_KEY=your_key
   supabase secrets set APP_URL=https://yourdomain.com
   ```

4. **Test Notification Flow**
   - Create a test conversation
   - Verify lead is created
   - Check match is generated
   - Confirm email/notification sent

---

## Next Steps

After implementing these core features:

1. **Build Firm Onboarding Flow**
   - Practice area selection
   - Capacity settings
   - Notification preferences
   - Payment setup

2. **Add Billing System**
   - Stripe integration
   - Subscription management
   - Usage tracking
   - Invoice generation

3. **Create System Admin Tools**
   - Firm approval workflow
   - Manual matching override
   - Quality control dashboard
   - Revenue reporting

4. **Enhance Matching Algorithm**
   - Location-based scoring
   - Historical performance data
   - Client preference matching
   - Dynamic pricing

5. **Add Communication Features**
   - In-app messaging
   - Automated follow-ups
   - Meeting scheduler
   - Document sharing
