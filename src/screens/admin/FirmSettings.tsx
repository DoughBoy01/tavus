import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { userProfileAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Plus, Trash, Save, Building, MapPin, Users, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ServiceArea = {
  id: string;
  state: string;
  city: string;
  zip_code: string;
  radius_miles: number;
};

type FirmProfile = {
  id: string;
  name: string;
  description: string;
  location: string;
  website: string;
  contact_phone: string;
  max_leads_per_month: number;
  remote_capable: boolean;
  subscription_status: string;
  current_month_leads: number;
};

type Subscription = {
  id: string;
  plan_type: string;
  monthly_fee: number;
  max_leads: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  is_active: boolean;
};

export const FirmSettings = () => {
  const [userProfile] = useAtom(userProfileAtom);
  const [firmProfile, setFirmProfile] = useState<FirmProfile | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newServiceArea, setNewServiceArea] = useState({
    state: '',
    city: '',
    zip_code: '',
    radius_miles: 50,
  });

  useEffect(() => {
    fetchFirmData();
  }, [userProfile]);

  const fetchFirmData = async () => {
    if (!userProfile?.email) return;

    try {
      setIsLoading(true);

      // Get firm profile
      const { data: firm, error: firmError } = await supabase
        .from('law_firms')
        .select('*')
        .eq('contact_email', userProfile.email)
        .single();

      if (firmError) throw firmError;
      setFirmProfile(firm);

      // Get service areas
      const { data: areas, error: areasError } = await supabase
        .from('firm_service_areas')
        .select('*')
        .eq('law_firm_id', firm.id);

      if (areasError) throw areasError;
      setServiceAreas(areas || []);

      // Get subscription
      const { data: sub, error: subError } = await supabase
        .from('firm_subscriptions')
        .select('*')
        .eq('law_firm_id', firm.id)
        .eq('is_active', true)
        .single();

      if (subError && subError.code !== 'PGRST116') throw subError;
      setSubscription(sub);

    } catch (error) {
      console.error('Error fetching firm data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFirmProfile = async () => {
    if (!firmProfile) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('law_firms')
        .update({
          name: firmProfile.name,
          description: firmProfile.description,
          location: firmProfile.location,
          website: firmProfile.website,
          contact_phone: firmProfile.contact_phone,
          max_leads_per_month: firmProfile.max_leads_per_month,
          remote_capable: firmProfile.remote_capable,
        })
        .eq('id', firmProfile.id);

      if (error) throw error;

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const addServiceArea = async () => {
    if (!firmProfile || !newServiceArea.state) return;

    try {
      const { error } = await supabase
        .from('firm_service_areas')
        .insert({
          law_firm_id: firmProfile.id,
          ...newServiceArea,
        });

      if (error) throw error;

      setNewServiceArea({ state: '', city: '', zip_code: '', radius_miles: 50 });
      fetchFirmData();
    } catch (error) {
      console.error('Error adding service area:', error);
    }
  };

  const removeServiceArea = async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('firm_service_areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;
      fetchFirmData();
    } catch (error) {
      console.error('Error removing service area:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!firmProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Building className="mx-auto mb-4 h-12 w-12 text-zinc-500" />
          <h3 className="text-lg font-medium text-white">No firm profile found</h3>
          <p className="text-zinc-400">Contact support to set up your firm profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Firm Settings</h2>
        <Button onClick={saveFirmProfile} disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-500">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Firm Profile */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-medium text-white">Firm Profile</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Firm Name</label>
              <Input
                value={firmProfile.name}
                onChange={(e) => setFirmProfile({ ...firmProfile, name: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
              <textarea
                value={firmProfile.description || ''}
                onChange={(e) => setFirmProfile({ ...firmProfile, description: e.target.value })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Main Location</label>
              <Input
                value={firmProfile.location}
                onChange={(e) => setFirmProfile({ ...firmProfile, location: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="City, State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Website</label>
              <Input
                value={firmProfile.website || ''}
                onChange={(e) => setFirmProfile({ ...firmProfile, website: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="https://yourfirm.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
              <Input
                value={firmProfile.contact_phone || ''}
                onChange={(e) => setFirmProfile({ ...firmProfile, contact_phone: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="(555) 555-5555"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Max Leads Per Month</label>
              <Input
                type="number"
                value={firmProfile.max_leads_per_month}
                onChange={(e) => setFirmProfile({ ...firmProfile, max_leads_per_month: parseInt(e.target.value) })}
                className="bg-zinc-800 border-zinc-700"
                min="1"
                max="1000"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remote_capable"
                checked={firmProfile.remote_capable}
                onChange={(e) => setFirmProfile({ ...firmProfile, remote_capable: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 text-cyan-500"
              />
              <label htmlFor="remote_capable" className="text-sm text-zinc-300">
                We can handle remote clients nationwide
              </label>
            </div>
          </div>
        </div>

        {/* Service Areas */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-medium text-white">Service Areas</h3>
            </div>
          </div>
          <div className="p-6">
            {/* Add new service area */}
            <div className="mb-6 rounded-lg border border-zinc-700 p-4">
              <h4 className="mb-3 text-sm font-medium text-zinc-300">Add Service Area</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="State"
                  value={newServiceArea.state}
                  onChange={(e) => setNewServiceArea({ ...newServiceArea, state: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Input
                  placeholder="City (optional)"
                  value={newServiceArea.city}
                  onChange={(e) => setNewServiceArea({ ...newServiceArea, city: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Input
                  placeholder="ZIP Code (optional)"
                  value={newServiceArea.zip_code}
                  onChange={(e) => setNewServiceArea({ ...newServiceArea, zip_code: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Input
                  type="number"
                  placeholder="Radius (miles)"
                  value={newServiceArea.radius_miles}
                  onChange={(e) => setNewServiceArea({ ...newServiceArea, radius_miles: parseInt(e.target.value) })}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <Button onClick={addServiceArea} className="mt-3 bg-cyan-600 hover:bg-cyan-500" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add Area
              </Button>
            </div>

            {/* Current service areas */}
            <div className="space-y-3">
              {serviceAreas.length === 0 ? (
                <p className="text-sm text-zinc-400">No service areas defined. Add areas where you can serve clients.</p>
              ) : (
                serviceAreas.map((area) => (
                  <div key={area.id} className="flex items-center justify-between rounded-lg border border-zinc-700 p-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {area.city ? `${area.city}, ` : ''}{area.state}
                        {area.zip_code && ` ${area.zip_code}`}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {area.radius_miles} mile radius
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeServiceArea(area.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Info */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">Subscription</h3>
          </div>
        </div>
        <div className="p-6">
          {subscription ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-zinc-400">Plan</p>
                <p className="text-lg font-semibold text-white capitalize">{subscription.plan_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">Monthly Fee</p>
                <p className="text-lg font-semibold text-white">${subscription.monthly_fee}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">Lead Limit</p>
                <p className="text-lg font-semibold text-white">{subscription.max_leads} leads</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">Usage This Month</p>
                <p className="text-lg font-semibold text-white">
                  {firmProfile.current_month_leads} / {subscription.max_leads}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto mb-4 h-12 w-12 text-zinc-500" />
              <h3 className="text-lg font-medium text-white">No Active Subscription</h3>
              <p className="text-zinc-400 mb-4">Subscribe to start receiving leads</p>
              <Button className="bg-cyan-600 hover:bg-cyan-500">
                Choose Plan
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};