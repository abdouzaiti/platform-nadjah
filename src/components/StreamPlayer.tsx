import React from "react";
import ReactPlayer from "react-player";
import { StreamData, UserProfile, ChatMessageData } from "../types";
import { Send, Users, Heart, Share2, MoreHorizontal, X, MessageCircle, Play } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { formatDate } from "../lib/utils";

const Player = ReactPlayer as any;

interface StreamPlayerProps {
  stream: StreamData;
  profile: UserProfile;
  onClose?: () => void;
  isTeacherView?: boolean;
}

export default function StreamPlayer({ stream, profile, onClose, isTeacherView }: StreamPlayerProps) {
  const [chatMessage, setChatMessage] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessageData[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const q = query(
      collection(db, `streams/${stream.id}/chat`),
      orderBy("timestamp", "asc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessageData)));
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });
    return () => unsubscribe();
  }, [stream.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    try {
      await addDoc(collection(db, `streams/${stream.id}/chat`), {
        text: chatMessage,
        userId: profile.uid,
        userName: profile.displayName,
        userPhoto: profile.photoURL,
        timestamp: serverTimestamp(),
      });
      setChatMessage("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `streams/${stream.id}/chat`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-brand-darkest text-white overflow-hidden">
      {/* Video Content */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-brand-surface to-brand-darkest">
        <div className="flex-1 bg-black relative group">
          {/* Mock Video Stream */}
          <div className="h-full w-full flex items-center justify-center relative overflow-hidden">
             <img src={stream.thumbnail || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110" />
             <div className="z-10 text-center space-y-6">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-blue/10 border border-brand-blue/30 backdrop-blur-3xl animate-pulse">
                    <Play className="h-10 w-10 text-brand-blue fill-current" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black font-display uppercase tracking-widest italic italic">
                      {isTeacherView ? "Broadcasting Live" : "Acquiring Signal..."}
                  </h3>
                  <p className="text-slate-500 font-bold tracking-widest text-xs uppercase italic opacity-60">Ecole Nadjah Content Delivery Network</p>
                </div>
             </div>
          </div>

          {!isTeacherView && (
            <div className="absolute inset-0 z-0">
               <Player
                  url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
                  width="100%"
                  height="100%"
                  playing
                  muted={false}
                  controls={false}
                  style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
               />
            </div>
          )}

          {/* Player Overlay Top */}
          <div className="absolute inset-x-0 top-0 p-6 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
                <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20">Live</span>
                <span className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-white border border-white/10 italic">Ultra HD 4K</span>
            </div>
            {onClose && (
                <button onClick={onClose} className="pointer-events-auto rounded-full bg-white/10 p-2 text-white border border-white/5 backdrop-blur-xl hover:bg-white/20 transition-all">
                    <X className="h-5 w-5" />
                </button>
            )}
          </div>
        </div>

        {/* Info Header */}
        <div className="bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 p-8">
           <div className="flex items-start justify-between">
              <div className="flex space-x-6">
                 <div className="relative">
                    <img src={profile.photoURL} alt="" className="h-16 w-16 rounded-full border-2 border-brand-blue shadow-2xl shadow-blue-500/20" />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-brand-blue rounded-full border-2 border-slate-950 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <h1 className="text-3xl font-black font-display uppercase tracking-tighter italic leading-none">{stream.title}</h1>
                    <div className="flex items-center space-x-4 text-xs font-black uppercase tracking-[0.2em] mt-2">
                        <span className="text-brand-blue">{stream.teacherName}</span>
                        <div className="h-3 w-px bg-white/10"></div>
                        <div className="flex items-center space-x-2 text-slate-400">
                            <Users className="h-4 w-4" />
                            <span>{stream.viewersCount} Active Students</span>
                        </div>
                    </div>
                 </div>
              </div>
              <div className="flex items-center space-x-3">
                 <button className="flex items-center space-x-3 rounded-xl bg-white/5 border border-white/5 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95">
                    <Heart className="h-4 w-4 text-white" />
                    <span>Favorite</span>
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
               <img src={msg.userPhoto} alt="" className="h-8 w-8 shrink-0 rounded border border-white/10" />
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

        <div className="p-5 border-t border-white/5 bg-slate-900/40 backdrop-blur-md">
           <div className="flex gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
             {["👋 Hi", "❓ Question", "💡 Clear", "🚀 Nice!"].map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => setChatMessage(prev => `${prev} ${emoji.split(" ")[1]}`)}
                  className="px-2.5 py-1 bg-slate-800/80 border border-white/5 rounded text-[10px] hov:bg-slate-700 transition-colors uppercase font-black tracking-widest text-slate-400 hover:text-white"
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
      </div>

      {/* Bottom Status Bar from theme */}
      {!isTeacherView && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-brand-blue flex items-center justify-between px-6 z-50 shadow-[0_-10px_20px_rgba(59,130,246,0.3)]">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
            <span>Session: Nadjah-{stream.id.slice(0,6).toUpperCase()}</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
              Network Optimized
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">{stream.viewersCount} Students Online</span>
            </div>
            <div className="h-4 w-[1px] bg-white/20"></div>
            <button className="text-[9px] font-black uppercase hover:underline">Report Lag</button>
          </div>
        </div>
      )}
    </div>
  );
}
