import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { StreamData, UserProfile, ChatMessageData } from "../types";
import { Send, Users, Heart, Share2, MoreHorizontal, X, MessageCircle, Play, VideoOff, Save, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { formatDate, cn } from "../lib/utils";
import { createAgoraClient, joinChannel, createTracks, leaveChannel, createRTMClient } from "../lib/agora";
import AgoraPlayer from "./AgoraPlayer";
import { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";

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
  const [rtmClient, setRtmClient] = useState<any | null>(null);
  const [localTracks, setLocalTracks] = useState<{ audioTrack: IMicrophoneAudioTrack; videoTrack: ICameraVideoTrack | null } | null>(null);
  const [remoteStudents, setRemoteStudents] = useState<IRemoteVideoTrack | null>(null);
  const [teacherVideo, setTeacherVideo] = useState<IRemoteVideoTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasAudioStarted, setHasAudioStarted] = useState(true);
  const [micVolume, setMicVolume] = useState(0);
  const [agoraError, setAgoraError] = useState<string | null>(null);
  const [isInitializingTracks, setIsInitializingTracks] = useState(false);
  const [initTakingLong, setInitTakingLong] = useState(false);

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
          const newMsg = payload.new as ChatMessageData;
          // Prevent duplicates if also received via RTM
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            const updated = [...prev, newMsg];
            return updated;
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
  }, [stream.id]);

  // Agora Lifecycle (RTC + RTM)
  useEffect(() => {
    if (stream.status !== "live") return;

    const client = createAgoraClient();
    const rtm = createRTMClient(profile.uid);
    
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

        // RTC Join
        await joinChannel(client, stream.id, profile.uid, isTeacherView ? "host" : "audience");
        
        // After joining, check if there are already users in the channel (safeguard)
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
          await rtm.subscribe(stream.id);
          
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
          console.error("RTM Setup Error (Optional):", rtmErr);
        }


        if (isTeacherView) {
          const timeout = setTimeout(() => setInitTakingLong(true), 8000);
          const tracks = await createTracks();
          clearTimeout(timeout);
          setLocalTracks(tracks);
          
          const tracksToPublish: any[] = [tracks.audioTrack];
          if (tracks.videoTrack) tracksToPublish.push(tracks.videoTrack);
          
          await client.publish(tracksToPublish);

          // Monitor mic volume
          const interval = setInterval(() => {
            if (tracks.audioTrack) {
              setMicVolume(tracks.audioTrack.getVolumeLevel() * 100);
            }
          }, 100);
        }

        setIsInitializingTracks(false);
      } catch (err: any) {
        console.error("Agora Setup Error:", err);
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
  }, [stream.id, stream.status, isTeacherView, profile.uid]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const newMsgId = Math.random().toString(36).substring(7);
    const msgData: ChatMessageData = {
      id: newMsgId,
      streamId: stream.id,
      text: chatMessage,
      userId: profile.uid,
      userName: profile.displayName,
      userPhoto: profile.photoURL,
      timestamp: new Date().toISOString(),
    };

    // Optimistic update
    setMessages(prev => [...prev, msgData]);
    setChatMessage("");
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);

    try {
      // 1. Send via RTM (Instant broadcast for live viewers)
      if (rtmClient) {
        rtmClient.publish(stream.id, JSON.stringify({
          type: "chat",
          payload: msgData
        }));
      }

      // 2. Persist to Supabase
      const { error } = await supabase.from("chat_messages").insert(msgData);
      if (error) throw error;
    } catch (err: any) {
      console.error("Chat error:", err);
      // We don't alert here to not interrupt flow, msg is already optimistic
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

  const toggleMute = async () => {
    if (!localTracks?.audioTrack) return;
    try {
      await localTracks.audioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    } catch (err) {
      console.error("Mute toggle error:", err);
    }
  };

  const resumeAudio = () => {
    setHasAudioStarted(true);
    // SDK will retry playing or we can iterate over users
    agoraClient?.remoteUsers.forEach(user => {
      user.audioTrack?.play();
    });
  };

  const isLive = stream.status === "live";
  const hasRecording = stream.status === "offline" && stream.recordingUrl;

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden relative">
      {/* Video Content */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        <div className="flex-1 bg-black relative group">
          {/* Main Video Area */}
          <div className="h-full w-full flex items-center justify-center relative overflow-hidden">
             {isLive && (
               <img src={stream.thumbnail || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-2xl scale-110" />
             )}
             
             {isLive ? (
               <div className="w-full h-full relative">
                 {isTeacherView ? (
                   localTracks ? (
                     localTracks.videoTrack ? (
                       <AgoraPlayer videoTrack={localTracks.videoTrack} />
                     ) : (
                       <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 space-y-4">
                         <div className="h-20 w-20 rounded-full bg-brand-blue/10 flex items-center justify-center border border-brand-blue/20">
                            <VideoOff className="h-8 w-8 text-brand-blue/50" />
                         </div>
                         <div className="text-center">
                            <p className="text-white text-sm font-black uppercase tracking-widest">Audio Only Active</p>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">No camera detected</p>
                         </div>
                       </div>
                     )
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full space-y-4 px-6 text-center">
                        {agoraError ? (
                          <>
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                              <X className="h-8 w-8 text-red-500" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-red-500 font-black uppercase tracking-widest text-[10px]">Connection Failure</p>
                              <p className="text-slate-400 text-xs font-medium max-w-xs">{agoraError}</p>
                              <div className="flex flex-col gap-2 w-full max-w-xs pt-4">
                                <button 
                                  onClick={() => window.location.reload()}
                                  className="w-full px-4 py-3 bg-brand-blue hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-white shadow-xl shadow-blue-500/20"
                                >
                                  Retry Connection
                                </button>
                                <a 
                                  href={window.location.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all text-white flex items-center justify-center gap-2"
                                >
                                  <Share2 className="h-3 w-3" />
                                  Open in New Tab
                                </a>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-full border-4 border-brand-blue border-t-transparent animate-spin"></div>
                            <div className="space-y-2">
                              <p className="text-brand-blue font-black uppercase tracking-widest text-xs">Initializing Camera...</p>
                              {initTakingLong && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-4"
                                >
                                  <p className="text-[10px] text-slate-500 font-medium max-w-[200px] mx-auto leading-relaxed">
                                    Still waiting for permissions. If you don't see a popup, try opening the classroom in a new window.
                                  </p>
                                  <a 
                                    href={window.location.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue/10 border border-brand-blue/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-blue hover:bg-brand-blue/20 transition-all"
                                  >
                                    <Share2 className="h-3 w-3" />
                                    Open New Tab
                                  </a>
                                </motion.div>
                              )}
                            </div>
                          </>
                        )}
                     </div>
                   )
                 ) : (
                   teacherVideo ? (
                     <AgoraPlayer videoTrack={teacherVideo} />
                   ) : (
                     <div className="z-10 text-center space-y-6">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-blue/10 border border-brand-blue/30 backdrop-blur-3xl animate-pulse">
                            <Play className="h-8 w-8 text-brand-blue fill-current" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black font-display uppercase tracking-widest italic leading-none">
                              Connecting to Class
                          </h3>
                          <p className="text-slate-500 font-bold tracking-widest text-[8px] uppercase italic opacity-60">Waiting for Teacher Output</p>
                        </div>
                     </div>
                   )
                 )}

                 {/* Autoplay Fallback Overlay */}
                 {!isTeacherView && !hasAudioStarted && isLive && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                      <motion.button 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={resumeAudio}
                        className="bg-brand-blue hover:bg-blue-500 text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl shadow-blue-500/40 group transition-all"
                      >
                         <Play className="h-6 w-6 fill-current group-hover:scale-110 transition-transform text-white" />
                         <span className="text-sm font-black uppercase tracking-widest text-white">Connect Audio</span>
                      </motion.button>
                    </div>
                 )}

                 {/* Instagram-style Live Chat Overlay */}
                 {isLive && (
                   <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end pb-24 md:pb-32 px-4 md:px-8">
                      <div 
                        className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2 max-w-[85%] md:max-w-[400px] [mask-image:linear-gradient(to_top,black_80%,transparent_100%)] pt-10"
                        ref={scrollRef}
                      >
                         <AnimatePresence>
                            {messages.map((msg) => (
                              <motion.div 
                                key={msg.id}
                                initial={{ opacity: 0, x: -20, scale: 0.8 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                className="flex items-start gap-2 py-1"
                              >
                                 <img src={msg.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.userName)}&background=0D8ABC&color=fff`} className="w-8 h-8 rounded-full border border-white/10 shrink-0" alt="" />
                                 <div className="bg-black/20 backdrop-blur-md px-3 py-2 rounded-2xl rounded-tl-none border border-white/5 pointer-events-auto">
                                   <p className="text-[10px] font-black uppercase text-brand-blue leading-none mb-1">{msg.userName.split(" ")[0]}</p>
                                   <p className="text-sm text-white font-medium leading-tight">{msg.text}</p>
                                 </div>
                              </motion.div>
                            ))}
                         </AnimatePresence>
                      </div>
                   </div>
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
          <div className="absolute inset-x-0 top-0 p-4 md:p-6 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-40">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 pointer-events-auto">
                <img 
                  src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=0D8ABC&color=fff`} 
                  className="w-10 h-10 rounded-full border border-white/20" 
                  alt="" 
                />
                <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-tighter text-white">{stream.title}</p>
                  <p className="text-[8px] font-bold text-brand-blue uppercase">{stream.teacherName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                  {isLive ? (
                    <span className="bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse">Live</span>
                  ) : hasRecording ? (
                    <span className="bg-brand-blue px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white">Record</span>
                  ) : null}
                  <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white border border-white/10 flex items-center gap-1">
                    <Users className="h-2 w-2" />
                    <span>{stream.viewersCount}</span>
                  </div>
              </div>
            </div>
            {onClose && !isEnding && (
                <button onClick={onClose} className="pointer-events-auto rounded-full bg-black/40 p-2 text-white border border-white/5 backdrop-blur-md hover:bg-white/20 transition-all">
                    <X className="h-5 w-5" />
                </button>
            )}
          </div>

          {/* Floating Transparent Chat Input */}
          {isLive && (
            <div className="absolute bottom-6 inset-x-0 px-4 md:px-8 z-40 flex items-center gap-3">
               <form onSubmit={handleSendMessage} className="flex-1 flex items-center bg-black/40 backdrop-blur-xl rounded-full border border-white/10 px-4 py-1">
                 <input 
                   type="text" 
                   value={chatMessage}
                   onChange={(e) => setChatMessage(e.target.value)}
                   placeholder="Comment..." 
                   className="flex-1 bg-transparent border-none py-2 text-sm text-white placeholder-slate-400 outline-none"
                 />
                 <button 
                   type="submit"
                   disabled={!chatMessage.trim()}
                   className="p-2 text-white hover:text-brand-blue transition-colors disabled:opacity-20"
                 >
                   <Send className="h-4 w-4" />
                 </button>
               </form>
               {!isTeacherView && (
                 <button className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white">
                   <Heart className="h-5 w-5" />
                 </button>
               )}
            </div>
          )}

          {/* Teacher Controls */}
          {isTeacherView && isLive && !isEnding && (
            <div className="absolute top-20 right-6 flex flex-col gap-3 group-hover:opacity-100 opacity-60 transition-opacity z-40">
               <button 
                 onClick={toggleMute}
                 className={cn(
                   "flex items-center justify-center w-10 h-10 rounded-full transition-all border backdrop-blur-md",
                   isMuted ? "bg-red-600/40 border-red-500 text-red-500" : "bg-emerald-600/40 border-emerald-500 text-emerald-500"
                 )}
               >
                 {isMuted ? <VideoOff className="h-4 w-4" /> : <Users className="h-4 w-4" />}
               </button>
               <button 
                 onClick={() => setIsEnding(true)}
                 className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600/40 border border-red-500 text-red-500 backdrop-blur-md"
               >
                 <X className="h-4 w-4" />
               </button>
            </div>
          )}

          {/* Finish Modal */}
          <AnimatePresence>
            {isEnding && (/* ... modal code remains similar but styled more sleekly ... */
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
              >
                <div className="bg-slate-900/90 w-full max-w-sm rounded-[40px] p-8 border border-white/10 shadow-2xl space-y-6">
                  <div className="text-center space-y-2">
                    <h4 className="text-2xl font-black font-display uppercase tracking-tighter italic">End Class?</h4>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Share the recording with students.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <input 
                      type="url"
                      placeholder="Recording URL (optional)"
                      value={recordingUrlInput}
                      onChange={(e) => setRecordingUrlInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-xs outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleEndStream}
                      className="w-full py-4 bg-brand-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-blue-500/20"
                    >
                      Publish & Finish
                    </button>
                    <button 
                      onClick={() => setIsEnding(false)}
                      className="w-full py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
