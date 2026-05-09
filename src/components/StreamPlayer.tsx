import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { StreamData, UserProfile, ChatMessageData } from "../types";
import { Send, Users, Heart, Share2, MoreHorizontal, X, MessageCircle, Play, VideoOff, Save, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { formatDate, cn } from "../lib/utils";
import { createAgoraClient, joinChannel, createTracks, leaveChannel } from "../lib/agora";
import AgoraPlayer from "./AgoraPlayer";
import { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";

const Player = ReactPlayer as any;

interface StreamPlayerProps {
  stream: StreamData;
  profile: UserProfile;
  onClose?: () => void;
  isTeacherView?: boolean;
}

export default function StreamPlayer({ stream, profile, onClose, isTeacherView }: StreamPlayerProps) {
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isEnding, setIsEnding] = useState(false);
  const [recordingUrlInput, setRecordingUrlInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agora State
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localTracks, setLocalTracks] = useState<{ audioTrack: IMicrophoneAudioTrack; videoTrack: ICameraVideoTrack } | null>(null);
  const [remoteStudents, setRemoteStudents] = useState<IRemoteVideoTrack | null>(null);
  const [teacherVideo, setTeacherVideo] = useState<IRemoteVideoTrack | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("streamId", stream.id)
        .order("timestamp", { ascending: true })
        .limit(50);
      
      if (!error && data) {
        setMessages(data as ChatMessageData[]);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${stream.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `streamId=eq.${stream.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessageData]);
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stream.id]);

  // Agora Lifecycle (Unchanged logic, just ensure consistency)
  useEffect(() => {
    if (stream.status !== "live") return;

    const client = createAgoraClient();
    setAgoraClient(client);

    const setupStream = async () => {
      try {
        await joinChannel(client, stream.id, profile.uid, isTeacherView ? "host" : "audience");
        
        if (isTeacherView) {
          const tracks = await createTracks();
          setLocalTracks(tracks);
          await client.publish([tracks.audioTrack, tracks.videoTrack]);
        } else {
          client.on("user-published", async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType === "video") {
              setTeacherVideo(user.videoTrack!);
            }
          });
        }
      } catch (err) {
        console.error("Agora Setup Error:", err);
      }
    };

    setupStream();

    return () => {
      if (client) {
        leaveChannel(client, localTracks || undefined);
      }
    };
  }, [stream.id, stream.status, isTeacherView, profile.uid]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    try {
      const { error } = await supabase.from("chat_messages").insert({
        streamId: stream.id,
        text: chatMessage,
        userId: profile.uid,
        userName: profile.displayName,
        userPhoto: profile.photoURL,
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;
      setChatMessage("");
    } catch (err: any) {
      console.error("Chat error:", err);
      alert(err.message || "Failed to send message");
    }
  };

  const handleEndStream = async () => {
    try {
      const { error } = await supabase
        .from("streams")
        .update({
          status: "offline",
          recordingUrl: recordingUrlInput || null,
          updatedAt: new Date().toISOString()
        })
        .eq("id", stream.id);

      if (error) throw error;
      if (onClose) onClose();
    } catch (err: any) {
      console.error("End stream error:", err);
      alert(err.message || "Failed to end session");
    }
  };

  const isLive = stream.status === "live";
  const hasRecording = stream.status === "offline" && stream.recordingUrl;

  return (
    <div className="flex h-screen w-full bg-brand-darkest text-white overflow-hidden">
      {/* Video Content */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-brand-surface to-brand-darkest">
        <div className="flex-1 bg-black relative group">
          {/* Main Video Area */}
          <div className="h-full w-full flex items-center justify-center relative overflow-hidden">
             <img src={stream.thumbnail || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110" />
             
             {isLive ? (
               <div className="w-full h-full">
                 {isTeacherView ? (
                   localTracks ? (
                     <AgoraPlayer videoTrack={localTracks.videoTrack} />
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className="w-16 h-16 rounded-full border-4 border-brand-blue border-t-transparent animate-spin"></div>
                        <p className="text-brand-blue font-black uppercase tracking-widest text-xs">Initializing Camera...</p>
                     </div>
                   )
                 ) : (
                   teacherVideo ? (
                     <AgoraPlayer videoTrack={teacherVideo} />
                   ) : (
                     <div className="z-10 text-center space-y-6">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-blue/10 border border-brand-blue/30 backdrop-blur-3xl animate-pulse">
                            <Play className="h-10 w-10 text-brand-blue fill-current" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-3xl font-black font-display uppercase tracking-widest italic leading-none">
                              Connecting to Class
                          </h3>
                          <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase italic opacity-60">Waiting for Teacher Output</p>
                        </div>
                     </div>
                   )
                 )}
               </div>
             ) : hasRecording ? (
               <div className="absolute inset-0 z-0">
                  <Player
                     url={stream.recordingUrl} 
                     width="100%"
                     height="100%"
                     playing
                     controls={true}
                     style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
                  />
               </div>
             ) : (
               <div className="z-10 text-center space-y-6">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 border border-white/5 backdrop-blur-3xl">
                      <VideoOff className="h-10 w-10 text-slate-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black font-display uppercase tracking-widest italic leading-none">
                        Session Offline
                    </h3>
                    <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase italic opacity-60">The teacher has concluded this session</p>
                  </div>
               </div>
             )}
          </div>

          {/* Player Overlay Top */}
          <div className="absolute inset-x-0 top-0 p-6 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <div className="flex items-center gap-3">
                {isLive ? (
                  <span className="bg-red-600 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20">Live</span>
                ) : hasRecording ? (
                  <span className="bg-brand-blue px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20">Recorded</span>
                ) : null}
                <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest text-white border border-white/10 italic">Nadjah CDN v2</span>
            </div>
            {onClose && !isEnding && (
                <button onClick={onClose} className="pointer-events-auto rounded-full bg-white/10 p-2 text-white border border-white/5 backdrop-blur-xl hover:bg-white/20 transition-all">
                    <X className="h-5 w-5" />
                </button>
            )}
          </div>

          {/* Teacher Termination Controls */}
          {isTeacherView && isLive && !isEnding && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-2xl p-2 rounded-2xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all">
               <button 
                 onClick={() => setIsEnding(true)}
                 className="flex items-center space-x-3 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
               >
                 <VideoOff className="h-4 w-4" />
                 <span>Terminate Session</span>
               </button>
            </div>
          )}

          {/* Finish Modal */}
          <AnimatePresence>
            {isEnding && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
              >
                <div className="bg-slate-900 w-full max-w-md rounded-[32px] p-8 border border-white/10 shadow-2xl space-y-6">
                  <div className="text-center space-y-2">
                    <h4 className="text-2xl font-black font-display uppercase tracking-tighter italic">Session Summary</h4>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Publish this recording for students who missed out?</p>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Recording Link (S3/YouTube/Drive)</label>
                    <input 
                      type="url"
                      placeholder="https://..."
                      value={recordingUrlInput}
                      onChange={(e) => setRecordingUrlInput(e.target.value)}
                      className="w-full bg-slate-800 border border-white/5 p-4 rounded-xl text-sm outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsEnding(false)}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
                    >
                      Back to Broadcast
                    </button>
                    <button 
                      onClick={handleEndStream}
                      className="flex-1 py-4 bg-brand-blue hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Publish & Exit
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Header */}
        <div className="bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 p-8">
           <div className="flex items-start justify-between">
              <div className="flex space-x-6">
                 <div className="relative">
                    <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=0D8ABC&color=fff`} alt="" className="h-16 w-16 rounded-full border-2 border-brand-blue shadow-2xl shadow-blue-500/20" />
                    {isLive && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-brand-blue rounded-full border-2 border-slate-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      </div>
                    )}
                 </div>
                 <div className="space-y-1">
                    <h1 className="text-3xl font-black font-display uppercase tracking-tighter italic leading-none">{stream.title}</h1>
                    <div className="flex items-center space-x-4 text-xs font-black uppercase tracking-[0.2em] mt-2">
                        <span className={isLive ? "text-brand-blue" : "text-slate-500"}>{stream.teacherName}</span>
                        <div className="h-3 w-px bg-white/10"></div>
                        <div className="flex items-center space-x-2 text-slate-400">
                            <Users className="h-4 w-4" />
                            <span>{stream.viewersCount} Classroom Capacity</span>
                        </div>
                    </div>
                 </div>
              </div>
              <div className="flex items-center space-x-3">
                 <button className="flex items-center space-x-3 rounded-xl bg-white/5 border border-white/5 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95">
                    <Heart className="h-4 w-1 text-white shrink-0" />
                    <span>Bookmark</span>
                 </button>
                 <button className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 active:scale-95">
                    <Share2 className="h-4 w-4" />
                 </button>
                 <button className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 active:scale-95">
                    <MoreHorizontal className="h-4 w-4" />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Chat Sidebar (Kick-inspired) */}
      <div className="w-80 border-l border-white/5 glass-sidebar flex flex-col z-10">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
           <div className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4 text-brand-blue" />
              <span className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Classroom Feed</span>
           </div>
           <div className="flex h-5 w-8 items-center justify-center rounded-full bg-slate-800 border border-white/5">
              <span className="text-[10px] font-black">{messages.length}</span>
           </div>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-6 no-scrollbar" ref={scrollRef}>
          {messages.map((msg) => (
            <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id} 
                className="flex items-start space-x-3 group"
            >
               <img src={msg.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.userName)}&background=0D8ABC&color=fff`} alt="" className="h-8 w-8 shrink-0 rounded border border-white/10" />
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                     <span className={cn(
                        "text-xs font-black uppercase tracking-tight",
                        msg.userId === stream.teacherId ? "text-brand-blue" : "text-slate-400"
                     )}>
                        {msg.userName.split(" ")[0]}
                     </span>
                     {msg.userId === stream.teacherId && <div className="h-1 w-1 bg-brand-blue rounded-full"></div>}
                  </div>
                  <p className="text-[13px] text-slate-200 leading-relaxed break-words font-medium">{msg.text}</p>
               </div>
            </motion.div>
          ))}
        </div>

        {isLive && (
          <div className="p-5 border-t border-white/5 bg-slate-900/40 backdrop-blur-md">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
              {["👋 Hi", "❓ Question", "💡 Clear", "🚀 Nice!"].map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => setChatMessage(prev => `${prev} ${emoji.split(" ")[1]}`)}
                    className="px-2.5 py-1 bg-slate-800/80 border border-white/5 rounded text-[10px] hover:bg-slate-700 transition-colors uppercase font-black tracking-widest text-slate-400 hover:text-white"
                  >
                    {emoji}
                  </button>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="relative">
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Send a message..." 
                  className="w-full rounded-lg border-none bg-slate-800/50 py-3.5 px-4 pr-12 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-brand-blue transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-blue hover:text-blue-400 transition-colors disabled:opacity-30"
                  disabled={!chatMessage.trim()}
                >
                  <Send className="h-5 w-5" />
                </button>
            </form>
            <div className="mt-4 flex items-center justify-center space-x-2 opacity-30">
                <div className="h-[1px] w-4 bg-slate-500"></div>
                <span className="text-[8px] font-black uppercase tracking-[0.3em]">Encrypted Feed</span>
                <div className="h-[1px] w-4 bg-slate-500"></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      {isLive && !isTeacherView && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-brand-blue flex items-center justify-between px-6 z-50 shadow-[0_-10px_20px_rgba(59,130,246,0.3)]">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
            <span>Session: Nadjah-{stream.id.slice(0,6).toUpperCase()}</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
              Network Optimized (Agora)
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">{stream.viewersCount} active students</span>
            </div>
            <div className="h-4 w-[1px] bg-white/20"></div>
            <button className="text-[9px] font-black uppercase hover:underline">Signal Strength</button>
          </div>
        </div>
      )}
    </div>
  );
}
