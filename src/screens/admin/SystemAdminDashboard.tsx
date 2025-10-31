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
  Line,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Building, BadgeCheck } from 'lucide-react';

export const SystemAdminDashboard = () => {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalLawFirms: 0,
    totalConversations: 0,
    conversionRate: 0,
    registeredUsers: 0,
  });
  const [leadsByStatus, setLeadsByStatus] = useState([]);
  const [leadsByPracticeArea, setLeadsByPracticeArea] = useState([]);
  const [dailyConversations, setDailyConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Get total counts
        const [
          { count: leadsCount },
          { count: lawFirmsCount },
          { count: conversationsCount },
          { count: usersCount },
          { count: convertedLeadsCount }
        ] = await Promise.all([
          supabase.from('leads').select('*', { count: 'exact' }),
          supabase.from('law_firms').select('*', { count: 'exact' }),
          supabase.from('conversations').select('*', { count: 'exact' }),
          supabase.from('profiles').select('*', { count: 'exact' }),
          supabase.from('leads').select('*', { count: 'exact' }).eq('status', 'converted'),
        ]);
        
        const conversionRate = leadsCount > 0
          ? ((convertedLeadsCount || 0) / leadsCount) * 100
          : 0;
          
        setStats({
          totalLeads: leadsCount || 0,
          totalLawFirms: lawFirmsCount || 0,
          totalConversations: conversationsCount || 0,
          conversionRate: Math.round(conversionRate),
          registeredUsers: usersCount || 0,
        });

        // Get leads by status
        const { data: statusData } = await supabase
          .from('leads')
          .select('status')
          .then(({ data }) => {
            if (!data) return { data: [] };
            
            const statusCounts = {};
            data.forEach(lead => {
              statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
            });
            
            return {
              data: Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
            };
          });
          
        setLeadsByStatus(statusData);

        // Get leads by practice area
        const { data: practiceAreaData } = await supabase
          .from('leads')
          .select('practice_area:practice_areas(name)')
          .then(({ data }) => {
            if (!data) return { data: [] };
            
            const areaCounts = {};
            data.forEach(lead => {
              const areaName = lead.practice_area?.name || 'Unknown';
              areaCounts[areaName] = (areaCounts[areaName] || 0) + 1;
            });
            
            return {
              data: Object.entries(areaCounts).map(([name, value]) => ({ name, value }))
            };
          });
          
        setLeadsByPracticeArea(practiceAreaData);

        // Get daily conversations for the past 14 days
        const today = new Date();
        const past14Days = [...Array(14)].map((_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return date.toISOString().split('T')[0];
        }).reverse();
        
        const dailyData = await Promise.all(
          past14Days.map(async (date) => {
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact' })
              .gte('created_at', date)
              .lt('created_at', nextDay.toISOString());
              
            return {
              date,
              count: count || 0,
            };
          })
        );
        
        setDailyConversations(dailyData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">System Dashboard</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-cyan-950/50 p-3 text-cyan-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Leads</p>
              <h3 className="text-2xl font-bold text-white">{stats.totalLeads}</h3>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-emerald-950/50 p-3 text-emerald-400">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Law Firms</p>
              <h3 className="text-2xl font-bold text-white">{stats.totalLawFirms}</h3>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-950/50 p-3 text-amber-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Conversations</p>
              <h3 className="text-2xl font-bold text-white">{stats.totalConversations}</h3>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-purple-950/50 p-3 text-purple-400">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Conversion</p>
              <h3 className="text-2xl font-bold text-white">{stats.conversionRate}%</h3>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-blue-950/50 p-3 text-blue-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Users</p>
              <h3 className="text-2xl font-bold text-white">{stats.registeredUsers}</h3>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Line Chart */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-white">Conversation Volume</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyConversations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#888' }} 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth()+1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#222', borderColor: '#444' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#22c5fe" 
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Bar Chart */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-white">Leads by Status</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByStatus} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tick={{ fill: '#888' }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fill: '#888' }}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#222', borderColor: '#444' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" fill="#22c5fe" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Pie Chart */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <PieChartIcon className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-white">Leads by Practice Area</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={leadsByPracticeArea}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                fill="#8884d8"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#555', strokeWidth: 1 }}
              >
                {leadsByPracticeArea.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#222', borderColor: '#444' }}
                labelStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};