import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Target, 
  Clock, 
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LeadDistributionStats = {
  totalLeads: number;
  distributedLeads: number;
  acceptedLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  averageResponseTime: number;
  distributionRate: number;
};

type FirmPerformance = {
  firm_name: string;
  total_assigned: number;
  accepted: number;
  rejected: number;
  pending: number;
  response_rate: number;
  acceptance_rate: number;
};

type LeadAssignmentDetail = {
  id: string;
  conversation: {
    name: string;
    email: string;
    case_category: string;
    firm_location: string;
    openai_urgency_score: number;
    created_at: string;
  };
  law_firm: {
    name: string;
    location: string;
  };
  status: string;
  assigned_at: string;
  responded_at: string;
  assignment_method: string;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const LeadDistributionDashboard = () => {
  const [stats, setStats] = useState<LeadDistributionStats>({
    totalLeads: 0,
    distributedLeads: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    pendingLeads: 0,
    averageResponseTime: 0,
    distributionRate: 0,
  });
  const [firmPerformance, setFirmPerformance] = useState<FirmPerformance[]>([]);
  const [leadAssignments, setLeadAssignments] = useState<LeadAssignmentDetail[]>([]);
  const [distributionData, setDistributionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('assigned_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [statusFilter, sortField, sortDirection]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Get overall stats
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select(`
          *,
          conversation:conversations(name, email, case_category, firm_location, openai_urgency_score, created_at),
          law_firm:law_firms(name, location)
        `);

      if (assignments) {
        const totalLeads = assignments.length;
        const acceptedLeads = assignments.filter(a => a.status === 'accepted').length;
        const rejectedLeads = assignments.filter(a => a.status === 'rejected').length;
        const pendingLeads = assignments.filter(a => a.status === 'pending').length;
        const distributionRate = totalLeads > 0 ? (totalLeads / totalLeads) * 100 : 0;

        // Calculate average response time
        const respondedAssignments = assignments.filter(a => a.responded_at);
        const avgResponseTime = respondedAssignments.length > 0 
          ? respondedAssignments.reduce((sum, a) => {
              const responseTime = new Date(a.responded_at).getTime() - new Date(a.assigned_at).getTime();
              return sum + (responseTime / (1000 * 60 * 60)); // Convert to hours
            }, 0) / respondedAssignments.length
          : 0;

        setStats({
          totalLeads,
          distributedLeads: totalLeads,
          acceptedLeads,
          rejectedLeads,
          pendingLeads,
          averageResponseTime: Math.round(avgResponseTime),
          distributionRate: Math.round(distributionRate),
        });

        setLeadAssignments(assignments);
      }

      // Get firm performance data
      const { data: firms } = await supabase
        .from('law_firms')
        .select(`
          id,
          name,
          lead_assignments!inner(status, assigned_at, responded_at)
        `);

      if (firms) {
        const performance = firms.map(firm => {
          const assignments = firm.lead_assignments;
          const totalAssigned = assignments.length;
          const accepted = assignments.filter(a => a.status === 'accepted').length;
          const rejected = assignments.filter(a => a.status === 'rejected').length;
          const pending = assignments.filter(a => a.status === 'pending').length;
          const responded = assignments.filter(a => a.responded_at).length;
          
          return {
            firm_name: firm.name,
            total_assigned: totalAssigned,
            accepted,
            rejected,
            pending,
            response_rate: totalAssigned > 0 ? Math.round((responded / totalAssigned) * 100) : 0,
            acceptance_rate: responded > 0 ? Math.round((accepted / responded) * 100) : 0,
          };
        }).filter(f => f.total_assigned > 0);

        setFirmPerformance(performance);
      }

      // Get distribution data by date (last 7 days)
      const today = new Date();
      const last7Days = [...Array(7)].map((_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const distributionByDate = await Promise.all(
        last7Days.map(async (date) => {
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          
          const { count } = await supabase
            .from('lead_assignments')
            .select('*', { count: 'exact' })
            .gte('assigned_at', date)
            .lt('assigned_at', nextDay.toISOString());
            
          return { 
            date, 
            leads: count || 0,
            displayDate: new Date(date).toLocaleDateString()
          };
        })
      );

      setDistributionData(distributionByDate);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
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

  const filteredAssignments = leadAssignments.filter(assignment => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      assignment.conversation?.name?.toLowerCase().includes(searchLower) ||
      assignment.conversation?.email?.toLowerCase().includes(searchLower) ||
      assignment.law_firm?.name?.toLowerCase().includes(searchLower) ||
      assignment.conversation?.case_category?.toLowerCase().includes(searchLower)
    );
    
    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'accepted':
        return 'bg-green-900/30 text-green-400';
      case 'rejected':
        return 'bg-red-900/30 text-red-400';
      case 'expired':
        return 'bg-gray-900/30 text-gray-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      <h2 className="text-2xl font-bold text-white">Lead Distribution Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-cyan-950/50 p-3 text-cyan-400">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Distributed</p>
              <h3 className="text-2xl font-bold text-white">{stats.distributedLeads}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-green-950/50 p-3 text-green-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Accepted</p>
              <h3 className="text-2xl font-bold text-white">{stats.acceptedLeads}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-yellow-950/50 p-3 text-yellow-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Pending</p>
              <h3 className="text-2xl font-bold text-white">{stats.pendingLeads}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-purple-950/50 p-3 text-purple-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Avg Response</p>
              <h3 className="text-2xl font-bold text-white">{stats.averageResponseTime}h</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Distribution Over Time */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="mb-4 text-lg font-medium text-white">Lead Distribution (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="displayDate" tick={{ fill: '#888' }} />
                <YAxis tick={{ fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#222', borderColor: '#444' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="leads" stroke="#22c5fe" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Firm Performance */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="mb-4 text-lg font-medium text-white">Firm Performance</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={firmPerformance.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tick={{ fill: '#888' }} />
                <YAxis 
                  dataKey="firm_name" 
                  type="category" 
                  tick={{ fill: '#888' }}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#222', borderColor: '#444' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="acceptance_rate" fill="#22c5fe" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lead Assignments Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h3 className="text-lg font-medium text-white">Recent Lead Assignments</h3>
            
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search assignments..."
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
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th 
                  className="cursor-pointer whitespace-nowrap p-4 text-sm font-medium text-zinc-300 transition hover:text-white"
                  onClick={() => handleSort('assigned_at')}
                >
                  <div className="flex items-center gap-1">
                    Assigned {getSortIcon('assigned_at')}
                  </div>
                </th>
                <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">Client</th>
                <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">Case Type</th>
                <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">Assigned To</th>
                <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">Status</th>
                <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">Method</th>
                <th className="whitespace-nowrap p-4 text-sm font-medium text-zinc-300">Response Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.slice(0, 20).map((assignment) => (
                <tr key={assignment.id} className="border-b border-zinc-800 bg-zinc-900/30 transition hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap p-4 text-sm text-zinc-300">
                    {formatDate(assignment.assigned_at)}
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-white">
                      {assignment.conversation?.name || 'Anonymous'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {assignment.conversation?.email}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="rounded bg-cyan-900/30 px-2 py-1 text-xs text-cyan-400">
                      {assignment.conversation?.case_category}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-white">{assignment.law_firm?.name}</div>
                    <div className="text-xs text-zinc-400">{assignment.law_firm?.location}</div>
                  </td>
                  <td className="p-4">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(assignment.status)}`}>
                      {assignment.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-zinc-300 capitalize">
                      {assignment.assignment_method}
                    </span>
                  </td>
                  <td className="p-4">
                    {assignment.responded_at ? (
                      <span className="text-sm text-zinc-300">
                        {Math.round((new Date(assignment.responded_at).getTime() - new Date(assignment.assigned_at).getTime()) / (1000 * 60 * 60))}h
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};