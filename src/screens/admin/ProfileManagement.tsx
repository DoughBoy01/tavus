import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Building, CheckCircle, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LawFirm = {
  id: string;
  name: string;
  description: string;
  location: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  capacity: number;
  success_rate: number;
};

type PracticeArea = {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  experience_years: number;
};

export const ProfileManagement = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [lawFirm, setLawFirm] = useState<LawFirm | null>(null);
  const [availablePracticeAreas, setAvailablePracticeAreas] = useState<PracticeArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!userProfile) return;
      
      try {
        setIsLoading(true);
        
        // Fetch law firm data
        const { data: lawFirmData, error: lawFirmError } = await supabase
          .from('law_firms')
          .select('*')
          .eq('contact_email', userProfile.email)
          .single();
          
        if (lawFirmError && lawFirmError.code !== 'PGRST116') {
          console.error('Error fetching law firm:', lawFirmError);
        } else {
          setLawFirm(lawFirmData || null);
          
          // If we found a law firm, fetch its practice areas
          if (lawFirmData) {
            // First, get all practice areas
            const { data: allPracticeAreas } = await supabase
              .from('practice_areas')
              .select('*')
              .order('name');
              
            // Then, get the law firm's practice areas
            const { data: firmPracticeAreas } = await supabase
              .from('law_firm_practice_areas')
              .select('practice_area_id, experience_years')
              .eq('law_firm_id', lawFirmData.id);
              
            // Combine the data
            const practiceAreasWithSelection = allPracticeAreas.map(area => {
              const firmArea = firmPracticeAreas?.find(fa => fa.practice_area_id === area.id);
              return {
                ...area,
                selected: !!firmArea,
                experience_years: firmArea?.experience_years || 0,
              };
            });
            
            setAvailablePracticeAreas(practiceAreasWithSelection);
          } else {
            // If no law firm, just get all practice areas
            const { data: allPracticeAreas } = await supabase
              .from('practice_areas')
              .select('*')
              .order('name');
              
            const practiceAreasWithSelection = allPracticeAreas.map(area => ({
              ...area,
              selected: false,
              experience_years: 0,
            }));
            
            setAvailablePracticeAreas(practiceAreasWithSelection);
          }
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [userProfile]);

  const handleTogglePracticeArea = (id: string) => {
    setAvailablePracticeAreas(areas =>
      areas.map(area =>
        area.id === id
          ? { ...area, selected: !area.selected }
          : area
      )
    );
  };

  const handleExperienceChange = (id: string, years: number) => {
    setAvailablePracticeAreas(areas =>
      areas.map(area =>
        area.id === id
          ? { ...area, experience_years: years }
          : area
      )
    );
  };

  const handleSave = async () => {
    if (!userProfile) return;
    
    try {
      setIsSaving(true);
      
      // If no law firm exists, create one
      if (!lawFirm?.id) {
        if (!lawFirm?.name || !lawFirm?.location || !lawFirm?.contact_email) {
          alert('Please fill out all required fields');
          setIsSaving(false);
          return;
        }
        
        const { data: newLawFirm, error: createError } = await supabase
          .from('law_firms')
          .insert({
            name: lawFirm.name,
            description: lawFirm.description,
            location: lawFirm.location,
            website: lawFirm.website,
            contact_email: userProfile.email,
            contact_phone: lawFirm.contact_phone,
            capacity: lawFirm.capacity || 100,
            success_rate: lawFirm.success_rate || 0,
          })
          .select()
          .single();
          
        if (createError) throw createError;
        
        setLawFirm(newLawFirm);
        
        // Add practice areas
        const selectedAreas = availablePracticeAreas.filter(area => area.selected);
        if (selectedAreas.length > 0) {
          const practiceAreaInserts = selectedAreas.map(area => ({
            law_firm_id: newLawFirm.id,
            practice_area_id: area.id,
            experience_years: area.experience_years,
          }));
          
          const { error: insertError } = await supabase
            .from('law_firm_practice_areas')
            .insert(practiceAreaInserts);
            
          if (insertError) throw insertError;
        }
      } else {
        // Update existing law firm
        const { error: updateError } = await supabase
          .from('law_firms')
          .update({
            name: lawFirm.name,
            description: lawFirm.description,
            location: lawFirm.location,
            website: lawFirm.website,
            contact_phone: lawFirm.contact_phone,
            capacity: lawFirm.capacity,
            success_rate: lawFirm.success_rate,
          })
          .eq('id', lawFirm.id);
          
        if (updateError) throw updateError;
        
        // Delete all practice areas and re-add selected ones
        await supabase
          .from('law_firm_practice_areas')
          .delete()
          .eq('law_firm_id', lawFirm.id);
          
        const selectedAreas = availablePracticeAreas.filter(area => area.selected);
        if (selectedAreas.length > 0) {
          const practiceAreaInserts = selectedAreas.map(area => ({
            law_firm_id: lawFirm.id,
            practice_area_id: area.id,
            experience_years: area.experience_years,
          }));
          
          const { error: insertError } = await supabase
            .from('law_firm_practice_areas')
            .insert(practiceAreaInserts);
            
          if (insertError) throw insertError;
        }
      }
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Firm Profile</h2>
        
        {showSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-green-900/20 px-4 py-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span>Profile saved successfully</span>
          </div>
        )}
        
        <Button 
          className="gap-1 bg-cyan-600 hover:bg-cyan-500"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Law Firm Information */}
        <div className="col-span-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 bg-zinc-800/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-medium text-white">Law Firm Information</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-400">Firm Name*</label>
                <Input
                  value={lawFirm?.name || ''}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, name: e.target.value }))}
                  className="mt-1"
                  placeholder="Enter firm name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400">Location*</label>
                <Input
                  value={lawFirm?.location || ''}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, location: e.target.value }))}
                  className="mt-1"
                  placeholder="City, State"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400">Contact Phone</label>
                <Input
                  value={lawFirm?.contact_phone || ''}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, contact_phone: e.target.value }))}
                  className="mt-1"
                  placeholder="(555) 555-5555"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400">Website</label>
                <Input
                  value={lawFirm?.website || ''}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, website: e.target.value }))}
                  className="mt-1"
                  placeholder="https://example.com"
                  type="url"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400">Current Capacity (%)</label>
                <Input
                  value={lawFirm?.capacity?.toString() || '100'}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, capacity: Number(e.target.value) }))}
                  className="mt-1"
                  type="number"
                  min="0"
                  max="100"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Percentage of your current capacity to take on new clients
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400">Success Rate (0-1)</label>
                <Input
                  value={lawFirm?.success_rate?.toString() || '0'}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, success_rate: Number(e.target.value) }))}
                  className="mt-1"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Your success rate in handling cases (0.00-1.00)
                </p>
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-400">Description</label>
                <textarea
                  value={lawFirm?.description || ''}
                  onChange={(e) => setLawFirm(prev => ({ ...prev!, description: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
                  placeholder="Describe your law firm"
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Practice Areas */}
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 bg-zinc-800/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-medium text-white">Practice Areas</h3>
            </div>
          </div>
          <div className="h-[480px] overflow-y-auto p-6">
            {availablePracticeAreas.map((area) => (
              <div key={area.id} className="mb-4 rounded-lg border border-zinc-800 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`area-${area.id}`}
                      checked={area.selected}
                      onChange={() => handleTogglePracticeArea(area.id)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-cyan-500"
                    />
                    <label htmlFor={`area-${area.id}`} className="text-white">
                      {area.name}
                    </label>
                  </div>
                  
                  {area.selected && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-400">Years Exp:</span>
                      <Input
                        type="number"
                        min="0"
                        value={area.experience_years}
                        onChange={(e) => handleExperienceChange(area.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                      />
                    </div>
                  )}
                </div>
                
                {area.selected && (
                  <p className="mt-2 text-sm text-zinc-400">{area.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};