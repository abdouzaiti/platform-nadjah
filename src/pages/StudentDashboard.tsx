import React from "react";
import { UserProfile, StreamData } from "../types";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import { Play, Eye, Clock, Search, Bell } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import StreamPlayer from "../components/StreamPlayer";

interface StudentDashboardProps {
  profile: UserProfile;
}

export default function StudentDashboard({ profile }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = React.useState("browse");
  const [streams, setStreams] = React.useState<StreamData[]>([]);
  const [selectedStream, setSelectedStream] = React.useState<StreamData | null>(null);

  React.useEffect(() => {
    const fetchStreams = async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("*")
        .eq("status", "live")
        .order("createdAt", { ascending: false });
      
      if (!error && data) {
        setStreams(data as StreamData[]);
      }
    };

    fetchStreams();

    const channel = supabase
      .channel('live-streams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: 'status=eq.live'
        },
        () => {
          fetchStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const heroStream = streams[0];

  return (
    <div className="flex h-screen overflow-hidden bg-brand-darkest">
      <Sidebar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto no-scrollbar bg-gradient-to-b from-brand-surface to-brand-darkest">
        {selectedStream ? (
           <div className="h-full">
              <StreamPlayer stream={selectedStream} profile={profile} onClose={() => setSelectedStream(null)} />
           </div>
        ) : (
          <div className="p-8 space-y-12">
            {/* Top Bar */}
            <header className="flex items-center justify-between pb-6 border-b border-white/5">
                <div className="relative w-96 group">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-blue" />
                    <input 
                        type="text" 
                        placeholder="Search for lessons, teachers..." 
                        className="w-full rounded-xl border border-white/5 bg-slate-900/50 py-2.5 pl-11 pr-4 text-sm text-white outline-none focus:ring-1 focus:ring-brand-blue transition-all"
                    />
                </div>
                <div className="flex items-center space-x-6">
                    <div className="hidden lg:flex items-center gap-2 bg-blue-600/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Live Enrollment Open</span>
                    </div>
                    <button className="relative rounded-xl bg-slate-900/50 p-2 text-slate-400 border border-white/5 hover:text-white transition-all hover:bg-slate-800">
                        <Bell className="h-5 w-5" />
                        <span className="absolute right-2.5 top-2.5 flex h-2 w-2 rounded-full bg-blue-500 ring-2 ring-slate-900"></span>
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            {heroStream ? (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative h-[440px] w-full overflow-hidden rounded-[40px] border border-white/10 shadow-2xl shadow-blue-500/10 group cursor-pointer"
                onClick={() => setSelectedStream(heroStream)}
              >
                 <img src={heroStream.thumbnail || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80"} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                 <div className="netflix-gradient absolute inset-0 flex flex-col justify-end p-12">
                    <div className="flex items-center space-x-4 mb-4">
                        <span className="flex items-center space-x-2 rounded px-2.5 py-1 bg-red-600 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                            <span className="block h-2 w-2 rounded-full bg-white animate-pulse"></span>
                            <span>Live Now</span>
                        </span>
                        <div className="h-4 w-px bg-white/20"></div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-300">{heroStream.teacherName}</span>
                    </div>
                    <h2 className="font-display text-5xl font-black tracking-tight text-white mb-4 max-w-2xl uppercase italic leading-[1.1]">{heroStream.title}</h2>
                    <p className="max-w-xl text-base text-slate-300/80 mb-8 line-clamp-2 font-medium leading-relaxed">{heroStream.description}</p>
                    <div className="flex items-center space-x-4">
                        <button 
                            className="flex items-center space-x-3 rounded-xl bg-brand-blue px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-blue-500 hover:scale-105 shadow-xl shadow-blue-500/20"
                        >
                            <Play className="h-5 w-5 fill-current" />
                            <span>Join Classroom</span>
                        </button>
                    </div>
                 </div>
              </motion.section>
            ) : (
                <section className="flex h-80 flex-col items-center justify-center rounded-[40px] border border-white/5 bg-slate-900/30">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                      <Clock className="h-8 w-8 text-slate-600" />
                    </div>
                    <p className="text-lg font-black text-slate-500 uppercase tracking-widest">No live sessions now</p>
                    <p className="text-slate-600 text-sm">Check the schedule for upcoming classes</p>
                </section>
            )}

            {/* Live Row */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-black text-white uppercase italic tracking-tight">Active Classrooms</h3>
                    <button className="text-xs font-black text-brand-blue uppercase tracking-widest hover:underline">View All</button>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {streams.map((stream, idx) => (
                        <motion.div 
                            key={stream.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => setSelectedStream(stream)}
                            className="group cursor-pointer space-y-4"
                        >
                            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/5 transition-all group-hover:border-brand-blue shadow-lg group-hover:shadow-blue-500/10">
                                <img src={stream.thumbnail || "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80"} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                {stream.status === 'live' ? (
                                    <div className="absolute left-3 top-3 flex items-center space-x-2 rounded bg-red-600 px-2 py-0.5 text-[8px] font-black text-white uppercase tracking-[0.2em]">
                                        <span className="block h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                                        <span>Live</span>
                                    </div>
                                ) : (
                                    <div className="absolute left-3 top-3 flex items-center space-x-2 rounded bg-blue-600 px-2 py-0.5 text-[8px] font-black text-white uppercase tracking-[0.2em]">
                                        <Play className="h-2 w-2 fill-current" />
                                        <span>Recorded</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Play className="h-10 w-10 text-white fill-white" />
                                </div>
                                <div className="absolute right-3 bottom-3 flex items-center space-x-2 rounded bg-black/50 backdrop-blur-md px-2 py-1 text-[8px] font-bold text-white uppercase">
                                    <Eye className="h-3 w-3 text-blue-400" />
                                    <span>{stream.status === 'live' ? `${stream.viewersCount} Viewers` : "Past Session"}</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-black text-sm text-white uppercase tracking-tight group-hover:text-brand-blue truncate leading-tight mb-1">{stream.title}</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stream.teacherName}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
