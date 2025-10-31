import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit, Trash, RefreshCw, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PostgrestError } from '@supabase/supabase-js';

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  law_firm?: {
    id: string;
    name: string;
  } | null;
  error?: string;
  loading?: boolean;
};

export const UserManagementPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showEditUserForm, setShowEditUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // New user form state
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'public',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);

      // First, fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (profilesError) throw profilesError;
      
      if (!profiles) {
        setUsers([]);
        return;
      }

      // For legal admin users, fetch their associated law firms
      const usersWithLawFirms = await Promise.all(
        profiles.map(async (profile) => {
          if (profile.role === 'legal_admin') {
            try {
              const { data: lawFirms, error: lawFirmError } = await supabase
                .from('law_firms')
                .select('id, name')
                .eq('contact_email', profile.email)
                .single();

              if (lawFirmError && lawFirmError.code !== 'PGRST116') {
                console.error(`Error fetching law firm for ${profile.email}:`, lawFirmError);
              }

              return {
                ...profile,
                law_firm: lawFirms || null
              };
            } catch (error) {
              console.error(`Error processing law firm for ${profile.email}:`, error);
              return profile;
            }
          }
          return profile;
        })
      );
      
      setUsers(usersWithLawFirms);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddUser = async () => {
    try {
      setFormError(null);
      
      // Validate form
      if (!newUser.email || !newUser.password) {
        setFormError('Email and password are required');
        return;
      }
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setFormError('Authentication required');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }
      
      // Reset form and refresh users
      setNewUser({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'public',
      });
      
      setShowAddUserForm(false);
      setSuccessMessage('User added successfully');
        
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
        
      fetchUsers();
    } catch (error: any) {
      setFormError(error.message || 'An error occurred');
    }
  };
  
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowEditUserForm(true);
    setShowAddUserForm(false);
  };
  
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      setFormError(null);
      
      // Update the profile
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editingUser.first_name,
          last_name: editingUser.last_name,
          role: editingUser.role,
        })
        .eq('id', editingUser.id);
        
      if (error) {
        setFormError(error.message);
        return;
      }
      
      // Reset form and refresh users
      setEditingUser(null);
      setShowEditUserForm(false);
      setSuccessMessage('User updated successfully');
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      fetchUsers();
    } catch (error: any) {
      setFormError(error.message || 'An error occurred');
    }
  };
  
  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        // Get current session for auth token
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) {
          setFormError('Authentication required');
          return;
        }
        
        // Call edge function to delete user
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users/delete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete user');
        }
        
        setSuccessMessage('User deleted successfully');
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
        
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        setFormError('Failed to delete user');
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.first_name?.toLowerCase() || '').includes(searchLower) ||
      (user.last_name?.toLowerCase() || '').includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'system_admin':
        return 'bg-purple-900/30 text-purple-400';
      case 'legal_admin':
        return 'bg-cyan-900/30 text-cyan-400';
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button 
            onClick={() => {
              setShowAddUserForm(!showAddUserForm);
              setShowEditUserForm(false);
              setEditingUser(null);
              setFormError(null);
            }}
            className="gap-1 bg-cyan-600 hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
          
          <Button
            variant="outline"
            onClick={fetchUsers}
            title="Refresh users list"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {successMessage && (
        <div className="rounded-lg bg-green-900/20 p-4 text-green-400">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <p>{successMessage}</p>
          </div>
        </div>
      )}
      
      {showAddUserForm && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">Add New User</h3>
          </div>
          
          {formError && (
            <div className="mb-4 rounded-lg bg-red-900/20 p-4 text-red-400">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                <p>{formError}</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-400">Email*</label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="mt-1"
                placeholder="user@example.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">Password*</label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="mt-1"
                placeholder="••••••••"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">First Name</label>
              <Input
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                className="mt-1"
                placeholder="First Name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">Last Name</label>
              <Input
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                className="mt-1"
                placeholder="Last Name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              >
                <option value="public">Public User</option>
                <option value="legal_admin">Legal Admin</option>
                <option value="system_admin">System Admin</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button 
              variant="outline"
              onClick={() => {
                setShowAddUserForm(false);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-500"
              onClick={handleAddUser}
            >
              Add User
            </Button>
          </div>
        </div>
      )}
      
      {showEditUserForm && editingUser && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <Edit className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">Edit User</h3>
          </div>
          
          {formError && (
            <div className="mb-4 rounded-lg bg-red-900/20 p-4 text-red-400">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                <p>{formError}</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-400">Email</label>
              <Input
                type="email"
                value={editingUser.email}
                disabled
                className="mt-1 opacity-70"
              />
              <p className="mt-1 text-xs text-zinc-500">Email cannot be changed</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">First Name</label>
              <Input
                value={editingUser.first_name || ''}
                onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                className="mt-1"
                placeholder="First Name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">Last Name</label>
              <Input
                value={editingUser.last_name || ''}
                onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                className="mt-1"
                placeholder="Last Name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400">Role</label>
              <select
                value={editingUser.role}
                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              >
                <option value="public">Public User</option>
                <option value="legal_admin">Legal Admin</option>
                <option value="system_admin">System Admin</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button 
              variant="outline"
              onClick={() => {
                setShowEditUserForm(false);
                setEditingUser(null);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-500"
              onClick={handleUpdateUser}
            >
              Update User
            </Button>
          </div>
        </div>
      )}
      
      {filteredUsers.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <UserPlus className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No users found</h3>
          <p className="text-zinc-400">Add a user or adjust your search</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="p-4 text-sm font-medium text-zinc-300">User</th>
                  <th className="p-4 text-sm font-medium text-zinc-300">Contact</th>
                  <th className="p-4 text-sm font-medium text-zinc-300">Role</th>
                  <th className="p-4 text-sm font-medium text-zinc-300">Law Firm</th>
                  <th className="p-4 text-sm font-medium text-zinc-300">Created</th>
                  <th className="p-4 text-sm font-medium text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-800 bg-zinc-900/30 transition hover:bg-zinc-900/50">
                    <td className="p-4">
                      <div className="text-sm font-medium text-white">
                        {user.first_name} {user.last_name}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-zinc-300">{user.email}</div>
                      <div className="text-xs text-zinc-500">Last updated: {formatDate(user.updated_at)}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {user.role === 'legal_admin' && user.law_firm ? (
                        <div className="text-sm text-zinc-300">{user.law_firm.name}</div>
                      ) : (
                        <div className="text-xs text-zinc-500">-</div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-zinc-300">{formatDate(user.created_at)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditUser(user)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.role === 'system_admin'}
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
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