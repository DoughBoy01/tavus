import { DialogWrapper, AnimatedTextBlockWrapper } from "@/components/DialogWrapper";
import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { screenAtom } from "@/store/screens";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const FinalScreen: React.FC = () => {
  const [, setScreenState] = useAtom(screenAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [leadData, setLeadData] = useState<any>(null);

  useEffect(() => {
    const fetchLeadData = async () => {
      setIsLoading(true);
      
      try {
        // Get the most recent conversation
        const { data: conversationData } = await supabase
          .from('conversations')
          .select(`
            id,
            name,
            email,
            case_description,
            leads(
              id,
              status,
              practice_area:practice_areas(name),
              matches(
                id,
                match_score,
                law_firm:law_firms(name, website, contact_phone)
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (conversationData) {
          // Sort matches by score (highest first) and get top matches
          const matches = conversationData.leads?.[0]?.matches || [];
          const sortedMatches = matches.sort((a, b) => b.match_score - a.match_score).slice(0, 3);
          
          setLeadData({
            name: conversationData.name,
            practiceArea: conversationData.leads?.[0]?.practice_area?.name,
            matches: sortedMatches.map(match => ({
              firmName: match.law_firm.name,
              score: Math.round(match.match_score * 100),
              website: match.law_firm.website,
              phone: match.law_firm.contact_phone
            }))
          });
        }
      } catch (error) {
        console.error('Error fetching lead data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLeadData();
  }, []);

  const handleReturn = () => {
    setScreenState({ currentScreen: "intro" });
  };

  return (
    <DialogWrapper>
      <AnimatedTextBlockWrapper>
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Thank You!</h1>
            <p className="text-xl text-cyan-300 mb-8">
              We have received your inquiry
            </p>
            
            {isLoading ? (
              <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full mx-auto" />
            ) : leadData ? (
              <div className="max-w-md bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
                {leadData.name && (
                  <p className="mb-4 text-lg">
                    <span className="text-gray-400">Name:</span> <span className="text-white">{leadData.name}</span>
                  </p>
                )}
                
                {leadData.practiceArea && (
                  <p className="mb-4 text-lg">
                    <span className="text-gray-400">Practice Area:</span> <span className="text-white">{leadData.practiceArea}</span>
                  </p>
                )}
                
                {leadData.matches && leadData.matches.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Recommended Law Firms</h3>
                    <div className="space-y-4">
                      {leadData.matches.map((match, index) => (
                        <div key={index} className="border border-zinc-700 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-lg font-medium text-white">{match.firmName}</h4>
                            <span className="px-2 py-1 bg-cyan-900/30 text-cyan-400 text-xs rounded-full">
                              {match.score}% match
                            </span>
                          </div>
                          {match.phone && (
                            <p className="text-gray-400 text-sm mb-1">
                              <span className="font-medium">Phone:</span> {match.phone}
                            </p>
                          )}
                          {match.website && (
                            <p className="text-gray-400 text-sm">
                              <span className="font-medium">Website:</span>{' '}
                              <a href={match.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                                {match.website}
                              </a>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">
                We'll be in touch with suitable legal help soon.
              </p>
            )}
          </div>
          
          <Button
            onClick={handleReturn}
            className="relative z-20 flex items-center justify-center gap-2 rounded-3xl border border-[rgba(255,255,255,0.3)] px-8 py-3 text-base text-white transition-all duration-200 hover:text-primary disabled:opacity-50"
            style={{
              height: '48px',
              transition: 'all 0.2s ease-in-out',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(34, 197, 254, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Return to Main Screen
          </Button>
        </div>
      </AnimatedTextBlockWrapper>
    </DialogWrapper>
  );
};