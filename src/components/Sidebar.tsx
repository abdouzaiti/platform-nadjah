import React from "react";
import { auth } from "../lib/firebase";
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
}

export default function Sidebar({ profile, activeTab, setActiveTab }: SidebarProps) {
  const isTeacher = profile.role === "teacher";

  const menuItems = [
    { id: "browse", icon: Home, label: "Browse" },
    { id: "live", icon: PlayCircle, label: "Live Now" },
    ...(isTeacher ? [{ id: "mystreams", icon: Tv2, label: "My Streams" }] : []),
    { id: "classes", icon: School, label: "Classes" },
    { id: "community", icon: Users, label: "Community" },
    { id: "messages", icon: MessageSquare, label: "Messages" },
  ];

  return (
    <div className="flex h-screen w-60 flex-col glass-sidebar">
      <div className="flex h-20 items-center px-6 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-blue shadow-lg shadow-blue-500/20">
            <School className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase text-white">Ecole <span className="text-brand-blue">Nad</span></span>
        </div>
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
                    ? "bg-brand-blue text-white shadow-lg shadow-blue-500/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
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
              <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                <div className={cn("w-8 h-8 rounded shrink-0", i === 1 ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-emerald-500 to-teal-600")}></div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate text-white">{i === 1 ? "Calculus II" : "Bio Science"}</p>
                  <p className="text-[10px] text-blue-400 font-bold">{i === 1 ? "1.2k Viewers" : "Offline"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 p-4 space-y-4">
        <div className="flex items-center space-x-3 px-2 py-2">
            <img src={profile.photoURL} alt="" className="h-10 w-10 rounded-full border border-brand-blue shadow-lg shadow-blue-500/20" />
            <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-black text-white uppercase tracking-tight">{profile.displayName}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{profile.role}</p>
                </div>
            </div>
        </div>

        <button
          onClick={() => auth.signOut()}
          className="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
