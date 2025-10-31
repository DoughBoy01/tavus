import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom } from '@/store/auth';
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
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, Users, Building } from 'lucide-react';

export const Dashboard = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    convertedLeads: 0,
    matchRate: 0,
  });
  const [leadsData, setLeadsData] = useState([]);
  const [practiceAreaData, setPracticeAreaData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userProfile) return;

      try {
        setIsLoading(true);
        
        if (userProfile.role === 'legal_admin') {
          // Fetch law firm specific data
          // For a legal admin, we'll show their own firm's lead data
          const { data: lawFirm } = await supabase
            .from('law_firms')
            .select('id, name')
            .eq('contact_email', userProfile.email)
            .single();

          if (lawFirm) {
            // Get all matches for this law firm
            const { data: matches } = await supabase
              .from('matches')
              .select(`
                id,
                match_score,
                status,
                lead_id,
                leads(
                  id,
                  status,
                  practice_area_id,
                  created_at,
                  practice_areas(name)
                )
              `)
              .eq('law_firm_id', lawFirm.id);

            // Transform data for charts and stats
            if (matches) {
              // Calculate stats
              const totalLeads = matches.length;
              const newLeads = matches.filter(m => m.leads.status === 'new').length;
              const convertedLeads = matches.filter(m => m.leads.status === 'converted').length;
              const matchRate = totalLeads ? (convertedLeads / totalLeads) * 100 : 0;

              setStats({
                totalLeads,
                newLeads,
                convertedLeads,
                matchRate: Math.round(matchRate),
              });

              // Process leads by date (last 7 days)
              const today = new Date();
              const last7Days = [...Array(7)].map((_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
              }).reverse();

              const leadsByDate = last7Days.map(date => {
                const count = matches.filter(m => {
                  return new Date(m.leads.created_at).toISOString().split('T')[0] === date;
                }).length;
                return { date, count };
              });

              setLeadsData(leadsByDate);

              // Process practice areas
              const practiceAreas = {};
              matches.forEach(m => {
                const areaName = m.leads.practice_areas?.name || 'Unknown';
                practiceAreas[areaName] = (practiceAreas[areaName] || 0) + 1;
              });

              setPracticeAreaData(
                Object.entries(practiceAreas).map(([name, value]) => ({ name, value }))
              );
            }
          }
        } else if (userProfile.role === 'system_admin') {
          // Fetch system-wide data
          // For a system admin, we'll show aggregate data across all firms
          
          // Get lead stats
          const { count: totalLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact' });
            
          const { count: newLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('status', 'new');
            
          const { count: convertedLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('status', 'converted');
            
          const matchRate = totalLeads ? (convertedLeads / totalLeads) * 100 : 0;
            
          setStats({
            totalLeads: totalLeads || 0,
            newLeads: newLeads || 0,
            convertedLeads: convertedLeads || 0,
            matchRate: Math.round(matchRate),
          });

          // Get leads by date (last 7 days)
          const today = new Date();
          const last7Days = [...Array(7)].map((_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
          }).reverse();
          
          const leadsByDate = await Promise.all(last7Days.map(async (date) => {
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const { count } = await supabase
              .from('leads')
              .select('*', { count: 'exact' })
              .gte('created_at', date)
              .lt('created_at', nextDay.toISOString());
              
            return { date, count: count || 0 };
          }));
          
          setLeadsData(leadsByDate);

          // Get practice area distribution
          const { data: practiceAreas } = await supabase
            .from('leads')
            .select(`
              practice_areas (
                name
              )
            `);
            
          const areaCount = {};
          practiceAreas?.forEach(lead => {
            const name = lead.practice_areas?.name || 'Unknown';
            areaCount[name] = (areaCount[name] || 0) + 1;
          });
          
          setPracticeAreaData(
            Object.entries(areaCount).map(([name, value]) => ({ name, value }))
          );
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [userProfile]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">New Leads</p>
              <h3 className="text-2xl font-bold text-white">{stats.newLeads}</h3>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-950/50 p-3 text-amber-400">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Converted</p>
              <h3 className="text-2xl font-bold text-white">{stats.convertedLeads}</h3>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-purple-950/50 p-3 text-purple-400">
              <PieChartIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Match Rate</p>
              <h3 className="text-2xl font-bold text-white">{stats.matchRate}%</h3>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar Chart */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-white">Leads Over Time</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsData}>
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
                <Bar dataKey="count" fill="#22c5fe" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Pie Chart */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <PieChartIcon className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-white">Practice Area Distribution</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={practiceAreaData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {practiceAreaData.map((entry, index) => (
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
    </div>
  );
};