import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Check, X, Clock, AlertCircle, Phone, Mail, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LeadAssignment = {
  id: string;
  conversation: {
    id: string;
    name: string;
    email: string;
    phone: string;
    case_description: string;
    case_category: string;
    firm_location: string;
    openai_urgency_score: number;
    created_at: string;
  };
  match_score: number;
  status: string;
  assigned_at: string;
  expires_at: string;
  assignment_method: string;
};

type FirmStats = {
  totalLeads: number;
  acceptedLeads: number;
  pendingLeads: number;
  currentMonthLeads: number;
  maxLeadsPerMonth: number;
  conversionRate: number;
};

export const FirmDashboard = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [leadAssignments, setLeadAssignments] = useState<LeadAssignment[]>([]);
  const [firmStats, setFirmStats] = useState<FirmStats>({
    totalLeads: 0,
    acceptedLeads: 0,
    pendingLeads: 0,
    currentMonthLeads: 0,
    maxLeadsPerMonth: 50,
    conversionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeadAssignments();
    fetchFirmStats();
  }, [userProfile]);

  const fetchLeadAssignments = async () => {
    if (!userProfile?.email) return;

    try {
      // Get law firm ID first
      const { data: lawFirm } = await supabase
        .from('law_firms')
        .select('id')
        .eq('contact_email', userProfile.email)
        .single();

      if (!lawFirm) return;

      // Get lead assignments for this firm
      const { data: assignments, error } = await supabase
        .from('lead_assignments')
        .select(`
          *,
          conversation:conversations(
            id,
            name,
            email,
            phone,
            case_description,
            case_category,
            firm_location,
            openai_urgency_score,
            created_at
          )
        `)
        .eq('law_firm_id', lawFirm.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      setLeadAssignments(assignments || []);
    } catch (error) {
      console.error('Error fetching lead assignments:', error);
    }
  };

  const fetchFirmStats = async () => {
    if (!userProfile?.email) return;

    try {
      // Get law firm details
      const { data: lawFirm } = await supabase
        .from('law_firms')
        .select('current_month_leads, max_leads_per_month')
        .eq('contact_email', userProfile.email)
        .single();

      if (!lawFirm) return;

      // Get assignment stats
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select('status')
        .eq('law_firm_id', lawFirm.id);

      const totalLeads = assignments?.length || 0;
      const acceptedLeads = assignments?.filter(a => a.status === 'accepted').length || 0;
      const pendingLeads = assignments?.filter(a => a.status === 'pending').length || 0;
      const conversionRate = totalLeads > 0 ? (acceptedLeads / totalLeads) * 100 : 0;

      setFirmStats({
        totalLeads,
        acceptedLeads,
        pendingLeads,
        currentMonthLeads: lawFirm.current_month_leads || 0,
        maxLeadsPerMonth: lawFirm.max_leads_per_month || 50,
        conversionRate: Math.round(conversionRate),
      });
    } catch (error) {
      console.error('Error fetching firm stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadResponse = async (assignmentId: string, status: 'accepted' | 'rejected', reason?: string) => {
    try {
      const { error } = await supabase
        .rpc('handle_lead_response', {
          assignment_id: assignmentId,
          response_status: status,
          reason: reason || null
        });

      if (error) throw error;

      // Refresh data
      fetchLeadAssignments();
      fetchFirmStats();
    } catch (error) {
      console.error('Error responding to lead:', error);
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 8) return 'text-red-400 bg-red-900/30';
    if (score >= 6) return 'text-yellow-400 bg-yellow-900/30';
    return 'text-green-400 bg-green-900/30';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/30';
      case 'accepted':
        return 'text-green-400 bg-green-900/30';
      case 'rejected':
        return 'text-red-400 bg-red-900/30';
      case 'expired':
        return 'text-gray-400 bg-gray-900/30';
      default:
        return 'text-gray-400 bg-gray-900/30';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 2 && hoursUntilExpiry > 0;
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Lead Dashboard</h2>
        <div className="text-sm text-zinc-400">
          {firmStats.currentMonthLeads} / {firmStats.maxLeadsPerMonth} leads this month
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-cyan-950/50 p-3 text-cyan-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Pending Leads</p>
              <h3 className="text-2xl font-bold text-white">{firmStats.pendingLeads}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-green-950/50 p-3 text-green-400">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Accepted</p>
              <h3 className="text-2xl font-bold text-white">{firmStats.acceptedLeads}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-purple-950/50 p-3 text-purple-400">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Conversion Rate</p>
              <h3 className="text-2xl font-bold text-white">{firmStats.conversionRate}%</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-950/50 p-3 text-amber-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Monthly Quota</p>
              <h3 className="text-2xl font-bold text-white">
                {Math.round((firmStats.currentMonthLeads / firmStats.maxLeadsPerMonth) * 100)}%
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Assignments */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h3 className="text-lg font-medium text-white">Lead Assignments</h3>
        </div>
        <div className="divide-y divide-zinc-800">
          {leadAssignments.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="mx-auto mb-4 h-12 w-12 text-zinc-500" />
              <h3 className="text-lg font-medium text-white">No leads assigned yet</h3>
              <p className="text-zinc-400">New leads will appear here when they match your practice areas and location.</p>
            </div>
          ) : (
            leadAssignments.map((assignment) => (
              <div key={assignment.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-4 flex items-center gap-4">
                      <h4 className="text-lg font-medium text-white">
                        {assignment.conversation.name || 'Anonymous'}
                      </h4>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${getUrgencyColor(assignment.conversation.openai_urgency_score || 5)}`}>
                        Urgency: {assignment.conversation.openai_urgency_score || 5}/10
                      </span>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                      {isExpiringSoon(assignment.expires_at) && (
                        <span className="rounded bg-red-900/30 px-2 py-1 text-xs font-medium text-red-400">
                          Expiring Soon
                        </span>
                      )}
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Mail className="h-4 w-4" />
                        {assignment.conversation.email || 'No email'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Phone className="h-4 w-4" />
                        {assignment.conversation.phone || 'No phone'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <MapPin className="h-4 w-4" />
                        {assignment.conversation.firm_location || 'No location'}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-sm font-medium text-zinc-300">Case Category:</p>
                      <span className="rounded bg-cyan-900/30 px-2 py-1 text-sm text-cyan-400">
                        {assignment.conversation.case_category}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-sm font-medium text-zinc-300">Case Description:</p>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {assignment.conversation.case_description || 'No description provided'}
                      </p>
                    </div>

                    <div className="text-xs text-zinc-500">
                      Assigned {formatTimeAgo(assignment.assigned_at)} • 
                      Expires {new Date(assignment.expires_at).toLocaleDateString()}
                    </div>
                  </div>

                  {assignment.status === 'pending' && (
                    <div className="ml-6 flex gap-2">
                      <Button
                        onClick={() => handleLeadResponse(assignment.id, 'accepted')}
                        className="bg-green-600 hover:bg-green-500"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const reason = prompt('Reason for rejection (optional):');
                          handleLeadResponse(assignment.id, 'rejected', reason || undefined);
                        }}
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};