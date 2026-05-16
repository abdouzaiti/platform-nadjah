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

  return (
    <>
      {/* Semi-transparent backdrop for mobile when sidebar is open */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[55] transition-opacity duration-300 sm:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      <div className={cn(
        "fixed inset-y-0 z-[60] flex flex-col bg-white border-slate-100 transition-all duration-300 ease-in-out sm:relative sm:z-50 sm:translate-x-0",
        lang === 'ar' ? "right-0 border-l" : "left-0 border-r",
        isOpen 
          ? "translate-x-0 w-64 shadow-2xl sm:shadow-none" 
          : (lang === 'ar' ? "translate-x-full w-0 sm:w-20 sm:translate-x-0" : "-translate-x-full w-0 sm:w-20 sm:translate-x-0"),
        "sm:w-64"
      )}>
        <div className={cn(
          "p-4 border-b border-slate-100 transition-opacity duration-200",
          !isOpen && "sm:opacity-0"
        )}>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 truncate">{t('room_menu', 'Room Menu')}</h2>
        </div>

        <div className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
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
                "flex items-center gap-3 p-3 rounded-xl transition-all group relative",
                activeTab === item.id 
                  ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20" 
                  : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={cn(
                "text-sm font-bold whitespace-nowrap transition-all duration-200",
                !isOpen ? "sm:opacity-0 sm:scale-95" : "opacity-100 scale-100"
              )}>{item.label}</span>
              
              {/* Tooltip for mini-bar state on desktop */}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-[10px] font-black uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block whitespace-nowrap z-[100]">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="p-2 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors group relative"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn(
              "text-sm font-bold whitespace-nowrap transition-all duration-200",
              !isOpen ? "sm:opacity-0 sm:scale-95" : "opacity-100 scale-100"
            )}>{t('leave_room', 'Leave Room')}</span>
            
            {!isOpen && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-red-500 text-white text-[10px] font-black uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block whitespace-nowrap z-[100]">
                {t('leave_room', 'Leave')}
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
