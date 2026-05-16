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
      "absolute z-50 bg-white/90 backdrop-blur-xl rounded-2xl p-3 shadow-lg border border-white flex flex-col gap-2 transition-all",
      "top-20 left-4 right-4 sm:top-24 sm:w-48 sm:left-20 sm:right-auto",
      lang === 'ar' && "sm:right-20 sm:left-auto"
    )}>
      <div className="flex flex-col gap-1">
        {[
          { id: "announcements", icon: Megaphone, label: "Announcements" },
          { id: "group_chat", icon: Users, label: "Group Chat" },
          { id: "private_chat", icon: MessageCircle, label: "Private Chat" },
          { id: "live", icon: Radio, label: "Live" }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn("flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all", activeTab === item.id ? "bg-brand-blue text-white" : "hover:bg-slate-100 text-slate-600")}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
      
      <div className="border-t border-slate-100 pt-2 mt-2">
        <button 
          onClick={onClose}
          className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          {t('leave_room', 'Leave Room')}
        </button>
      </div>
    </div>
  );
}
