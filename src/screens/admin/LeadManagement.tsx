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
  ExternalLink,
  Filter,
  Search,
  TrendingUp,
  UserCheck,
  XCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Lead {
  id: string;
  status: string;
  created_at: string;
  claimed_at: string | null;
  quality_score: number | null;
  temperature: string;
  conversation: {
    id: string;
    name: string;
    email: string;
    phone: string;
    case_description: string;
    case_category: string;
    urgency_score: number;
    openai_urgency_score: number;
  };
  practice_area: {
    name: string;
  } | null;
  matches: Array<{
    id: string;
    match_score: number;
    status: string;
    created_at: string;
  }>;
}

export const LeadManagement = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<'all' | 'available' | 'claimed' | 'converted'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    claimed: 0,
    converted: 0
  });
  const user = useAuthStore((state) => state.user);
  const [firmId, setFirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchFirmId();
  }, [user]);

  useEffect(() => {
    if (firmId) {
      fetchLeads();
    }
  }, [firmId, filter]);

  useEffect(() => {
    applySearchFilter();
  }, [searchTerm, leads]);

  const fetchFirmId = async () => {
    if (!user?.id) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('law_firm_id')
      .eq('id', user.id)
      .single();

    if (profile?.law_firm_id) {
      setFirmId(profile.law_firm_id);
    } else {
      console.error('User not associated with a law firm');
    }
  };

  const fetchLeads = async () => {
    if (!firmId) return;

    try {
      setIsLoading(true);

      // Build query to get leads matched with this firm
      let query = supabase
        .from('leads')
        .select(`
          *,
          conversation:conversations!inner (
            id,
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
            created_at,
            law_firm_id
          )
        `)
        .eq('matches.law_firm_id', firmId)
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter === 'available') {
        query = query
          .is('claimed_at', null)
          .eq('matches.status', 'pending');
      } else if (filter === 'claimed') {
        query = query
          .not('claimed_at', 'is', null)
          .eq('claimed_by_firm_id', firmId);
      } else if (filter === 'converted') {
        query = query.eq('status', 'converted');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter to only show leads where this firm has a match
      const filteredData = (data || []).filter(lead =>
        lead.matches.some((m: any) => m.law_firm_id === firmId)
      );

      setLeads(filteredData);
      setFilteredLeads(filteredData);

      // Calculate stats
      const statsData = {
        total: filteredData.length,
        available: filteredData.filter(l => !l.claimed_at && l.matches.some((m: any) => m.status === 'pending')).length,
        claimed: filteredData.filter(l => l.claimed_at && l.claimed_by_firm_id === firmId).length,
        converted: filteredData.filter(l => l.status === 'converted').length
      };
      setStats(statsData);

    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applySearchFilter = () => {
    if (!searchTerm.trim()) {
      setFilteredLeads(leads);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = leads.filter(lead =>
      lead.conversation.name?.toLowerCase().includes(term) ||
      lead.conversation.email?.toLowerCase().includes(term) ||
      lead.conversation.case_category?.toLowerCase().includes(term) ||
      lead.practice_area?.name?.toLowerCase().includes(term) ||
      lead.conversation.case_description?.toLowerCase().includes(term)
    );
    setFilteredLeads(filtered);
  };

  const claimLead = async (leadId: string) => {
    if (!firmId || !user?.id) return;

    try {
      // Check if firm can claim more leads
      const { data: canClaim } = await supabase
        .rpc('can_firm_claim_lead', { firm_id: firmId });

      if (!canClaim) {
        alert('⚠️ You have reached your monthly lead limit. Please upgrade your subscription to claim more leads.');
        return;
      }

      const { error } = await supabase
        .from('leads')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
          claimed_by_firm_id: firmId,
          claimed_by_user_id: user.id,
        })
        .eq('id', leadId);

      if (error) throw error;

      // Log activity
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'claimed',
        details: { claimed_by_firm_id: firmId }
      });

      // Refresh leads
      await fetchLeads();

      alert('✅ Lead claimed successfully! Client contact information is now available.');
    } catch (error) {
      console.error('Error claiming lead:', error);
      alert('❌ Failed to claim lead. Please try again.');
    }
  };

  const getUrgencyBadge = (score: number) => {
    if (score >= 8) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Urgent
        </Badge>
      );
    } else if (score >= 6) {
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" /> High
        </Badge>
      );
    } else {
      return <Badge variant="secondary">Standard</Badge>;
    }
  };

  const getTemperatureBadge = (temp: string) => {
    const colors = {
      hot: 'bg-red-500',
      warm: 'bg-orange-500',
      cold: 'bg-blue-500'
    };
    return (
      <Badge className={`${colors[temp as keyof typeof colors] || 'bg-gray-500'} text-white`}>
        {temp}
      </Badge>
    );
  };

  const getMatchScore = (matches: any[]) => {
    const match = matches.find(m => m.law_firm_id === firmId);
    return match?.match_score || 0;
  };

  if (!firmId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-zinc-400">
          <p className="text-lg">⚠️ You are not associated with a law firm.</p>
          <p className="mt-2 text-sm">Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Lead Management</h2>
          <p className="text-sm text-zinc-400 mt-1">Manage your matched leads and claim new opportunities</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-cyan-950/50 p-3 text-cyan-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Leads</p>
              <h3 className="text-2xl font-bold text-white">{stats.total}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-950/50 p-3 text-green-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Available</p>
              <h3 className="text-2xl font-bold text-white">{stats.available}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-950/50 p-3 text-blue-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Claimed</p>
              <h3 className="text-2xl font-bold text-white">{stats.claimed}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-950/50 p-3 text-purple-400">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Converted</p>
              <h3 className="text-2xl font-bold text-white">{stats.converted}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            All Leads
          </Button>
          <Button
            variant={filter === 'available' ? 'default' : 'outline'}
            onClick={() => setFilter('available')}
            size="sm"
          >
            Available ({stats.available})
          </Button>
          <Button
            variant={filter === 'claimed' ? 'default' : 'outline'}
            onClick={() => setFilter('claimed')}
            size="sm"
          >
            My Leads ({stats.claimed})
          </Button>
          <Button
            variant={filter === 'converted' ? 'default' : 'outline'}
            onClick={() => setFilter('converted')}
            size="sm"
          >
            Converted
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center">
          <XCircle className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-4 text-lg font-medium text-zinc-400">
            {searchTerm ? 'No leads match your search' : 'No leads found'}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {filter === 'available' && 'Check back soon for new lead matches!'}
            {filter === 'claimed' && 'Start claiming leads to see them here.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-zinc-400">Practice Area</TableHead>
                <TableHead className="text-zinc-400">Client</TableHead>
                <TableHead className="text-zinc-400">Contact</TableHead>
                <TableHead className="text-zinc-400">Case Summary</TableHead>
                <TableHead className="text-zinc-400">Urgency</TableHead>
                <TableHead className="text-zinc-400">Match</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const isClaimed = lead.claimed_at !== null;
                const isClaimedByUs = lead.claimed_by_firm_id === firmId;
                const urgency = lead.conversation.urgency_score || lead.conversation.openai_urgency_score || 5;
                const matchScore = getMatchScore(lead.matches);

                return (
                  <TableRow key={lead.id} className="border-zinc-800 hover:bg-zinc-800/30">
                    <TableCell className="font-medium text-white">
                      <div>
                        <p>{lead.practice_area?.name || 'General'}</p>
                        {lead.conversation.case_category && (
                          <p className="text-xs text-zinc-500 mt-1">{lead.conversation.case_category}</p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-zinc-300">
                      {isClaimed && isClaimedByUs ? (
                        <div>
                          <p className="font-medium text-white">{lead.conversation.name || 'N/A'}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Claimed {new Date(lead.claimed_at!).toLocaleDateString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-zinc-500 italic">Claim to reveal</p>
                      )}
                    </TableCell>

                    <TableCell className="text-zinc-300">
                      {isClaimed && isClaimedByUs ? (
                        <div className="space-y-1">
                          {lead.conversation.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-cyan-400" />
                              <a
                                href={`mailto:${lead.conversation.email}`}
                                className="text-cyan-400 hover:underline"
                              >
                                {lead.conversation.email}
                              </a>
                            </div>
                          )}
                          {lead.conversation.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-cyan-400" />
                              <a
                                href={`tel:${lead.conversation.phone}`}
                                className="text-cyan-400 hover:underline"
                              >
                                {lead.conversation.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-zinc-500 italic">Claim to reveal</p>
                      )}
                    </TableCell>

                    <TableCell className="max-w-xs text-zinc-300">
                      <p className="line-clamp-2 text-sm">
                        {lead.conversation.case_description || 'No description'}
                      </p>
                    </TableCell>

                    <TableCell>
                      {getUrgencyBadge(urgency)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${matchScore >= 0.8 ? 'bg-green-500' : matchScore >= 0.6 ? 'bg-cyan-400' : 'bg-yellow-500'}`}
                            style={{ width: `${matchScore * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-white">
                          {(matchScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isClaimed ? (
                        isClaimedByUs ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Claimed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-zinc-500">
                            Taken
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-green-400 border-green-400">
                          Available
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {!isClaimed ? (
                        <Button
                          size="sm"
                          onClick={() => claimLead(lead.id)}
                          className="bg-cyan-500 hover:bg-cyan-600"
                        >
                          Claim Lead
                        </Button>
                      ) : isClaimedByUs ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => (window.location.href = `/admin/leads/${lead.id}`)}
                        >
                          View Details
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>
                          Unavailable
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
