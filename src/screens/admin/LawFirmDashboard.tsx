import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit, Trash, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LawFirm = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  capacity: number;
  success_rate: number;
  created_at: string;
  practice_areas: {
    name: string;
    experience_years: number;
  }[];
};

export const LawFirmDashboard = () => {
  const [lawFirms, setLawFirms] = useState<LawFirm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingFirm, setIsAddingFirm] = useState(false);
  const [newFirm, setNewFirm] = useState({
    name: '',
    location: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    description: '',
    capacity: 100,
    success_rate: 0.0,
  });
  
  useEffect(() => {
    fetchLawFirms();
  }, []);

  const fetchLawFirms = async () => {
    try {
      setIsLoading(true);
      
      const { data: lawFirmsData, error: lawFirmsError } = await supabase
        .from('law_firms')
        .select('*')
        .order('name');
        
      if (lawFirmsError) throw lawFirmsError;
      
      // For each law firm, fetch the practice areas
      const lawFirmsWithPracticeAreas = await Promise.all(
        lawFirmsData.map(async (firm) => {
          const { data: practiceAreasData } = await supabase
            .from('law_firm_practice_areas')
            .select(`
              experience_years,
              practice_areas(name)
            `)
            .eq('law_firm_id', firm.id);
            
          return {
            ...firm,
            practice_areas: practiceAreasData?.map(pa => ({
              name: pa.practice_areas.name,
              experience_years: pa.experience_years,
            })) || [],
          };
        })
      );
      
      setLawFirms(lawFirmsWithPracticeAreas);
    } catch (error) {
      console.error('Error fetching law firms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFirm = async () => {
    try {
      const { data, error } = await supabase
        .from('law_firms')
        .insert([
          {
            name: newFirm.name,
            location: newFirm.location,
            contact_email: newFirm.contact_email,
            contact_phone: newFirm.contact_phone,
            website: newFirm.website,
            description: newFirm.description,
            capacity: newFirm.capacity,
            success_rate: newFirm.success_rate,
          }
        ])
        .select();
        
      if (error) throw error;
      
      // Refresh law firms list
      fetchLawFirms();
      
      // Reset form
      setNewFirm({
        name: '',
        location: '',
        contact_email: '',
        contact_phone: '',
        website: '',
        description: '',
        capacity: 100,
        success_rate: 0.0,
      });
      
      setIsAddingFirm(false);
    } catch (error) {
      console.error('Error adding law firm:', error);
    }
  };

  const handleDeleteFirm = async (id: string) => {
    if (confirm('Are you sure you want to delete this law firm?')) {
      try {
        const { error } = await supabase
          .from('law_firms')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        // Refresh law firms list
        fetchLawFirms();
      } catch (error) {
        console.error('Error deleting law firm:', error);
      }
    }
  };

  const filteredLawFirms = lawFirms.filter(firm => {
    const searchLower = searchTerm.toLowerCase();
    return (
      firm.name.toLowerCase().includes(searchLower) ||
      firm.location.toLowerCase().includes(searchLower) ||
      firm.contact_email.toLowerCase().includes(searchLower) ||
      firm.practice_areas.some(pa => pa.name.toLowerCase().includes(searchLower))
    );
  });

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
        <h2 className="text-2xl font-bold text-white">Law Firm Management</h2>
        
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search law firms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button 
            onClick={() => setIsAddingFirm(!isAddingFirm)}
            className="gap-1 bg-cyan-600 hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Add Firm
          </Button>
        </div>
      </div>
      
      {isAddingFirm && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="mb-4 text-lg font-medium text-white">Add New Law Firm</h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-400">Firm Name</label>
              <Input
                value={newFirm.name}
                onChange={(e) => setNewFirm({ ...newFirm, name: e.target.value })}
                className="mt-1"
                placeholder="Enter firm name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-zinc-400">Location</label>
              <Input
                value={newFirm.location}
                onChange={(e) => setNewFirm({ ...newFirm, location: e.target.value })}
                className="mt-1"
                placeholder="City, State"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-zinc-400">Email</label>
              <Input
                value={newFirm.contact_email}
                onChange={(e) => setNewFirm({ ...newFirm, contact_email: e.target.value })}
                className="mt-1"
                placeholder="contact@example.com"
                type="email"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-zinc-400">Phone</label>
              <Input
                value={newFirm.contact_phone}
                onChange={(e) => setNewFirm({ ...newFirm, contact_phone: e.target.value })}
                className="mt-1"
                placeholder="(555) 555-5555"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-zinc-400">Website</label>
              <Input
                value={newFirm.website}
                onChange={(e) => setNewFirm({ ...newFirm, website: e.target.value })}
                className="mt-1"
                placeholder="https://example.com"
                type="url"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-zinc-400">Capacity (%)</label>
              <Input
                value={newFirm.capacity.toString()}
                onChange={(e) => setNewFirm({ ...newFirm, capacity: Number(e.target.value) })}
                className="mt-1"
                type="number"
                min="0"
                max="100"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-zinc-400">Success Rate</label>
              <Input
                value={newFirm.success_rate.toString()}
                onChange={(e) => setNewFirm({ ...newFirm, success_rate: Number(e.target.value) })}
                className="mt-1"
                type="number"
                min="0"
                max="1"
                step="0.01"
                placeholder="0.00-1.00"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-zinc-400">Description</label>
              <textarea
                value={newFirm.description}
                onChange={(e) => setNewFirm({ ...newFirm, description: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                placeholder="Enter a description"
                rows={3}
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button 
              variant="outline"
              onClick={() => setIsAddingFirm(false)}
            >
              Cancel
            </Button>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-500"
              onClick={handleAddFirm}
            >
              Save Firm
            </Button>
          </div>
        </div>
      )}
      
      {filteredLawFirms.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <Building className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No law firms found</h3>
          <p className="text-zinc-400">Add a law firm to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filteredLawFirms.map((firm) => (
            <div key={firm.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 bg-zinc-800/30 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">{firm.name}</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteFirm(firm.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-400">Location</p>
                    <p className="text-white">{firm.location}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-400">Contact</p>
                    <p className="text-white">{firm.contact_email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-400">Capacity</p>
                    <p className="text-white">{firm.capacity}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-400">Success Rate</p>
                    <p className="text-white">{(firm.success_rate * 100).toFixed(0)}%</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm font-medium text-zinc-400">Practice Areas</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {firm.practice_areas.map((area, index) => (
                      <div
                        key={index}
                        className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-white"
                      >
                        {area.name} ({area.experience_years} yrs)
                      </div>
                    ))}
                    {firm.practice_areas.length === 0 && (
                      <p className="text-sm text-zinc-500">No practice areas defined</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};