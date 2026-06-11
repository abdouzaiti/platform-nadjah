import React from "react";
import { UserProfile, TeacherCommunity, ClassRoom, RoomType, LiveSession } from "../types";
import Sidebar from "../components/Sidebar";
import SettingsView from "../components/SettingsView";
import { supabase, createAdminAuthClient } from "../lib/supabase";
import { Plus, Video, Trash2, Edit3, Loader2, Play, Users, Menu, X, Database, MessageSquare, Megaphone, FileText, Settings, Hash, Radio, Key, Mail, Phone, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import StreamPlayer from "../components/StreamPlayer";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface TeacherDashboardProps {
  profile: UserProfile;
}

export default function TeacherDashboard({ profile }: TeacherDashboardProps) {
  const { t, i18n } = useTranslation();
  
  const getLabel = (ar: string, fr: string, en: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  const isDeveloper = ["developer", "developper"].includes(profile.role?.toString().toLowerCase()) || profile.email?.toLowerCase() === "zaitiabdou27@gmail.com";
  const [activeTab, setActiveTab] = React.useState(isDeveloper ? "manage-users" : "rooms");
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

  // Manage Users State
  const [usersList, setUsersList] = React.useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [regRequests, setRegRequests] = React.useState<any[]>([]);
  const [regRequestsLoading, setRegRequestsLoading] = React.useState(false);
  const [actingRegId, setActingRegId] = React.useState<string | null>(null);
  const [pendingSubTab, setPendingSubTab] = React.useState<"forms" | "guests">("forms");

  // Manual User Registration States
  const [regFullName, setRegFullName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regRole, setRegRole] = React.useState<"student" | "teacher">("student");
  const [regLoading, setRegLoading] = React.useState(false);
  const [regError, setRegError] = React.useState<string | null>(null);
  const [regSuccess, setRegSuccess] = React.useState<string | null>(null);

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    const emailToSignUp = regEmail.trim();
    const fullNameToSignUp = regFullName.trim();

    if (!emailToSignUp || !fullNameToSignUp) {
      setRegError(i18n.language === 'ar' ? "يرجى ملء جميع الحقول المطلوبة!" : "Please fill in all fields.");
      setRegLoading(false);
      return;
    }

    try {
      // 1. Initialize isolated auth client
      const adminAuth = createAdminAuthClient();
      
      // Generate standard, easy-to-remember password satisfying the security policy (uppercase, lowercase, number)
      const prefixClean = emailToSignUp.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const dynamicPass = (() => {
        if (prefixClean.length >= 3) {
          const capitalized = prefixClean.charAt(0).toUpperCase() + prefixClean.slice(1).toLowerCase();
          return `${capitalized}2026`; // e.g., "Abdou2026"
        }
        return "Nadjah2026";
      })();
      
      // 2. Register the user with compliant password
      const { data: signUpData, error: signUpError } = await adminAuth.auth.signUp({
        email: emailToSignUp,
        password: dynamicPass,
        options: {
          data: {
            fullname: fullNameToSignUp,
            full_name: fullNameToSignUp,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        const newUserId = signUpData.user.id;
        
        // 3. Immediately activate / update their role to the selected role
        // Instead of GUEST, they directly become Student or Teacher!
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            fullname: fullNameToSignUp,
            name: fullNameToSignUp,
            role: regRole, // directly 'student' or 'teacher'
            role_requested: null
          })
          .eq("id", newUserId);

        if (profileError) {
          console.error("Profile role activation error:", profileError);
        }

        setRegSuccess(
          i18n.language === 'ar'
            ? `تم تسجيل الحساب (${fullNameToSignUp}) بنجاح! كلمة السر الافتراضية للولوج هي: ${dynamicPass} (يمكن للطالب تغييرها من الإعدادات)`
            : `Success! Account (${fullNameToSignUp}) registered. The login passcode is set to: ${dynamicPass} (the student can customize it in Account Settings anytime).`
        );

        // Reset form fields
        setRegFullName("");
        setRegEmail("");
        setRegRole("student");
        
        // Refresh users list
        await fetchUsers();
      }
    } catch (err: any) {
      console.error("Register student error:", err);
      // Clean display of signup error
      setRegError(err.message || "Failed to create user account. Ensure email is unique.");
    } finally {
      setRegLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUsersList((data || []) as UserProfile[]);
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchRegistrationRequests = async () => {
    setRegRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from("registration_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRegRequests(data || []);
    } catch (err) {
      console.error("Fetch registration requests error:", err);
    } finally {
      setRegRequestsLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "manage-users") {
      fetchUsers();
      fetchRegistrationRequests();

      // Subscribe to real-time additions, updates, or deletions of registration requests and users profile status
      const userChannel = supabase.channel('manage-users-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_requests' }, () => {
          fetchRegistrationRequests();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          fetchUsers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(userChannel);
      };
    }
  }, [activeTab]);

  const handleApproveRegistrationRequest = async (request: any, finalRole?: string) => {
    setActingRegId(request.id);
    try {
      const emailToSignUp = request.email.trim();
      const fullNameToSignUp = request.full_name.trim();
      const targetRole = (finalRole || request.role || 'STUDENT').toLowerCase() as 'student' | 'teacher';

      // 1. Initialize admin auth client
      const adminAuth = createAdminAuthClient();
      
      // Generate standard passcode satisfying password policy
      const prefixClean = emailToSignUp.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const dynamicPass = (() => {
        if (prefixClean.length >= 3) {
          const capitalized = prefixClean.charAt(0).toUpperCase() + prefixClean.slice(1).toLowerCase();
          return `${capitalized}2026`;
        }
        return "Nadjah2026";
      })();

      // 2. See if profile already exists in public.profiles
      const { data: searchProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", emailToSignUp)
        .maybeSingle();

      let targetUserId: string | null = null;

      if (searchProfile?.id) {
        targetUserId = searchProfile.id;
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            fullname: fullNameToSignUp,
            name: fullNameToSignUp,
            role: targetRole,
            role_requested: null
          })
          .eq("id", targetUserId);

        if (profileError) throw profileError;
      } else {
        // Create userauth and update role
        const { data: signUpData, error: signUpError } = await adminAuth.auth.signUp({
          email: emailToSignUp,
          password: dynamicPass,
          options: {
            data: {
              fullname: fullNameToSignUp,
              full_name: fullNameToSignUp,
            }
          }
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          targetUserId = signUpData.user.id;
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              fullname: fullNameToSignUp,
              name: fullNameToSignUp,
              role: targetRole,
              role_requested: null
            })
            .eq("id", targetUserId);

          if (profileError) {
            console.error("Profile role activation error in auto-approve:", profileError);
          }
        }
      }

      // 3. Mark approved or remove from temporary registration table
      const { error: updateReqError } = await supabase
        .from("registration_requests")
        .update({ status: 'APPROVED' })
        .eq("id", request.id);

      if (updateReqError) {
        console.error("Error updating request status:", updateReqError);
      }

      alert(
        i18n.language === 'ar'
          ? `تم تفعيل حساب (${fullNameToSignUp}) بنجاح كـ ${targetRole === 'teacher' ? 'أستاذ' : 'طالب'}! كلمة المرور: ${dynamicPass}`
          : `Success! Created account for (${fullNameToSignUp}) as ${targetRole}. Passcode: ${dynamicPass}`
      );

      await fetchUsers();
      await fetchRegistrationRequests();
    } catch (err: any) {
      console.error("Approve registration request error:", err);
      alert(err.message || "Failed to approve request.");
    } finally {
      setActingRegId(null);
    }
  };

  const handleRejectRegistrationRequest = async (requestId: string) => {
    if (!confirm(i18n.language === 'ar' ? "هل أنت متأكد من رفض وحذف هذا الطلب؟" : "Reject and delete this request?")) return;
    try {
      setRegRequestsLoading(true);
      const { error } = await supabase
        .from("registration_requests")
        .delete()
        .eq("id", requestId);
      if (error) throw error;
      await fetchRegistrationRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRegRequestsLoading(false);
    }
  };

  const handleApproveUser = async (userId: string, targetRole: 'student' | 'teacher' | 'guest') => {
    try {
      setUsersLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({ 
          role: targetRole,
          role_requested: null
        })
        .eq("id", userId);
      
      if (error) throw error;
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleRejectOrDelete = async (userId: string) => {
    if (!confirm(i18n.language === 'ar' ? "هل أنت متأكد من حذف هذا الحساب؟" : "Are you sure you want to delete this user?")) return;
    try {
      setUsersLoading(true);
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);
      
      if (error) throw error;
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

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

  const handleEnterRoom = async (room: ClassRoom) => {
    try {
      setLoading(true);
      // Check for existing session (live or scheduled)
      const { data: existing, error: checkError } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("room_id", room.id)
        .in("status", ["live", "scheduled"])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (checkError) throw checkError;

      setActiveRoom(room);
      setActiveSession(existing as LiveSession | null);
    } catch (err: any) {
      console.error("EnterRoom error:", err);
      alert(`Failed to enter room: ${err.message}`);
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

  if (activeRoom) {
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
        {activeTab === "settings" ? (
          <div className="space-y-6">
            {/* Mobile Header Bar */}
            <div className="flex lg:hidden items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <span className="font-sans font-black text-xs uppercase tracking-wider text-slate-800">
                {getLabel("إعدادات الحساب", "Paramètres du Compte", "Account Settings")}
              </span>

              <button
                onClick={async () => {
                  window.dispatchEvent(new Event("dev-logout"));
                  await supabase.auth.signOut();
                }}
                className="p-2 bg-red-50 hover:bg-red-100 rounded-xl text-red-500 border border-red-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                title={getLabel("تسجيل الخروج", "Déconnexion", "Sign Out")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <SettingsView profile={profile} />
          </div>
        ) : (activeTab === "manage-users" && (profile.role === "developer" || profile.role === "developper" || profile.email?.toLowerCase() === "zaitiabdou27@gmail.com")) ? (
          <div className="space-y-6">
            {/* Mobile Header Bar */}
            <div className="flex lg:hidden items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-brand-blue/5 rounded-xl text-brand-blue border border-brand-blue/10 active:scale-95 transition-all cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <span className="font-sans font-black text-xs uppercase tracking-wider text-slate-800">
                {getLabel("مركز التحكم للمطور", "Console Développeur", "Developer Console")}
              </span>

              <button
                onClick={async () => {
                  window.dispatchEvent(new Event("dev-logout"));
                  await supabase.auth.signOut();
                }}
                className="p-2 bg-red-50 hover:bg-red-100 rounded-xl text-red-500 border border-red-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                title={getLabel("تسجيل الخروج", "Déconnexion", "Sign Out")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {/* Intro Card */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md shadow-indigo-500/10">💻 Developer Console</span>
                </div>
                <h3 className="text-xl font-black font-display uppercase tracking-tight text-slate-900 mt-1">
                  {getLabel(
                    "لوحة المطور: التحكم والقبول",
                    "Console Développeur: Contrôle & Approbations",
                    "Ultimate Developer Console"
                  )}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {getLabel(
                    "بصفتك المطور الرئيسي للمنصة، لك الصلاحية الكاملة لتسجيل الطلاب والأساتذة وإدارتهم مباشرة.",
                    "En tant que développeur principal de la plateforme, vous disposez des privilèges absolus pour inscrire et autoriser les étudiants et enseignants.",
                    "As the lead platform developer, you hold absolute master privileges to register and authorize both students and teachers."
                  )}
                </p>
              </div>
              
              {community && (
                <div className="bg-brand-blue/5 border border-brand-blue/10 p-4 rounded-2xl flex items-center gap-3 shrink-0">
                  <Key className="h-5 w-5 text-brand-blue" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-blue">
                      {getLabel(
                        "مفتاح التسجيل لطلابك",
                        "ID d'inscription étudiant",
                        "Your Community ID"
                      )}
                    </p>
                    <p className="text-xs font-mono font-black text-slate-700">
                      @{community.community_username}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Fast-Track Academic Registration Widget */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    {getLabel(
                      "تسجيل طالب أو أستاذ جديد تلقائياً",
                      "Enregistrement rapide d'utilisateur",
                      "Fast-Track User Registration"
                    )}
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-400">
                    {getLabel(
                      "سجل العضو ببريده الإلكتروني مباشرة وستكون كلمة المرور هي بادئة بريده الإلكتروني بحرف كبير مع كلمة 2026 لتستوفي المعايير الأمنية.",
                      "Créez le profil d'un membre avec son e-mail. Le mot de passe initial sera le début de l'e-mail avec une majuscule suivi de 2026.",
                      "Register a user with their email. The initial passcode will be generated with a capitalized prefix and '2026' to meet security rules."
                    )}
                  </p>
                </div>
              </div>

              {regError && (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{regSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegisterUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5 text-left rtl:text-right md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                    {getLabel("الاسم الكامل للعضو", "Nom complet du membre", "Full Name")}
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder={getLabel("مثل: محمد علي", "Ex: Jean Dupont", "e.g. Jean Dupont")}
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5 text-left rtl:text-right md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                    {getLabel("البريد الإلكتروني", "Adresse e-mail", "Email Address")}
                  </label>
                  <input 
                    type="email"
                    required
                    placeholder="student@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5 text-left rtl:text-right md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                    {getLabel("الصفة / الحساب", "Rôle / Fonction", "Role / Position")}
                  </label>
                  <select 
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-bold"
                  >
                    <option value="student">{getLabel("🧑‍🎓 طالب (Student)", "🧑‍🎓 Étudiant", "Student")}</option>
                    <option value="teacher">{getLabel("🧑‍🏫 أستاذ (Teacher)", "🧑‍🏫 Enseignant", "Teacher")}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-[0.1em] rounded-xl shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-2 cursor-pointer h-10"
                >
                  {regLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>{getLabel("تسجيل وتفعيل العضو", "Créer et activer le membre", "Create Account")}</span>
                  )}
                </button>
              </form>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1">
                {/* Statistics Box */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {getLabel("قيد الانتظار", "En attente d'approbation", "Pending Approval")}
                    </p>
                    <p className="text-xl font-black text-amber-500">
                      {usersList.filter(u => u.role?.toLowerCase() === 'guest').length}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {getLabel("الطلاب النشطين", "Étudiants actifs", "Active Students")}
                    </p>
                    <p className="text-xl font-black text-emerald-500">
                      {usersList.filter(u => u.role?.toLowerCase() === 'student').length}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {getLabel("الأساتذة والمدراء", "Corps enseignant", "Active Faculty")}
                    </p>
                    <p className="text-xl font-black text-blue-500">
                      {usersList.filter(u => ['teacher', 'admin', 'developer', 'developper'].includes(u.role?.toLowerCase())).length}
                    </p>
                  </div>
                </div>

                {/* Left/Right layout for pending and active */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending Request Queue */}
                  <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-3 gap-2">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                          {getLabel("مركز طلبات الانتساب والتسجيل", "Centre d'admissions & Inscriptions", "Admissions & Inscriptions Queue")}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium font-sans">
                          {getLabel(
                            "إدارة جميع طلبات التسجيل من استمارات الموقع الخارجي وحسابات المنصة.",
                            "Gerez les demandes d'inscription issues des formulaires et des comptes.",
                            "Manage admissions from enrollment forms and app accounts."
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-black uppercase self-start sm:self-center font-mono">
                        {(regRequests.filter(r => r.status?.toUpperCase() === 'PENDING' || !r.status).length + usersList.filter(u => u.role?.toLowerCase() === 'guest').length)} {getLabel("طلب جديد", "Demandes", "Pending Total")}
                      </span>
                    </div>

                    {/* Sub-tab selection pill buttons */}
                    <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100/50 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPendingSubTab("forms")}
                        className={cn(
                          "flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          pendingSubTab === "forms"
                            ? "bg-white text-indigo-600 shadow-sm border border-slate-100 font-extrabold"
                            : "text-slate-400 hover:text-slate-600 font-medium"
                        )}
                      >
                        📬 {getLabel("رسائل التسجيل (موقع)", "Formulaires du site web", "Form registrations")}
                        <span className={cn(
                          "px-1.5 py-0.5 text-[8px] rounded-full font-bold font-mono",
                          pendingSubTab === "forms" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          {regRequests.filter(r => r.status?.toUpperCase() === 'PENDING' || !r.status).length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingSubTab("guests")}
                        className={cn(
                          "flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          pendingSubTab === "guests"
                            ? "bg-white text-indigo-600 shadow-sm border border-slate-100 font-extrabold"
                            : "text-slate-400 hover:text-slate-600 font-medium"
                        )}
                      >
                        🧑‍💻 {getLabel("حسابات قيد التفعيل", "Profils GUEST", "Guest Profiles")}
                        <span className={cn(
                          "px-1.5 py-0.5 text-[8px] rounded-full font-bold font-mono",
                          pendingSubTab === "guests" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          {usersList.filter(u => u.role?.toLowerCase() === 'guest').length}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto no-scrollbar pt-1">
                      {regRequestsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
                        </div>
                      ) : pendingSubTab === "forms" ? (
                        <>
                          {regRequests.filter(r => r.status?.toUpperCase() === 'PENDING' || !r.status).map((req) => {
                            const isTeacherRole = (req.role || '').toUpperCase() === 'TEACHER';
                            const selfRoleClean = isTeacherRole ? 'teacher' : 'student';
                            const otherRoleClean = isTeacherRole ? 'student' : 'teacher';
                            const isCurrentlyProcessing = actingRegId === req.id;

                            return (
                              <div key={req.id} className="p-4 bg-slate-50 rounded-[18px] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-slate-200 hover:shadow-sm">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-black text-slate-800 truncate">{req.full_name}</p>
                                    <span className={cn(
                                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border font-mono",
                                      isTeacherRole 
                                        ? "bg-blue-50 text-blue-600 border-blue-100" 
                                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    )}>
                                      {isTeacherRole 
                                        ? getLabel("أستاذ", "Enseignant", "Teacher") 
                                        : getLabel("طالب", "Étudiant", "Student")}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-slate-400 font-semibold font-mono">
                                    <span className="flex items-center gap-1 truncate text-slate-500">
                                      <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                      {req.email}
                                    </span>
                                    {req.phone && (
                                      <span className="flex items-center gap-1 text-slate-500">
                                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                        {req.phone}
                                      </span>
                                    )}
                                    {req.parent_phone && (
                                      <span className="flex items-center gap-1 text-slate-400">
                                        📱 {getLabel(`ولي الأمر: `, "Parent: ", "Parent: ")} {req.parent_phone}
                                      </span>
                                    )}
                                    {req.subject_name && (
                                      <span className="flex items-center gap-1 text-indigo-500 font-bold truncate">
                                        📚 {getLabel(`المادة: `, "Matiere: ", "Subject: ")} {req.subject_name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                  <button
                                    onClick={() => handleApproveRegistrationRequest(req, selfRoleClean)}
                                    disabled={isCurrentlyProcessing}
                                    className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/15 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 h-7"
                                    title={getLabel("قبول كـطلب العضو الأصلي وهيكلة حسابه", "Approuver avec role demande", "Approve requested role")}
                                  >
                                    {isCurrentlyProcessing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "💡"} 
                                    {getLabel("تفعيل الطلب", "Approuver", "Approve")}
                                  </button>
                                  
                                  <button
                                    onClick={() => handleApproveRegistrationRequest(req, otherRoleClean)}
                                    disabled={isCurrentlyProcessing}
                                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 h-7"
                                    title={getLabel(`تغيير وتفعيل كـ ${isTeacherRole ? 'طالب' : 'أستاذ'}`, `Inverser le role`, `Swap role and approve`)}
                                  >
                                    🔄 {isTeacherRole 
                                      ? getLabel("طالب", "Étudiant", "Student") 
                                      : getLabel("أستاذ", "Enseignant", "Teacher")}
                                  </button>

                                  <button
                                    onClick={() => handleRejectRegistrationRequest(req.id)}
                                    disabled={isCurrentlyProcessing}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all cursor-pointer disabled:opacity-50 h-7 w-7 flex items-center justify-center"
                                    title={getLabel("رفض وحذف استمارة التسجيل", "Rejeter & Supprimer", "Reject & Delete")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {regRequests.filter(r => r.status?.toUpperCase() === 'PENDING' || !r.status).length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-[10px] font-bold uppercase font-sans">
                              ☘️ {i18n.language === 'ar' ? "لا توجد رسائل تسجيل معلقة في قاعدة البيانات" : "No pending registration database rows found!"}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {usersList.filter(u => u.role?.toLowerCase() === 'guest').map((userItem) => (
                            <div key={userItem.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{userItem.fullname}</p>
                                <p className="text-[9px] text-slate-400 font-mono">@{userItem.username} • {userItem.email}</p>
                                {userItem.role_requested && (
                                  <p className="text-[9px] font-black text-amber-500 uppercase mt-1 font-mono">
                                    {getLabel(
                                      `طلب صفة: ${userItem.role_requested === 'teacher' ? 'أستاذ' : 'طالب'}`,
                                      `Role demande: ${userItem.role_requested === 'teacher' ? 'Enseignant' : 'Étudiant'}`,
                                      `Requesting: ${userItem.role_requested}`
                                    )}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-right rtl:text-left shrink-0">
                                <button
                                  onClick={() => handleApproveUser(userItem.id, (userItem.role_requested as 'student' | 'teacher') || 'student')}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/15 flex items-center justify-center gap-1 cursor-pointer h-7"
                                >
                                  💡 {getLabel("تعيين مباشر", "Approuver", "Approve")}
                                </button>
                                <button
                                  onClick={() => handleApproveUser(userItem.id, userItem.role_requested === 'teacher' ? 'student' : 'teacher')}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer h-7"
                                >
                                  {getLabel(
                                    userItem.role_requested === 'teacher' ? "طالب" : "أستاذ",
                                    userItem.role_requested === 'teacher' ? "Activer Étudiant" : "Activer Enseignant",
                                    `As ${userItem.role_requested === 'teacher' ? 'Student' : 'Teacher'}`
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}

                          {usersList.filter(u => u.role?.toLowerCase() === 'guest').length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-[10px] font-bold uppercase font-sans">
                              ☘️ {i18n.language === 'ar' ? "لا توجد طلبات معلقة حالياً" : "All users are authorized!"}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Active Registered Members database */}
                  <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                        {getLabel("قاعدة بيانات الأعضاء المسجّلين", "Base de données des membres actifs", "Registered Active Members")}
                      </h4>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[9px] font-black uppercase">
                        {usersList.filter(u => u.role?.toLowerCase() !== 'guest').length} {getLabel("عضو", "Membres", "Members")}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto no-scrollbar">
                      {usersList.filter(u => u.role?.toLowerCase() !== 'guest').map((userItem) => (
                        <div key={userItem.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black text-slate-800 truncate">{userItem.fullname}</p>
                              {userItem.email === "zaitiabdou27@gmail.com" && (
                                <span className="bg-indigo-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded">DEV</span>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-400 truncate font-mono mt-0.5">@{userItem.username} • {userItem.email}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2.5 py-1 rounded-full",
                              userItem.role?.toLowerCase() === 'developer' || userItem.role?.toLowerCase() === 'developper' ? "bg-indigo-500/10 text-indigo-500" : userItem.role?.toLowerCase() === 'teacher' ? "bg-blue-500/10 text-blue-500" : (userItem.role?.toLowerCase() === 'admin' ? "bg-purple-500/10 text-purple-500" : "bg-emerald-500/10 text-emerald-500")
                            )}>
                              {userItem.role?.toLowerCase() === 'developer' || userItem.role?.toLowerCase() === 'developper' 
                                ? getLabel('المطور', 'Développeur', 'Developer') 
                                : userItem.role?.toLowerCase() === 'teacher' 
                                  ? getLabel('أستاذ', 'Professeur', 'Teacher') 
                                  : (userItem.role?.toLowerCase() === 'admin' ? 'Admin' : getLabel('طالب', 'Élève', 'Student'))}
                            </span>
                            
                            {userItem.id !== profile.id && (
                              <>
                                <button
                                  onClick={() => handleApproveUser(userItem.id, 'guest')}
                                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-amber-500/10 cursor-pointer"
                                  title={getLabel("تجميد الحساب وإرساله لقائمة الانتظار", "Désactiver le compte vers la liste d'attente", "Deactivate accounts to pending state")}
                                >
                                  🔒 {getLabel("تجميد الحساب", "Désactiver", "Freeze")}
                                </button>
                                
                                <button
                                  onClick={() => handleRejectOrDelete(userItem.id)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  🗑️ {getLabel("حذف", "Supprimer", "Delete")}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : !community ? (
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
                <p className="text-slate-500 font-medium tracking-wide">{t('create_community_sub', 'Build your server and start inviting students.')}</p>
              </div>

              <form onSubmit={handleCreateCommunity} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl shadow-blue-500/5 space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('community_name', 'Community Name')}</label>
                  <input 
                    required
                    value={commName}
                    onChange={(e) => setCommName(e.target.value)}
                    placeholder={t('community_name_placeholder', "Prof. Ahmed's Academy")}
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('community_username', 'Community Username')}</label>
                  <input 
                    required
                    value={commUsername}
                    onChange={(e) => setCommUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder={t('community_username_placeholder', "ahmed_academy")}
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                  <p className="text-[10px] text-slate-400 italic">{t('community_username_hint', 'This will be used for students to find your server.')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('community_password', 'Community Password')}</label>
                  <input 
                    required
                    type="password"
                    value={commPassword}
                    onChange={(e) => setCommPassword(e.target.value)}
                    placeholder={t('community_password_placeholder', "Enter a secure password")}
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                  <p className="text-[10px] text-slate-400 italic">{t('community_password_hint', 'Students will need this password to join your community.')}</p>
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

            {activeTab === "settings" ? (
              <SettingsView profile={profile} />
            ) : activeTab === "create-room" ? (
              <div className="max-w-xl mx-auto py-10">
                <div className="space-y-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-blue-500/5">
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black font-display uppercase italic text-slate-900">{t('new_room', 'New Room')}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('room_hint', 'Create a channel for your community.')}</p>
                  </div>
                  <form onSubmit={handleCreateRoom} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('room_name', 'Room Name')}</label>
                      <input 
                        required
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder={t('room_name_placeholder', "Live Class BAC")}
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none focus:border-brand-blue transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('room_username_optional', 'Room Username (Optional)')}</label>
                      <input 
                        value={roomUsername}
                        onChange={(e) => setRoomUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder={t('room_username_placeholder_default', "live_class_bac")}
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('room_password_optional', 'Room Password (Optional)')}</label>
                      <input 
                        type="password"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        placeholder={t('room_password_placeholder', "Leave blank for public room")}
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
                        {t('cancel', 'Cancel')}
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : t('create_room', 'Create Room')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : false ? (
              <div className="space-y-6">
                {/* Intro Card */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-display uppercase tracking-tight text-slate-900">
                      {i18n.language === 'ar' ? "التحكم في العضويات والقبول" : "Members Administration"}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {i18n.language === 'ar' 
                        ? "قم بتفعيل حسابات طلابك الجدد يدوياً أو تجميد الحسابات الوهمية لتجنب الاكتظاظ."
                        : "Verify and activate new student accounts manually, or suspend inactive accounts."}
                    </p>
                  </div>
                  
                  <div className="bg-brand-blue/5 border border-brand-blue/10 p-4 rounded-2xl flex items-center gap-3 shrink-0">
                    <Key className="h-5 w-5 text-brand-blue" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-brand-blue">
                        {i18n.language === 'ar' ? "مفتاح التسجيل لطلابك" : "Your Community ID"}
                      </p>
                      <p className="text-xs font-mono font-black text-slate-700">
                        @{community.community_username}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fast-Track Academic Registration Widget */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-blue/10 text-brand-blue rounded-xl">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                        {i18n.language === 'ar' ? "تسجيل طالب أو أستاذ جديد تلقائياً" : "Fast-Track User Registration"}
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {i18n.language === 'ar' 
                          ? "سجل العضو ببريده الإلكتروني مباشرة وستكون كلمة المرور هي بادئة بريده الإلكتروني بحرف كبير مع كلمة 2026 لتستوفي المعايير الأمنية." 
                          : "Register a user with their email. The initial passcode will be generated with a capitalized prefix and '2026' to meet security rules."}
                      </p>
                    </div>
                  </div>

                  {regError && (
                    <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span>{regError}</span>
                    </div>
                  )}

                  {regSuccess && (
                    <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{regSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegisterUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5 text-left rtl:text-right md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                        {i18n.language === 'ar' ? "الاسم الكامل للعضو" : "Full Name"}
                      </label>
                      <input 
                        type="text"
                        required
                        placeholder={i18n.language === 'ar' ? "مثل: محمد علي" : "e.g. Jean Dupont"}
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-1.5 text-left rtl:text-right md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                        {i18n.language === 'ar' ? "البريد الإلكتروني" : "Email Address"}
                      </label>
                      <input 
                        type="email"
                        required
                        placeholder={i18n.language === 'ar' ? "student@example.com" : "student@example.com"}
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-1.5 text-left rtl:text-right md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                        {i18n.language === 'ar' ? "الصفة / الحساب" : "Role / Position"}
                      </label>
                      <select 
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-bold"
                      >
                        <option value="student">{i18n.language === 'ar' ? "🧑‍🎓 طالب (Student)" : "Student"}</option>
                        <option value="teacher">{i18n.language === 'ar' ? "🧑‍🏫 أستاذ (Teacher)" : "Teacher"}</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full py-3 bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-[0.1em] rounded-xl shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2 cursor-pointer h-10"
                    >
                      {regLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span>{i18n.language === 'ar' ? "تسجيل وتفعيل العضو" : "Create Account"}</span>
                      )}
                    </button>
                  </form>
                </div>

                {usersLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Stats Counter */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {i18n.language === 'ar' ? "قيد الانتظار" : "Pending Approvals"}
                          </p>
                          <p className="text-3xl font-black text-amber-500 mt-1">
                            {usersList.filter(u => u.role?.toLowerCase() === 'guest').length}
                          </p>
                        </div>
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                          <Users className="h-5 w-5 animate-pulse" />
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {i18n.language === 'ar' ? "الطلاب النشطين" : "Active Students"}
                          </p>
                          <p className="text-3xl font-black text-emerald-500 mt-1">
                            {usersList.filter(u => u.role?.toLowerCase() === 'student').length}
                          </p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                          <Users className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {i18n.language === 'ar' ? "الأساتذة والمدراء" : "Teachers & Admins"}
                          </p>
                          <p className="text-3xl font-black text-brand-blue mt-1">
                            {usersList.filter(u => ['teacher', 'admin', 'developer', 'developper'].includes(u.role?.toLowerCase())).length}
                          </p>
                        </div>
                        <div className="p-3 bg-brand-blue/10 text-brand-blue rounded-xl">
                          <Users className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    {/* Pending Request Area */}
                    <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          {i18n.language === 'ar' ? "طلبات الانضمام المعلقة" : "Pending Registration Requests"}
                        </h4>
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                          {usersList.filter(u => u.role?.toLowerCase() === 'guest').length} {i18n.language === 'ar' ? "طلبات" : "Requests"}
                        </span>
                      </div>
                      
                      <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto no-scrollbar">
                        {usersList.filter(u => u.role?.toLowerCase() === 'guest').map((userItem) => (
                          <div key={userItem.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                            <div className="flex items-center gap-3">
                              <img 
                                src={userItem.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userItem.fullname)}&background=f59e0b&color=fff`} 
                                alt="" 
                                className="h-10 w-10 rounded-full shadow-sm" 
                              />
                              <div>
                                <p className="text-xs font-black uppercase text-slate-800">{userItem.fullname}</p>
                                <p className="text-[10px] font-mono text-slate-400">@{userItem.username}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {userItem.role_requested && (
                                <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full mr-2">
                                  {i18n.language === 'ar' ? `طلب صفة: ${userItem.role_requested === 'teacher' ? 'أستاذ' : 'طالب'}` : `Requesting: ${userItem.role_requested}`}
                                </span>
                              )}
                              
                              <button
                                onClick={() => handleApproveUser(userItem.id, (userItem.role_requested as 'student' | 'teacher') || 'student')}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                              >
                                {i18n.language === 'ar' ? "قبول وتفعيل كلي" : "Approve & Activate"}
                              </button>
                              
                              <button
                                onClick={() => handleApproveUser(userItem.id, userItem.role_requested === 'teacher' ? 'student' : 'teacher')}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                {i18n.language === 'ar' 
                                  ? (userItem.role_requested === 'teacher' ? "تفعيل كطالب" : "تفعيل كأستاذ") 
                                  : `As ${userItem.role_requested === 'teacher' ? 'Student' : 'Teacher'}`}
                              </button>

                              <button
                                onClick={() => handleRejectOrDelete(userItem.id)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                {i18n.language === 'ar' ? "رفض وحذف" : "Reject"}
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {usersList.filter(u => u.role?.toLowerCase() === 'guest').length === 0 && (
                          <div className="p-12 text-center text-slate-400">
                            <p className="text-xs font-black uppercase tracking-wider">{i18n.language === 'ar' ? "لا يوجد أي طلبات معلقة" : "No pending requests"}</p>
                            <p className="text-[9px] font-medium mt-1">{i18n.language === 'ar' ? "سيصلك إشعار هنا عند قيام طلاب جدد بالتسجيل في المنصة." : "New students registration will manifest here for approval."}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Accounts Area */}
                    <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          {i18n.language === 'ar' ? "الأعضاء المسجلين والطلاب النشطين" : "Active School Database Profiles"}
                        </h4>
                        <span className="bg-brand-blue/15 text-brand-blue text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                          {usersList.filter(u => u.role?.toLowerCase() !== 'guest').length} {i18n.language === 'ar' ? "عضو" : "Members"}
                        </span>
                      </div>
                      
                      <div className="divide-y divide-slate-50 max-h-[350px] overflow-y-auto no-scrollbar">
                        {usersList.filter(u => u.role?.toLowerCase() !== 'guest').map((userItem) => (
                          <div key={userItem.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                            <div className="flex items-center gap-3">
                              <img 
                                src={userItem.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userItem.fullname)}&background=3b82f6&color=fff`} 
                                alt="" 
                                className="h-10 w-10 rounded-full shadow-sm" 
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black uppercase text-slate-800">{userItem.fullname}</p>
                                  {userItem.id === profile.id && (
                                    <span className="bg-brand-blue/10 text-brand-blue text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                                      {i18n.language === 'ar' ? "أنت" : "You"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono text-slate-400">@{userItem.username}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[8px] font-black uppercase px-2.5 py-1 rounded-full",
                                userItem.role?.toLowerCase() === 'developer' || userItem.role?.toLowerCase() === 'developper' ? "bg-indigo-500/10 text-indigo-500" : userItem.role?.toLowerCase() === 'teacher' ? "bg-blue-500/10 text-blue-500" : (userItem.role?.toLowerCase() === 'admin' ? "bg-purple-500/10 text-purple-500" : "bg-emerald-500/10 text-emerald-500")
                              )}>
                                {userItem.role?.toLowerCase() === 'developer' || userItem.role?.toLowerCase() === 'developper' ? (i18n.language === 'ar' ? 'المطور' : 'Developer') : userItem.role?.toLowerCase() === 'teacher' ? (i18n.language === 'ar' ? 'أستاذ' : 'Teacher') : (userItem.role?.toLowerCase() === 'admin' ? 'Admin' : (i18n.language === 'ar' ? 'طالب' : 'Student'))}
                              </span>
                              
                              {userItem.id !== profile.id && (
                                <>
                                  <button
                                    onClick={() => handleApproveUser(userItem.id, 'guest')}
                                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-amber-500/10 cursor-pointer"
                                    title={i18n.language === 'ar' ? "تجميد الحساب وإرساله لقائمة الانتظار" : "Deactivate accounts to pending state"}
                                  >
                                    🔒 {i18n.language === 'ar' ? "تجميد الحساب" : "Freeze"}
                                  </button>
                                  
                                  <button
                                    onClick={() => handleRejectOrDelete(userItem.id)}
                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                  >
                                    🗑️ {i18n.language === 'ar' ? "حذف نهائي" : "Delete"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                           <span className="text-[10px] font-bold text-slate-400">{t('manage_room', 'Manage Class')}</span>
                        </div>
                        
                        <button 
                          onClick={() => handleEnterRoom(room)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md transition-all",
                            room.room_type === 'live' 
                              ? "bg-brand-blue text-white shadow-blue-500/10 hover:bg-blue-600"
                              : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          )}
                        >
                          {room.room_type === 'live' ? t('enter', 'Enter') : t('open', 'Open')}
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
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('no_rooms_yet', 'No rooms yet')}</p>
                      <p className="text-[10px] font-medium text-slate-400">{t('no_rooms_hint', 'Create your first room to start interacting.')}</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab("create-room")}
                      className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                    >
                      {t('new_room', 'New Room')}
                    </button>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
