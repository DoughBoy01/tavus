import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Search, Filter, ChevronDown, ChevronUp, Phone, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Lead = {
  id: string;
  conversation: {
    id: string;
    name: string;
    email: string;
    phone: string;
    case_description: string;
    urgency_score: number;
    created_at: string;
  };
  practice_area: {
    name: string;
  };
  status: string;
  created_at: string;
};

export const LeadsManagement = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      if (!userProfile) return;
      
      try {
        setIsLoading(true);
        
        let query = supabase
          .from('leads')
          .select(`
            id,
            status,
            created_at,
            conversation:conversations(id, name, email, phone, case_description, urgency_score, created_at),
            practice_area:practice_areas(name)
          `);
        
        if (userProfile.role === 'legal_admin') {
          // For legal admin, only show leads matched to their firm
          const { data: lawFirm } = await supabase
            .from('law_firms')
            .select('id')
            .eq('contact_email', userProfile.email)
            .single();
            
          if (lawFirm) {
            query = query.in(
              'id', 
              supabase
                .from('matches')
                .select('lead_id')
                .eq('law_firm_id', lawFirm.id)
            );
          }
        }
        
        // Apply filters
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        
        // Apply sorting
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching leads:', error);
        } else {
          setLeads(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeads();
  }, [userProfile, statusFilter, sortField, sortDirection]);

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

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.conversation?.name?.toLowerCase().includes(searchLower) ||
      lead.conversation?.email?.toLowerCase().includes(searchLower) ||
      lead.conversation?.case_description?.toLowerCase().includes(searchLower) ||
      lead.practice_area?.name?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-900/30 text-blue-400';
      case 'contacted':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'converted':
        return 'bg-green-900/30 text-green-400';
      case 'closed':
        return 'bg-gray-900/30 text-gray-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  const getUrgencyBadgeClass = (score: number) => {
    if (score >= 8) return 'bg-red-900/30 text-red-400';
    if (score >= 5) return 'bg-yellow-900/30 text-yellow-400';
    return 'bg-green-900/30 text-green-400';
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
        <h2 className="text-2xl font-bold text-white">Manage Leads</h2>
        
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search leads..."
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
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      )}
      
      {filteredLeads.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <Search className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No leads found</h3>
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
                    Contact
                  </th>
                  <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">
                    Case Details
                  </th>
                  <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">
                    Practice Area
                  </th>
                  <th 
                    className="cursor-pointer whitespace-nowrap p-4 text-sm font-medium text-zinc-300 transition hover:text-white"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer whitespace-nowrap p-4 text-sm font-medium text-zinc-300 transition hover:text-white"
                    onClick={() => handleSort('conversation.urgency_score')}
                  >
                    <div className="flex items-center gap-1">
                      Urgency {getSortIcon('conversation.urgency_score')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-zinc-800 bg-zinc-900/30 transition hover:bg-zinc-900/50">
                    <td className="whitespace-nowrap p-4 text-sm text-zinc-300">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <div className="text-sm font-medium text-white">{lead.conversation?.name || 'Unknown'}</div>
                    </td>
                    <td className="p-4">
                      {lead.conversation?.email && (
                        <div className="mb-1 flex items-center gap-1 text-sm text-zinc-400">
                          <Mail className="h-3.5 w-3.5" />
                          {lead.conversation.email}
                        </div>
                      )}
                      {lead.conversation?.phone && (
                        <div className="flex items-center gap-1 text-sm text-zinc-400">
                          <Phone className="h-3.5 w-3.5" />
                          {lead.conversation.phone}
                        </div>
                      )}
                    </td>
                    <td className="max-w-xs p-4">
                      <div className="truncate text-sm text-zinc-300">
                        {lead.conversation?.case_description || 'No description provided'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-zinc-300">{lead.practice_area?.name || 'Unknown'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getStatusBadgeClass(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {lead.conversation?.urgency_score && (
                        <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getUrgencyBadgeClass(lead.conversation.urgency_score)}`}>
                          {lead.conversation.urgency_score}/10
                        </span>
                      )}
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