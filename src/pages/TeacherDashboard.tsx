import React from "react";
import { UserProfile, TeacherCommunity, ClassRoom, RoomType, LiveSession } from "../types";
import Sidebar from "../components/Sidebar";
import SettingsView from "../components/SettingsView";
import { supabase, createAdminAuthClient } from "../lib/supabase";
import { Plus, Video, Trash2, Edit3, Loader2, Play, Users, Menu, X, Database, MessageSquare, Megaphone, FileText, Settings, Hash, Radio, Key, Mail, Phone, LogOut, RefreshCw, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import StreamPlayer from "../components/StreamPlayer";
import { cn, formatDate } from "../lib/utils";
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
  const isAdmin = profile.role?.toString().toLowerCase() === "admin";
  const isManager = isDeveloper || isAdmin;
  const [activeTab, setActiveTab] = React.useState(isManager ? "all-profiles" : "rooms");
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

  // Edit User State
  const [editingUser, setEditingUser] = React.useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = React.useState("");
  const [editUsername, setEditUsername] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [confirmEditPassword, setConfirmEditPassword] = React.useState("");
  const [editRole, setEditRole] = React.useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(false);
  const [showEditPassword, setShowEditPassword] = React.useState(false);

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditFullName(user.fullname || "");
    setEditUsername(user.username || "");
    setEditPassword("");
    setConfirmEditPassword("");
    setEditRole(user.role || "student");
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) {
      alert("No user selected for editing");
      return;
    }

    if (!profile || !profile.id) {
      alert("Current profile not loaded. Please wait.");
      return;
    }
    
    if (!isManager) {
      alert(getLabel("عذراً، يجب أن تكون مطوراً للقيام بهذا الإجراء", "Désolé, vous devez être un développeur pour effectuer cette action", "Sorry, you must be a developer to perform this action"));
      return;
    }

    if (!editFullName.trim()) {
      alert("Full name is required");
      return;
    }

    if (!editUsername.trim()) {
      alert("Username is required");
      return;
    }
    
    if (editPassword) {
      if (editPassword.length < 6) {
        alert(getLabel(
          "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
          "Le mot de passe doit contenir au moins 6 caractères.",
          "Password must be at least 6 characters long."
        ));
        return;
      }

      if (editPassword !== confirmEditPassword) {
        alert(getLabel("كلمات المرور غير متطابقة", "Les mots de passe ne correspondent pas", "Passwords do not match"));
        return;
      }
    }
    
    setEditLoading(true);
    console.log("--- Frontend Update Start ---");
    console.log("Target User ID:", editingUser.id);
    console.log("Dev ID:", profile.id);
    
    try {
      let apiSuccess = false;
      
      const payload = {
        userId: editingUser.id,
        developerId: profile.id,
        password: editPassword || undefined,
        updates: {
          fullname: editFullName,
          name: editFullName,
          username: editUsername.toLowerCase(),
          role: editRole
        }
      };

      try {
        const response = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.success) {
            apiSuccess = true;
          } else if (result.error) {
            throw new Error(result.error);
          }
        }
      } catch (apiErr: any) {
        console.warn("API route error, using Supabase direct update fallback:", apiErr);
      }

      // Fallback if API route is not available (e.g. static hosting on Vercel)
      if (!apiSuccess) {
        const profileUpdates: any = {
          fullname: editFullName,
          name: editFullName,
          username: editUsername.toLowerCase(),
          role: editRole,
          updated_at: new Date().toISOString()
        };
        if (editPassword) {
          profileUpdates.password = editPassword;
        }

        let { error: directError } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", editingUser.id);

        // If the 'password' column is missing from the database schema
        if (directError && directError.message?.includes("password")) {
          delete profileUpdates.password;
          const { error: retryError } = await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("id", editingUser.id);
          
          if (retryError) throw retryError;
        } else if (directError) {
          throw directError;
        }
      }

      alert(getLabel("تم تحديث البيانات بنجاح", "Profil mis à jour avec succès", "Profile updated successfully"));
      setIsEditModalOpen(false);
      setEditingUser(null);
      setEditPassword("");
      setConfirmEditPassword("");
      await fetchUsers();
    } catch (err: any) {
      console.error("Critical Update Error:", err);
      let errorMessage = err.message || "Failed to update user";
      
      // Handle Supabase weak password error variants
      const lowerErr = errorMessage.toLowerCase();
      if (lowerErr.includes("abcdefghijklmnopqrstuvwxyz") || 
          lowerErr.includes("weak_password") || 
          lowerErr.includes("at least one character") ||
          lowerErr.includes("should contain")) {
        errorMessage = getLabel(
          "يجب أن تحتوي كلمة المرور على أحرف كبيرة وصغيرة وأرقام",
          "Le mot de passe doit contenir des majuscules, des minuscules et des chiffres",
          "Password must contain uppercase, lowercase letters and numbers"
        );
      }
      
      alert(errorMessage);
    } finally {
      setEditLoading(false);
      console.log("--- Frontend Update End ---");
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin) return;
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
        let base = "User";
        if (prefixClean.length >= 3) {
          // Extract only letters for the base to ensure we have letters to capitalize
          const lettersOnly = prefixClean.replace(/[^a-zA-Z]/g, '');
          if (lettersOnly.length >= 3) {
            base = lettersOnly;
          }
        }
        const capitalized = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
        return `${capitalized}2026`; // e.g., "Abdou2026", "User2026"
      })();
      
      // 2. Register the user with compliant password
      const { data: signUpData, error: signUpError } = await adminAuth.auth.signUp({
        email: emailToSignUp,
        password: dynamicPass,
        options: {
          data: {
            fullname: fullNameToSignUp,
            password: dynamicPass,
            full_name: fullNameToSignUp,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        const newUserId = signUpData.user.id;
        
        const usernameToSet = emailToSignUp.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');

        // 3. Immediately activate / update their role to the selected role
        // Instead of GUEST, they directly become Student or Teacher!
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            fullname: fullNameToSignUp,
            password: dynamicPass,
            name: fullNameToSignUp,
            username: usernameToSet,
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
      // Use the admin list-users API to get passwords from metadata
      const response = await fetch(`/api/admin/list-users?developerId=${profile.id}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        // Fallback to direct supabase fetch if API fails or unauthorized
        console.warn("API fetch failed, falling back to direct supabase fetch");
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setUsersList((data || []) as UserProfile[]);
        return;
      }
      
      const data = await response.json();
      setUsersList(data as UserProfile[]);
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
    if (activeTab === "manage-users" || activeTab === "all-profiles") {
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
        let base = "User";
        if (prefixClean.length >= 3) {
          const lettersOnly = prefixClean.replace(/[^a-zA-Z]/g, '');
          if (lettersOnly.length >= 3) {
            base = lettersOnly;
          }
        }
        const capitalized = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
        return `${capitalized}2026`;
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
        const usernameToSet = emailToSignUp.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            fullname: fullNameToSignUp,
            password: dynamicPass,
            name: fullNameToSignUp,
            username: usernameToSet,
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
            password: dynamicPass,
              full_name: fullNameToSignUp,
            }
          }
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          targetUserId = signUpData.user.id;
          const usernameToSet = emailToSignUp.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              fullname: fullNameToSignUp,
            password: dynamicPass,
              name: fullNameToSignUp,
              username: usernameToSet,
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
    if (isAdmin) return;
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
    if (isAdmin) return;
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
    if (isAdmin) return;
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
    if (isAdmin) return;
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
    if (isAdmin) {
      alert("Admin accounts have read-only access.");
      return;
    }
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
            <SettingsView profile={profile} />
          </div>
        ) : activeTab === "all-profiles" && isManager ? (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black font-display uppercase italic tracking-tighter text-slate-900 leading-none">
                    {getLabel("دليل المستخدمين وكلمات المرور", "Annuaire & Passcodes", "User Directory & Passcodes")}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    {getLabel(
                      "تحتوي هذه القائمة على جميع الحسابات المسجلة مع كلمات المرور الافتراضية الخاصة بهم.",
                      "Liste complète des comptes avec leurs mots de passe par défaut.",
                      "Complete list of all registered accounts with their default passcodes."
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                   <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500">
                      {usersList.length} {getLabel("حساب", "Profils", "Profiles")}
                   </div>
                   <button 
                    onClick={() => fetchUsers()}
                    className="p-2 bg-brand-blue text-white rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                   >
                     <RefreshCw className="h-4 w-4" />
                   </button>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left rtl:text-right">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{getLabel("المستخدم", "Utilisateur", "User")}</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{getLabel("البريد الإلكتروني", "Email", "Email")}</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{getLabel("اسم المستخدم", "Username", "Username")}</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{getLabel("الصفة", "Rôle", "Role")}</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                        <div className="flex items-center gap-1.5">
                          <Key className="h-3 w-3" />
                          <span>{getLabel("كلمة السر (افتراضية)", "Pass (Défaut)", "Passcode (Default)")}</span>
                        </div>
                      </th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 text-center">{getLabel("إجراءات", "Actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {usersList.map((user) => {
                      const email = user.email || "";
                      const prefixClean = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                      const defaultPass = (() => {
                        if (prefixClean.length >= 3) {
                          const capitalized = prefixClean.charAt(0).toUpperCase() + prefixClean.slice(1).toLowerCase();
                          return `${capitalized}2026`;
                        }
                        return "Nadjah2026";
                      })();

                      const displayPass = user.password || defaultPass;

                      return (
                        <tr key={user.id} className="group hover:bg-slate-50/50 transition-all">
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 truncate uppercase tracking-tight">{user.fullname || "Anonymous"}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(user.created_at)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500 lowercase">{user.email}</span>
                          </td>
                          <td className="py-4 px-2">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">@{user.username}</span>
                          </td>
                          <td className="py-4 px-2">
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                              user.role === 'developer' || user.role === 'developper' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                              user.role === 'admin' ? "bg-purple-50 border-purple-100 text-purple-600" :
                              user.role === 'teacher' ? "bg-blue-50 border-blue-100 text-blue-600" :
                              "bg-emerald-50 border-emerald-100 text-emerald-600"
                            )}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-700 select-all border border-slate-200">
                                {displayPass}
                              </code>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(displayPass);
                                }}
                                className="p-1.5 text-slate-400 hover:text-brand-blue transition-colors"
                                title="Copy Passcode"
                              >
                                <Key className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                             <div className="flex items-center justify-center gap-2">
                               {user.id !== profile.id && (
                                 <>
                                   {isDeveloper && (
                                     <button 
                                       onClick={() => handleOpenEditModal(user)}
                                       className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                                       title={getLabel("تعديل", "Modifier", "Edit")}
                                     >
                                       <Edit3 className="h-4 w-4" />
                                     </button>
                                   )}
                                   <button 
                                     onClick={() => handleRejectOrDelete(user.id)}
                                     className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </button>
                                 </>
                               )}
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
                  <label className="text-xs font-semibold text-slate-500 ml-2">{t('community_name', 'Community Name')}</label>
                  <input 
                    required
                    value={commName}
                    onChange={(e) => setCommName(e.target.value)}
                    placeholder={t('community_name_placeholder', "Prof. Ahmed's Academy")}
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none focus:border-brand-blue transition-all font-medium", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 ml-2">{t('community_username', 'Community Username')}</label>
                  <input 
                    required
                    value={commUsername}
                    onChange={(e) => setCommUsername(e.target.value)}
                    placeholder={t('community_username_placeholder', "ahmed_academy")}
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                  <p className="text-[10px] text-slate-400 font-medium ml-2">{t('community_username_hint', 'This will be used for students to find your server.')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 ml-2">{t('community_password', 'Community Password')}</label>
                  <input 
                    required
                    type="password"
                    value={commPassword}
                    onChange={(e) => setCommPassword(e.target.value)}
                    placeholder={t('community_password_placeholder', "Enter a secure password")}
                    className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-sm outline-none focus:border-brand-blue transition-all", i18n.language === 'ar' ? 'text-right' : 'text-left')}
                  />
                  <p className="text-[10px] text-slate-400 font-medium ml-2">{t('community_password_hint', 'Students will need this password to join your community.')}</p>
                </div>

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
            {!isAdmin && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveTab("create-room")}
                  className="flex items-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/10 hover:bg-blue-600 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  {t('add_room', 'Add Room')}
                </button>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-600 font-bold text-[10px] uppercase tracking-widest shadow-sm">
                <Key className="h-3.5 w-3.5" />
                Read Only Access
              </div>
            )}
            </header>

            {activeTab === "settings" ? (
              <SettingsView profile={profile} />
            ) : activeTab === "create-room" ? (
              <div className="max-w-xl mx-auto py-10">
                <div className="space-y-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-blue-500/5">
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black font-display uppercase italic text-slate-900">{t('new_room', 'قسم جديد')}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('room_hint', 'Create a channel for your community.')}</p>
                  </div>
                  <form onSubmit={handleCreateRoom} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('room_name', 'إسم القسم')}</label>
                      <input 
                        required
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder={t('room_name_placeholder', "سنة أولى")}
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none focus:border-brand-blue transition-all"
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
                    {/* Room type selection removed as requested */}
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
            ) : (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {rooms.map((room) => (
                  <motion.div 
                    key={room.id}
                    layout
                    className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isAdmin && (
                        <button 
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-2 text-slate-300 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
            )}
          </div>
        )}
      </main>

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-5">
                  <div>
                    <h3 className="text-xl font-black font-display uppercase italic tracking-tighter text-slate-900 leading-none">
                      {getLabel("تعديل بيانات المستخدم", "Modifier le profil", "Edit User Profile")}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                      {editingUser?.email}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      {getLabel("الاسم الكامل", "Nom complet", "Full Name")}
                    </label>
                    <input 
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      {getLabel("اسم المستخدم", "Nom d'utilisateur", "Username")}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs select-none">@</span>
                      <input 
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      {getLabel("الصلاحية", "Rôle", "Role")}
                    </label>
                    <select 
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-bold"
                    >
                      <option value="student">🧑‍🎓 Student</option>
                      <option value="teacher">🧑‍🏫 Teacher</option>
                      <option value="admin">🛡️ Admin</option>
                      <option value="developer">💻 Developer</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                        {getLabel("كلمة المرور الجديدة", "Nouveau mot de passe", "New Password")}
                      </label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                          type={showEditPassword ? "text" : "password"}
                          placeholder={getLabel("A-z, 0-9", "A-z, 0-9", "A-z, 0-9")}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        >
                          {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                        {getLabel("تأكيد كلمة المرور", "Confirmer", "Confirm")}
                      </label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                          type={showEditPassword ? "text" : "password"}
                          placeholder="..."
                          value={confirmEditPassword}
                          onChange={(e) => setConfirmEditPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-slate-800 text-xs focus:outline-none focus:border-brand-blue transition-all font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        >
                          {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                    >
                      {getLabel("إلغاء", "Annuler", "Cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex-2 py-3.5 bg-brand-blue hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{getLabel("حفظ التغييرات", "Enregistrer", "Save Changes")}</span>}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
