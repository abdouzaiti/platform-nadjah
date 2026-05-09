import React from "react";
import { UserProfile, StreamData } from "../types";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import { Plus, Video, Trash2, Edit3, Loader2, Play, Users } from "lucide-react";
import { motion } from "motion/react";
import StreamPlayer from "../components/StreamPlayer";
import { cn } from "../lib/utils";

interface TeacherDashboardProps {
  profile: UserProfile;
}

export default function TeacherDashboard({ profile }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = React.useState("browse");
  const [myStreams, setMyStreams] = React.useState<StreamData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [liveStream, setLiveStream] = React.useState<StreamData | null>(null);

  // Form State
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [thumb, setThumb] = React.useState("");

  React.useEffect(() => {
    // Initial fetch
    const fetchMyStreams = async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("*")
        .eq("teacherId", profile.uid)
        .order("createdAt", { ascending: false });
      
      if (!error && data) {
        setMyStreams(data as StreamData[]);
      }
    };

    fetchMyStreams();

    // Subscribe to changes
    const channel = supabase
      .channel('my-streams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: `teacherId=eq.${profile.uid}`
        },
        () => {
          fetchMyStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.uid]);

  const handleStartStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const streamData = {
        title,
        description,
        teacherId: profile.uid,
        teacherName: profile.displayName,
        status: "live",
        thumbnail: thumb || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80",
        viewersCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from("streams")
        .insert(streamData)
        .select()
        .single();

      if (error) throw error;
      
      setLiveStream(data as StreamData);
      setActiveTab("live-console");
      setTitle("");
      setDescription("");
      setThumb("");
    } catch (err: any) {
      console.error("Stream creation error:", err);
      alert(err.message || "Failed to start stream");
    } finally {
      setLoading(false);
    }
  };

  const stopStream = async (streamId: string) => {
     try {
        const { error } = await supabase
          .from("streams")
          .update({
            status: "offline",
            updatedAt: new Date().toISOString()
          })
          .eq("id", streamId);

        if (error) throw error;
        
        setLiveStream(null);
        setActiveTab("browse");
     } catch (err: any) {
        console.error("Stop stream error:", err);
        alert(err.message || "Failed to stop stream");
     }
  };

  const deleteStream = async (streamId: string) => {
    if (!confirm("Are you sure you want to delete this stream record?")) return;
    try {
      const { error } = await supabase
        .from("streams")
        .delete()
        .eq("id", streamId);
        
      if (error) throw error;
    } catch (err: any) {
      console.error("Delete stream error:", err);
      alert(err.message || "Failed to delete stream");
    }
  };

  if (activeTab === "live-console" && liveStream) {
    return <StreamPlayer stream={liveStream} profile={profile} isTeacherView onClose={() => stopStream(liveStream.id)} />;
  }

  return (
    <div className="flex h-screen bg-brand-darkest">
      <Sidebar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto p-8 no-scrollbar bg-gradient-to-b from-brand-surface to-brand-darkest">
        {activeTab === "start-stream" ? (
          <div className="mx-auto max-w-2xl space-y-8">
             <div className="space-y-4 text-center">
                <h2 className="font-display text-5xl font-black text-white uppercase italic tracking-tight">Initiate Stream</h2>
                <p className="text-slate-400 font-medium tracking-wide">Configure your session parameters for the student collective.</p>
             </div>

             <form onSubmit={handleStartStream} className="space-y-6 rounded-[40px] bg-slate-900/40 p-10 backdrop-blur-2xl border border-white/5 shadow-2xl shadow-blue-500/10">
                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Lesson Title</label>
                    <input 
                        required
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Advanced Calculus - Week 4"
                        className="w-full rounded-2xl border border-white/5 bg-slate-800/50 p-4 font-bold text-white outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Description</label>
                    <textarea 
                        required
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What will students learn in this session?"
                        className="w-full rounded-2xl border border-white/5 bg-slate-800/50 p-4 font-medium text-slate-300 outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Thumbnail URL</label>
                    <input 
                        type="url" 
                        value={thumb}
                        onChange={(e) => setThumb(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full rounded-2xl border border-white/5 bg-slate-800/50 p-4 text-sm text-slate-400 outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                </div>

                <button 
                    disabled={loading}
                    type="submit"
                    className="flex w-full items-center justify-center space-x-3 rounded-2xl bg-brand-blue py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                        <>
                            <Video className="h-5 w-5" />
                            <span>Broadcast Live Session</span>
                        </>
                    )}
                </button>
             </form>
          </div>
        ) : (
          <div className="space-y-12">
            <header className="flex items-center justify-between pb-8 border-b border-white/5">
                <div className="space-y-1">
                    <h2 className="font-display text-4xl font-black text-white uppercase italic tracking-tighter">Academic Control</h2>
                    <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase">Welcome back, Professor {profile.displayName.split(" ")[0]}</p>
                </div>
                <button 
                  onClick={() => setActiveTab("start-stream")}
                  className="flex items-center space-x-2 rounded-xl bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:scale-105"
                >
                    <Plus className="h-4 w-4" />
                    <span>Create Session</span>
                </button>
            </header>

            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-[32px] bg-slate-900/40 p-8 border border-white/5 backdrop-blur-xl">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Total Engagement</p>
                   <p className="text-5xl font-black font-display text-white italic">1.2k</p>
                   <div className="mt-4 flex items-center space-x-2 text-blue-400 font-black text-[10px] uppercase tracking-widest">
                      <span>↑ 12% Growth</span>
                   </div>
                </div>
                <div className="rounded-[32px] bg-slate-900/40 p-8 border border-white/5 backdrop-blur-xl">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Active Sessions</p>
                   <p className="text-5xl font-black font-display text-brand-blue italic">{myStreams.filter(s => s.status === 'live').length}</p>
                   <div className="mt-4 flex items-center space-x-2 text-white/40 font-black text-[10px] uppercase tracking-widest">
                      <span>Standby Ready</span>
                   </div>
                </div>
                <div className="rounded-[32px] bg-gradient-to-br from-brand-blue to-blue-700 p-8 text-white shadow-xl shadow-blue-500/20">
                   <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-4">Total Broadcasts</p>
                   <p className="text-5xl font-black font-display italic tracking-tighter">{myStreams.length}</p>
                   <div className="mt-4 flex items-center space-x-2 text-white/70 font-black text-[10px] uppercase tracking-widest">
                      <span>Nadjah Academy 2024</span>
                   </div>
                </div>
            </section>

            <section className="space-y-6">
                <h3 className="font-display text-xl font-black text-white uppercase italic tracking-tight">Broadcasting Archive</h3>
                <div className="grid gap-4">
                    {myStreams.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center rounded-[32px] border border-white/5 bg-slate-900/20">
                            <p className="font-black text-slate-600 uppercase tracking-widest text-xs">No records found</p>
                        </div>
                    ) : (
                        myStreams.map((stream) => (
                            <motion.div 
                                key={stream.id}
                                layout
                                className="flex items-center justify-between rounded-2xl bg-slate-900/40 p-4 border border-white/5 backdrop-blur-sm hover:border-white/10 transition-all group"
                            >
                                <div className="flex items-center space-x-6">
                                    <div className="relative h-16 w-28 overflow-hidden rounded-lg border border-white/5">
                                        <img src={stream.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80"} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                        {stream.status === 'live' && (
                                            <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                                                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-brand-blue truncate max-w-[200px]">{stream.title}</h4>
                                        <div className="flex items-center space-x-4 mt-1">
                                            <span className={cn(
                                                "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                                stream.status === 'live' ? "bg-red-500/20 text-red-500" : "bg-slate-800 text-slate-500"
                                            )}>
                                                {stream.status}
                                            </span>
                                            <div className="flex items-center space-x-1 text-slate-500 text-[10px] font-bold">
                                                <Users className="h-3 w-3" />
                                                <span>{stream.viewersCount} Viewers</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {stream.status === 'live' ? (
                                        <button 
                                            onClick={() => { setLiveStream(stream); setActiveTab("live-console"); }}
                                            className="flex items-center space-x-2 rounded-lg bg-brand-blue px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-500"
                                        >
                                            <Play className="h-3 w-3 fill-current" />
                                            <span>Console</span>
                                        </button>
                                    ) : (
                                        <button className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:text-white transition-colors">
                                            <Edit3 className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => deleteStream(stream.id)}
                                        className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
