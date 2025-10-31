import React, { useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom, logoutAtom } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, User } from 'lucide-react';

export const AdminHeader = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [, logout] = useAtom(logoutAtom);
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleSignOut = async () => {
    const success = await logout();
    if (success) {
      navigate('/login');
    }
  };

  const getInitials = () => {
    if (!userProfile?.first_name && !userProfile?.last_name) return 'U';
    return `${userProfile?.first_name?.[0] || ''}${userProfile?.last_name?.[0] || ''}`;
  };

  const getRoleName = () => {
    switch (userProfile?.role) {
      case 'legal_admin':
        return 'Legal Administrator';
      case 'system_admin':
        return 'System Administrator';
      default:
        return 'User';
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          {userProfile?.role === 'legal_admin' ? 'Law Firm Dashboard' : 'System Administration'}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white">
          <Bell size={20} />
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-red-500"></span>
        </button>
        
        <div className="relative">
          <button 
            className="flex items-center gap-2 rounded-full bg-zinc-800 px-2 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            onClick={toggleDropdown}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-white">
              {getInitials()}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">
                {userProfile?.first_name} {userProfile?.last_name}
              </span>
              <span className="text-xs text-zinc-400">{getRoleName()}</span>
            </div>
            <ChevronDown size={16} />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 z-10 mt-1 w-48 origin-top-right rounded-md bg-zinc-800 shadow-lg ring-1 ring-black ring-opacity-5">
              <div className="py-1" role="menu" aria-orientation="vertical">
                <a
                  href="/admin/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                  role="menuitem"
                >
                  <User size={16} />
                  Profile Settings
                </a>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                  role="menuitem"
                  onClick={handleSignOut}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';