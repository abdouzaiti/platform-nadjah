import React from "react";
import { UserProfile, TeacherCommunity, ClassRoom, RoomType, LiveSession } from "../types";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import { Plus, Video, Trash2, Edit3, Loader2, Play, Users, Menu, X, Database, MessageSquare, Megaphone, FileText, Settings, Hash, Radio } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import StreamPlayer from "../components/StreamPlayer";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface TeacherDashboardProps {
  profile: UserProfile;
}

export default function TeacherDashboard({ profile }: TeacherDashboardProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = React.useState("rooms");
  const [community, setCommunity] = React.useState<TeacherCommunity | null>(null);
  const [rooms, setRooms] = React.useState<ClassRoom[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  
  // Create Community State
  const [commName, setCommName] = React.useState("");
  const [commUsername, setCommUsername] = React.useState("");
  const [commPassword, setCommPassword] = React.useState("");
  const [commDescription, setCommDescription] = React.useState("");

  // Create Room State
  const [roomName, setRoomName] = React.useState("");
  const [roomUsername, setRoomUsername] = React.useState("");
  const [roomPassword, setRoomPassword] = React.useState("");
  const [roomType, setRoomType] = React.useState<RoomType>("live");

  // Active Session State
  const [activeRoom, setActiveRoom] = React.useState<ClassRoom | null>(null);
  const [activeSession, setActiveSession] = React.useState<LiveSession | null>(null);

  React.useEffect(() => {
    const initDashboard = async () => {
      setLoading(true);
      try {
        const { data: commData, error: commError } = await supabase
          .from("teacher_communities")
          .select("*")
          .eq("teacher_id", profile.id)
          .maybeSingle();

        if (commError) throw commError;
        setCommunity(commData as TeacherCommunity);

        if (commData) {
          const { data: roomData, error: roomError } = await supabase
            .from("class_rooms")
            .select("*")
            .eq("community_id", commData.id)
            .order("created_at", { ascending: true });

          if (roomError) throw roomError;
          setRooms(roomData as ClassRoom[]);
        }
      } catch (err) {
        console.error("Init dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();

    const commChannel = supabase.channel('community-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_communities', filter: `teacher_id=eq.${profile.id}` }, () => initDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_rooms' }, () => initDashboard())
      .subscribe();

    return () => {
      supabase.removeChannel(commChannel);
    };
  }, [profile.id]);

  const [schemaError, setSchemaError] = React.useState<string | null>(null);

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSchemaError(null);
    try {
      const { data, error } = await supabase
        .from("teacher_communities")
        .insert({
          teacher_id: profile.id,
          community_name: commName,
          community_username: commUsername,
          community_password: commPassword,
          description: commDescription
        })
        .select()
        .single();

      if (error) throw error;
      setCommunity(data as TeacherCommunity);
    } catch (err: any) {
      if (err.message?.includes('community_password')) {
        setSchemaError("ALTER TABLE public.teacher_communities ADD COLUMN community_password text;");
      } else if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
        setSchemaError("It looks like the 'teacher_communities' table does not exist. Please copy the contents of supabase_schema.sql and run it in your Supabase SQL Editor to create the necessary tables.");
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("class_rooms")
        .insert({
          community_id: community.id,
          room_name: roomName,
          room_username: roomUsername,
          room_password: roomPassword,
          room_type: roomType
        });

      if (error) throw error;
      setRoomName("");
      setRoomUsername("");
      setRoomPassword("");
      setActiveTab("rooms");
    } catch (err: any) {
      if (err.message?.includes('room_username')) {
        alert("This room username is already in use or the column doesn't exist. Please run the Quick Fix SQL from the dashboard.");
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async (room: ClassRoom) => {
    try {
      setLoading(true);
      // Check for existing session (live or waiting)
      const { data: existing, error: checkError } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("room_id", room.id)
        .in("status", ["live", "waiting"])
        .maybeSingle();
      
      if (checkError) throw checkError;

      if (existing) {
        setActiveRoom(room);
        setActiveSession(existing as LiveSession);
        return;
      }

      // Create new session
      const { data, error } = await supabase
        .from("live_sessions")
        .insert({
          room_id: room.id,
          status: "waiting",
          started_at: new Date().toISOString(),
          title: `${room.room_name} Live`
        })
        .select()
        .single();

      if (error) throw error;
      setActiveRoom(room);
      setActiveSession(data as LiveSession);
    } catch (err: any) {
      console.error("GoLive error:", err);
      alert(`Failed to start live: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room?")) return;
    try {
      const { error } = await supabase.from("class_rooms").delete().eq("id", roomId);
      if (error) throw error;
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getRoomIcon = (type: RoomType) => {
    switch (type) {
      case "live": return <Radio className="h-4 w-4" />;
      case "chat": return <MessageSquare className="h-4 w-4" />;
      case "announcements": return <Megaphone className="h-4 w-4" />;
      case "files": return <FileText className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  if (activeRoom && activeSession) {
    return (
      <StreamPlayer 
        room={activeRoom} 
        session={activeSession} 
        profile={profile} 
        isTeacherView 
        teacherId={profile.id}
        onClose={() => {
          setActiveRoom(null);
          setActiveSession(null);
        }} 
      />
    );
  }

  if (loading && !community) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
      </div>
    );
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
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-slate-50/50">
        {!community ? (
          <div className="mx-auto max-w-2xl mt-10">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden mb-6 p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all"
            >
              <Menu className="h-6 w-6" />
            </button>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 text-center"
            >
              <div className="space-y-4">
                <h2 className="text-4xl font-black font-display uppercase italic tracking-tight text-slate-900">{t('create_community', 'Create Your Community')}</h2>
                <p className="text-slate-500 font-medium tracking-wide">Build your server and start inviting students.</p>
              </div>

              <form onSubmit={handleCreateCommunity} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl shadow-blue-500/5 space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('community_name', 'Community Name')}</label>
                  <input 
                    required
                    value={commName}
                    onChange={(e) => setCommName(e.target.value)}
                    placeholder="Prof. Ahmed's Academy"
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('community_username', 'Community Username')}</label>
                  <input 
                    required
                    value={commUsername}
                    onChange={(e) => setCommUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="ahmed_academy"
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                  <p className="text-[10px] text-slate-400 italic">This will be used for students to find your server.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('community_password', 'Community Password')}</label>
                  <input 
                    required
                    type="password"
                    value={commPassword}
                    onChange={(e) => setCommPassword(e.target.value)}
                    placeholder="Enter a secure password"
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                  <p className="text-[10px] text-slate-400 italic">Students will need this password to join your community.</p>
                </div>
                {schemaError && (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2">
                    <p className="text-red-600 text-xs font-bold">Database Error:</p>
                    <p className="text-red-500 text-[10px]">Please run this in your Supabase SQL Editor to add the missing password column:</p>
                    <pre className="text-[10px] bg-white p-2 rounded border border-red-100 overflow-x-auto text-red-600 font-mono">
                      {schemaError}
                    </pre>
                  </div>
                )}
                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full py-5 bg-brand-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : t('launch_community', 'Launch Community')}
                </button>
              </form>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="lg:hidden p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                  <div className="space-y-1">
                      <h2 className="font-display text-xl sm:text-4xl font-black text-slate-900 uppercase italic tracking-tighter truncate max-w-[200px] sm:max-w-none">{community.community_name}</h2>
                      <p className="text-slate-400 font-bold tracking-widest text-[8px] sm:text-[10px] uppercase">@{community.community_username} • {rooms.length} {t('rooms', 'Rooms')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveTab("create-room")}
                    className="flex items-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/10 hover:bg-blue-600 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    {t('add_room', 'Add Room')}
                  </button>
                </div>
            </header>

            {activeTab === "create-room" ? (
              <div className="max-w-xl mx-auto py-10">
                <div className="space-y-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-blue-500/5">
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black font-display uppercase italic text-slate-900">New Room</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Create a channel for your community.</p>
                  </div>
                  <form onSubmit={handleCreateRoom} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Room Name</label>
                      <input 
                        required
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Live Class BAC"
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none focus:border-brand-blue transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Room Username (Optional)</label>
                      <input 
                        value={roomUsername}
                        onChange={(e) => setRoomUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder="live_class_bac"
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Room Password (Optional)</label>
                      <input 
                        type="password"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        placeholder="Leave blank for public room"
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {(['live', 'chat', 'announcements', 'files'] as RoomType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRoomType(type)}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                            roomType === type 
                              ? "bg-brand-blue border-brand-blue text-white shadow-lg shadow-blue-500/20" 
                              : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-white"
                          )}
                        >
                          <div className={cn("p-2 rounded-lg", roomType === type ? "bg-white/20" : "bg-white shadow-sm")}>
                            {getRoomIcon(type)}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider">{type}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setActiveTab("rooms")}
                        className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Create Room"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {rooms.map((room) => (
                  <motion.div 
                    key={room.id}
                    layout
                    className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-2 text-slate-300 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-blue/10 rounded-2xl text-brand-blue">
                          {getRoomIcon(room.room_type)}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{room.room_type}</p>
                          <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight">{room.room_name}</h4>
                          {room.room_username && <p className="text-[9px] font-bold text-brand-blue/70">@{room.room_username}</p>}
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                        <div className="flex items-center gap-2">
                           <Users className="h-3 w-3 text-slate-400" />
                           <span className="text-[10px] font-bold text-slate-400">Manage Room</span>
                        </div>
                        
                        <button 
                          onClick={() => handleGoLive(room)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md transition-all",
                            room.room_type === 'live' 
                              ? "bg-brand-blue text-white shadow-blue-500/10 hover:bg-blue-600"
                              : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          )}
                        >
                          {room.room_type === 'live' ? t('go_live', 'Go Live') : t('open', 'Open')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {rooms.length === 0 && (
                  <div className="col-span-full py-20 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center shadow-lg text-slate-200">
                      <Hash className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">No rooms yet</p>
                      <p className="text-[10px] font-medium text-slate-400">Create your first room to start interacting.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab("create-room")}
                      className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                    >
                      New Room
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
