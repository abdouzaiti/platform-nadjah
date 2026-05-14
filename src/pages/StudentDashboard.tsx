import React from "react";
import { UserProfile, TeacherCommunity, ClassRoom, RoomType, LiveSession } from "../types";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import { Play, Eye, Clock, Search, Bell, Menu, Users, Hash, Plus, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import StreamPlayer from "../components/StreamPlayer";
import { useTranslation } from "react-i18next";

interface StudentDashboardProps {
  profile: UserProfile;
}

export default function StudentDashboard({ profile }: StudentDashboardProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = React.useState("joined");
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Search communities
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<TeacherCommunity[]>([]);
  
  // Joined rooms
  const [joinedRooms, setJoinedRooms] = React.useState<(ClassRoom & { community: TeacherCommunity })[]>([]);
  
  // Active Community
  const [selectedCommunity, setSelectedCommunity] = React.useState<TeacherCommunity | null>(null);
  const [communityRooms, setCommunityRooms] = React.useState<ClassRoom[]>([]);

  // Active Session State
  const [activeRoom, setActiveRoom] = React.useState<ClassRoom | null>(null);
  const [activeSession, setActiveSession] = React.useState<LiveSession | null>(null);

  React.useEffect(() => {
    fetchJoinedRooms();
  }, [profile.id]);

  const fetchJoinedRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("room_members")
        .select(`
          room_id,
          class_rooms (
            *,
            teacher_communities (*)
          )
        `)
        .eq("user_id", profile.id);

      if (error) throw error;
      
      const rooms = data.map((item: any) => ({
        ...item.class_rooms,
        community: item.class_rooms.teacher_communities
      }));
      
      setJoinedRooms(rooms);
    } catch (err) {
      console.error("Fetch joined rooms error:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("teacher_communities")
        .select("*")
        .ilike("community_username", `%${searchQuery}%`);
      
      if (error) throw error;
      setSearchResults(data as TeacherCommunity[]);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const viewCommunity = async (comm: TeacherCommunity) => {
    setSelectedCommunity(comm);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("class_rooms")
        .select("*")
        .eq("community_id", comm.id);
      
      if (error) throw error;
      setCommunityRooms(data as ClassRoom[]);
      setActiveTab("community-view");
    } catch (err) {
      console.error("Fetch community rooms error:", err);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (room: ClassRoom) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("room_members")
        .insert({
          room_id: room.id,
          user_id: profile.id
        });
      
      if (error) throw error;
      alert("Joined successfully!");
      fetchJoinedRooms();
    } catch (err: any) {
      alert(err.message || "Failed to join");
    } finally {
      setLoading(false);
    }
  };

  const handleEnterRoom = async (room: ClassRoom) => {
    try {
      setLoading(true);
      // Fetch current live session for this room
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("room_id", room.id)
        .eq("status", "live")
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        alert("No live session active for this room yet.");
        return;
      }

      setActiveRoom(room);
      setActiveSession(data as LiveSession);
    } catch (err: any) {
      alert(err.message || "Failed to join session");
    } finally {
      setLoading(false);
    }
  };

  if (activeRoom && activeSession) {
    return (
      <StreamPlayer 
        room={activeRoom} 
        session={activeSession} 
        profile={profile} 
        onClose={() => {
          setActiveRoom(null);
          setActiveSession(null);
        }} 
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar 
        profile={profile} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
          if (tab !== "community-view") setSelectedCommunity(null);
        }} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/50 relative p-4 md:p-8">
        {/* Top Header */}
        <header className="flex items-center justify-between gap-6 pb-8 border-b border-slate-100 mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="space-y-1">
                  <h2 className="font-display text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                    {activeTab === 'joined' ? t('joined', "My Classrooms") : (activeTab === 'discover' ? t('discover', "Discover Communities") : selectedCommunity?.community_name)}
                  </h2>
                  <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase">
                    Welcome back, {profile.fullname.split(" ")[0]}
                  </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-slate-100 p-1">
                 <button 
                   onClick={() => setActiveTab("joined")}
                   className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'joined' ? "bg-brand-blue text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-slate-600")}
                 >
                   {t('joined', 'Joined')}
                 </button>
                 <button 
                   onClick={() => setActiveTab("discover")}
                   className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'discover' ? "bg-brand-blue text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-slate-600")}
                 >
                   {t('discover', 'Discover')}
                 </button>
               </div>
            </div>
        </header>

        {activeTab === "discover" ? (
          <div className="space-y-8">
            <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-4">
              <div className="relative flex-1 group">
                <Search className={`absolute ${i18n.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue`} />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search_community', 'Search by community username...')}
                  className={cn("w-full bg-white border border-slate-200 rounded-2xl py-4 pr-4 text-sm font-bold shadow-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left')}
                />
              </div>
              <button 
                type="submit"
                className="bg-brand-blue text-white px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all"
              >
                {t('search', 'Search')}
              </button>
            </form>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 pt-6">
              {searchResults.map((comm) => (
                <motion.div 
                  key={comm.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-gradient-to-br from-brand-blue to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/10">
                      {comm.community_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black uppercase text-slate-900 leading-none mb-1">{comm.community_name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">@{comm.community_username}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-6 line-clamp-2 leading-relaxed">{comm.description || "No description provided."}</p>
                  <button 
                    onClick={() => viewCommunity(comm)}
                    className="w-full py-3 bg-slate-50 text-brand-blue font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-brand-blue hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    View Server <ArrowRight className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
              
              {searchResults.length === 0 && !loading && searchQuery && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="h-20 w-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-300">
                    <Search className="h-10 w-10" />
                  </div>
                  <p className="font-black text-slate-400 uppercase tracking-widest">No communities found</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "community-view" && selectedCommunity ? (
           <div className="space-y-8">
             <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
               {communityRooms.map((room) => {
                 const isJoined = joinedRooms.some(jr => jr.id === room.id);
                 return (
                    <div key={room.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-slate-50 rounded-xl text-slate-400">
                          {room.room_type === 'live' ? <Clock className="h-4 w-4 text-red-500" /> : <Hash className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">{room.room_type}</p>
                          <h4 className="text-sm font-black uppercase text-slate-900">{room.room_name}</h4>
                        </div>
                      </div>
                      
                      <button 
                        disabled={isJoined || loading}
                        onClick={() => joinRoom(room)}
                        className={cn(
                          "w-full py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all",
                          isJoined 
                            ? "bg-emerald-50 text-emerald-600 cursor-default" 
                            : "bg-brand-blue text-white hover:bg-blue-600 shadow-lg shadow-blue-500/10"
                        )}
                      >
                        {isJoined ? t('member', 'Member') : t('join_room', 'Join Room')}
                      </button>
                    </div>
                 );
               })}
             </div>
           </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {joinedRooms.map((room) => (
              <motion.div 
                key={room.id}
                layout
                onClick={() => handleEnterRoom(room)}
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">
                    {room.community.community_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase text-slate-900 leading-none mb-1">{room.room_name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{room.community.community_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", room.room_type === 'live' ? "bg-red-500 animate-pulse" : "bg-slate-300")}></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">{room.room_type === 'live' ? "Live" : "Room"}</span>
                  </div>
                  <button className="bg-brand-blue text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-500/10">
                    Enter
                  </button>
                </div>
              </motion.div>
            ))}

            {joinedRooms.length === 0 && (
              <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-6 text-center">
                <div className="h-24 w-24 bg-white rounded-[40px] flex items-center justify-center shadow-xl border border-slate-100 text-slate-200">
                  <Users className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black font-display uppercase italic text-slate-900">Your Classroom is Empty</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">Discover teacher communities and join rooms to start learning.</p>
                </div>
                <button 
                  onClick={() => setActiveTab("discover")}
                  className="px-8 py-4 bg-brand-blue text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20"
                >
                  Explore Communities
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
