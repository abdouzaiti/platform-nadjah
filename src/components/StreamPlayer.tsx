import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { UserProfile, ChatMessageData, ClassRoom, TeacherCommunity, LiveSession } from "../types";
import { Send, Users, Heart, Share2, MoreHorizontal, X, MessageCircle, Play, VideoOff, Save, Check, Video, Maximize2, Minimize2, Eye, EyeOff, RefreshCw, Loader2, LogOut, Megaphone, Radio, Trash2, FileText, Upload, Download, File, FileIcon, Image, Lock, Shield, Film, Link2, AlertCircle, ExternalLink } from "lucide-react";
import BunnyVideoPlayer from "./BunnyVideoPlayer";
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
  session: LiveSession | null;
  profile: UserProfile;
  onClose?: () => void;
  isTeacherView?: boolean;
  teacherId?: string;
}

export default function StreamPlayer({ room, session, profile, onClose, isTeacherView, teacherId: teacherIdProp }: StreamPlayerProps) {
  const { t, i18n } = useTranslation();
  const [currentSession, setCurrentSession] = useState<LiveSession | null>(session);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [roomFiles, setRoomFiles] = useState<ChatMessageData[]>([]);
  const [roomVideos, setRoomVideos] = useState<ChatMessageData[]>([]);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [agoraRecordingState, setAgoraRecordingState] = useState<{resourceId: string, sid: string, m3u8Url: string, prefix: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingUrlInput, setRecordingUrlInput] = useState("");
  const [activeVideoModalUrl, setActiveVideoModalUrl] = useState<string | null>(null);
  const [activeVideoModalTitle, setActiveVideoModalTitle] = useState<string | null>(null);
  const [showAddBunnyModal, setShowAddBunnyModal] = useState(false);
  const [bunnyTitleInput, setBunnyTitleInput] = useState("");
  const [bunnyUrlInput, setBunnyUrlInput] = useState("");
  const [hideComments, setHideComments] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarActiveTab, setSidebarActiveTab] = useState(
    room.room_type === "videos" ? "videos" : 
    room.room_type === "files" ? "files" : 
    room.room_type === "chat" ? "group_chat" : 
    room.room_type === "announcements" ? "announcements" : 
    "live"
  );
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
    const fetchRecordings = async () => {
      const { data, error } = await supabase
        .from('recordings')
        .select(`
          *,
          live_session:live_sessions (
            title,
            started_at
          )
        `)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setRecordings(data);
      }
    };

    if (sidebarActiveTab === "recordings") {
      fetchRecordings();
    }
    
    if (sidebarActiveTab === "files") {
      const fetchFiles = async () => {
        const { data, error } = await supabase
          .from("room_messages")
          .select("*")
          .eq("room_id", room.id)
          .eq("content", "file")
          .order("created_at", { ascending: false });
        
        if (!error && data) {
          setRoomFiles(data.map(m => {
             let msgText = m.message;
             let fileData = { name: "File", url: "", type: "" };
             try {
               const parsed = JSON.parse(msgText);
               fileData = parsed;
             } catch(e) {}
             
             return {
               ...m,
               message: fileData.name,
               fileUrl: fileData.url,
               fileType: fileData.type
             };
          }) as any[]);
        }
      };
      fetchFiles();
    }

    if (sidebarActiveTab === "videos") {
      const fetchVideos = async () => {
        const { data, error } = await supabase
          .from("room_messages")
          .select("*")
          .eq("room_id", room.id)
          .eq("content", "video")
          .order("created_at", { ascending: false });
          
        if (!error && data) {
          setRoomVideos(data.map(m => {
             let msgText = m.message;
             let videoData = { name: "Video", url: "" };
             try {
               const parsed = JSON.parse(msgText);
               videoData = parsed;
             } catch(e) {}
             
             return {
               ...m,
               message: videoData.name,
               fileUrl: videoData.url
             };
          }) as any[]);
        }
      };
      fetchVideos();
    }
  }, [sidebarActiveTab, room.id]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(50);
      
      if (!error && data) {
        setMessages(data.map(m => {
          let msgText = m.message || m.message_text || "";
          let msgContent = m.content;
          let msgRecipient = m.recipient_id;
          
          try {
            if (msgText.startsWith('{"msg":')) {
              const parsed = JSON.parse(msgText);
              msgText = parsed.msg;
              msgContent = parsed.c;
              msgRecipient = parsed.r || undefined;
            }
          } catch(e) {}

          return {
            id: m.id,
            room_id: m.room_id,
            message: msgText,
            content: msgContent,
            sender_id: m.user_id,
            sender_name: m.user_name,
            sender_avatar: m.user_avatar,
            recipient_id: msgRecipient,
            created_at: m.created_at
          };
        }) as ChatMessageData[]);
        
        setTimeout(() => {
          if (groupChatScrollRef.current) groupChatScrollRef.current.scrollTop = groupChatScrollRef.current.scrollHeight;
          if (liveCommentsScrollRef.current) liveCommentsScrollRef.current.scrollTop = liveCommentsScrollRef.current.scrollHeight;
        }, 100);
      }
    };

    fetchMessages();

    // Subscribe to session changes for this room
    const sessionChannel = supabase
      .channel(`room-sessions-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          const newSession = payload.new as LiveSession;
          if (newSession.status === 'live' || newSession.status === 'scheduled') {
            setCurrentSession(newSession);
          } else if (newSession.status === 'ended' && currentSession?.id === newSession.id) {
            setCurrentSession(newSession);
          }
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
          let msgText = payload.new.message || payload.new.message_text || "";
          let msgContent = payload.new.content;
          let msgRecipient = payload.new.recipient_id;

          try {
            if (msgText.startsWith('{"msg":')) {
              const parsed = JSON.parse(msgText);
              msgText = parsed.msg;
              msgContent = parsed.c;
              msgRecipient = parsed.r || undefined;
            }
          } catch(e) {}

          const newMsg: ChatMessageData = {
            id: payload.new.id,
            room_id: payload.new.room_id,
            message: msgText,
            content: msgContent,
            sender_id: payload.new.user_id,
            sender_name: payload.new.user_name,
            sender_avatar: payload.new.user_avatar,
            recipient_id: msgRecipient,
            created_at: payload.new.created_at
          };
          
          if (msgContent === 'file') {
            let fileData = { name: "File", url: "", type: "" };
            try {
              fileData = JSON.parse(payload.new.message);
            } catch(e) {}
            
            setRoomFiles(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [{
                ...newMsg,
                message: fileData.name,
                fileUrl: fileData.url,
                fileType: fileData.type
              } as any, ...prev];
            });
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(sessionChannel);
    };
  }, [room.id, session?.id]);

  // Agora Lifecycle (RTC + RTM)
  useEffect(() => {
    let isMounted = true;
    // Setup RTM regardless of live status for reliable chat
    const rtm = createRTMClient(profile.id);
    setRtmClient(rtm);

    const setupRtm = async () => {
      try {
        await rtm.login();
        
        if (!isMounted) {
          try { await rtm.logout(); } catch (e) {}
          return;
        }

        await rtm.subscribe(room.id, { withPresence: false, withMessage: true });
        
        if (!isMounted) return;
        
        rtm.addEventListener("message", (event: any) => {
          try {
            const data = JSON.parse(event.message as string);
            if (data.type === "chat") {
              const newMsg = data.payload as ChatMessageData;
              
              // For private messages, check if we are the intended recipient or sender
              if (newMsg.content === 'private') {
                const isRelevant = newMsg.sender_id === profile.id || newMsg.recipient_id === profile.id || isTeacherView;
                if (!isRelevant) return;
              }

              if (newMsg.content === 'file') {
                setRoomFiles(prev => {
                   if (prev.some(m => m.id === newMsg.id)) return prev;
                   return [newMsg as any, ...prev];
                });
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
        if (isMounted) {
          console.warn("Agora RTM notice (using Supabase Realtime as primary socket):", err);
          setRtmClient(null);
        }
      }
    };

    setupRtm();

    // Setup RTC only if live
    let client: IAgoraRTCClient | null = null;
    if (currentSession?.status === "live") {
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
            
            const tracksToPublish: any[] = [];
            if (tracks.audioTrack) tracksToPublish.push(tracks.audioTrack);
            if (tracks.videoTrack) tracksToPublish.push(tracks.videoTrack);
            
            if (tracksToPublish.length > 0) {
              await client!.publish(tracksToPublish);
            }

            // Start Agora Cloud Recording
            try {
              const recRes = await fetch("/api/agora/start-recording", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channel: room.id, uid: 999999 })
              });
              if (recRes.ok) {
                const recData = await recRes.json();
                setAgoraRecordingState(recData);
                console.log("Agora Cloud Recording started:", recData);
              } else {
                console.error("Agora recording start failed", await recRes.text());
              }
            } catch (recErr) {
              console.error("Recording start error:", recErr);
            }

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
      isMounted = false;
      if (client) {
        leaveChannel(client, localTracks ? { 
          audioTrack: localTracks.audioTrack, 
          videoTrack: localTracks.videoTrack || undefined 
        } : undefined);
      }
      if (rtm) {
        try { rtm.logout(); } catch (e) {}
      }
      // Reset video states when leaving live
      setTeacherVideo(null);
      setLocalTracks(null);
      setAgoraClient(null);
      setRtmClient(null);
    };
  }, [room.id, currentSession?.status, isTeacherView, profile.id]);

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

      const safeMessageText = JSON.stringify({
        msg: chatMessage,
        c: contentType,
        r: recipientId || ""
      });

      const msgData = {
        room_id: room.id,
        user_id: profile.id,
        user_name: profile.fullname,
        user_avatar: profile.avatar_url,
        message: safeMessageText,
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
          message: chatMessage,
          content: contentType,
          sender_id: data.user_id,
          sender_name: data.user_name,
          sender_avatar: data.user_avatar,
          recipient_id: recipientId || undefined,
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
      if (currentSession) {
        const { error } = await supabase
          .from("live_sessions")
          .update({
            status: "live",
            started_at: new Date().toISOString()
          })
          .eq("id", currentSession.id);

        if (error) throw error;
        
        setCurrentSession({
          ...currentSession,
          status: 'live',
          started_at: new Date().toISOString()
        });
      } else {
        const { data, error } = await supabase
          .from("live_sessions")
          .insert({
            room_id: room.id,
            status: "live",
            started_at: new Date().toISOString(),
            title: `${room.room_name} Live`
          })
          .select()
          .single();

        if (error) throw error;
        setCurrentSession(data as LiveSession);
      }
    } catch (err: any) {
      alert(err.message || "Failed to start session");
    }
  };

  const handleEndStream = async () => {
    if (!currentSession) return;
    setIsEnding(false);
    setIsUploading(true);
    try {
      // 1. Stop recording if active
      if (agoraRecordingState) {
        await fetch("/api/agora/stop-recording", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: room.id,
            uid: 999999,
            resourceId: agoraRecordingState.resourceId,
            sid: agoraRecordingState.sid
          })
        });
      }

      const { error } = await supabase
        .from("live_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString()
        })
        .eq("id", currentSession.id);

      if (error) throw error;
      
      // Stop the tracks locally
      if (agoraClient) {
        leaveChannel(agoraClient, localTracks ? { 
          audioTrack: localTracks.audioTrack, 
          videoTrack: localTracks.videoTrack || undefined 
        } : undefined);
      }
      
      setIsUploading(false);
      setShowSaveDialog(true);
    } catch (err: any) {
      console.error("End stream error:", err);
      if (currentSession) {
        alert(err.message || "Failed to end session");
      }
      setIsUploading(false);
    }
  };

  const handleSaveRecording = async () => {
    setIsUploading(true);
    try {
      const videoUrl = agoraRecordingState ? agoraRecordingState.m3u8Url : recordingUrlInput;
      if (videoUrl && currentSession) {
        await supabase.from("recordings").insert({
          live_session_id: currentSession.id,
          video_url: videoUrl
        });
      }
      setShowSaveDialog(false);
      setRecordingUrlInput("");
      setIsUploading(false);
      onClose(); // Close the modal
    } catch (e) {
      console.error(e);
      setIsUploading(false);
    }
  };

  const handleDeleteRecording = async () => {
    setIsUploading(true);
    try {
      if (agoraRecordingState?.prefix) {
        await fetch("/api/recordings/delete-s3", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: agoraRecordingState.prefix })
        });
      }
      setShowSaveDialog(false);
      setRecordingUrlInput("");
      setIsUploading(false);
      onClose();
    } catch (e) {
      console.error(e);
      setIsUploading(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isTeacherView) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `files/${room.id}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('recordings') // Using existing bucket
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(filePath);

      const fileInfo = JSON.stringify({
        name: file.name,
        url: publicUrl,
        type: file.type
      });

      const { data: msgData, error: msgError } = await supabase
        .from("room_messages")
        .insert({
          room_id: room.id,
          user_id: profile.id,
          user_name: profile.fullname,
          user_avatar: profile.avatar_url,
          message: fileInfo,
          content: "file"
        })
        .select()
        .single();

      if (msgError) throw msgError;

      const newFileMsg = {
        id: msgData.id,
        room_id: msgData.room_id,
        message: file.name,
        fileUrl: publicUrl,
        fileType: file.type,
        sender_id: profile.id,
        sender_name: profile.fullname,
        created_at: msgData.created_at
      };

      setRoomFiles(prev => [newFileMsg as any, ...prev]);
      
      // Also notify via RTM if possible
      if (rtmClient) {
        rtmClient.publish(room.id, JSON.stringify({ 
          type: "chat", 
          payload: {
            ...msgData,
            message: file.name,
            content: "file",
            fileUrl: publicUrl,
            fileType: file.type
          } 
        }));
      }

    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Failed to upload file: " + err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isTeacherView) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `videos/${room.id}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(filePath);

      const videoInfo = JSON.stringify({
        name: file.name,
        url: publicUrl,
        type: file.type
      });

      const { data: msgData, error: msgError } = await supabase
        .from("room_messages")
        .insert({
          room_id: room.id,
          user_id: profile.id,
          user_name: profile.fullname,
          user_avatar: profile.avatar_url,
          message: videoInfo,
          content: "video"
        })
        .select()
        .single();

      if (msgError) throw msgError;

      const newVideoMsg = {
        id: msgData.id,
        room_id: msgData.room_id,
        message: file.name,
        fileUrl: publicUrl,
        fileType: file.type,
        sender_id: profile.id,
        sender_name: profile.fullname,
        created_at: msgData.created_at
      };

      setRoomVideos(prev => [newVideoMsg as any, ...prev]);

    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Failed to upload video: " + err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleAddBunnyVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bunnyUrlInput.trim()) return;

    setIsUploading(true);
    try {
      const title = bunnyTitleInput.trim() || "Bunny.net Video";
      const url = bunnyUrlInput.trim();

      const videoInfo = JSON.stringify({
        name: title,
        url: url,
        type: "bunny"
      });

      const { data: msgData, error: msgError } = await supabase
        .from("room_messages")
        .insert({
          room_id: room.id,
          user_id: profile.id,
          user_name: profile.fullname,
          user_avatar: profile.avatar_url,
          message: videoInfo,
          content: "video"
        })
        .select()
        .single();

      if (msgError) throw msgError;

      const newVideoMsg = {
        id: msgData.id,
        room_id: msgData.room_id,
        message: title,
        fileUrl: url,
        sender_id: profile.id,
        sender_name: profile.fullname,
        created_at: msgData.created_at
      };

      setRoomVideos(prev => [newVideoMsg as any, ...prev]);
      setShowAddBunnyModal(false);
      setBunnyTitleInput("");
      setBunnyUrlInput("");
    } catch (err: any) {
      console.error("Add Bunny video error:", err);
      alert("Failed to add video: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const isLive = currentSession?.status === "live";

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
                      <div className="space-y-3">
                        <h3 className="text-2xl font-display font-black uppercase italic tracking-tighter text-slate-900">{t('room_ready', 'Class Ready')}</h3>
                        <p className="text-sm font-medium text-slate-400 font-sans leading-relaxed">{t('click_to_enter', 'Click below to enter the classroom.')}</p>
                      </div>
                      <button 
                        onClick={() => setHasEntered(true)}
                        className="w-full bg-brand-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        {t('enter_room', 'Enter to the Class')}
                      </button>
                    </div>
                 </div>
               ) : isLive ? (
                 <div className="absolute inset-0 bg-slate-900 overflow-hidden rounded-2xl md:m-4 shadow-2xl flex items-center justify-center">
                 {agoraError ? (
                   <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center space-y-4 max-w-md mx-auto">
                     <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
                       <AlertCircle className="h-8 w-8" />
                     </div>
                     <div className="space-y-1">
                       <h4 className="text-sm font-black uppercase tracking-wider text-red-400">Connection & Device Notice</h4>
                       <p className="text-xs text-slate-300 leading-relaxed">{agoraError}</p>
                     </div>
                     <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                       <button
                         onClick={() => window.open(window.location.href, '_blank')}
                         className="flex-1 py-2.5 px-4 bg-brand-blue hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                       >
                         <ExternalLink className="h-4 w-4" />
                         <span>Open in New Tab</span>
                       </button>
                       <button
                         onClick={() => {
                           setAgoraError(null);
                         }}
                         className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                       >
                         <RefreshCw className="h-4 w-4" />
                         <span>Retry</span>
                       </button>
                     </div>
                   </div>
                 ) : isTeacherView ? (
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
                      <div className="mx-auto w-24 h-24 bg-brand-blue/10 rounded-[32px] flex items-center justify-center rotate-6 shadow-inner ring-4 ring-white">
                        <Radio className="h-10 w-10 text-brand-blue animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-3xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                          {isTeacherView ? t('ready_to_start', 'Ready to Start') : t('live_not_started', 'Waiting for Teacher')}
                        </h3>
                        <p className="text-sm font-medium text-slate-400 font-sans leading-relaxed max-w-[280px] mx-auto">
                          {isTeacherView 
                            ? t('start_live_hint', 'Your students are waiting. Click below to start the high-definition live stream.') 
                            : t('live_hint_student', 'The session will light up automatically once your teacher goes live. Grab a snack!')}
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
                  <div className="mb-6 flex items-end justify-between">
                    <div>
                      <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">{t('group_chat', 'Group Chat')}</h2>
                      <div className="h-1.5 w-16 bg-brand-blue rounded-full mt-3"></div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('live_now', 'Live Now')}</span>
                    </div>
                  </div>
                  
                  <div 
                    ref={groupChatScrollRef}
                    className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2"
                  >
                    <AnimatePresence initial={false}>
                       {messages.filter(m => m.content !== 'private' && m.content !== 'live' && m.content !== 'announcement' && m.content !== 'file').map((msg) => (
                         <motion.div 
                           key={msg.id} 
                           initial={{ opacity: 0, y: 10 }} 
                           animate={{ opacity: 1, y: 0 }} 
                           className={cn(
                             "flex items-start gap-3",
                             msg.sender_id === profile.id ? "flex-row-reverse" : "flex-row"
                           )}
                         >
                            <div className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm bg-slate-100 flex items-center justify-center">
                              <Users className="h-5 w-5 text-slate-400" />
                            </div>
                            <div className={cn(
                               "max-w-[80%] px-5 py-3.5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] relative group transition-all duration-500",
                               msg.sender_id === profile.id 
                                 ? "bg-brand-blue text-white rounded-tr-none shadow-[0_8px_20px_-4px_rgba(37,99,235,0.4)]" 
                                 : "bg-white text-slate-800 border border-slate-100 shadow-sm rounded-tl-none"
                             )}>
                               {msg.sender_id === profile.id && (
                                 <button 
                                   onClick={() => handleDeleteMessage(msg.id)}
                                   className="absolute -top-2.5 -right-2.5 p-2 bg-white text-slate-400 hover:text-red-500 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 group-hover:scale-100 border border-slate-100"
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </button>
                               )}
                               {msg.sender_id !== profile.id && (
                                 <p className="text-[10px] font-black uppercase tracking-widest text-brand-blue mb-1.5 flex items-center gap-2">
                                   {msg.sender_name}
                                   {isTeacherView && msg.sender_id !== teacherId && (
                                     <span className="text-[8px] bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-md">Student</span>
                                   )}
                                 </p>
                               )}
                               <p className="text-[15px] font-medium leading-relaxed tracking-tight">{msg.message}</p>
                               <div className={cn(
                                 "flex items-center gap-1.5 mt-2 opacity-40 font-mono text-[9px] font-semibold tracking-tighter",
                                 msg.sender_id === profile.id ? "justify-end text-white" : "justify-start text-slate-400"
                               )}>
                                 {formatDate(msg.created_at)}
                               </div>
                             </div>
                         </motion.div>
                       ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : sidebarActiveTab === "private_chat" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner">
                  <div className="mb-6">
                    <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">{t('private_chat', 'Ask Teacher')}</h2>
                    <div className="h-1.5 w-16 bg-brand-blue rounded-full mt-3"></div>
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
                                <div className="w-8 h-8 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-white/50" />
                                </div>
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
                                      <div className="w-8 h-8 rounded-xl border-2 border-white shadow-sm ring-1 ring-slate-100/50 bg-slate-100 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-slate-400" />
                                      </div>
                                      <div className={cn("max-w-[85%] px-4 py-3 rounded-2xl shadow-[0_2px_12px_rgba(37,99,235,0.03)] relative group transition-all duration-300", msg.sender_id === profile.id ? "bg-brand-blue text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-100 rounded-tl-none")}>
                                        {msg.sender_id === profile.id && (
                                          <button 
                                            onClick={() => handleDeleteMessage(msg.id)}
                                            className="absolute -top-2 -right-2 p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 group-hover:scale-100"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                        <p className="text-[14px] font-medium leading-relaxed tracking-tight">{msg.message}</p>
                                        <p className={cn("text-[8px] mt-1.5 font-mono tracking-tighter opacity-40 font-semibold", msg.sender_id === profile.id ? "text-white" : "text-slate-400")}>{formatDate(msg.created_at)}</p>
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
                                <div className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm bg-slate-100 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-slate-400" />
                                </div>
                                <div className={cn("max-w-[75%] px-4 py-3 rounded-[24px] shadow-sm relative group", msg.sender_id === profile.id ? "bg-brand-blue text-white rounded-tr-none" : "bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none")}>
                                  {msg.sender_id === profile.id && (
                                    <button 
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="absolute -top-2 -right-2 p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 group-hover:scale-100"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                  <p className="text-[15px] font-medium leading-relaxed tracking-tight">{msg.message}</p>
                                  <p className={cn("text-[9px] mt-1 font-bold opacity-50", msg.sender_id === profile.id ? "text-right" : "text-left")}>{formatDate(msg.created_at)}</p>
                                </div>
                             </motion.div>
                           ))}
                           {messages.filter(m => m.content === 'private' && (m.sender_id === profile.id || m.recipient_id === profile.id)).length === 0 && (
                             <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                <MessageCircle className="h-16 w-16 text-slate-100 mb-6" />
                                <h3 className="text-xl font-black uppercase text-slate-900 italic tracking-tighter mb-2">{t('private_placeholder_title', 'Ask your Teacher')}</h3>
                                <p className="text-sm font-medium text-slate-400 max-w-xs">{t('private_placeholder_desc', 'Send a private message to your teacher. Only you and the teacher can see this.')}</p>
                             </div>
                           )}
                       </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : sidebarActiveTab === "announcements" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner">
                  <div className="mb-6">
                    <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">{t('announcements', 'Announcements')}</h2>
                    <div className="h-1.5 w-16 bg-brand-blue rounded-full mt-3"></div>
                  </div>
                  
                  <div 
                    ref={announcementsScrollRef}
                    className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2"
                  >
                    <AnimatePresence initial={false}>
                       {messages.filter(m => m.content === 'announcement').map((msg) => (
                         <motion.div 
                           key={msg.id} 
                           initial={{ opacity: 0, y: 20 }} 
                           animate={{ opacity: 1, y: 0 }} 
                           className="bg-white border border-slate-100 rounded-3xl p-8 relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all"
                         >
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Megaphone className="h-20 w-20 text-brand-blue -rotate-12" />
                            </div>
                            {msg.sender_id === profile.id && (
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="absolute top-6 right-6 p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100 z-10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            <div className="flex items-center gap-4 mb-6">
                               <div className="w-12 h-12 rounded-2xl border-4 border-slate-50 shadow-sm bg-slate-100 flex items-center justify-center">
                                 <Users className="h-6 w-6 text-slate-400" />
                               </div>
                               <div>
                                 <p className="text-sm font-black uppercase tracking-wider text-slate-900">{msg.sender_name}</p>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">{formatDate(msg.created_at)}</p>
                               </div>
                            </div>
                            <div className="prose prose-slate max-w-none">
                              <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-wrap text-[15px]">{msg.message}</p>
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
              ) : sidebarActiveTab === "files" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner overflow-hidden">
                  <div className="mb-6 flex items-end justify-between">
                    <div>
                      <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">{t('files_docs', 'Files & Docs')}</h2>
                      <div className="h-1.5 w-16 bg-brand-blue rounded-full mt-3"></div>
                    </div>
                    {isTeacherView && (
                      <label className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer shadow-lg shadow-brand-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <span>{t('upload_file', 'Upload File')}</span>
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                      </label>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {roomFiles.map((file: any) => (
                        <div key={file.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group relative">
                          <div className="flex items-start gap-3">
                            <div className="p-3 bg-white rounded-xl text-brand-blue shadow-sm">
                              {file.fileType?.includes('image') ? <Image className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-black uppercase text-slate-900 truncate mb-1" title={file.message}>{file.message}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(file.created_at)}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mt-4">
                            <button 
                              onClick={() => setPreviewFile({ name: file.message, url: file.fileUrl, type: file.fileType })}
                              className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl text-[9px] font-black uppercase tracking-widest text-center hover:bg-blue-600 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-blue/20"
                            >
                              <Eye className="h-3.5 w-3.5" /> {t('view_file', 'عرض الملف')}
                            </button>
                            {isTeacherView && (
                              <button 
                                onClick={() => handleDeleteMessage(file.id)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {roomFiles.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                          <FileText className="h-12 w-12 text-slate-200" />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">{t('no_files_yet', 'No files shared yet')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : sidebarActiveTab === "videos" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner overflow-hidden">
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">{t('videos_tab', i18n.language === 'ar' ? 'دورات' : 'Courses')}</h2>
                      <div className="h-1.5 w-16 bg-brand-blue rounded-full mt-3"></div>
                    </div>
                    {isTeacherView && (
                      <button
                        onClick={() => setShowAddBunnyModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <Film className="h-4 w-4" />
                        <span>{i18n.language === 'ar' ? 'إضافة فيديو Bunny.net' : 'Add Bunny Video'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {roomVideos.map((video: any) => (
                        <div key={video.id} className="bg-slate-50 rounded-2xl border border-slate-100 group relative overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all">
                          <div 
                            onClick={() => {
                              setActiveVideoModalUrl(video.fileUrl);
                              setActiveVideoModalTitle(video.message);
                            }}
                            className="aspect-video bg-slate-950 relative cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <button 
                                type="button"
                                className="h-12 w-12 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"
                              >
                                <Play className="h-5 w-5 ml-1 fill-current" />
                              </button>
                            </div>
                            <span className="absolute top-2 left-2 bg-orange-500/90 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full backdrop-blur-md">
                              Bunny.net
                            </span>
                          </div>
                          <div className="p-4 flex flex-col gap-1">
                            <h4 className="text-xs font-black uppercase text-slate-900 truncate" title={video.message}>{video.message}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(video.created_at)}</p>
                          </div>
                          {isTeacherView && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleDeleteMessage(video.id)}
                                className="h-8 w-8 bg-red-500 text-white rounded-lg flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                        
                      {roomVideos.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                          <Film className="h-12 w-12 text-slate-300" />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">{t('no_videos_yet', 'No videos shared yet')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : sidebarActiveTab === "recordings" ? (
                <div className="absolute inset-0 bg-white flex flex-col p-6 mt-16 pb-24 shadow-inner overflow-hidden">
                  <div className="mb-6">
                    <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">{t('recordings', 'Recordings')}</h2>
                    <div className="h-1.5 w-16 bg-brand-blue rounded-full mt-3"></div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
                    {recordings.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recordings.map((recording) => (
                          <motion.div 
                            key={recording.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all group"
                          >
                            <div 
                              onClick={() => {
                                setActiveVideoModalUrl(recording.video_url);
                                setActiveVideoModalTitle(recording.live_session?.title || "Live Recording");
                              }}
                              className="aspect-video bg-slate-950 rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center cursor-pointer"
                            >
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                                <button 
                                  type="button"
                                  className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-brand-blue shadow-xl scale-90 group-hover:scale-100 transition-transform cursor-pointer"
                                >
                                  <Play className="h-6 w-6 fill-current" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-md font-black uppercase italic tracking-tight text-slate-900 mb-1">{recording.live_session?.title || t('untitled_recording', 'Untitled Recording')}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">{(recording.live_session && recording.live_session.started_at) ? formatDate(recording.live_session.started_at) : formatDate(recording.created_at)}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-12">
                         <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                           <Save className="h-10 w-10 text-slate-200" />
                         </div>
                         <h3 className="text-xl font-black uppercase text-slate-900 italic tracking-tighter mb-2">{t('no_recordings_title', 'Vault is Empty')}</h3>
                         <p className="text-sm font-medium text-slate-400 max-w-xs">{t('no_recordings_desc', 'Previous live sessions will automatically appear here once the teacher finishes them.')}</p>
                      </div>
                    )}
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

             {isLive && sidebarActiveTab === "live" && !hideComments && (
               <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end pb-44 sm:pb-24 md:pb-32 px-4 md:px-8">
                  <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2 max-w-[400px]" ref={liveCommentsScrollRef}>
                     <AnimatePresence>
                        {messages.filter(m => m.content === 'live').map((msg) => (
                          <motion.div key={msg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 py-1">
                             <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
                               <Users className="h-4 w-4 text-white/50" />
                             </div>
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
                {onClose && (
                   <button onClick={onClose} className="bg-white/80 backdrop-blur-xl p-3 rounded-full text-slate-600 border border-white shadow-sm pointer-events-auto hover:bg-white transition-colors">
                     <X className="h-5 w-5" />
                   </button>
                )}
            </div>
          </div>

          <div className="absolute bottom-28 sm:bottom-6 inset-x-0 px-6 z-40 flex items-center gap-4">
             {isLive && sidebarActiveTab === "live" && (
               <button onClick={() => setHideComments(!hideComments)} className="h-12 w-12 rounded-full bg-white/80 backdrop-blur-xl border border-white flex items-center justify-center text-slate-600 shadow-sm transition-all hover:bg-white pointer-events-auto">
                 {hideComments ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
               </button>
             )}
             {((sidebarActiveTab === "live" && isLive) || sidebarActiveTab === "group_chat" || sidebarActiveTab === "private_chat" || (sidebarActiveTab === "announcements" && isTeacherView)) && (
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
                 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[40px] w-full max-w-sm text-center space-y-6 shadow-2xl">
                    {isUploading ? (
                      <div className="py-8 space-y-4">
                        <Loader2 className="h-12 w-12 text-brand-blue animate-spin mx-auto" />
                        <h4 className="text-xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">Ending Session...</h4>
                        <p className="text-xs text-slate-400 font-medium font-sans px-4">
                          Please wait while we wrap up the stream.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                          <Radio className="h-8 w-8 text-red-500" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-2xl font-display font-black uppercase text-slate-900 italic tracking-tighter leading-none">{t('end_session', 'End Session?')}</h4>
                          <p className="text-xs text-slate-400 font-medium font-sans">
                            Are you sure you want to end this live session?
                          </p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 pt-2">
                            <button 
                              onClick={handleEndStream} 
                              className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-red-500/20 hover:bg-red-600 hover:scale-[1.02] transition-all"
                            >
                              {t('finish_publish', 'Finish & Close Stream')}
                            </button>
                            <button 
                              onClick={() => setIsEnding(false)} 
                              className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition-all"
                            >
                              {t('cancel', 'Back to Class')}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                 </motion.div>
              </div>
            )}
            
            {showSaveDialog && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-lg p-6">
                 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[40px] w-full max-w-sm text-center space-y-6 shadow-2xl">
                    {isUploading ? (
                      <div className="py-8 space-y-4">
                        <Loader2 className="h-12 w-12 text-brand-blue animate-spin mx-auto" />
                        <h4 className="text-xl font-display font-black uppercase italic tracking-tighter text-slate-900 leading-none">Processing...</h4>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto w-16 h-16 bg-brand-blue/10 rounded-2xl flex items-center justify-center">
                          <Save className="h-8 w-8 text-brand-blue" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-2xl font-display font-black uppercase text-slate-900 italic tracking-tighter leading-none">Save Recording?</h4>
                          <p className="text-xs text-slate-400 font-medium font-sans">
                            Do you want to save this recording to the Replay Library?
                          </p>
                        </div>
                        <div className="space-y-4">
                          <div className="relative group">
                            <input 
                              value={recordingUrlInput} 
                              onChange={(e) => setRecordingUrlInput(e.target.value)} 
                              placeholder="YouTube/Google Drive Link (Optional Override)" 
                              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[13px] font-medium outline-none focus:border-brand-blue transition-all" 
                            />
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-20">
                              <Share2 className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 pt-2">
                            <button 
                              onClick={handleSaveRecording} 
                              className="w-full py-4 bg-brand-blue text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-500/20 hover:bg-blue-600 hover:scale-[1.02] transition-all"
                            >
                              Save to Replay Library
                            </button>
                            <button 
                              onClick={handleDeleteRecording} 
                              className="w-full py-4 bg-red-100 text-red-600 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-red-200 transition-all"
                            >
                              Delete Recording
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                 </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Protected File Viewer Modal */}
        <AnimatePresence>
          {previewFile && (
            <div 
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md select-none" 
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && ['c', 's', 'p', 'u', 'a'].includes(e.key.toLowerCase())) {
                  e.preventDefault();
                }
              }}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-5xl h-[85vh] rounded-[28px] shadow-2xl overflow-hidden flex flex-col relative border border-slate-100 select-none"
                onContextMenu={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              >
                {/* Protected Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-3 overflow-hidden pr-4">
                    <div className="p-2.5 bg-brand-blue/20 text-brand-blue rounded-xl">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-black uppercase tracking-wider truncate text-white">{previewFile.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                        <Shield className="h-3.5 w-3.5 text-emerald-400" />
                        <span>عرض فقط داخل التطبيق • يمنع التنزيل والنسخ (View-Only • Download & Copy Disabled)</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Protected Viewer Canvas */}
                <div 
                  className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center select-none"
                  onContextMenu={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  {previewFile.type?.includes('image') || previewFile.url?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ? (
                    <div className="relative max-w-full max-h-full flex items-center justify-center p-4 select-none">
                      <img 
                        src={previewFile.url} 
                        alt={previewFile.name} 
                        className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-none select-none"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                      {/* Protective Transparent Overlay Mask */}
                      <div 
                        className="absolute inset-0 z-20 cursor-default" 
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    </div>
                  ) : previewFile.type?.includes('pdf') || previewFile.url?.match(/\.pdf$/i) ? (
                    <div className="w-full h-full relative overflow-hidden select-none">
                      <iframe 
                        src={`${previewFile.url}#toolbar=0&navpanes=0&scrollbar=1`}
                        className="w-full h-full border-0 select-none"
                        title={previewFile.name}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full relative overflow-hidden select-none">
                      <iframe 
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(previewFile.url)}&embedded=true`}
                        className="w-full h-full border-0 select-none"
                        title={previewFile.name}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Active Bunny Video Playback Overlay Modal */}
        <AnimatePresence>
          {activeVideoModalUrl && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-4xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[92vh]"
              >
                <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl">
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-bold text-white truncate max-w-md">
                        {activeVideoModalTitle || "Bunny.net Stream Player"}
                      </h3>
                      <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                        Bunny.net High Performance Player
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveVideoModalUrl(null); setActiveVideoModalTitle(null); }}
                    className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-2 sm:p-4 bg-slate-950 flex-1 flex items-center justify-center">
                  <BunnyVideoPlayer
                    url={activeVideoModalUrl}
                    title={activeVideoModalTitle || ""}
                    autoPlay={true}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Bunny Video Modal */}
        <AnimatePresence>
          {showAddBunnyModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
                      <Film className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
                        {i18n.language === 'ar' ? 'إضافة فيديو Bunny.net Stream' : 'Add Bunny.net Video'}
                      </h3>
                      <p className="text-[10px] font-medium text-slate-400">
                        {i18n.language === 'ar' ? 'أدخل رابط أو كود الفيديو من مكتبة Bunny.net' : 'Enter Bunny.net video link or embed URL'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddBunnyModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleAddBunnyVideo} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      {i18n.language === 'ar' ? 'عنوان الفيديو / الدرس' : 'Video Title'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={i18n.language === 'ar' ? 'مثال: الدرس الأول - الرياضيات' : 'e.g. Lesson 1 - Algebra'}
                      value={bunnyTitleInput}
                      onChange={(e) => setBunnyTitleInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      {i18n.language === 'ar' ? 'رابط الفيديو من Bunny.net (Direct URL or Embed iframe link)' : 'Bunny Video URL / Embed Link'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://iframe.mediadelivery.net/embed/LIBRARY_ID/VIDEO_ID or https://vz-xxx.b-cdn.net/VIDEO_ID/play_480p.mp4"
                      value={bunnyUrlInput}
                      onChange={(e) => setBunnyUrlInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-brand-blue"
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddBunnyModal(false)}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase rounded-xl transition-all"
                    >
                      {i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span>{i18n.language === 'ar' ? 'إضافة الفيديو' : 'Add Video'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
