import React from "react";
import { cn } from "../lib/utils";
import { Megaphone, Users, MessageCircle, Radio, LogOut, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface RoomSidebarProps {
  isOpen: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
  lang: string;
}

export default function RoomSidebar({ isOpen, activeTab, setActiveTab, onClose, lang }: RoomSidebarProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className={cn(
      "h-full bg-white border-r border-slate-100 flex flex-col z-50 transition-all",
      "w-16 sm:w-64", // Adaptive width
      lang === 'ar' && "border-r-0 border-l"
    )}>
      <div className="p-4 border-b border-slate-100 hidden sm:block">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">{t('room_menu', 'Room Menu')}</h2>
      </div>

      <div className="flex-1 p-2 flex flex-col gap-1">
        {[
          { id: "announcements", icon: Megaphone, label: "Announcements" },
          { id: "group_chat", icon: Users, label: "Group Chat" },
          { id: "private_chat", icon: MessageCircle, label: "Private Chat" },
          { id: "live", icon: Radio, label: "Live" }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all group overflow-hidden",
              activeTab === item.id 
                ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20" 
                : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-sm font-bold whitespace-nowrap hidden sm:block">{item.label}</span>
          </button>
        ))}
      </div>
      
      <div className="p-2 border-t border-slate-100">
        <button 
          onClick={onClose}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors group overflow-hidden"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="text-sm font-bold whitespace-nowrap hidden sm:block">{t('leave_room', 'Leave Room')}</span>
        </button>
      </div>
    </div>
  );
}
