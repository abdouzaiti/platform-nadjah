import React from "react";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types";
import { 
  Home, 
  Tv2, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  PlayCircle,
  PlusCircle,
  School
} from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  profile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ profile, activeTab, setActiveTab, isOpen = false, onClose }: SidebarProps) {
  const isTeacher = profile.role === "teacher";

  const menuItems = [
    { id: "browse", icon: Home, label: "Browse" },
    { id: "live", icon: PlayCircle, label: "Live Now" },
    ...(isTeacher ? [{ id: "mystreams", icon: Tv2, label: "My Streams" }] : []),
    { id: "classes", icon: School, label: "Classes" },
    { id: "community", icon: Users, label: "Community" },
    { id: "messages", icon: MessageSquare, label: "Messages" },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col glass-sidebar transition-all duration-300 transform lg:translate-x-0 lg:static lg:inset-auto lg:h-screen lg:w-60",
        isOpen ? "translate-x-0 shadow-2xl shadow-blue-500/10" : "-translate-x-full"
      )}>
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-blue shadow-lg shadow-blue-500/10 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase text-slate-900">Nadjah <span className="text-brand-blue">Live</span></span>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="lg:hidden h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 active:scale-95"
          >
            <PlusCircle className="h-5 w-5 rotate-45" />
          </button>
        </div>

      <div className="flex-1 space-y-8 p-4 overflow-y-auto no-scrollbar">
        <div>
          <p className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Navigation</p>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all",
                  activeTab === item.id 
                    ? "bg-brand-blue text-white shadow-md shadow-blue-500/20" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {isTeacher && (
           <div className="p-4 bg-gradient-to-br from-brand-blue to-blue-700 rounded-xl shadow-lg shadow-blue-500/10">
              <p className="text-xs font-black uppercase text-white mb-1">Teacher Mode</p>
              <p className="text-[10px] text-white/70 mb-4 font-medium">Manage your live broadcasts</p>
              <button 
                onClick={() => setActiveTab("start-stream")}
                className="w-full py-2.5 bg-white text-brand-blue text-[10px] font-black rounded uppercase tracking-wider transition-all hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                Go Live Now
              </button>
           </div>
        )}

        <div>
          <p className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Channels</p>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                <div className={cn("w-8 h-8 rounded shrink-0", i === 1 ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm")}></div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate text-slate-800">{i === 1 ? "Calculus II" : "Bio Science"}</p>
                  <p className="text-[10px] text-blue-500 font-bold">{i === 1 ? "1.2k Viewers" : "Offline"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 p-4 space-y-4">
        <div className="flex items-center space-x-3 px-2 py-2">
            <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=3b82f6&color=fff`} alt="" className="h-10 w-10 rounded-full border-2 border-white shadow-md" />
            <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-black text-slate-900 uppercase tracking-tight">{profile.displayName}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest">{profile.role}</p>
                </div>
            </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
    </>
  );
}
