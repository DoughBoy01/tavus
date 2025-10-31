import { DialogWrapper } from "@/components/DialogWrapper";
import {
  DailyAudio,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  useVideoTrack,
  useAudioTrack,
  useDailyEvent,
} from "@daily-co/daily-react";
import React, { useCallback, useEffect, useState } from "react";
import Video from "@/components/Video";
import { conversationAtom } from "@/store/conversation";
import { useAtom, useAtomValue } from "jotai";
import { screenAtom } from "@/store/screens";
import { Button } from "@/components/ui/button";
import { endConversation } from "@/api/endConversation";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneIcon,
} from "lucide-react";
import {
  clearSessionTime,
  getSessionTime,
  setSessionStartTime,
  updateSessionEndTime,
} from "@/utils";
import { Timer } from "@/components/Timer";
import { TIME_LIMIT } from "@/config";
import { niceScoreAtom } from "@/store/game";
import { naughtyScoreAtom } from "@/store/game";
import { Game } from "@/components/Game";
import { quantum } from 'ldrs';
import { cn } from "@/lib/utils";

quantum.register();

const timeToGoPhrases = [
  "I'll need to dash off soon—let's make these last moments count.",
  "I'll be heading out soon, but I've got a little more time for you!",
  "I'll be leaving soon, but I'd love to hear one more thing before I go!",
];

const outroPhrases = [
  "It's time for me to go now. Take care, and I'll see you soon!",
  "I've got to get back to work. See you next time!",
  "I must say goodbye for now. Stay well, and I'll see you soon!",
];

export const Conversation: React.FC = () => {
  const [conversation, setConversation] = useAtom(conversationAtom);
  const [, setScreenState] = useAtom(screenAtom);
  const [naughtyScore] = useAtom(naughtyScoreAtom);
  const [niceScore] = useAtom(niceScoreAtom);

  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const localVideo = useVideoTrack(localSessionId);
  const localAudio = useAudioTrack(localSessionId);
  const isCameraEnabled = !localVideo.isOff;
  const isMicEnabled = !localAudio.isOff;
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const [start, setStart] = useState(false);

  // State to store conversation data
  const [conversationData, setConversationData] = useState({
    name: '',
    email: '',
    phone: '',
    case_description: '',
  });

  useEffect(() => {
    if (remoteParticipantIds.length && !start) {
      setStart(true);
      setTimeout(() => daily?.setLocalAudio(true), 4000);
    }
  }, [remoteParticipantIds, start]);

  useEffect(() => {
    if (!remoteParticipantIds.length || !start) return;

    setSessionStartTime();
    const interval = setInterval(() => {
      const time = getSessionTime();
      if (time === TIME_LIMIT - 60) {
        daily?.sendAppMessage({
          message_type: "conversation",
          event_type: "conversation.echo",
          conversation_id: conversation?.conversation_id,
          properties: {
            modality: "text",
            text:
              timeToGoPhrases[Math.floor(Math.random() * 3)] ??
              timeToGoPhrases[0],
          },
        });
      }
      if (time === TIME_LIMIT - 10) {
        daily?.sendAppMessage({
          message_type: "conversation",
          event_type: "conversation.echo",
          conversation_id: conversation?.conversation_id,
          properties: {
            modality: "text",
            text:
              outroPhrases[Math.floor(Math.random() * 3)] ?? outroPhrases[0],
          },
        });
      }
      if (time >= TIME_LIMIT) {
        leaveConversation();
        clearInterval(interval);
      } else {
        updateSessionEndTime();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [remoteParticipantIds, start]);

  useEffect(() => {
    console.log('=== CONVERSATION DEBUG ===');
    console.log('Full conversation object:', conversation);
    console.log('Conversation URL:', conversation?.conversation_url);
    console.log('Conversation ID:', conversation?.conversation_id);
    console.log('Daily instance:', daily);
    
    // Validate URL format
    if (conversation?.conversation_url) {
      if (conversation.conversation_url.includes('tavus.daily.co')) {
        console.log('✅ URL is in correct tavus.daily.co format');
      } else if (conversation.conversation_url.includes('c.daily.co')) {
        console.warn('⚠️ URL is in old c.daily.co format - this may cause issues');
      } else {
        console.warn('⚠️ URL format not recognized:', conversation.conversation_url);
      }
    }
    
    if (conversation?.conversation_url) {
      console.log('🟢 Attempting to join Daily.co call with URL:', conversation.conversation_url);
      
      daily
        ?.join({
          url: conversation.conversation_url,
          startVideoOff: false,
          startAudioOff: true,
        })
        .then((result) => {
          console.log('✅ Successfully joined Daily.co call:', result);
          daily?.setLocalVideo(true);
          daily?.setLocalAudio(false);
        })
        .catch((error) => {
          console.error('❌ Failed to join Daily.co call:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            url: conversation.conversation_url
          });
        });
    } else {
      console.log('🔴 No conversation URL available');
      console.log('Conversation object keys:', conversation ? Object.keys(conversation) : 'conversation is null/undefined');
    }
  }, [conversation?.conversation_url, daily]);

  // Handle Tavus messages to extract user information
  useDailyEvent(
    "app-message",
    useCallback(
      (ev: {
        data?: {
          event_type: string;
          properties?: { 
            modality?: string; 
            text?: string;
            entity_name?: string;
            entity_type?: string;
            value?: string;
          };
        };
      }) => {
        if (ev.data?.event_type === "conversation.echo" && ev.data?.properties?.modality === "text") {
          const text = ev.data.properties.text || "";
          console.log("Received message:", text);
          
          // Try to build a more complete case description from AI responses
          if (text.length > 20 && !text.includes("I'll need to dash off") && !text.includes("It's time for me to go")) {
            setConversationData(prev => ({
              ...prev,
              case_description: prev.case_description 
                ? `${prev.case_description}\n\nAI: ${text}`
                : `AI: ${text}`
            }));
          }
        }
        
        // Extract entities from NER results
        if (ev.data?.event_type === "conversation.entity" && 
            ev.data?.properties?.entity_name &&
            ev.data?.properties?.entity_type &&
            ev.data?.properties?.value) {
          
          const { entity_type, value } = ev.data.properties;
          
          switch(entity_type.toLowerCase()) {
            case "person":
            case "name":
              setConversationData(prev => ({ ...prev, name: value }));
              break;
            case "email":
              setConversationData(prev => ({ ...prev, email: value }));
              break;
            case "phone":
            case "phone_number":
              setConversationData(prev => ({ ...prev, phone: value }));
              break;
          }
        }
      },
      []
    )
  );

  const toggleVideo = useCallback(() => {
    daily?.setLocalVideo(!isCameraEnabled);
  }, [daily, isCameraEnabled]);

  const toggleAudio = useCallback(() => {
    daily?.setLocalAudio(!isMicEnabled);
  }, [daily, isMicEnabled]);

  const leaveConversation = useCallback(async () => {
    daily?.leave();
    daily?.destroy();
    
    if (conversation?.conversation_id) {
      // Calculate urgency score based on case description
      let urgencyScore = 5; // Default medium urgency
      const description = conversationData.case_description.toLowerCase();
      
      if (description.includes('urgent') || 
          description.includes('emergency') || 
          description.includes('immediately') ||
          description.includes('critical')) {
        urgencyScore = 9;
      } else if (description.includes('soon') || 
                description.includes('quickly') ||
                description.includes('important')) {
        urgencyScore = 7;
      } else if (description.includes('no rush') ||
                description.includes('whenever') ||
                description.includes('not urgent')) {
        urgencyScore = 3;
      }
      
      // End the conversation and pass the collected data
      await endConversation(conversation.conversation_id, {
        ...conversationData,
        urgency_score: urgencyScore
      });
    }
    
    setConversation(null);
    clearSessionTime();

    // Return to home screen instead of final screen
    setScreenState({ currentScreen: "intro" });
  }, [daily, conversation, conversationData, naughtyScore, niceScore, setScreenState, setConversation]);

  return (
    <DialogWrapper>
      <div className="absolute inset-0 size-full">
        {remoteParticipantIds?.length > 0 ? (
          <>
            <Timer />
            <Video
              id={remoteParticipantIds[0]}
              className="size-full"
              tileClassName="!object-cover"
            />
            <Game />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <l-quantum
              size="45"
              speed="1.75"
              color="white"
            ></l-quantum>
          </div>
        )}
        {localSessionId && (
          <Video
            id={localSessionId}
            tileClassName="!object-cover"
            className={cn(
              "absolute bottom-20 right-4 aspect-video h-40 w-24 overflow-hidden rounded-lg border-2 border-[#22C5FE] shadow-[0_0_20px_rgba(34,197,254,0.3)] sm:bottom-12 lg:h-auto lg:w-52"
            )}
          />
        )}
        <div className="absolute bottom-8 right-1/2 z-10 flex translate-x-1/2 justify-center gap-4">
          <Button
            size="icon"
            className="border border-[#22C5FE] shadow-[0_0_20px_rgba(34,197,254,0.2)]"
            variant="secondary"
            onClick={toggleAudio}
          >
            {!isMicEnabled ? (
              <MicOffIcon className="size-6" />
            ) : (
              <MicIcon className="size-6" />
            )}
          </Button>
          <Button
            size="icon"
            className="border border-[#22C5FE] shadow-[0_0_20px_rgba(34,197,254,0.2)]"
            variant="secondary"
            onClick={toggleVideo}
          >
            {!isCameraEnabled ? (
              <VideoOffIcon className="size-6" />
            ) : (
              <VideoIcon className="size-6" />
            )}
          </Button>
          <Button
            size="icon"
            className="bg-[rgba(251,36,71,0.80)] backdrop-blur hover:bg-[rgba(251,36,71,0.60)] border border-[rgba(251,36,71,0.9)] shadow-[0_0_20px_rgba(251,36,71,0.3)]"
            variant="secondary"
            onClick={leaveConversation}
          >
            <PhoneIcon className="size-6 rotate-[135deg]" />
          </Button>
        </div>
        <DailyAudio />
      </div>
    </DialogWrapper>
  );
};