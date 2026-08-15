import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";
import { Users, BookOpen, ArrowRight, School, Globe, Search, PlayCircle } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import TeacherProfileModal from "../components/TeacherProfileModal";

interface Community {
  id: string;
  community_name: string;
  description: string;
  teacher: {
    id?: string;
    fullname: string;
    avatar_url: string;
    bio?: string;
    subject?: string;
    email?: string;
    phone?: string;
  };
  teacher_id: string;
  member_count: number;
}

export default function LandingPage({ onJoinClick }: { onJoinClick: () => void }) {
  const { t, i18n } = useTranslation();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from("teacher_communities")
        .select(`
          id,
          community_name,
          description,
          teacher_id,
          profiles(id, fullname, avatar_url, email, phone)
          
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map((c: any) => {
          let memberCount = 0;
          if (c.class_rooms) {
            c.class_rooms.forEach((r: any) => {
              if (r.room_members && r.room_members[0]) {
                
              }
            });
          }
          return {
            id: c.id,
            community_name: c.community_name,
            description: c.description,
            teacher_id: c.teacher_id,
            teacher: c.profiles || { id: c.teacher_id, fullname: "Unknown Teacher", avatar_url: "" },
            member_count: memberCount
          };
        });
        setCommunities(formatted);
      }
    } catch (err) {
      console.error("Error fetching communities:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommunities = communities.filter(c => 
    c.community_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.teacher.fullname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Nadjah School" className="w-[64px] h-[63px] object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 mr-4 bg-slate-100 p-1 rounded-lg">
              {['en', 'fr', 'ar'].map(lng => (
                <button
                  key={lng}
                  onClick={() => i18n.changeLanguage(lng)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                    i18n.language === lng ? "bg-white text-brand-blue shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {lng}
                </button>
              ))}
            </div>
            <button 
              onClick={onJoinClick}
              className="bg-brand-blue hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-md shadow-brand-blue/20"
            >
              {i18n.language === 'ar' ? 'تسجيل الدخول / إنشاء حساب' : 'Sign In / Register'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-blue/5 rounded-full blur-3xl -z-10" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 max-w-3xl mx-auto"
        >
          <h1 className="text-5xl sm:text-6xl font-display font-black tracking-tight text-slate-900 leading-tight">
            {i18n.language === 'ar' ? 'اكتشف أفضل' : 'Discover the best'} <br />
            <span className="text-brand-blue">{i18n.language === 'ar' ? 'المجتمعات التعليمية' : 'Educational Communities'}</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium">
            {i18n.language === 'ar' 
              ? 'انضم إلى آلاف الطلاب والمعلمين في بيئة تعليمية تفاعلية حديثة. تصفح المجتمعات أدناه وابدأ رحلتك.'
              : 'Join thousands of students and teachers in a modern interactive learning environment. Browse the communities below and start your journey.'}
          </p>
          
          <div className="max-w-md mx-auto relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
            </div>
            <input
              type="text"
              placeholder={i18n.language === 'ar' ? 'ابحث عن مجتمع أو أستاذ...' : 'Search for a community or teacher...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-brand-blue transition-all shadow-sm"
            />
          </div>
        </motion.div>
      </div>

      {/* Communities Grid */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-32">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 border-4 border-slate-200 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : filteredCommunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCommunities.map((community, idx) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-brand-blue/30 transition-all group flex flex-col h-full"
              >
                <div className="flex items-start gap-4 mb-4 cursor-pointer" onClick={() => setSelectedTeacher({ ...community.teacher, id: community.teacher.id || community.teacher_id })}>
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                    {community.teacher.avatar_url ? (
                      <img src={community.teacher.avatar_url} alt={community.teacher.fullname} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-slate-900 truncate" title={community.community_name}>
                      {community.community_name}
                    </h3>
                    <p className="text-sm text-slate-500 truncate">{community.teacher.fullname}</p>
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 line-clamp-3 mb-6 flex-1 font-medium leading-relaxed">
                  {community.description || (i18n.language === 'ar' ? 'لا يوجد وصف متاح.' : 'No description available.')}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-brand-blue bg-blue-50 px-3 py-1.5 rounded-lg">
                    <School className="h-4 w-4" />
                    <span className="text-xs font-bold">{i18n.language === 'ar' ? 'مجتمع تعليمي' : 'Educational Community'}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedTeacher({ ...community.teacher, id: community.teacher.id || community.teacher_id })}
                    className="flex items-center gap-1.5 text-brand-blue font-bold text-sm hover:text-blue-700 transition-colors group-hover:translate-x-1 cursor-pointer"
                  >
                    {i18n.language === 'ar' ? 'المزيد' : 'More'}
                    <ArrowRight className={cn("h-4 w-4", i18n.language === 'ar' && "rotate-180")} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Globe className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {i18n.language === 'ar' ? 'لا توجد مجتمعات' : 'No communities found'}
            </h3>
            <p className="text-slate-500">
              {i18n.language === 'ar' ? 'جرب البحث بكلمات مختلفة' : 'Try searching with different keywords'}
            </p>
          </div>
        )}
      </div>
      <TeacherProfileModal
        isOpen={!!selectedTeacher}
        teacherId={selectedTeacher?.id}
        teacherProfile={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        onActionClick={() => {
          setSelectedTeacher(null);
          onJoinClick();
        }}
      />
    </div>
  );
}
