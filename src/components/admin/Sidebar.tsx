import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import { cn } from '@/lib/utils';
import { userProfileAtom } from '@/store/auth';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Building2, 
  Settings, 
  LogOut, 
  Link2, 
  PieChart,
  BadgeCheck,
  Target,
  CreditCard,
  Home,
  BarChart3
} from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const Sidebar = () => {
  const location = useLocation();
  const [userProfile] = useAtom(userProfileAtom);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const getLinkClass = (active: boolean) => {
    return cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 transition-all',
      active 
        ? 'bg-cyan-600 text-white' 
        : 'text-zinc-300 hover:bg-zinc-800'
    );
  };

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex h-16 items-center border-b border-zinc-800 px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-white">
          <img src="/images/logo.svg" alt="Logo" className="h-8 w-8" />
          <span>LegalLeads</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4">
        <Link to="/admin" className={getLinkClass(isActive('/admin'))}>
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>

        {/* Legal Admin Links */}
        {userProfile?.role === 'legal_admin' && (
          <>
            <Link to="/admin/firm-dashboard" className={getLinkClass(isActive('/admin/firm-dashboard'))}>
              <Home className="h-5 w-5" />
              <span>Lead Inbox</span>
            </Link>
            <Link to="/admin/firm-settings" className={getLinkClass(isActive('/admin/firm-settings'))}>
              <Settings className="h-5 w-5" />
              <span>Firm Settings</span>
            </Link>
            <Link to="/admin/leads" className={getLinkClass(isActive('/admin/leads'))}>
              <FileText className="h-5 w-5" />
              <span>Lead History</span>
            </Link>
            <Link to="/admin/matches" className={getLinkClass(isActive('/admin/matches'))}>
              <Link2 className="h-5 w-5" />
              <span>Matches</span>
            </Link>
            <Link to="/admin/profile" className={getLinkClass(isActive('/admin/profile'))}>
              <BadgeCheck className="h-5 w-5" />
              <span>Practice Areas</span>
            </Link>
          </>
        )}

        {/* System Admin Links */}
        {userProfile?.role === 'system_admin' && (
          <>
            <Link to="/admin/system" className={getLinkClass(isActive('/admin/system'))}>
              <PieChart className="h-5 w-5" />
              <span>System Overview</span>
            </Link>
            <Link to="/admin/lead-distribution" className={getLinkClass(isActive('/admin/lead-distribution'))}>
              <Target className="h-5 w-5" />
              <span>Lead Distribution</span>
            </Link>
            <Link to="/admin/law-firms" className={getLinkClass(isActive('/admin/law-firms'))}>
              <Building2 className="h-5 w-5" />
              <span>Law Firms</span>
            </Link>
            <Link to="/admin/users" className={getLinkClass(isActive('/admin/users'))}>
              <Users className="h-5 w-5" />
              <span>Users</span>
            </Link>
            <Link to="/admin/conversations" className={getLinkClass(isActive('/admin/conversations'))}>
              <MessageSquare className="h-5 w-5" />
              <span>Conversations</span>
            </Link>
          </>
        )}
      </nav>
      <div className="mt-auto border-t border-zinc-800 p-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-400 transition-colors hover:bg-zinc-800 hover:text-red-300"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};