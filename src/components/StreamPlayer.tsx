import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { UserProfile, ChatMessageData, ClassRoom, TeacherCommunity, LiveSession } from "../types";
import { Send, Users, Heart, Share2, MoreHorizontal, X, MessageCircle, Play, VideoOff, Save, Check, Maximize2, Minimize2, Eye, EyeOff, RefreshCw, Loader2, LogOut, Megaphone, Radio } from "lucide-react";
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
}

export default function StreamPlayer({ room, session, profile, onClose, isTeacherView }: StreamPlayerProps) {
  const { t, i18n } = useTranslation();
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isEnding, setIsEnding] = useState(false);
  const [recordingUrlInput, setRecordingUrlInput] = useState("");
  const [hideComments, setHideComments] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarActiveTab, setSidebarActiveTab] = useState("announcements");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          sender_id: m.user_id,
          sender_name: m.user_name,
          sender_avatar: m.user_avatar,
          created_at: m.created_at
        })) as ChatMessageData[]);
        
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      }
    };

    fetchMessages();

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
            sender_id: payload.new.user_id,
            sender_name: payload.new.user_name,
            sender_avatar: payload.new.user_avatar,
            created_at: payload.new.created_at
          };
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  // Agora Lifecycle (RTC + RTM)
  useEffect(() => {
    if (session.status !== "live") return;

    const client = createAgoraClient();
    const rtm = createRTMClient(profile.id);
    
    setAgoraClient(client);
    setRtmClient(rtm);

    const setupStream = async () => {
      try {
        setAgoraError(null);
        setInitTakingLong(false);
        setIsInitializingTracks(true);
        
        if (!isTeacherView) {
          client.on("user-published", async (user, mediaType) => {
            try {
              await client.subscribe(user, mediaType);
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

          client.on("user-unpublished", (user, mediaType) => {
            if (mediaType === "video") {
              setTeacherVideo(null);
            }
          });
        }

        // RTC Join - Using room.id as channel name
        const tracksPromise = isTeacherView ? createTracks() : null;
        await joinChannel(client, room.id, profile.id, isTeacherView ? "host" : "audience");
        
        const updateViewers = () => {
          setLiveViewers(client.remoteUsers.length + 1);
        };

        client.on("user-joined", updateViewers);
        client.on("user-left", updateViewers);
        updateViewers();
        
        if (!isTeacherView) {
          for (const user of client.remoteUsers) {
            if (user.hasVideo) {
              await client.subscribe(user, "video");
              setTeacherVideo(user.videoTrack || null);
            }
            if (user.hasAudio) {
              await client.subscribe(user, "audio");
              user.audioTrack?.play();
            }
          }
        }
        
        // RTM Join
        try {
          await rtm.login();
          await rtm.subscribe(room.id);
          
          rtm.addEventListener("message", (event) => {
            try {
              const data = JSON.parse(event.message as string);
              if (data.type === "chat") {
                const newMsg = data.payload as ChatMessageData;
                setMessages(prev => {
                   if (prev.some(m => m.id === newMsg.id)) return prev;
                   return [...prev, newMsg];
                });
                setTimeout(() => {
                  if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }, 100);
              }
            } catch (e) {
              console.error("RTM Message Parse Error:", e);
            }
          });
        } catch (rtmErr) {
          console.error("RTM Setup Error:", rtmErr);
        }

        if (isTeacherView) {
          const tracks = await tracksPromise!;
          setLocalTracks(tracks);
          
          const tracksToPublish: any[] = [tracks.audioTrack];
          if (tracks.videoTrack) tracksToPublish.push(tracks.videoTrack);
          
          await client.publish(tracksToPublish);

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
    };
  }, [room.id, session.status, isTeacherView, profile.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    try {
      const msgData = {
        room_id: room.id,
        user_id: profile.id,
        user_name: profile.fullname,
        user_avatar: profile.avatar_url,
        message: chatMessage
      };

      const { data, error } = await supabase.from("room_messages").insert(msgData).select().single();
      if (error) throw error;

      if (rtmClient) {
        const payload: ChatMessageData = {
          id: data.id,
          room_id: data.room_id,
          message: data.message,
          sender_id: data.user_id,
          sender_name: data.user_name,
          sender_avatar: data.user_avatar,
          created_at: data.created_at
        };
        rtmClient.publish(room.id, JSON.stringify({ type: "chat", payload }));
      }
      
      setChatMessage("");
    } catch (err: any) {
      console.error("Chat error:", err);
      alert("Failed to send message: " + (err.message || "Unknown error"));
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
        .eq("id", session.id);

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
          status: "ended",
          ended_at: new Date().toISOString()
        })
        .eq("id", session.id);

      if (error) throw error;
      
      if (recordingUrlInput) {
        await supabase.from("recordings").insert({
          room_id: room.id,
          video_url: recordingUrlInput,
          session_id: session.id
        });
      }

      if (onClose) onClose();
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

  const isLive = session.status === "live";

  return (
    <div ref={containerRef} className="flex h-screen w-full bg-white text-slate-900 overflow-hidden relative">
      {isTeacherView && (
        <RoomSidebar 
          isOpen={isSidebarOpen} 
          activeTab={sidebarActiveTab} 
          setActiveTab={setSidebarActiveTab} 
          onClose={() => { if(onClose) onClose(); }}
          lang={i18n.language}
        />
      )}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        <div className="flex-1 bg-white relative group">
          <div className="h-full w-full flex items-center justify-center relative overflow-hidden">
             {sidebarActiveTab === "live" ? (
               isLive ? (
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
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">{t('live_not_started', 'Live Ready')}</h3>
                        <p className="text-sm font-medium text-slate-400">{t('live_hint', 'Students will be notified once you go live.')}</p>
                      </div>
                      {isTeacherView && (
                        <button 
                          onClick={handleStartStream}
                          className="w-full bg-brand-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          {t('go_live', 'Start Live Session')}
                        </button>
                      )}
                    </div>
                 </div>
               )
             ) : (
               <div className="absolute inset-0 bg-white p-8 flex flex-col">
                 <div className="mb-8">
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
                  <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2 max-w-[400px]" ref={scrollRef}>
                     <AnimatePresence>
                        {messages.map((msg) => (
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
              {isTeacherView && (
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <MoreHorizontal className={cn("h-4 w-4 text-slate-400 transition-transform", isSidebarOpen && "rotate-90")} />
                </button>
              )}
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
             {(isLive || sidebarActiveTab === "group_chat") && (
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
