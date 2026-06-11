import React from "react";
import { UserProfile, TeacherCommunity, ClassRoom, RoomType, LiveSession } from "../types";
import Sidebar from "../components/Sidebar";
import SettingsView from "../components/SettingsView";
import { supabase } from "../lib/supabase";
import { Play, Eye, Clock, Search, Bell, Menu, Users, Hash, Plus, Loader2, ArrowRight, BookOpen, MessageSquare, PlayCircle } from "lucide-react";
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
  const [mobileSubFilter, setMobileSubFilter] = React.useState<'chat' | 'announcements' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Search communities
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<TeacherCommunity[]>([]);
  
  // Joined rooms
  const [joinedRooms, setJoinedRooms] = React.useState<(ClassRoom & { community: TeacherCommunity, teacherProfile?: any })[]>([]);
  
  // Active Community
  const [selectedCommunity, setSelectedCommunity] = React.useState<TeacherCommunity | null>(null);
  const [communityRooms, setCommunityRooms] = React.useState<ClassRoom[]>([]);

  // Active Session State
  const [activeRoom, setActiveRoom] = React.useState<ClassRoom | null>(null);
  const [activeSession, setActiveSession] = React.useState<LiveSession | null>(null);

  // Password Modal
  const [passwordModal, setPasswordModal] = React.useState<{ isOpen: boolean, community: TeacherCommunity | null, action: 'view' | 'join', room: ClassRoom | null }>({
    isOpen: false,
    community: null,
    action: 'view',
    room: null
  });
  const [enteredPassword, setEnteredPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");

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
      
      const teacherIds = Array.from(new Set(rooms.map(r => r.community?.teacher_id).filter(Boolean)));
      let teachersMap: Record<string, any> = {};
      
      if (teacherIds.length > 0) {
        const { data: teachersData, error: teachersError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", teacherIds);
        
        if (!teachersError && teachersData) {
          teachersData.forEach((t: any) => {
            teachersMap[t.id] = t;
          });
        }
      }
      
      const roomsWithTeachers = rooms.map((r: any) => ({
        ...r,
        teacherProfile: r.community ? teachersMap[r.community.teacher_id] : null
      }));
      
      setJoinedRooms(roomsWithTeachers);
    } catch (err) {
      console.error("Fetch joined rooms error:", err);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'discover' && searchResults.length === 0 && !searchQuery) {
      const fetchTopCommunities = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from("teacher_communities")
            .select("*")
            .limit(20)
            .order('created_at', { ascending: false });
          if (error) throw error;
          setSearchResults(data as TeacherCommunity[]);
        } catch (error) {
          console.error("Top communities error:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchTopCommunities();
    }
  }, [activeTab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let query = supabase.from("teacher_communities").select("*");
      if (searchQuery.trim()) {
        query = query.or(`community_username.ilike.%${searchQuery}%,community_name.ilike.%${searchQuery}%`);
      } else {
        query = query.limit(20).order('created_at', { ascending: false });
      }
      const { data, error } = await query;
      
      if (error) throw error;
      setSearchResults(data as TeacherCommunity[]);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const viewCommunity = async (comm: TeacherCommunity) => {
    if (comm.community_password) {
      setPasswordModal({ isOpen: true, community: comm, action: 'view', room: null });
      return;
    }
    proceedViewCommunity(comm);
  };

  const proceedViewCommunity = async (comm: TeacherCommunity) => {
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
    if (selectedCommunity?.community_password || room.room_password) {
      setPasswordModal({ isOpen: true, community: selectedCommunity, action: 'join', room: room });
      return;
    }
    proceedJoinRoom(room);
  };

  const proceedJoinRoom = async (room: ClassRoom) => {
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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { action, community, room } = passwordModal;
    
    let expectedPassword = "";
    if (action === 'view') {
      expectedPassword = community?.community_password || "";
    } else if (action === 'join') {
      expectedPassword = room?.room_password || community?.community_password || "";
    }

    if (enteredPassword !== expectedPassword) {
      setPasswordError("Incorrect password");
      return;
    }
    setPasswordError("");
    setPasswordModal({ isOpen: false, community: null, action: 'view', room: null });
    setEnteredPassword("");
    
    if (action === 'view' && community) {
      proceedViewCommunity(community);
    } else if (action === 'join' && room) {
      proceedJoinRoom(room);
    }
  };

  const handleEnterRoom = async (room: ClassRoom) => {
    try {
      setLoading(true);
      // Fetch current session for this room (live or scheduled)
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("room_id", room.id)
        .in("status", ["live", "scheduled"])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      setActiveRoom(room);
      setActiveSession(data as LiveSession || null);
    } catch (err: any) {
      alert(err.message || "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  if (activeRoom) {
    return (
      <StreamPlayer 
        room={activeRoom} 
        session={activeSession} 
        profile={profile} 
        teacherId={joinedRooms.find(r => r.id === activeRoom.id)?.community?.teacher_id}
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
      
      <main className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/50 relative p-4 md:p-8 shrink-0 pb-28 md:pb-8">
        {/* Mobile Header (Menu toggler & Simple title) */}
        <div className="flex items-center justify-between pb-4 md:hidden">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all"
          >
            <Menu className="h-6 w-6" />
          </button>
          {activeTab !== 'joined' && (
            <h2 className="font-display text-sm font-black text-slate-900 uppercase italic tracking-tighter">
              {activeTab === 'discover' ? t('discover', "Discover Communities") : selectedCommunity?.community_name}
            </h2>
          )}
        </div>

        {/* Top Header */}
        <header className="hidden md:flex items-center justify-between gap-6 pb-8 border-b border-slate-100 mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="space-y-1">
                  <h2 className="font-display text-lg sm:text-2xl font-black text-slate-900 uppercase italic tracking-tighter truncate max-w-[150px] sm:max-w-none">
                    {activeTab === 'joined' ? t('joined', "My Classrooms") : (activeTab === 'discover' ? t('discover', "Discover Communities") : selectedCommunity?.community_name)}
                  </h2>
                  <p className="text-slate-400 font-bold tracking-widest text-[8px] sm:text-[10px] uppercase">
                    {t('welcome_back', 'Welcome back, {{name}}', { name: profile.fullname.split(" ")[0] })}
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

        {activeTab === "settings" ? (
          <SettingsView profile={profile} />
        ) : activeTab === "discover" ? (
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
                  <p className="text-xs text-slate-500 mb-6 line-clamp-2 leading-relaxed">{comm.description || t('no_description', "No description provided.")}</p>
                  <button 
                    onClick={() => viewCommunity(comm)}
                    className="w-full py-3 bg-slate-50 text-brand-blue font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-brand-blue hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    {t('view_server', 'View Server')} <ArrowRight className={cn("h-3 w-3", i18n.language === 'ar' ? "rotate-180" : "")} />
                  </button>
                </motion.div>
              ))}
              
              {searchResults.length === 0 && !loading && searchQuery && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="h-20 w-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-300">
                    <Search className="h-10 w-10" />
                  </div>
                  <p className="font-black text-slate-400 uppercase tracking-widest">{t('no_communities_found', 'No communities found')}</p>
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
                          {room.room_username && <p className="text-[9px] font-bold text-brand-blue/70">@{room.room_username}</p>}
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
                        {isJoined ? t('member', 'Member') : t('join_room', 'Join Class')}
                      </button>
                    </div>
                 );
               })}
             </div>
           </div>
         ) : (
          <>
{/* Desktop Layout */}
            <div className="hidden md:grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                      <span className="text-[10px] font-black uppercase text-slate-400">{room.room_type === 'live' ? "Live" : "Class"}</span>
                    </div>
                    <button className="bg-brand-blue text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-500/10">
                      {t('enter', 'Enter')}
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
                    <h3 className="text-xl font-black font-display uppercase italic text-slate-900">{t('classroom_empty', 'Your Classroom is Empty')}</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">{t('classroom_empty_hint', 'Discover teacher communities and join classes to start learning.')}</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("discover")}
                    className="px-8 py-4 bg-brand-blue text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20"
                  >
                    {t('explore_communities', 'Explore Communities')}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Layout (Exact mockup matching layout) */}
            <div className="block md:hidden space-y-6">
              {/* Greeting */}
              <div className="space-y-1 text-right rtl:text-right px-1">
                <p className="text-slate-400 text-sm font-medium">مرحباً،</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">{profile.fullname}</h1>
              </div>

              {/* My communities section */}
              <div className="space-y-4 pt-2 text-right rtl:text-right">
                <div className="flex items-center justify-between px-1">
                  <button onClick={() => setActiveTab("discover")} className="text-xs font-extrabold text-blue-500 hover:underline">{t('all', 'الكل')}</button>
                  <h3 className="text-lg font-bold text-slate-800">{t('my_classes_title', 'مجتمعاتي')}</h3>
                </div>

                <div className="space-y-3">
                  {/* Filter classes based on active subfilter */}
                  {joinedRooms
                    .filter(room => !mobileSubFilter || room.room_type === mobileSubFilter)
                    .map((room, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <motion.div 
                          key={room.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleEnterRoom(room)}
                          className="bg-white p-4 rounded-[24px] border border-slate-100/60 shadow-sm flex items-center justify-between cursor-pointer transition-all hover:bg-slate-50/50"
                        >
                          {/* Left: dot indicator */}
                          <div className="flex items-center">
                            {room.room_type === 'live' ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            ) : (
                              <div className={cn("w-2.5 h-2.5 rounded-full", isEven ? "bg-blue-500" : "bg-emerald-500")} />
                            )}
                          </div>

                          {/* Right: details and book icon */}
                          <div className="flex items-center gap-3">
                            <div className="text-right flex flex-col items-end">
                              <h4 className="text-sm font-bold text-slate-800 leading-none">{room.room_name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 mt-1.5">{room.community.community_name}</p>
                            </div>
                            
                            {/* Circle BookIcon */}
                            <div className={cn(
                              "h-11 w-11 rounded-full flex items-center justify-center border",
                              isEven 
                                ? "bg-blue-50/75 border-blue-100/50 text-blue-500" 
                                : "bg-emerald-50/75 border-emerald-100/50 text-emerald-500"
                            )}>
                              <BookOpen className="h-4.5 w-4.5" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                  {joinedRooms.filter(room => !mobileSubFilter || room.room_type === mobileSubFilter).length === 0 && (
                    <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-full">
                         {mobileSubFilter === 'chat' ? t('no_chats_yet', "لا توجد دردشات بعد") : (mobileSubFilter === 'announcements' ? t('no_announcements_yet', "لا توجد إعلانات بعد") : t('no_joined_classes_yet', "لا توجد صفوف انضممت إليها بعد"))}
                       </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming live section */}
              {!mobileSubFilter && (
                <div className="space-y-4 pt-2 text-right rtl:text-right">
                  <div className="px-1 text-right rtl:text-right">
                    <h3 className="text-lg font-bold text-slate-850">{t('upcoming_lives')}</h3>
                  </div>

                  <div className="space-y-3">
                    {joinedRooms.filter(r => r.room_type === 'live').map((room) => (
                      <motion.div
                        key={room.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleEnterRoom(room)}
                        className="bg-white rounded-[24px] border border-orange-100/50 shadow-sm relative overflow-hidden flex items-center justify-between p-4 cursor-pointer"
                        style={{ borderLeftWidth: i18n.language === 'ar' ? '1px' : '4px', borderLeftColor: i18n.language === 'ar' ? undefined : '#f43f5e', borderRightWidth: i18n.language === 'ar' ? '4px' : '1px', borderRightColor: i18n.language === 'ar' ? '#f43f5e' : undefined }}
                      >
                        <div className="flex flex-col gap-1 items-start text-left rtl:text-right">
                          <div className="inline-flex items-center gap-1 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold text-red-500 tracking-wider">
                            LIVE <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          </div>
                          <h4 className="text-base font-extrabold text-slate-800 leading-tight mt-1">{room.room_name}</h4>
                          <p className="text-[10px] font-bold text-slate-400">{t('today_at_18')}</p>
                        </div>

                        <div className="relative">
                          <img 
                            src={room.teacherProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(room.community.community_name)}&background=3b82f6&color=fff`} 
                            alt="Teacher" 
                            className="h-14 w-14 rounded-full border-2 border-white shadow-md object-cover" 
                          />
                        </div>
                      </motion.div>
                    ))}
                    
                    {joinedRooms.filter(r => r.room_type === 'live').length === 0 && (
                      <motion.div
                        whileTap={{ scale: 0.98 }}
                        className="bg-white rounded-[24px] border border-orange-100/50 shadow-sm relative overflow-hidden flex items-center justify-between p-4 cursor-pointer"
                        style={{ borderLeftWidth: i18n.language === 'ar' ? '1px' : '4px', borderLeftColor: i18n.language === 'ar' ? undefined : '#f43f5e', borderRightWidth: i18n.language === 'ar' ? '4px' : '1px', borderRightColor: i18n.language === 'ar' ? '#f43f5e' : undefined }}
                      >
                        <div className="flex flex-col gap-1 items-start text-left rtl:text-right">
                          <div className="inline-flex items-center gap-1 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold text-red-500 tracking-wider">
                            LIVE <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          </div>
                          <h4 className="text-base font-extrabold text-slate-800 leading-tight mt-1">{t('math_demo')}</h4>
                          <p className="text-[10px] font-bold text-slate-400">{t('today_at_18')}</p>
                        </div>

                        <div className="relative">
                          <img 
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" 
                            alt="Teacher" 
                            className="h-14 w-14 rounded-full border-2 border-white shadow-md object-cover" 
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Password Modal */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-display text-2xl font-black uppercase italic text-slate-900">{t('enter_password', 'Enter Password')}</h3>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                {passwordModal.action === 'join' && passwordModal.room ? passwordModal.room.room_name : passwordModal.community?.community_name}
              </p>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <input 
                  autoFocus
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder={t('password', 'Password')}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl font-mono text-sm outline-none focus:border-brand-blue transition-all text-center"
                />
                {passwordError && <p className="text-xs text-red-500 font-bold text-center">{passwordError}</p>}
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setPasswordModal({ isOpen: false, community: null, action: 'view', room: null });
                    setEnteredPassword("");
                    setPasswordError("");
                  }}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-brand-blue text-white rounded-xl shadow-lg shadow-blue-500/10 hover:bg-blue-600 transition-all"
                >
                  {t('submit', 'Submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
