import React from "react";
import { UserProfile, StreamData } from "../types";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import { Plus, Video, Trash2, Edit3, Loader2, Play, Users, Menu, X, Database } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import StreamPlayer from "../components/StreamPlayer";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface TeacherDashboardProps {
  profile: UserProfile;
}

export default function TeacherDashboard({ profile }: TeacherDashboardProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = React.useState("browse");
  const [myStreams, setMyStreams] = React.useState<StreamData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [liveStream, setLiveStream] = React.useState<StreamData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

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
    if (!confirm("Are you sure you want to permanently delete this session? This will also remove all chat records.")) return;
    
    setLoading(true);
    try {
      // Manual Cascade: Delete dependencies first so user doesn't have to touch SQL
      await supabase.from('chat_messages').delete().eq('streamId', streamId);
      
      const { error } = await supabase
        .from("streams")
        .delete()
        .eq("id", streamId);
        
      if (error) throw error;
      setMyStreams(prev => prev.filter(s => s.id !== streamId));
    } catch (err: any) {
      console.error("Delete stream error:", err);
      alert(err.message || "Failed to delete session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (activeTab === "live-console" && liveStream) {
    return <StreamPlayer stream={liveStream} profile={profile} isTeacherView onClose={() => stopStream(liveStream.id)} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar 
        profile={profile} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
        }} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-slate-50/50 relative">
        {/* Mobile Navbar */}
        <div className="lg:hidden flex items-center justify-between mb-6 glass-panel p-3 rounded-2xl shadow-sm">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded bg-brand-blue flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Plus className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
        {activeTab === "start-stream" ? (
          <div className="mx-auto max-w-2xl space-y-8">
             <div className="space-y-4 text-center">
                <h2 className="font-display text-5xl font-black text-slate-900 uppercase italic tracking-tight">{t('initiate_stream')}</h2>
                <p className="text-slate-500 font-medium tracking-wide">Configure your session parameters for the student collective.</p>
             </div>

             <form onSubmit={handleStartStream} className="space-y-6 rounded-[24px] sm:rounded-[40px] bg-white p-6 sm:p-10 border border-slate-100 shadow-2xl shadow-blue-500/5">
                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 font-display">{t('lesson_title')}</label>
                    <input 
                        required
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Advanced Calculus"
                        className="w-full rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-4 font-bold text-slate-900 outline-none focus:border-brand-blue transition-colors shadow-sm"
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 font-display">{t('description')}</label>
                    <textarea 
                        required
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Lesson topics..."
                        className="w-full rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-4 font-medium text-slate-600 outline-none focus:border-brand-blue transition-colors shadow-sm"
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 font-display">{t('thumbnail_url')}</label>
                    <input 
                        type="url" 
                        value={thumb}
                        onChange={(e) => setThumb(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400 outline-none focus:border-brand-blue transition-colors shadow-sm"
                    />
                </div>

                <button 
                    disabled={loading}
                    type="submit"
                    className="flex w-full items-center justify-center space-x-3 rtl:space-x-reverse rounded-xl sm:rounded-2xl bg-brand-blue py-4 sm:py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-600 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                        <>
                            <Video className="h-5 w-5" />
                            <span>{t('start_streaming')}</span>
                        </>
                    )}
                </button>
             </form>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-12">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-slate-100">
                <div className="space-y-1">
                    <h2 className="font-display text-2xl sm:text-4xl font-black text-slate-900 uppercase italic tracking-tighter">{t('academic_control')}</h2>
                    <p className="text-slate-400 font-bold tracking-widest text-[8px] sm:text-[10px] uppercase">{t('welcome_professor')} {profile.displayName.split(" ")[0]}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 rtl:space-x-reverse">
                  <button 
                    onClick={() => setActiveTab("start-stream")}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 rounded-xl bg-brand-blue px-4 sm:px-6 py-3 text-[9px] sm:text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/10 hover:bg-blue-600 transition-all"
                  >
                      <Plus className="h-4 w-4" />
                      <span>{i18n.language === 'ar' ? 'إنشاء' : 'Create'}</span>
                  </button>
                </div>
            </header>

            <section className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-[24px] sm:rounded-[32px] bg-white p-6 sm:p-8 border border-slate-100 shadow-sm">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{t('engagement')}</p>
                   <p className="text-4xl sm:text-5xl font-black font-display text-slate-900 italic">1.2k</p>
                </div>
                <div className="rounded-[24px] sm:rounded-[32px] bg-white p-6 sm:p-8 border border-slate-100 shadow-sm">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{t('active')}</p>
                   <p className="text-4xl sm:text-5xl font-black font-display text-brand-blue italic">{myStreams.filter(s => s.status === 'live').length}</p>
                </div>
                <div className="rounded-[24px] sm:rounded-[32px] bg-gradient-to-br from-brand-blue to-blue-700 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10">
                   <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-4">{t('broadcasts')}</p>
                   <p className="text-4xl sm:text-5xl font-black font-display italic tracking-tighter">{myStreams.length}</p>
                </div>
            </section>

            <section className="space-y-6">
                <h3 className="font-display text-xl font-black text-slate-900 uppercase italic tracking-tight">{t('academic_archive')}</h3>
                <div className="grid gap-3 sm:gap-4 text-left">
                    {myStreams.length === 0 ? (
                        <div className="flex h-32 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm">
                            <p className="font-black text-slate-300 uppercase tracking-widest text-[10px]">{t('no_records')}</p>
                        </div>
                    ) : (
                        myStreams.map((stream) => (
                            <motion.div 
                                key={stream.id}
                                layout
                                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all gap-4 group"
                            >
                                <div className="flex items-center space-x-4 sm:space-x-6 rtl:space-x-reverse">
                                    <div className="relative h-12 w-20 sm:h-16 sm:w-28 overflow-hidden rounded-lg border border-slate-100 shrink-0">
                                        <img src={stream.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80"} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                        {stream.status === 'live' && (
                                            <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-brand-blue truncate">{stream.title}</h4>
                                        <div className="flex items-center space-x-3 mt-1 rtl:space-x-reverse">
                                            <span className={cn(
                                                "text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                                stream.status === 'live' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
                                            )}>
                                                {stream.status === 'live' ? t('live_now') : t('offline')}
                                            </span>
                                            <span className="text-slate-400 text-[8px] sm:text-[10px] font-bold uppercase">{stream.viewersCount} {t('viewers')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end space-x-2 rtl:space-x-reverse">
                                    {stream.status === 'live' ? (
                                        <button 
                                            onClick={() => { setLiveStream(stream); setActiveTab("live-console"); }}
                                            className="flex items-center space-x-2 rtl:space-x-reverse rounded-lg bg-brand-blue px-4 py-2 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600 shadow-md shadow-blue-500/10"
                                        >
                                            <Play className="h-3 w-3 fill-current" />
                                            <span>{t('console')}</span>
                                        </button>
                                    ) : (
                                        <button className="rounded-lg bg-slate-50 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                                            <Edit3 className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => deleteStream(stream.id)}
                                        className="rounded-lg bg-slate-50 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
