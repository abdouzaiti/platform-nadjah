import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserProfile, TeacherCommunity, ClassRoom } from "../types";
import { useTranslation } from "react-i18next";
import { X, School, Users, BookOpen, Mail, Phone, Award, Sparkles, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface TeacherProfileModalProps {
  teacherId?: string;
  teacherProfile?: Partial<UserProfile> | null;
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (communityOrRoom?: any) => void;
}

export default function TeacherProfileModal({
  teacherId,
  teacherProfile,
  isOpen,
  onClose,
  onActionClick
}: TeacherProfileModalProps) {
  const { i18n } = useTranslation();
  const [profileData, setProfileData] = useState<any>(teacherProfile || null);
  const [communities, setCommunities] = useState<TeacherCommunity[]>([]);
  const [rooms, setRooms] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const getLabel = (ar: string, fr: string, en: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    if (!isOpen) return;

    const targetId = teacherId || teacherProfile?.id;
    if (!targetId) return;

    fetchTeacherDetails(targetId);
  }, [isOpen, teacherId, teacherProfile]);

  const fetchTeacherDetails = async (id: string) => {
    setLoading(true);
    try {
      // 1. Fetch teacher profile
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (profErr) console.error("Profile fetch err:", profErr);
      if (prof) setProfileData(prof);

      // 2. Fetch teacher communities
      const { data: comms, error: commsErr } = await supabase
        .from("teacher_communities")
        .select("*")
        .eq("teacher_id", id);

      if (commsErr) console.error("Comms fetch err:", commsErr);
      if (comms) setCommunities(comms as TeacherCommunity[]);

      // 3. Fetch teacher rooms across communities
      if (comms && comms.length > 0) {
        const commIds = comms.map((c: any) => c.id);
        const { data: rmData } = await supabase
          .from("class_rooms")
          .select("*")
          .in("community_id", commIds);

        if (rmData) setRooms(rmData as ClassRoom[]);
      }
    } catch (err) {
      console.error("Teacher details fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentTeacher = profileData || teacherProfile || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-20 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all backdrop-blur-sm cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Banner */}
          <div className="relative h-40 bg-gradient-to-r from-brand-blue via-blue-600 to-indigo-700 p-6 flex items-end">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
            <div className="relative z-10 flex items-center gap-2 text-white/90 text-xs font-bold bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{getLabel("أستاذ معتمد في مدرسة نجاح", "Professeur Vérifié", "Verified Teacher")}</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="px-6 pb-8 relative">
            {/* Avatar Header overlap */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 mb-6 gap-4">
              <div className="flex items-end gap-4">
                <div className="h-28 w-28 rounded-2xl bg-white p-1.5 shadow-xl border-2 border-white shrink-0">
                  {currentTeacher.avatar_url ? (
                    <img
                      src={currentTeacher.avatar_url}
                      alt={currentTeacher.fullname}
                      className="h-full w-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="h-full w-full rounded-xl bg-gradient-to-br from-brand-blue to-blue-700 text-white flex items-center justify-center font-black text-3xl uppercase">
                      {currentTeacher.fullname?.charAt(0) || "T"}
                    </div>
                  )}
                </div>

                <div className="pb-1">
                  <h2 className="text-2xl font-black text-slate-900 font-display">
                    {currentTeacher.fullname || currentTeacher.name || getLabel("الأستاذ", "Le Professeur", "Teacher")}
                  </h2>
                  <p className="text-xs font-bold text-slate-400">
                    @{currentTeacher.username || "teacher"}
                  </p>
                </div>
              </div>

              {currentTeacher.subject && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-brand-blue border border-blue-100 rounded-xl text-xs font-black">
                  <BookOpen className="h-4 w-4" />
                  <span>{currentTeacher.subject}</span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="h-8 w-8 border-3 border-slate-200 border-t-brand-blue rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* About / Bio */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>{getLabel("نبذة عن الأستاذ والمعلومات للطلاب", "À propos du Professeur", "About the Teacher")}</span>
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {currentTeacher.bio || getLabel(
                      "أهلاً بكم في صفحتي الشخصية ومجتمعي التعليمي بمدرسة نجاح. يسعدني تواصلكم وانضمامكم لدروسي التفاعلية.",
                      "Bienvenue sur mon profil et ma communauté éducative. Heureux de vous accueillir dans mes cours.",
                      "Welcome to my teacher profile and learning community on Nadjah School. Glad to have you in my interactive classes."
                    )}
                  </p>
                </div>

                {/* Additional Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentTeacher.email && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3 text-xs font-medium text-slate-700">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                        <Mail className="h-4 w-4" />
                      </div>
                      <span className="truncate">{currentTeacher.email}</span>
                    </div>
                  )}

                  {currentTeacher.phone && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3 text-xs font-medium text-slate-700">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                        <Phone className="h-4 w-4" />
                      </div>
                      <span className="truncate">{currentTeacher.phone}</span>
                    </div>
                  )}
                </div>

                {/* Teacher's Communities & Classrooms */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <School className="h-4 w-4 text-brand-blue" />
                    <span>{getLabel("المجتمعات والصفوف التابعة للأستاذ", "Communautés & Classes", "Teacher Communities & Classes")}</span>
                  </h3>

                  {communities.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-bold">
                      {getLabel("لم يقم الأستاذ بإنشاء مجتمعات بعد.", "Aucune communauté créée pour le moment.", "No communities created yet.")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {communities.map((comm) => (
                        <div
                          key={comm.id}
                          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-blue/30 transition-all"
                        >
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-900 text-sm">{comm.community_name}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2 font-medium">{comm.description}</p>
                          </div>

                          <button
                            onClick={() => {
                              onClose();
                              if (onActionClick) onActionClick(comm);
                            }}
                            className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                          >
                            <span>{getLabel("الانضمام / الدخول", "Rejoindre", "Join Community")}</span>
                            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
