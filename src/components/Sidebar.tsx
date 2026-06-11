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
  School,
  Languages,
  Search
} from "lucide-react";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  profile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ profile, activeTab, setActiveTab, isOpen = false, onClose }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const isTeacher = profile.role === "teacher";
  const isDeveloper = ["developer", "developper"].includes(profile.role?.toString().toLowerCase()) || profile.email?.toLowerCase() === "zaitiabdou27@gmail.com";

  const menuItems = [];
  if (isTeacher || isDeveloper) {
    menuItems.push({ id: "rooms", icon: School, label: t('my_community', 'My Community') });
    menuItems.push({ id: "create-room", icon: PlusCircle, label: t('add_room', 'Add Class') });
    if (isDeveloper) {
      menuItems.push({ id: "manage-users", icon: Users, label: i18n.language === 'ar' ? 'أعضاء المنصة والطلبات' : 'Students & Approvals' });
    }
    menuItems.push({ id: "settings", icon: Settings, label: i18n.language === 'ar' ? 'إعدادات الحساب' : 'Account Settings' });
  } else {
    menuItems.push({ id: "joined", icon: Home, label: t('joined', 'Joined Classes') });
    menuItems.push({ id: "discover", icon: Search, label: t('discover', 'Discover Communities') });
    menuItems.push({ id: "settings", icon: Settings, label: i18n.language === 'ar' ? 'إعدادات الحساب' : 'Account Settings' });
  }

  const handleSignOut = async () => {
    window.dispatchEvent(new Event("dev-logout"));
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
        "fixed inset-y-0 z-50 flex w-64 flex-col glass-sidebar transition-all duration-300 transform lg:static lg:inset-auto lg:h-screen lg:w-60",
        i18n.language === 'ar' ? "right-0" : "left-0",
        isOpen 
          ? (i18n.language === 'ar' ? "translate-x-0" : "translate-x-0") 
          : (i18n.language === 'ar' ? "translate-x-full" : "-translate-x-full"),
        isOpen ? "shadow-2xl shadow-blue-500/10" : "",
        "lg:translate-x-0"
      )}>
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-blue shadow-lg shadow-blue-500/10 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase text-slate-900">
              {i18n.language === 'ar' ? t('app_name').split(' ')[0] : 'Nadjah'} <span className="text-brand-blue">{i18n.language === 'ar' ? t('app_name').split(' ')[1] : 'Live'}</span>
            </span>
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
          <p className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('navigation')}</p>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onClose) onClose();
                }}
                className={cn(
                  "flex w-full items-center space-x-3 rtl:space-x-reverse rounded-lg px-3 py-2.5 text-sm font-bold transition-all",
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

        <div>
          <p className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('language', 'Language')}</p>
          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
            {['ar', 'fr', 'en'].map((lng) => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={cn(
                  "py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                  i18n.language === lng 
                    ? "bg-white text-brand-blue shadow-sm" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {lng === 'ar' ? 'العربية' : lng}
              </button>
            ))}
          </div>
        </div>

        {isTeacher && (
           <div className="p-4 bg-gradient-to-br from-brand-blue to-blue-700 rounded-xl shadow-lg shadow-blue-500/10">
              <p className="text-xs font-black uppercase text-white mb-1">{t('teacher_mode')}</p>
              <p className="text-[10px] text-white/70 mb-4 font-medium">{t('manage_broadcasts')}</p>
              <button 
                onClick={() => {
                  setActiveTab("rooms");
                  if (onClose) onClose();
                }}
                className="w-full py-2.5 bg-white text-brand-blue text-[10px] font-black rounded uppercase tracking-wider transition-all hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {t('manage_rooms', 'Manage Classes')}
              </button>
           </div>
        )}


      </div>

      <div className="border-t border-slate-100 p-4 space-y-4">
        <div className="flex items-center space-x-3 rtl:space-x-reverse px-2 py-2">
            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullname)}&background=3b82f6&color=fff`} alt="" className="h-10 w-10 rounded-full border-2 border-white shadow-md" />
            <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-black text-slate-900 uppercase tracking-tight">{profile.fullname}</p>
                <div className="flex items-center gap-1.5 rtl:space-x-reverse">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest">
                    {profile.role === 'developer' || profile.role === 'developper'
                      ? (i18n.language === 'ar' ? 'المطور' : (i18n.language === 'fr' ? 'Développeur' : 'Developer'))
                      : profile.role === 'teacher'
                        ? (i18n.language === 'ar' ? 'أستاذ' : (i18n.language === 'fr' ? 'Professeur' : 'Professor'))
                        : (profile.role === 'admin' ? 'Admin' : (i18n.language === 'ar' ? 'طالب' : 'Student'))}
                  </p>
                </div>
            </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center space-x-3 rtl:space-x-reverse rounded-lg px-3 py-2 text-xs font-bold text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          <span>{t('sign_out')}</span>
        </button>
      </div>
    </div>
    </>
  );
}
