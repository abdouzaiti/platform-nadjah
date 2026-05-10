import React from "react";
import { UserProfile, StreamData } from "../types";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import { Play, Eye, Clock, Search, Bell, Menu } from "lucide-react";
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
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
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
      
      <main className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/50 relative p-4 md:p-0">
        {selectedStream ? (
           <div className="h-full">
              <StreamPlayer stream={selectedStream} profile={profile} onClose={() => setSelectedStream(null)} />
           </div>
        ) : (
          <div className="md:p-8 space-y-8 sm:space-y-12">
            {/* Top Bar */}
            <header className="flex items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="lg:hidden p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                  <div className="relative w-32 sm:w-40 md:w-96 group">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue" />
                      <input 
                          type="text" 
                          placeholder="Search..." 
                          className="w-full rounded-xl border border-slate-100 bg-white py-2 sm:py-2.5 pl-11 pr-4 text-[10px] sm:text-sm text-slate-900 outline-none focus:border-brand-blue transition-all shadow-sm"
                      />
                  </div>
                </div>
                <div className="flex items-center space-x-3 sm:space-x-6">
                    <div className="hidden sm:flex items-center gap-2 bg-brand-blue/5 px-3 py-1.5 rounded-full border border-brand-blue/10">
                      <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse"></div>
                      <span className="text-[8px] sm:text-[10px] font-black text-brand-blue uppercase tracking-widest">Live Open</span>
                    </div>
                    <button className="relative rounded-xl bg-white p-2 text-slate-400 border border-slate-100 hover:text-slate-900 transition-all hover:bg-slate-50 shadow-sm">
                        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            {heroStream ? (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative h-[300px] sm:h-[440px] w-full overflow-hidden rounded-[24px] sm:rounded-[40px] border border-slate-100 shadow-2xl shadow-blue-500/10 group cursor-pointer"
                onClick={() => setSelectedStream(heroStream)}
              >
                 <img src={heroStream.thumbnail || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80"} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                 <div className="netflix-gradient absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
                    <div className="flex items-center space-x-2 sm:space-x-4 mb-2 sm:mb-4">
                        <span className="flex items-center space-x-2 rounded px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-600 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/20">
                            <span className="block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white animate-pulse"></span>
                            <span>Live Now</span>
                        </span>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500">{heroStream.teacherName}</span>
                    </div>
                    <h2 className="font-display text-2xl sm:text-5xl font-black tracking-tight text-slate-900 mb-2 sm:mb-4 max-w-2xl uppercase italic leading-[1.1]">{heroStream.title}</h2>
                    <p className="max-w-xl text-xs sm:text-base text-slate-500 mb-4 sm:mb-8 line-clamp-2 font-medium leading-relaxed hidden xs:block">{heroStream.description}</p>
                    <div className="flex items-center space-x-4">
                        <button 
                            className="flex items-center space-x-3 rounded-xl bg-brand-blue px-5 py-3 sm:px-8 sm:py-4 text-xs sm:text-sm font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-500/20 hover:bg-blue-600 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                            <span>Join Classroom</span>
                        </button>
                    </div>
                 </div>
              </motion.section>
            ) : (
                <section className="flex h-60 sm:h-80 flex-col items-center justify-center rounded-[24px] sm:rounded-[40px] border border-slate-100 bg-white shadow-sm">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                       <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-slate-300" />
                    </div>
                    <p className="text-sm sm:text-lg font-black text-slate-400 uppercase tracking-widest">No live sessions now</p>
                    <p className="text-slate-300 text-[10px] sm:text-sm">Check the schedule for upcoming classes</p>
                </section>
            )}

            {/* Live Row */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg sm:text-xl font-black text-slate-900 uppercase italic tracking-tight">Active Classrooms</h3>
                    <button className="text-[10px] font-black text-brand-blue uppercase tracking-widest hover:underline">View All</button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {streams.map((stream, idx) => (
                        <motion.div 
                            key={stream.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => setSelectedStream(stream)}
                            className="group cursor-pointer space-y-3 sm:space-y-4"
                        >
                            <div className="relative aspect-video overflow-hidden rounded-xl sm:rounded-2xl border border-slate-100 bg-white transition-all group-hover:border-brand-blue shadow-sm group-hover:shadow-md">
                                <img src={stream.thumbnail || "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80"} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                {stream.status === 'live' ? (
                                    <div className="absolute left-2 top-2 sm:left-3 sm:top-3 flex items-center space-x-2 rounded bg-red-600 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-red-500/20">
                                        <span className="block h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-white animate-pulse"></span>
                                        <span>Live</span>
                                    </div>
                                ) : (
                                    <div className="absolute left-2 top-2 sm:left-3 sm:top-3 flex items-center space-x-2 rounded bg-brand-blue px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">
                                        <Play className="h-2 w-2 fill-current" />
                                        <span>Recorded</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-brand-blue flex items-center justify-center shadow-xl shadow-blue-500/20 transform scale-90 group-hover:scale-100 transition-transform">
                                        <Play className="h-4 w-4 sm:h-5 sm:w-5 text-white fill-white ml-0.5" />
                                    </div>
                                </div>
                                <div className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 flex items-center space-x-1.5 rounded bg-white/90 backdrop-blur-md px-1.5 py-1 text-[7px] sm:text-[8px] font-bold text-slate-900 uppercase border border-slate-100 shadow-sm">
                                    <Eye className="h-2 w-2 sm:h-3 sm:w-3 text-brand-blue" />
                                    <span>{stream.status === 'live' ? `${stream.viewersCount}` : "Past"}</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-tight group-hover:text-brand-blue truncate leading-tight mb-1">{stream.title}</h4>
                                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stream.teacherName}</p>
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
