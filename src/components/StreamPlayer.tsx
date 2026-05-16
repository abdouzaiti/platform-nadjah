import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { UserProfile, ChatMessageData, ClassRoom, TeacherCommunity, LiveSession } from "../types";
import { Send, Users, Heart, Share2, MoreHorizontal, X, MessageCircle, Play, VideoOff, Save, Check, Maximize2, Minimize2, Eye, EyeOff, RefreshCw, Loader2, LogOut, Megaphone, Radio, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { formatDate, cn } from "../lib/utils";
import { createAgoraClient, joinChannel, createTracks, leaveChannel, createRTMClient, AgoraRTC } from "../lib/agora";
import AgoraPlayer from "./AgoraPlayer";
import RoomSidebar from "./RoomSidebar";
import { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import { useTranslation } from "react-i18next";

const Player = ReactPlayer as any;

interface StreamPlayerProps {
  room: ClassRoom;
  session: LiveSession;
  profile: UserProfile;
  onClose?: () => void;
  isTeacherView?: boolean;
  teacherId?: string;
}

export default function StreamPlayer({ room, session, profile, onClose, isTeacherView, teacherId: teacherIdProp }: StreamPlayerProps) {
  const { t, i18n } = useTranslation();
  const [currentSession, setCurrentSession] = useState<LiveSession>(session);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isEnding, setIsEnding] = useState(false);
  const [recordingUrlInput, setRecordingUrlInput] = useState("");
  const [hideComments, setHideComments] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarActiveTab, setSidebarActiveTab] = useState("announcements");
  const [hasEntered, setHasEntered] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(teacherIdProp || null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const groupChatScrollRef = useRef<HTMLDivElement>(null);
  const privateChatScrollRef = useRef<HTMLDivElement>(null);
  const liveCommentsScrollRef = useRef<HTMLDivElement>(null);
  const announcementsScrollRef = useRef<HTMLDivElement>(null);

  // Agora State
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [rtmClient, setRtmClient] = useState<any | null>(null);
  const [localTracks, setLocalTracks] = useState<{ audioTrack: IMicrophoneAudioTrack; videoTrack: ICameraVideoTrack | null } | null>(null);
  const [remoteStudents, setRemoteStudents] = useState<IRemoteVideoTrack | null>(null);
  const [teacherVideo, setTeacherVideo] = useState<IRemoteVideoTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isFlipping, setIsFlipping] = useState(false);
  const [hasAudioStarted, setHasAudioStarted] = useState(true);
  const [micVolume, setMicVolume] = useState(0);
  const [agoraError, setAgoraError] = useState<string | null>(null);
  const [isInitializingTracks, setIsInitializingTracks] = useState(false);
  const [initTakingLong, setInitTakingLong] = useState(false);

  useEffect(() => {
    const fetchTeacher = async () => {
      try {
        const { data, error } = await supabase
          .from('class_rooms')
          .select(`
            community:teacher_communities (
              teacher_id
            )
          `)
          .eq('id', room.id)
          .maybeSingle();
        
        if (data && data.community) {
          // Handle both object and array return formats from Supabase joins
          const teacher_id = Array.isArray(data.community) 
            ? data.community[0]?.teacher_id 
            : (data.community as any).teacher_id;
            
          if (teacher_id) {
            setTeacherId(teacher_id);
            console.log("Teacher ID fetched:", teacher_id);
          }
        }
      } catch (err) {
        console.error("Error fetching teacher:", err);
      }
    };
    fetchTeacher();
  }, [room.id]);

  useEffect(() => {
    // Scroll to bottom when tab changes or messages updated for private chat
    if (sidebarActiveTab === "private_chat" && privateChatScrollRef.current) {
      privateChatScrollRef.current.scrollTop = privateChatScrollRef.current.scrollHeight;
    }
    if (sidebarActiveTab === "announcements" && announcementsScrollRef.current) {
      announcementsScrollRef.current.scrollTop = announcementsScrollRef.current.scrollHeight;
    }
  }, [sidebarActiveTab, messages, selectedStudentId]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(50);
      
      if (!error && data) {
        setMessages(data.map(m => ({
          id: m.id,
          room_id: m.room_id,
          message: m.message,
          content: m.content,
          sender_id: m.user_id,
          sender_name: m.user_name,
          sender_avatar: m.user_avatar,
          recipient_id: m.recipient_id,
          created_at: m.created_at
        })) as ChatMessageData[]);
        
        setTimeout(() => {
          if (groupChatScrollRef.current) groupChatScrollRef.current.scrollTop = groupChatScrollRef.current.scrollHeight;
          if (liveCommentsScrollRef.current) liveCommentsScrollRef.current.scrollTop = liveCommentsScrollRef.current.scrollHeight;
        }, 100);
      }
    };

    fetchMessages();

    // Subscribe to session changes
    const sessionChannel = supabase
      .channel(`session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${session.id}`
        },
        (payload) => {
          setCurrentSession(payload.new as LiveSession);
        }
      )
      .subscribe();

    const channel = supabase
      .channel(`chat-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          const newMsg: ChatMessageData = {
            id: payload.new.id,
            room_id: payload.new.room_id,
            message: payload.new.message,
            content: payload.new.content,
            sender_id: payload.new.user_id,
            sender_name: payload.new.user_name,
            sender_avatar: payload.new.user_avatar,
            recipient_id: payload.new.recipient_id,
            created_at: payload.new.created_at
          };
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          
          setTimeout(() => {
            if (groupChatScrollRef.current) groupChatScrollRef.current.scrollTop = groupChatScrollRef.current.scrollHeight;
            if (liveCommentsScrollRef.current) liveCommentsScrollRef.current.scrollTop = liveCommentsScrollRef.current.scrollHeight;
            if (privateChatScrollRef.current) privateChatScrollRef.current.scrollTop = privateChatScrollRef.current.scrollHeight;
            if (announcementsScrollRef.current) announcementsScrollRef.current.scrollTop = announcementsScrollRef.current.scrollHeight;
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(sessionChannel);
    };
  }, [room.id, session.id]);

  // Agora Lifecycle (RTC + RTM)
  useEffect(() => {
    // Setup RTM regardless of live status for reliable chat
    const rtm = createRTMClient(profile.id);
    setRtmClient(rtm);

    const setupRtm = async () => {
      try {
        await rtm.login();
        await rtm.subscribe(room.id);
        
        rtm.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.message as string);
            if (data.type === "chat") {
              const newMsg = data.payload as ChatMessageData;
              
              // For private messages, check if we are the intended recipient or sender
              if (newMsg.content === 'private') {
                const isRelevant = newMsg.sender_id === profile.id || newMsg.recipient_id === profile.id || isTeacherView;
                if (!isRelevant) return;
              }

              setMessages(prev => {
                 if (prev.some(m => m.id === newMsg.id)) return prev;
                 return [...prev, newMsg];
              });
              
              setTimeout(() => {
                if (groupChatScrollRef.current) groupChatScrollRef.current.scrollTop = groupChatScrollRef.current.scrollHeight;
                if (liveCommentsScrollRef.current) liveCommentsScrollRef.current.scrollTop = liveCommentsScrollRef.current.scrollHeight;
                if (privateChatScrollRef.current) privateChatScrollRef.current.scrollTop = privateChatScrollRef.current.scrollHeight;
                if (announcementsScrollRef.current) announcementsScrollRef.current.scrollTop = announcementsScrollRef.current.scrollHeight;
              }, 100);
            } else if (data.type === "delete_chat") {
              const deletedMessageId = data.payload.messageId;
              setMessages(prev => prev.filter(m => m.id !== deletedMessageId));
            }
          } catch (e) {
            console.error("RTM Message Parse Error:", e);
          }
        });
        console.log("Agora RTM Connected for real-time chat");
      } catch (err) {
        console.error("RTM Setup Error:", err);
      }
    };

    setupRtm();

    // Setup RTC only if live
    let client: IAgoraRTCClient | null = null;
    if (currentSession.status === "live") {
      client = createAgoraClient();
      setAgoraClient(client);

      const setupStream = async () => {
        try {
          setAgoraError(null);
          setInitTakingLong(false);
          setIsInitializingTracks(true);
          
          if (!isTeacherView) {
            client!.on("user-published", async (user, mediaType) => {
              try {
                await client!.subscribe(user, mediaType);
                if (mediaType === "video") {
                  setTeacherVideo(user.videoTrack || null);
                }
                if (mediaType === "audio") {
                  try {
                    user.audioTrack?.play();
                  } catch (err: any) {
                    if (err.name === "NotAllowedError") {
                      setHasAudioStarted(false);
                    }
                  }
                }
              } catch (err) {
                console.error("Subscription error:", err);
              }
            });

            client!.on("user-unpublished", (user, mediaType) => {
              if (mediaType === "video") {
                setTeacherVideo(null);
              }
            });
          }

          // RTC Join - Using room.id as channel name
          const tracksPromise = isTeacherView ? createTracks() : null;
          await joinChannel(client!, room.id, profile.id, isTeacherView ? "host" : "audience");
          
          const updateViewers = () => {
            setLiveViewers(client!.remoteUsers.length + 1);
          };

          client!.on("user-joined", updateViewers);
          client!.on("user-left", updateViewers);
          updateViewers();
          
          if (!isTeacherView) {
            for (const user of client!.remoteUsers) {
              if (user.hasVideo) {
                await client!.subscribe(user, "video");
                setTeacherVideo(user.videoTrack || null);
              }
              if (user.hasAudio) {
                await client!.subscribe(user, "audio");
                user.audioTrack?.play();
              }
            }
          }
          
          if (isTeacherView) {
            const tracks = await tracksPromise!;
            setLocalTracks(tracks);
            
            const tracksToPublish: any[] = [tracks.audioTrack];
            if (tracks.videoTrack) tracksToPublish.push(tracks.videoTrack);
            
            await client!.publish(tracksToPublish);

            const interval = setInterval(() => {
              if (tracks.audioTrack) {
                setMicVolume(tracks.audioTrack.getVolumeLevel() * 100);
              }
            }, 100);
          }

          setIsInitializingTracks(false);
        } catch (err: any) {
          setAgoraError(err.message || "Failed to establish live connection");
          setIsInitializingTracks(false);
        }
      };

      setupStream();
    }

    return () => {
      if (client) {
        leaveChannel(client, localTracks ? { 
          audioTrack: localTracks.audioTrack, 
          videoTrack: localTracks.videoTrack || undefined 
        } : undefined);
      }
      if (rtm) {
        rtm.logout();
      }
      // Reset video states when leaving live
      setTeacherVideo(null);
      setLocalTracks(null);
      setAgoraClient(null);
      setRtmClient(null);
    };
  }, [room.id, currentSession.status, isTeacherView, profile.id]);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from("room_messages").delete().eq("id", messageId);
      if (error) throw error;

      if (rtmClient) {
        rtmClient.publish(room.id, JSON.stringify({ 
          type: "delete_chat", 
          payload: { messageId } 
        }));
      }

      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err: any) {
      console.error("Delete error:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    try {
      const isLiveTab = sidebarActiveTab === "live" && isLive;
      const isPrivateTab = sidebarActiveTab === "private_chat";
      const isAnnouncementTab = sidebarActiveTab === "announcements";
      
      let recipientId = null;
      let contentType = "group";
      
      if (isLiveTab) {
        contentType = "live";
      } else if (isPrivateTab) {
        contentType = "private";
        if (isTeacherView) {
          if (!selectedStudentId) {
            console.error("No student selected for private chat");
            return;
          }
          recipientId = selectedStudentId;
        } else {
          recipientId = teacherId;
        }
      } else if (isAnnouncementTab) {
        if (!isTeacherView) return;
        contentType = "announcement";
      }

      const msgData = {
        room_id: room.id,
        user_id: profile.id,
        user_name: profile.fullname,
        user_avatar: profile.avatar_url,
        message: chatMessage,
        content: contentType,
        recipient_id: recipientId
      };

      const { data, error } = await supabase.from("room_messages").insert(msgData).select().single();
      if (error) throw error;

      console.log("Message sent to Supabase, response:", data);

      if (rtmClient) {
        const payload: ChatMessageData = {
          id: data.id,
          room_id: data.room_id,
          message: data.message,
          content: contentType,
          sender_id: data.user_id,
          sender_name: data.user_name,
          sender_avatar: data.user_avatar,
          recipient_id: data.recipient_id,
          created_at: data.created_at
        };
        console.log("Publishing RTM payload:", payload);
        rtmClient.publish(room.id, JSON.stringify({ type: "chat", payload }));

        setMessages((prev) => {
          if (prev.some(m => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      }
      
      setChatMessage("");
      
      setTimeout(() => {
        if (groupChatScrollRef.current) groupChatScrollRef.current.scrollTop = groupChatScrollRef.current.scrollHeight;
        if (privateChatScrollRef.current) privateChatScrollRef.current.scrollTop = privateChatScrollRef.current.scrollHeight;
        if (liveCommentsScrollRef.current) liveCommentsScrollRef.current.scrollTop = liveCommentsScrollRef.current.scrollHeight;
        if (announcementsScrollRef.current) announcementsScrollRef.current.scrollTop = announcementsScrollRef.current.scrollHeight;
      }, 100);
    } catch (err: any) {
      console.error("Chat error:", err);
    }
  };

  const handleStartStream = async () => {
    try {
      const { error } = await supabase
        .from("live_sessions")
        .update({
          status: "live",
          started_at: new Date().toISOString()
        })
        .eq("id", currentSession.id);

      if (error) throw error;
    } catch (err: any) {
      alert(err.message || "Failed to start session");
    }
  };

  const handleEndStream = async () => {
    try {
      const { error } = await supabase
        .from("live_sessions")
        .update({
          status: "finished",
          ended_at: new Date().toISOString()
        })
        .eq("id", currentSession.id);

      if (error) throw error;
      
      if (recordingUrlInput) {
        await supabase.from("recordings").insert({
          room_id: room.id,
          video_url: recordingUrlInput,
          session_id: currentSession.id
        });
      }

      setIsEnding(false);
      setRecordingUrlInput("");
    } catch (err: any) {
      alert(err.message || "Failed to end session");
    }
  };

  const toggleMute = async () => {
    if (!localTracks?.audioTrack) return;
    try {
      await localTracks.audioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    } catch (err) {
      console.error("Mute toggle error:", err);
    }
  };

  const toggleFlipCamera = async () => {
    if (!isTeacherView || !localTracks?.videoTrack || isFlipping) return;
    setIsFlipping(true);
    try {
      const devices = await AgoraRTC.getCameras();
      if (devices.length < 2) return;
      const currentDeviceId = localTracks.videoTrack.getMediaStreamTrack().getSettings().deviceId;
      const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      const nextDevice = devices[nextIndex];
      if (nextDevice) {
        await localTracks.videoTrack.setDevice(nextDevice.deviceId);
        setFacingMode(prev => prev === "user" ? "environment" : "user");
      }
    } catch (err) {
      console.error("Flip camera error:", err);
    } finally {
      setIsFlipping(false);
    }
  };

  const resumeAudio = () => {
    setHasAudioStarted(true);
    agoraClient?.remoteUsers.forEach(user => {
      user.audioTrack?.play();
    });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isLive = currentSession.status === "live";

  return (
    <div ref={containerRef} className="flex h-screen w-full bg-white text-slate-900 overflow-hidden relative">
      <RoomSidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        activeTab={sidebarActiveTab} 
        setActiveTab={setSidebarActiveTab} 
        onClose={() => { if(onClose) onClose(); }}
        lang={i18n.language}
      />
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        <div className="flex-1 bg-white relative group">
          <div className="h-full w-full flex items-center justify-center relative overflow-hidden">
             {sidebarActiveTab === "live" ? (
               !hasEntered ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-white">
                    <div className="max-w-md w-full px-8 text-center space-y-6">
                      <div className="mx-auto w-24 h-24 bg-brand-blue/10 rounded-[32px] flex items-center justify-center rotate-6">
                        <Radio className="h-10 w-10 text-brand-blue" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">{t('room_ready', 'Room Ready')}</h3>
                        <p className="text-sm font-medium text-slate-400">{t('click_to_enter', 'Click below to enter the classroom.')}</p>
                      </div>
                      <button 
                        onClick={() => setHasEntered(true)}
                        className="w-full bg-brand-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        {t('enter_room', 'Enter to the Room')}
                      </button>
                    </div>
                 </div>
               ) : isLive ? (
                 <div className="absolute inset-0 bg-slate-900 overflow-hidden rounded-2xl md:m-4 shadow-2xl">
                 {isTeacherView ? (
                   localTracks ? (
                     localTracks.videoTrack ? (
                       <AgoraPlayer videoTrack={localTracks.videoTrack} mirrored={true} />
                     ) : (
                       <div className="flex flex-col items-center justify-center h-full text-white">
                          <VideoOff className="h-10 w-10 mb-4 opacity-50" />
                          <p className="text-xs font-black uppercase tracking-widest">Audio Only Active</p>
                       </div>
                     )
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full text-white">
                        <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
                     </div>
                   )
                 ) : (
                   teacherVideo ? (
                     <AgoraPlayer videoTrack={teacherVideo} />
                   ) : (
                     <div className="text-center space-y-6 text-white">
                        <div className="mx-auto h-20 w-20 bg-brand-blue/20 rounded-full flex items-center justify-center animate-pulse">
                            <Play className="h-8 w-8 text-brand-blue fill-current" />
                        </div>
                        <h3 className="text-xl font-black uppercase italic tracking-widest">Connecting to Class</h3>
                     </div>
                   )
                 )}
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-white">
                    <div className="max-w-md w-full px-8 text-center space-y-6">
                      <div className="mx-auto w-24 h-24 bg-brand-blue/10 rounded-[32px] flex items-center justify-center rotate-6">
                        <Radio className="h-10 w-10 text-brand-blue" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
                          {isTeacherView ? t('ready_to_start', 'Ready to Start') : t('live_not_started', 'Waiting for Teacher')}
                        </h3>
                        <p className="text-sm font-medium text-slate-400">
                          {isTeacherView 
                            ? t('start_live_hint', 'Click below to start the live stream for your students.') 
                            : t('live_hint_student', 'The session will start automatically once the teacher is live.')}
                        </p>
                      </div>
                      {isTeacherView && (
                        <button 
                          onClick={handleStartStream}
                          className="w-full bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Radio className="h-5 w-5" />
                          {t('go_live', 'Go Live Now')}
                        </button>
                      )}
                    </div>
                </div>
               )
              ) : sidebarActiveTab === "group_chat" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner">
                  <div className="mb-4">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">{t('group_chat', 'Group Chat')}</h2>
                    <div className="h-1 w-12 bg-brand-blue rounded-full mt-2"></div>
                  </div>
                  
                  <div 
                    ref={groupChatScrollRef}
                    className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2"
                  >
                    <AnimatePresence initial={false}>
                       {messages.filter(m => m.content !== 'private' && m.content !== 'live' && m.content !== 'announcement').map((msg) => (
                         <motion.div 
                           key={msg.id} 
                           initial={{ opacity: 0, y: 10 }} 
                           animate={{ opacity: 1, y: 0 }} 
                           className={cn(
                             "flex items-start gap-3",
                             msg.sender_id === profile.id ? "flex-row-reverse" : "flex-row"
                           )}
                         >
                            <img 
                              src={msg.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender_name || 'User')}`} 
                              className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm" 
                              alt="" 
                            />
                            <div className={cn(
                              "max-w-[75%] px-4 py-3 rounded-[24px] shadow-sm relative group",
                              msg.sender_id === profile.id 
                                ? "bg-brand-blue text-white rounded-tr-none" 
                                : "bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none"
                            )}>
                              {msg.sender_id === profile.id && (
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="absolute -top-2 -right-2 p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                              {msg.sender_id !== profile.id && (
                                <p className="text-[10px] font-black uppercase text-brand-blue mb-1">{msg.sender_name}</p>
                              )}
                              <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                              <p className={cn(
                                "text-[9px] mt-1 font-bold opacity-50",
                                msg.sender_id === profile.id ? "text-right" : "text-left"
                              )}>
                                {formatDate(msg.created_at)}
                              </p>
                            </div>
                         </motion.div>
                       ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : sidebarActiveTab === "private_chat" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner">
                  <div className="mb-4">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">{t('private_chat', 'Private Chat')}</h2>
                    <div className="h-1 w-12 bg-brand-blue rounded-full mt-2"></div>
                  </div>
                  
                  {isTeacherView ? (
                    <div className="flex-1 flex gap-4 overflow-hidden">
                      {/* Students list for teacher */}
                      <div className="w-1/3 border-r border-slate-100 pr-2 overflow-y-auto no-scrollbar">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{t('students', 'Students')}</p>
                        <div className="space-y-1">
                          {Array.from(new Set(
                            messages
                              .filter(m => m.content === 'private')
                              .map(m => m.sender_id === profile.id ? m.recipient_id : m.sender_id)
                              .filter((id): id is string => id !== null && id !== undefined && id !== profile.id)
                          )).map(studentId => {
                            const messagesWithStudent = messages.filter(m => (m.sender_id === studentId || m.recipient_id === studentId) && m.content === 'private');
                            
                            // Find the student's name: preferably from a message THEY sent
                            const studentMsg = messagesWithStudent.find(m => m.sender_id === studentId);
                            const lastMsg = messagesWithStudent[messagesWithStudent.length - 1];
                            const studentName = studentMsg?.sender_name || t('student', 'Student');
                            const studentAvatar = studentMsg?.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}`;
                            
                            return (
                              <button 
                                key={studentId}
                                onClick={() => setSelectedStudentId(studentId!)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
                                  selectedStudentId === studentId ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20" : "hover:bg-slate-50 text-slate-600"
                                )}
                              >
                                <img src={studentAvatar} className="w-8 h-8 rounded-xl border border-white/20" alt="" />
                                <div className="text-left overflow-hidden">
                                  <p className="text-xs font-black truncate">{studentName}</p>
                                  <p className={cn("text-[9px] truncate opacity-60", selectedStudentId === studentId ? "text-white" : "text-slate-400")}>
                                    {lastMsg?.message || t('no_messages', 'No messages')}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                          {messages.filter(m => m.content === 'private').length === 0 && (
                            <div className="py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-100">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('no_students', 'No students yet')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active Chat */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {selectedStudentId ? (
                          <div ref={privateChatScrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
                             <AnimatePresence initial={false}>
                               {messages
                                 .filter(m => m.content === 'private' && ((m.sender_id === profile.id && m.recipient_id === selectedStudentId) || (m.sender_id === selectedStudentId && m.recipient_id === profile.id)))
                                 .map((msg) => (
                                   <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex items-start gap-3", msg.sender_id === profile.id ? "flex-row-reverse" : "flex-row")}>
                                      <img src={msg.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender_name || 'User')}`} className="w-8 h-8 rounded-xl border-2 border-white shadow-sm" alt="" />
                                      <div className={cn("max-w-[85%] px-4 py-3 rounded-[24px] shadow-sm relative group", msg.sender_id === profile.id ? "bg-brand-blue text-white rounded-tr-none" : "bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none")}>
                                        {msg.sender_id === profile.id && (
                                          <button 
                                            onClick={() => handleDeleteMessage(msg.id)}
                                            className="absolute -top-2 -right-2 p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                        <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                                        <p className={cn("text-[8px] mt-1 font-bold opacity-50", msg.sender_id === profile.id ? "text-right" : "text-left")}>{formatDate(msg.created_at)}</p>
                                      </div>
                                   </motion.div>
                                 ))}
                             </AnimatePresence>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-100">
                             <MessageCircle className="h-10 w-10 text-slate-200 mb-4" />
                             <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">{t('select_student', 'Select a student to chat')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div ref={privateChatScrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
                       <AnimatePresence initial={false}>
                         {messages
                           .filter(m => m.content === 'private' && (m.sender_id === profile.id || m.recipient_id === profile.id))
                           .map((msg) => (
                             <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex items-start gap-3", msg.sender_id === profile.id ? "flex-row-reverse" : "flex-row")}>
                                <img src={msg.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender_name || 'User')}`} className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm" alt="" />
                                <div className={cn("max-w-[75%] px-4 py-3 rounded-[24px] shadow-sm relative group", msg.sender_id === profile.id ? "bg-brand-blue text-white rounded-tr-none" : "bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none")}>
                                  {msg.sender_id === profile.id && (
                                    <button 
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="absolute -top-2 -right-2 p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                  <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                                  <p className={cn("text-[9px] mt-1 font-bold opacity-50", msg.sender_id === profile.id ? "text-right" : "text-left")}>{formatDate(msg.created_at)}</p>
                                </div>
                             </motion.div>
                           ))}
                           {messages.filter(m => m.content === 'private' && (m.sender_id === profile.id || m.recipient_id === profile.id)).length === 0 && (
                             <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                <MessageCircle className="h-16 w-16 text-slate-100 mb-6" />
                                <h3 className="text-xl font-black uppercase text-slate-900 italic tracking-tighter mb-2">{t('private_placeholder_title', 'Private Question?')}</h3>
                                <p className="text-sm font-medium text-slate-400 max-w-xs">{t('private_placeholder_desc', 'Send a private message to your teacher. Only you and the teacher can see this.')}</p>
                             </div>
                           )}
                       </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : sidebarActiveTab === "announcements" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner">
                  <div className="mb-4">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">{t('announcements', 'Announcements')}</h2>
                    <div className="h-1 w-12 bg-brand-blue rounded-full mt-2"></div>
                  </div>
                  
                  <div 
                    ref={announcementsScrollRef}
                    className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2"
                  >
                    <AnimatePresence initial={false}>
                       {messages.filter(m => m.content === 'announcement').map((msg) => (
                         <motion.div 
                           key={msg.id} 
                           initial={{ opacity: 0, scale: 0.95 }} 
                           animate={{ opacity: 1, scale: 1 }} 
                           className="bg-brand-blue/5 border border-brand-blue/10 rounded-3xl p-6 relative overflow-hidden group"
                         >
                            {msg.sender_id === profile.id && (
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="absolute top-4 right-12 p-2 bg-white text-slate-400 hover:text-red-500 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Megaphone className="h-12 w-12 text-brand-blue" />
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                               <img 
                                 src={msg.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender_name || 'Teacher')}`} 
                                 className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm" 
                                 alt="" 
                               />
                               <div>
                                 <p className="text-xs font-black uppercase tracking-widest text-slate-900">{msg.sender_name}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(msg.created_at)}</p>
                               </div>
                            </div>
                            <div className="prose prose-sm max-w-none">
                              <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            </div>
                         </motion.div>
                       ))}
                       {messages.filter(m => m.content === 'announcement').length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center text-center p-12">
                            <Megaphone className="h-16 w-16 text-slate-100 mb-6" />
                            <h3 className="text-xl font-black uppercase text-slate-900 italic tracking-tighter mb-2">{t('no_announcements_title', 'Silence is Golden')}</h3>
                            <p className="text-sm font-medium text-slate-400 max-w-xs">{t('no_announcements_desc', 'Stay tuned! Your teacher hasn\'t posted any important announcements yet.')}</p>
                         </div>
                       )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-white p-8 flex flex-col">
                  <div className="mb-8 mt-16">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">{sidebarActiveTab.replace('_', ' ')}</h2>
                    <div className="h-1 w-12 bg-brand-blue rounded-full mt-2"></div>
                  </div>
                  
                  <div className="flex-1 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center p-12 text-center">
                     <Loader2 className="h-12 w-12 text-slate-200 animate-spin mb-4" />
                     <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-loose max-w-xs">
                       {t('tab_coming_soon', 'This section is currently under construction and will be available soon.')}
                     </p>
                  </div>
                </div>
              )}

              {!isTeacherView && !hasAudioStarted && isLive && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <button onClick={resumeAudio} className="bg-brand-blue text-white px-8 py-4 rounded-full font-black uppercase tracking-widest shadow-2xl">
                     {t('connect_audio', 'Connect Audio')}
                  </button>
                </div>
             )}

             {isLive && !hideComments && (
               <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end pb-24 md:pb-32 px-4 md:px-8">
                  <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2 max-w-[400px]" ref={liveCommentsScrollRef}>
                     <AnimatePresence>
                        {messages.filter(m => m.content === 'live').map((msg) => (
                          <motion.div key={msg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 py-1">
                             <img src={msg.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender_name || 'User')}`} className="w-8 h-8 rounded-full border border-white/20" alt="" />
                             <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white shadow-sm pointer-events-auto">
                               <p className="text-[10px] font-black uppercase text-brand-blue leading-none mb-1">{msg.sender_name}</p>
                               <p className="text-sm text-slate-800 font-medium leading-tight">{msg.message}</p>
                             </div>
                          </motion.div>
                        ))}
                     </AnimatePresence>
                  </div>
               </div>
             )}
          </div>

          <div className="absolute inset-x-0 top-0 p-6 flex items-start justify-between z-40 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white shadow-sm pointer-events-auto flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <MoreHorizontal className={cn("h-4 w-4 text-slate-400 transition-transform", isSidebarOpen && "rotate-90")} />
              </button>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 leading-none">{room.room_name}</p>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isLive ? "bg-red-500 animate-pulse" : "bg-slate-300")}></div>
                  <p className="text-xs font-black uppercase text-slate-900 italic tracking-tighter">{isLive ? t('live_session', 'Live Session') : sidebarActiveTab.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pointer-events-auto">
                {isLive && (
                  <button 
                    onClick={toggleFullscreen} 
                    className="bg-white/80 backdrop-blur-xl p-3 rounded-full text-slate-600 border border-white shadow-sm hover:bg-white transition-colors"
                  >
                    {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </button>
                )}
                {onClose && !isTeacherView && (
                   <button onClick={onClose} className="bg-white/80 backdrop-blur-xl p-3 rounded-full text-slate-600 border border-white shadow-sm pointer-events-auto hover:bg-white transition-colors">
                     <X className="h-5 w-5" />
                   </button>
                )}
            </div>
          </div>

          <div className="absolute bottom-6 inset-x-0 px-6 z-40 flex items-center gap-4">
             {isLive && (
               <button onClick={() => setHideComments(!hideComments)} className="h-12 w-12 rounded-full bg-white/80 backdrop-blur-xl border border-white flex items-center justify-center text-slate-600 shadow-sm transition-all hover:bg-white pointer-events-auto">
                 {hideComments ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
               </button>
             )}
             {(isLive || sidebarActiveTab === "group_chat" || sidebarActiveTab === "private_chat" || (sidebarActiveTab === "announcements" && isTeacherView)) && (
               <form onSubmit={handleSendMessage} className="flex-1 flex bg-white/80 backdrop-blur-xl rounded-2xl border border-white px-4 h-12 shadow-sm focus-within:bg-white transition-all pointer-events-auto">
                 <input 
                   value={chatMessage} 
                   onChange={(e) => setChatMessage(e.target.value)} 
                   placeholder={t('type_message', 'Type a message...')} 
                   className={cn("flex-1 bg-transparent border-none outline-none text-sm font-medium", i18n.language === 'ar' ? "text-right" : "text-left")}
                 />
                 <button type="submit" className="p-2 text-brand-blue disabled:opacity-20"><Send className="h-5 w-5" /></button>
               </form>
             )}
          </div>

          {isTeacherView && isLive && sidebarActiveTab === "live" && (
            <div className={`absolute top-24 ${i18n.language === 'ar' ? 'left-6' : 'right-6'} flex flex-col gap-3 z-40`}>
               <button onClick={toggleMute} className={cn("h-10 w-10 rounded-full flex items-center justify-center transition-all bg-white border border-white shadow-md", isMuted ? "text-red-500" : "text-emerald-500")}>
                 {isMuted ? <VideoOff className="h-4 w-4" /> : <Users className="h-4 w-4" />}
               </button>
               <button onClick={toggleFlipCamera} className="h-10 w-10 rounded-full flex items-center justify-center bg-white border border-white shadow-md text-slate-400">
                 <RefreshCw className="h-4 w-4" />
               </button>
               <button onClick={() => setIsEnding(true)} className="h-10 w-10 rounded-full flex items-center justify-center bg-red-500 text-white shadow-md hover:bg-red-600">
                 <X className="h-4 w-4" />
               </button>
            </div>
          )}

          <AnimatePresence>
            {isEnding && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-lg p-6">
                 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[40px] w-full max-w-sm text-center space-y-6">
                    <h4 className="text-2xl font-black uppercase text-slate-900 italic tracking-tighter">{t('end_session', 'End Session?')}</h4>
                    <p className="text-xs text-slate-400 font-medium">{t('end_session_hint', 'This will disconnect all students. You can optionally provide a recording URL.')}</p>
                    <input value={recordingUrlInput} onChange={(e) => setRecordingUrlInput(e.target.value)} placeholder="YouTube/Google Drive Link" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs outline-none focus:border-brand-blue transition-all" />
                    <div className="flex flex-col gap-3">
                      <button onClick={handleEndStream} className="w-full py-4 bg-brand-blue text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20">{t('finish_publish', 'Finish & Publish')}</button>
                      <button onClick={() => setIsEnding(false)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">{t('cancel', 'Cancel')}</button>
                    </div>
                 </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
