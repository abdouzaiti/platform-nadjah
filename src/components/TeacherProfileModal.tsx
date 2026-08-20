import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserProfile, TeacherCommunity, ClassRoom } from "../types";
import { useTranslation } from "react-i18next";
import { X, School, Users, BookOpen, Mail, Phone, Award, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Copy, Check, Edit3, Eye, Calendar, Shield, LogIn, Key } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface TeacherProfileModalProps {
  teacherId?: string;
  teacherProfile?: Partial<UserProfile> | null;
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (communityOrRoom?: any) => void;
  onEditUser?: (user: UserProfile) => void;
  onImpersonateUser?: (user: UserProfile) => void;
  isDeveloperOrAdmin?: boolean;
}

export default function TeacherProfileModal({
  teacherId,
  teacherProfile,
  isOpen,
  onClose,
  onActionClick,
  onEditUser,
  onImpersonateUser,
  isDeveloperOrAdmin = false
}: TeacherProfileModalProps) {
  const { i18n } = useTranslation();
  const [profileData, setProfileData] = useState<any>(teacherProfile || null);
  const [communities, setCommunities] = useState<TeacherCommunity[]>([]);
  const [rooms, setRooms] = useState<ClassRoom[]>([]);
  const [studentJoinedRooms, setStudentJoinedRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [zoomAvatar, setZoomAvatar] = useState(false);

  const copyToClipboard = (text: string, type: 'email' | 'phone' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const getLabel = (ar: string, fr: string, en: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    if (!isOpen) return;

    const targetId = teacherId || teacherProfile?.id;
    if (!targetId) return;

    fetchUserDetails(targetId);
  }, [isOpen, teacherId, teacherProfile]);

  const fetchUserDetails = async (id: string) => {
    setLoading(true);
    try {
      // 1. Fetch user profile
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (profErr) console.error("Profile fetch err:", profErr);
      const activeProf = prof || teacherProfile || {};
      if (prof) setProfileData(prof);

      const role = activeProf.role || "student";

      // 2. Fetch Teacher-specific data if teacher or dev/admin
      if (role === "teacher" || role === "developer" || role === "developper" || role === "admin") {
        const { data: comms } = await supabase
          .from("teacher_communities")
          .select("*")
          .eq("teacher_id", id);

        if (comms) {
          setCommunities(comms as TeacherCommunity[]);
          if (comms.length > 0) {
            const commIds = comms.map((c: any) => c.id);
            const { data: rmData } = await supabase
              .from("class_rooms")
              .select("*")
              .in("community_id", commIds);

            if (rmData) setRooms(rmData as ClassRoom[]);
          }
        }
      }

      // 3. Fetch Student-specific joined rooms
      if (role === "student" || role === "developer" || role === "developper") {
        const { data: mems } = await supabase
          .from("room_members")
          .select("*, room:class_rooms(*)")
          .eq("user_id", id);

        if (mems) {
          const joined = mems.map((m: any) => m.room).filter(Boolean);
          setStudentJoinedRooms(joined);
        }
      }
    } catch (err) {
      console.error("User details fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentProf = profileData || teacherProfile || {};
  const role = (currentProf.role || "student").toLowerCase();

  const isDev = role === "developer" || role === "developper";
  const isAdminRole = role === "admin";
  const isTeacherRole = role === "teacher";

  const email = currentProf.email || "";
  const defaultPass = (() => {
    let basePass = email.split('@')[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (basePass.length < 3) basePass = "user" + basePass;
    if (basePass.length < 6) basePass += "pass";
    return basePass;
  })();
  const displayPass = currentProf.password || defaultPass;

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

          {/* Action Buttons for Developer / Admin */}
          <div className="absolute top-4 right-16 rtl:right-auto rtl:left-16 z-20 flex items-center gap-2">
            {onImpersonateUser && (
              <button
                onClick={() => {
                  onImpersonateUser(currentProf as UserProfile);
                  onClose();
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-xs rounded-full transition-all backdrop-blur-sm cursor-pointer flex items-center gap-1.5 shadow-lg border border-amber-400/50"
                title={getLabel("دخول صفحة هذا المستخدم مباشرة بدون كلمة سر", "Se connecter à ce compte", "Enter Account Directly")}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{getLabel("دخول الحساب مباشرة", "Entrer au compte", "Enter Account")}</span>
              </button>
            )}

            {(isDeveloperOrAdmin || onEditUser) && (
              <button
                onClick={() => {
                  if (onEditUser) onEditUser(currentProf as UserProfile);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full transition-all backdrop-blur-sm cursor-pointer flex items-center gap-1.5 shadow-lg"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{getLabel("تعديل الحساب", "Modifier le compte", "Edit Account")}</span>
              </button>
            )}
          </div>

          {/* Banner */}
          <div className={cn(
            "relative h-32 p-6 flex items-end transition-all",
            isDev ? "bg-gradient-to-r from-indigo-900 via-indigo-700 to-purple-800" :
            isAdminRole ? "bg-gradient-to-r from-purple-800 via-purple-600 to-indigo-700" :
            isTeacherRole ? "bg-gradient-to-r from-brand-blue via-blue-600 to-indigo-700" :
            "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700"
          )}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
          </div>

          {/* Content Area */}
          <div className="px-6 pb-8 relative">
            {/* Avatar Header overlap */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 mb-6 gap-4">
              <div className="flex items-end gap-4">
                <div 
                  onClick={() => currentProf.avatar_url && setZoomAvatar(true)}
                  className="h-28 w-28 rounded-2xl bg-white p-1.5 shadow-xl border-2 border-white shrink-0 group relative cursor-pointer"
                >
                  {currentProf.avatar_url ? (
                    <>
                      <img
                        src={currentProf.avatar_url}
                        alt={currentProf.fullname}
                        className="h-full w-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="h-6 w-6" />
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full rounded-xl bg-gradient-to-br from-brand-blue to-blue-700 text-white flex items-center justify-center font-black text-3xl uppercase">
                      {currentProf.fullname?.charAt(0) || currentProf.username?.charAt(0) || "U"}
                    </div>
                  )}
                </div>

                <div className="pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-black text-slate-900 font-display">
                      {currentProf.fullname || currentProf.name || getLabel("مستخدم", "Utilisateur", "User")}
                    </h2>
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-2xs",
                      isDev ? "bg-indigo-50 border-indigo-200 text-indigo-700" :
                      isAdminRole ? "bg-purple-50 border-purple-200 text-purple-700" :
                      isTeacherRole ? "bg-blue-50 border-blue-200 text-brand-blue" :
                      "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}>
                      {isDev ? getLabel("مطور النظام", "Développeur", "Developer") :
                       isAdminRole ? getLabel("مدير النظام", "Administrateur", "Admin") :
                       isTeacherRole ? getLabel("أستاذ", "Professeur", "Teacher") :
                       getLabel("طالب", "Étudiant", "Student")}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    @{currentProf.username || "user"}
                  </p>
                </div>
              </div>

              {currentProf.subject && isTeacherRole && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-brand-blue border border-blue-100 rounded-xl text-xs font-black">
                  <BookOpen className="h-4 w-4" />
                  <span>{currentProf.subject}</span>
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
                    <span>{getLabel("نبذة ومعلومات الحساب", "À propos du compte", "About Profile")}</span>
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {currentProf.bio || getLabel(
                      "حساب مسجل في منصة مدرسة نجاح الأكاديمية للبث المباشر والدراسة التفاعلية.",
                      "Compte enregistré sur la plateforme académique École Nadjah.",
                      "Registered profile on École Nadjah Live Academic Platform."
                    )}
                  </p>
                </div>

                {/* Contact Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Current Password Card for Developer / Admin */}
                  {(isDeveloperOrAdmin || isDev) && displayPass && (
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs font-medium hover:border-slate-700 transition-all sm:col-span-2">
                      <div className="flex items-center gap-3 truncate min-w-0">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                          <Key className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="text-[9px] uppercase font-bold text-slate-400">
                            {getLabel("كلمة السر الحالية بالحساب", "Mot de passe actuel", "Current Password")}
                          </span>
                          <code className="text-xs font-black text-amber-400 font-mono tracking-wider select-all">
                            {displayPass}
                          </code>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(displayPass, 'pass')}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 text-[11px] font-bold border border-slate-700"
                        title={getLabel("نسخ كلمة السر", "Copier le mot de passe", "Copy password")}
                      >
                        {copiedPass ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-400">{getLabel("تم النسخ", "Copié", "Copied")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                            <span>{getLabel("نسخ كلمة السر", "Copier", "Copy")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {currentProf.email && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs font-medium text-slate-700 hover:border-slate-300 transition-all">
                      <div className="flex items-center gap-3 truncate min-w-0">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                          <Mail className="h-4 w-4" />
                        </div>
                        <span className="truncate select-all">{currentProf.email}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(currentProf.email, 'email')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 text-[11px] font-bold"
                        title={getLabel("نسخ البريد الإلكتروني", "Copier l'e-mail", "Copy email")}
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">{getLabel("تم النسخ", "Copié", "Copied")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-500" />
                            <span>{getLabel("نسخ", "Copier", "Copy")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {currentProf.phone ? (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs font-medium text-slate-700 hover:border-slate-300 transition-all">
                      <div className="flex items-center gap-3 truncate min-w-0">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                          <Phone className="h-4 w-4" />
                        </div>
                        <span className="truncate select-all">{currentProf.phone}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(currentProf.phone, 'phone')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 text-[11px] font-bold"
                        title={getLabel("نسخ رقم الهاتف", "Copier le numéro", "Copy phone")}
                      >
                        {copiedPhone ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">{getLabel("تم النسخ", "Copié", "Copied")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-500" />
                            <span>{getLabel("نسخ", "Copier", "Copy")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : currentProf.created_at ? (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3 text-xs font-medium text-slate-700">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">{getLabel("تاريخ التسجيل", "Date d'inscription", "Registration Date")}</span>
                        <span className="font-bold text-slate-800">{new Date(currentProf.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Communities / Classes / Enrolled Courses */}
                {isTeacherRole ? (
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
                              className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <span>{getLabel("الانضمام / الدخول", "Rejoindre", "Join Community")}</span>
                              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <School className="h-4 w-4 text-emerald-600" />
                      <span>{getLabel("الصفوف المفتوحة للطالب", "Classes de l'étudiant", "Student Enrolled Classes")}</span>
                    </h3>

                    {studentJoinedRooms.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-bold">
                        {getLabel("غير مسجل في أي صف حالياً.", "Aucune classe inscrite.", "No classes joined yet.")}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {studentJoinedRooms.map((room) => (
                          <div
                            key={room.id}
                            className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{room.room_name}</p>
                              <p className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">{room.subject || "General"}</p>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg">
                              {getLabel("نشط", "Actif", "Active")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Fullsize Avatar Modal */}
        {zoomAvatar && currentProf.avatar_url && (
          <div 
            onClick={() => setZoomAvatar(false)}
            className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-lg w-full p-2 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20">
              <img
                src={currentProf.avatar_url}
                alt={currentProf.fullname}
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
              />
              <button
                onClick={() => setZoomAvatar(false)}
                className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}

