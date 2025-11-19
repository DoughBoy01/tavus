import { DialogWrapper, AnimatedTextBlockWrapper } from "@/components/DialogWrapper";
import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { screenAtom } from "@/store/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle,
  Mail,
  Clock,
  Phone,
  Globe,
  Award,
  Bell,
  MessageSquare,
  Calendar,
  ExternalLink
} from "lucide-react";

export const FinalScreen: React.FC = () => {
  const [, setScreenState] = useAtom(screenAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [leadData, setLeadData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [caseReference, setCaseReference] = useState("");

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
            case_category,
            urgency_score,
            openai_urgency_score,
            created_at,
            leads(
              id,
              status,
              practice_area:practice_areas(name),
              matches(
                id,
                match_score,
                status,
                law_firm:law_firms(
                  name,
                  website,
                  contact_phone,
                  contact_email,
                  rating,
                  avg_response_time_minutes
                )
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (conversationData) {
          // Generate case reference
          const ref = `CASE-${conversationData.id.slice(0, 8).toUpperCase()}`;
          setCaseReference(ref);

          // Get user email if provided
          if (conversationData.email) {
            setEmail(conversationData.email);
          }

          // Sort matches by score (highest first) and get top matches
          const matches = conversationData.leads?.[0]?.matches || [];
          const sortedMatches = matches
            .filter((m: any) => m.status === 'pending')
            .sort((a: any, b: any) => b.match_score - a.match_score)
            .slice(0, 3);

          setLeadData({
            name: conversationData.name,
            practiceArea: conversationData.leads?.[0]?.practice_area?.name || conversationData.case_category,
            urgency: conversationData.urgency_score || conversationData.openai_urgency_score || 5,
            createdAt: conversationData.created_at,
            matchCount: matches.length,
            matches: sortedMatches.map((match: any) => ({
              firmName: match.law_firm.name,
              score: Math.round(match.match_score * 100),
              website: match.law_firm.website,
              phone: match.law_firm.contact_phone,
              email: match.law_firm.contact_email,
              rating: match.law_firm.rating || 0,
              avgResponseTime: match.law_firm.avg_response_time_minutes || 0,
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

  const handleEmailSubmit = async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      // Add email to notification queue
      await supabase.from('email_queue').insert({
        to_email: email,
        subject: `Case Reference: ${caseReference} - Updates & Next Steps`,
        template_name: 'case-updates',
        template_data: { caseReference, name: leadData?.name },
      });

      setEmailSubmitted(true);
    } catch (error) {
      console.error('Error saving email:', error);
    }
  };

  const handleReturn = () => {
    setScreenState({ currentScreen: "intro" });
  };

  const getUrgencyText = (urgency: number) => {
    if (urgency >= 8) return 'Urgent - Priority Response';
    if (urgency >= 6) return 'High Priority';
    return 'Standard Timeline';
  };

  const getEstimatedResponseTime = (urgency: number) => {
    if (urgency >= 8) return '2-4 hours';
    if (urgency >= 6) return '4-8 hours';
    return '12-24 hours';
  };

  return (
    <DialogWrapper>
      <AnimatedTextBlockWrapper>
        <div className="flex flex-col items-center justify-center gap-6 py-8 px-4 max-w-4xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-400 mb-4">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Thank You{leadData?.name ? `, ${leadData.name}` : ''}!
            </h1>
            <p className="text-lg text-cyan-300">
              We've received your case and are connecting you with qualified attorneys
            </p>
          </div>

          {/* Case Reference Card */}
          {caseReference && (
            <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg p-4">
              <div className="text-center">
                <p className="text-sm text-zinc-400 mb-1">Your Case Reference Number</p>
                <p className="text-2xl font-bold text-cyan-400 font-mono tracking-wide">
                  {caseReference}
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Save this number for future reference
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
          ) : leadData ? (
            <div className="w-full space-y-6">
              {/* What Happens Next */}
              <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  What Happens Next?
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-white">Case Analysis Complete</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        We've analyzed your case and matched you with {leadData.matchCount} qualified law firm{leadData.matchCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-white">Firm Review & Contact</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        Selected firms are reviewing your case right now and will reach out directly
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-white">Initial Consultation</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        Schedule a free consultation to discuss your case in detail
                      </p>
                    </div>
                  </div>

                  {/* Response Time Estimate */}
                  <div className="mt-6 p-4 bg-cyan-950/20 border border-cyan-800/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-cyan-400" />
                      <span className="font-semibold text-white">
                        {getUrgencyText(leadData.urgency)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">
                      Estimated response time: <span className="font-medium text-cyan-400">{getEstimatedResponseTime(leadData.urgency)}</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Average response from our network: 4 hours
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched Firms */}
              {leadData.matches && leadData.matches.length > 0 && (
                <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-cyan-400" />
                    Top Matched Law Firms
                  </h2>
                  <div className="space-y-4">
                    {leadData.matches.map((match: any, index: number) => (
                      <div
                        key={index}
                        className="border border-zinc-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                              {match.firmName}
                              {index === 0 && (
                                <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-full">
                                  Best Match
                                </span>
                              )}
                            </h4>
                            {match.rating > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={i < Math.round(match.rating) ? 'text-yellow-400' : 'text-zinc-600'}
                                  >
                                    ★
                                  </span>
                                ))}
                                <span className="text-sm text-zinc-400 ml-1">
                                  ({match.rating.toFixed(1)})
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="px-3 py-1 bg-cyan-900/30 text-cyan-400 text-sm font-medium rounded-full">
                            {match.score}% match
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {match.phone && (
                            <div className="flex items-center gap-2 text-zinc-300">
                              <Phone className="h-4 w-4 text-cyan-400" />
                              <a href={`tel:${match.phone}`} className="hover:text-cyan-400 transition-colors">
                                {match.phone}
                              </a>
                            </div>
                          )}

                          {match.email && (
                            <div className="flex items-center gap-2 text-zinc-300">
                              <Mail className="h-4 w-4 text-cyan-400" />
                              <a href={`mailto:${match.email}`} className="hover:text-cyan-400 transition-colors">
                                {match.email}
                              </a>
                            </div>
                          )}

                          {match.website && (
                            <div className="flex items-center gap-2 text-zinc-300 col-span-full">
                              <Globe className="h-4 w-4 text-cyan-400" />
                              <a
                                href={match.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                              >
                                Visit Website
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}

                          {match.avgResponseTime > 0 && (
                            <div className="flex items-center gap-2 text-zinc-400 text-xs col-span-full">
                              <Clock className="h-3 w-3" />
                              Avg response: {Math.round(match.avgResponseTime / 60)} hours
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Notification Sign-up */}
              {!emailSubmitted ? (
                <div className="bg-gradient-to-br from-cyan-950/30 to-blue-950/30 border border-cyan-800/30 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Bell className="h-5 w-5 text-cyan-400 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-white">Get Status Updates</h3>
                      <p className="text-sm text-zinc-300 mt-1">
                        Receive notifications when firms review your case and reach out
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleEmailSubmit} className="bg-cyan-500 hover:bg-cyan-600">
                      <Mail className="mr-2 h-4 w-4" />
                      Subscribe
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <p className="font-medium">You're all set! We'll send updates to {email}</p>
                  </div>
                </div>
              )}

              {/* Additional Help */}
              <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-cyan-400" />
                  Need Immediate Assistance?
                </h3>
                <div className="space-y-2 text-sm text-zinc-300">
                  <p>• You can reach out directly to any of the matched firms above</p>
                  <p>• For urgent matters, call the firm directly using the phone numbers provided</p>
                  <p>• Have questions about your case? Email us at support@legalleads.com</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-8 text-center">
              <p className="text-zinc-300 mb-4">
                We're processing your case and connecting you with suitable legal professionals.
              </p>
              <p className="text-sm text-zinc-400">
                You should receive contact from a qualified attorney within 24 hours.
              </p>
            </div>
          )}

          {/* Return Button */}
          <Button
            onClick={handleReturn}
            variant="outline"
            className="mt-6"
          >
            Return to Home
          </Button>
        </div>
      </AnimatedTextBlockWrapper>
    </DialogWrapper>
  );
};
