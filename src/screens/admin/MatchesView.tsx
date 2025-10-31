import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Check, X, ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Match = {
  id: string;
  lead: {
    id: string;
    conversation: {
      id: string;
      name: string;
      email: string;
      phone: string;
      case_description: string;
      urgency_score: number;
    };
    practice_area: {
      id: string;
      name: string;
    };
  };
  match_score: number;
  status: string;
  created_at: string;
};

export const MatchesView = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!userProfile) return;
      
      try {
        setIsLoading(true);
        
        // For legal admin, only show matches for their firm
        const { data: lawFirm } = await supabase
          .from('law_firms')
          .select('id')
          .eq('contact_email', userProfile.email)
          .single();
          
        if (!lawFirm) return;
        
        let query = supabase
          .from('matches')
          .select(`
            id,
            match_score,
            status,
            created_at,
            lead:leads(
              id,
              practice_area:practice_areas(id, name),
              conversation:conversations(id, name, email, phone, case_description, urgency_score)
            )
          `)
          .eq('law_firm_id', lawFirm.id);
        
        // Apply filters
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        
        // Apply sorting
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching matches:', error);
        } else {
          setMatches(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [userProfile, statusFilter, sortField, sortDirection]);

  const updateMatchStatus = async (matchId: string, newStatus: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: newStatus })
        .eq('id', matchId);
        
      if (error) {
        console.error('Error updating match status:', error);
      } else {
        // Update local state
        setMatches(matches.map(match => 
          match.id === matchId 
            ? { ...match, status: newStatus } 
            : match
        ));
        
        // If match accepted, update lead status to contacted
        if (newStatus === 'accepted') {
          const match = matches.find(m => m.id === matchId);
          if (match) {
            await supabase
              .from('leads')
              .update({ status: 'contacted' })
              .eq('id', match.lead.id);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const filteredMatches = matches.filter(match => {
    const searchLower = searchTerm.toLowerCase();
    return (
      match.lead?.conversation?.name?.toLowerCase().includes(searchLower) ||
      match.lead?.conversation?.email?.toLowerCase().includes(searchLower) ||
      match.lead?.conversation?.case_description?.toLowerCase().includes(searchLower) ||
      match.lead?.practice_area?.name?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMatchScoreBadgeClass = (score: number) => {
    if (score >= 0.8) return 'bg-green-900/30 text-green-400';
    if (score >= 0.5) return 'bg-yellow-900/30 text-yellow-400';
    return 'bg-red-900/30 text-red-400';
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'accepted':
        return 'bg-green-900/30 text-green-400';
      case 'rejected':
        return 'bg-red-900/30 text-red-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  const formatMatchScore = (score: number) => {
    return `${Math.round(score * 100)}%`;
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-bold text-white">Potential Matches</h2>
        
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search matches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-zinc-800' : ''}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {showFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-zinc-400">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      )}
      
      {filteredMatches.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <Search className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No matches found</h3>
          <p className="text-zinc-400">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th 
                    className="cursor-pointer whitespace-nowrap p-4 text-sm font-medium text-zinc-300 transition hover:text-white"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Date {getSortIcon('created_at')}
                    </div>
                  </th>
                  <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">
                    Client
                  </th>
                  <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">
                    Case Details
                  </th>
                  <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">
                    Practice Area
                  </th>
                  <th 
                    className="cursor-pointer whitespace-nowrap p-4 text-sm font-medium text-zinc-300 transition hover:text-white"
                    onClick={() => handleSort('match_score')}
                  >
                    <div className="flex items-center gap-1">
                      Match Score {getSortIcon('match_score')}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer whitespace-nowrap p-4 text-sm font-medium text-zinc-300 transition hover:text-white"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status {getSortIcon('status')}
                    </div>
                  </th>
                  <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((match) => (
                  <tr key={match.id} className="border-b border-zinc-800 bg-zinc-900/30 transition hover:bg-zinc-900/50">
                    <td className="whitespace-nowrap p-4 text-sm text-zinc-300">
                      {formatDate(match.created_at)}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <div className="text-sm font-medium text-white">{match.lead?.conversation?.name || 'Unknown'}</div>
                      <div className="text-xs text-zinc-400">{match.lead?.conversation?.email}</div>
                    </td>
                    <td className="max-w-xs p-4">
                      <div className="truncate text-sm text-zinc-300">
                        {match.lead?.conversation?.case_description || 'No description provided'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-zinc-300">{match.lead?.practice_area?.name || 'Unknown'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getMatchScoreBadgeClass(match.match_score)}`}>
                        {formatMatchScore(match.match_score)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getStatusBadgeClass(match.status)}`}>
                        {match.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {match.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMatchStatus(match.id, 'accepted')}
                              className="bg-green-900/20 text-green-400 hover:bg-green-900/30 hover:text-green-300"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMatchStatus(match.id, 'rejected')}
                              className="bg-red-900/20 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                            >
                              <X className="mr-1 h-3 w-3" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};