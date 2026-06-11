import React from "react";
import { supabase, supabaseConfigured, isProperAnonKey } from "./lib/supabase";
import { UserProfile, UserRole } from "./types";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import { LogIn, GraduationCap, School, Loader2, Database, Key, CheckCircle2, Mail, ArrowRight, Video, Languages, User, Users, BookOpen, Sparkles, Calculator, Atom, Compass, Brain, Globe, Trophy, Palette, Music, Lightbulb, PenTool, FlaskConical, Ruler, Sigma } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "./lib/utils";

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");

  const [email, setEmail] = React.useState("");
  const [fullname, setFullname] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [chosenRole, setChosenRole] = React.useState<UserRole>("student");
  const [password, setPassword] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);

  const fetchProfile = React.useCallback(async (userId: string, userEmail?: string) => {
    setProfileLoading(true);
    setFetchError(null);
    try {
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch error:", error);
        // Fallback for different schema if maybeSingle fails due to missing columns
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("id, role") // Select only common fields
          .eq("id", userId)
          .maybeSingle();
        
        if (!fallbackError && fallbackData) {
          data = fallbackData;
        } else {
          throw error;
        }
      }

      // Auto-create profile if missing and we have an email
      if (!data && userEmail) {
        const username = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        // Try multiple field names for compatibility
        const profileData: any = {
          id: userId,
          email: userEmail,
          role: 'teacher'
        };

        // Add fields based on what columns likely exist or just try-catch the insert
        try {
          const { data: created, error: createError } = await supabase
            .from("profiles")
            .insert({
              ...profileData,
              fullname: userEmail.split('@')[0],
              name: userEmail.split('@')[0],
              username: username
            })
            .select()
            .maybeSingle();
          
          if (createError) {
            // Second attempt with minimal fields if first fails
            const { data: created2, error: createError2 } = await supabase
              .from("profiles")
              .insert(profileData)
              .select()
              .maybeSingle();
            
            if (createError2) {
              console.error("Auto-profile creation failed:", createError2);
            } else if (created2) {
              data = created2;
            }
          } else if (created) {
            data = created;
          }
        } catch (e) {
          console.error("Critical error in profile creation:", e);
        }
      }

      if (data) {
        // Ensure role is normalized for our app
        let normalizedRole = (data.role || "student").toString().toLowerCase() as UserRole;
        const currentEmail = userEmail || data.email;
        if (currentEmail && currentEmail.toLowerCase() === "zaitiabdou27@gmail.com") {
          normalizedRole = "developer";
          // silently keep the DB synchronized if possible
          if (data.role !== "developer") {
            supabase
              .from("profiles")
              .update({ role: "developer" })
              .eq("id", userId)
              .then(({ error }) => {
                if (error) console.log("Silent role sync deferred:", error.message);
              });
          }
        } else if (normalizedRole === "developper") {
          normalizedRole = "developer";
        }

        setProfile({
          ...data,
          role: normalizedRole,
          fullname: data.fullname || data.name || (currentEmail ? currentEmail.split('@')[0] : "user"),
          username: data.username || (currentEmail ? currentEmail.split('@')[0] : "user")
        } as UserProfile);
      } else {
        setFetchError("NOT_REGISTERED");
      }
      
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      if (err.code === "42P01") {
        setFetchError("TABLES_MISSING");
      } else {
        setFetchError(`${err.message || "Failed to load user profile"} (Code: ${err.code || 'unknown'})`);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchProfile(currentUser.id, currentUser.email);
        setFetchError(null);
      } else {
        setProfile(null);
      }
    });

    const handleDevLogout = () => {
      setUser(null);
      setProfile(null);
      setFetchError(null);
      setAuthError(null);
    };
    window.addEventListener("dev-logout", handleDevLogout);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("dev-logout", handleDevLogout);
    };
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Auth error details:", err);
      if (err.message?.includes('provider is not enabled')) {
        setAuthError("GOOGLE_NOT_ENABLED: Please enable Google Login in Supabase or use the Email option below.");
      } else {
        setAuthError(err.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      if (authMode === "signin") {
        if (!email || !password) return;
        let loginEmail = email.trim();
        
        // If it doesn't contain "@", treat it as a Username
        if (!loginEmail.includes("@")) {
          const { data: profileObj, error: searchError } = await supabase
            .from("profiles")
            .select("email, id")
            .eq("username", loginEmail.toLowerCase())
            .maybeSingle();
            
          if (profileObj?.email) {
            loginEmail = profileObj.email;
          } else {
            // Placeholder standard suffix: username@ecolenadjah.local
            loginEmail = `${loginEmail.toLowerCase()}@ecolenadjah.local`;
          }
        }
        
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) {
          // If the profile holds a different email pattern we didn't search properly, bypass if it fails
          throw error;
        }
      } else {
        // Sign Up Mode
        if (!fullname.trim() || !username.trim() || !password) {
          throw new Error(i18n.language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة!' : 'Please fill all required fields!');
        }
        
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        if (cleanUsername.length < 3) {
          throw new Error(i18n.language === 'ar' ? 'يجب أن يكون اسم المستخدم 3 أحرف على الأقل.' : 'Username must be at least 3 character long alphanumeric string.');
        }
        
        // Generate a clean virtual email that is 100% free and requires no verification
        const signUpEmail = `${cleanUsername}@ecolenadjah.local`;
        
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: signUpEmail,
          password,
          options: {
            data: {
              fullname: fullname.trim(),
            }
          }
        });
        
        if (error) throw error;
        
        if (signUpData.user) {
          // Enforce GUEST state upon registration, preventing instant/fake profile activation
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              fullname: fullname.trim(),
              name: fullname.trim(),
              username: cleanUsername,
              role: 'GUEST',
              role_requested: chosenRole
            })
            .eq("id", signUpData.user.id);
            
          if (profileError) {
            console.error("Error setting custom role upon signup:", profileError);
          }
        }
        
        setAuthError("ACCOUNT_CREATED_SUCCESS: Success! Your account was registered. Please ask the Teacher or School Manager to authorize and activate your account. You can sign in once active.");
        setAuthMode("signin");
        setEmail(cleanUsername); // Pre-fill username field in login
      }
    } catch (err: any) {
      console.error("Auth error details:", err);
      const msg = err.message || "";
      if (msg.includes('Invalid login credentials')) {
        setAuthError(i18n.language === 'ar' ? "خطأ في تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور." : "Access Denied. Please ensure your username and password are correct.");
      } else if (msg.includes('Email not confirmed')) {
        setAuthError(i18n.language === 'ar' ? "تأكيد البريد الإلكتروني مطلوب: يرجى الطلب من المدير إيقاف خيار 'Confirm email' في إعدادات Supabase للولوج الفوري." : "CONFIRM_REQUIRED: Email confirmation required. Please ask your administrator/manager to turn off 'Confirm email' under Authentication -> Providers -> Email in the Supabase Dashboard, which allows instant local signups for free!");
      } else {
        setAuthError(err.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDevBypass = async (role: "student" | "teacher", offlineBypass: boolean) => {
    setAuthLoading(true);
    setAuthError(null);
    
    if (offlineBypass) {
      const mockId = role === "teacher" ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002";
      const mockEmail = `dev-${role}@example.com`;
      const mockUser = {
        id: mockId,
        email: mockEmail,
        user_metadata: { fullname: `Dev ${role === "teacher" ? "Teacher" : "Student"}` }
      };
      const mockProfile: UserProfile = {
        id: mockId,
        fullname: role === "teacher" ? "Dev Teacher" : "Dev Student",
        name: role === "teacher" ? "Dev Teacher" : "Dev Student",
        email: mockEmail,
        username: `dev_${role}`,
        role: role as any,
        created_at: new Date().toISOString()
      };
      
      setUser(mockUser);
      setProfile(mockProfile);
      setFetchError(null);
      setAuthLoading(false);
      return;
    }

    let email = localStorage.getItem(`dev_${role}_verified_email`);
    const password = "devpassword123";

    if (email) {
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!signInError && signInData.user) {
          // Guarantee correct role upon signIn
          await supabase
            .from("profiles")
            .update({ role: role })
            .eq("id", signInData.user.id);
          await fetchProfile(signInData.user.id, email);
          setAuthLoading(false);
          return;
        }
        localStorage.removeItem(`dev_${role}_verified_email`);
      } catch (e) {
        localStorage.removeItem(`dev_${role}_verified_email`);
      }
    }

    // Fallback to dynamic, completely unique email/username generation to prevent ANY possible trigger constraint failures on the DB
    const uniqueId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    email = `dev-${role}-${uniqueId}@nadjah.com`;

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: role === "teacher" ? "Dev Teacher (Auth)" : "Dev Student (Auth)",
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (signUpData.user) {
        const userId = signUpData.user.id;
        // Trigger already inserted row in profiles upon auth.users insert, so we update the role to prevent duplicate key error
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            fullname: role === "teacher" ? "Dev Teacher (Auth)" : "Dev Student (Auth)",
            name: role === "teacher" ? "Dev Teacher (Auth)" : "Dev Student (Auth)",
            role: role
          })
          .eq("id", userId);
        
        if (profileError) {
          console.error("Profile update error for dev bypass:", profileError);
        }

        // Only save newly created email to localStorage if it successfully signed up and registered
        localStorage.setItem(`dev_${role}_verified_email`, email);
        await fetchProfile(userId, email);
      }
    } catch (err: any) {
      console.error("Auth Dev Bypass Error:", err);
      // Fallback to offline state mock so the dev is never locked out
      setAuthError(`Auth failed (${err.message}). Defaulting offline instead.`);
      const mockId = role === "teacher" ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002";
      const mockEmail = `dev-${role}@example.com`;
      const mockUser = {
        id: mockId,
        email: mockEmail,
        user_metadata: { fullname: `Dev ${role === "teacher" ? "Teacher" : "Student"}` }
      };
      const mockProfile: UserProfile = {
        id: mockId,
        fullname: role === "teacher" ? "Dev Teacher" : "Dev Student",
        name: role === "teacher" ? "Dev Teacher" : "Dev Student",
        email: mockEmail,
        username: `dev_${role}`,
        role: role as any,
        created_at: new Date().toISOString()
      };
      setUser(mockUser);
      setProfile(mockProfile);
      setFetchError(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const isStuck = user && !profile && !profileLoading && !fetchError;

  if (!supabaseConfigured) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-8 text-center overflow-y-auto">
        <div className="w-20 h-20 bg-brand-blue/10 rounded-3xl flex items-center justify-center mb-8 border border-brand-blue/20 shadow-sm">
          <Database className="h-10 w-10 text-brand-blue" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-4">
          Database Configuration Required
        </h2>
        <p className="max-w-md text-slate-500 mb-8 text-sm leading-relaxed">
          Nadjah Live has migrated to Supabase for better performance. Please configure your project credentials in the Secrets panel to continue.
        </p>

        <div className="grid gap-4 w-full max-w-sm text-left">
          {[
            { 
              icon: Key, 
              label: "VITE_SUPABASE_URL", 
              desc: "Project URL (e.g., https://xyz.supabase.co)",
              error: !supabaseConfigured && !import.meta.env.VITE_SUPABASE_URL && !import.meta.env.SUPABASE_URL 
            },
            { 
              icon: Key, 
              label: "VITE_SUPABASE_ANON_KEY", 
              desc: "Anon Public Key (Starts with 'ey...')",
              error: !isProperAnonKey
            }
          ].map((item, i) => (
            <div key={i} className={`bg-white border ${item.error ? 'border-red-500/50 bg-red-50' : 'border-slate-200'} p-4 rounded-2xl flex items-center gap-4 shadow-sm text-slate-900`}>
              <div className={`h-10 w-10 ${item.error ? 'bg-red-500/10' : 'bg-slate-100'} rounded-xl flex items-center justify-center`}>
                <item.icon className={`h-5 w-5 ${item.error ? 'text-red-500' : 'text-slate-500'}`} />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${item.error ? 'text-red-500' : 'text-brand-blue'} leading-none mb-1`}>{item.label}</p>
                <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-4 bg-brand-blue/5 border border-brand-blue/10 rounded-2xl flex items-start gap-4 max-w-sm text-left">
          <CheckCircle2 className="h-5 w-5 text-brand-blue shrink-0 mt-0.5" />
          <p className="text-[10px] text-brand-blue font-bold uppercase tracking-wider leading-relaxed">
            Enter these in the <span className="underline font-black">Secrets panel</span>. If you just added them, try clicking the "Retry" button below or refreshing the page.
          </p>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
        >
          Refresh & Retry
        </button>
      </div>
    );
  }

  if (loading || profileLoading || isStuck) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-brand-blue space-y-6">
        <Loader2 className="h-10 w-10 animate-spin" />
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Syncing with Nadjah Cloud</p>
          {isStuck && <p className="text-[8px] text-slate-500 italic">This usually takes a few seconds...</p>}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-6 text-center overflow-y-auto">
        <div className="w-16 h-16 bg-brand-blue/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-blue/20 shadow-sm">
          <Database className="h-8 w-8 text-brand-blue" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
          {fetchError === 'NOT_REGISTERED' ? "Approval Pending" : "System Notification"}
        </h2>
        
        <div className="max-w-2xl w-full text-sm mb-8 font-medium text-brand-blue bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          {fetchError === 'NOT_REGISTERED' ? (
            <div className="space-y-4 text-center py-2 h-auto">
              <p className="leading-relaxed text-sm text-slate-600 font-medium">
                Hi! Your account was successfully registered, but must be authorized by your teacher or school manager before you can enter classes.
              </p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-slate-400">Account Email:</span>
                  <span className="font-mono text-slate-900 font-bold">{user?.email}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold italic text-center pt-2">
                Approval typically takes a short while. Please contact your coordinator.
              </p>

            </div>
          ) : profile?.role?.toString().toLowerCase() === 'guest' ? (
            <div className="space-y-6 text-center">
               <div className="flex justify-center">
                  <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200">
                    <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                  </div>
               </div>
               <div className="space-y-2">
                 <p className="text-slate-900 font-black uppercase italic tracking-tighter text-xl">Approval Pending</p>
                 <p className="text-slate-500 text-xs font-medium px-4">
                   Your account is active, but a <span className="text-brand-blue font-bold">Manager</span> must approve your access before you can join classes.
                 </p>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">Request Info</p>
                  <p className="text-[10px] text-slate-600">ID: <span className="font-mono">{user?.id}</span></p>
                  <p className="text-[10px] text-slate-600">Email: {user?.email}</p>
               </div>
            </div>
          ) : fetchError === 'TABLES_MISSING' ? (
            <div className="space-y-6 text-left">
              <p className="text-slate-600 leading-relaxed text-sm">
                The database tables are missing. Please run the full overhaul SQL from <strong>supabase_schema.sql</strong> in the Supabase SQL Editor:
              </p>
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 font-mono text-[9px] text-emerald-600 overflow-x-auto whitespace-pre max-h-[300px]">
{`-- Run this FULL cleanup SQL:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='name') THEN ALTER TABLE public.profiles ADD COLUMN name text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='fullname') THEN ALTER TABLE public.profiles ADD COLUMN fullname text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN ALTER TABLE public.profiles ADD COLUMN username text; END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_members' AND column_name='student_id') THEN ALTER TABLE public.room_members RENAME COLUMN student_id TO user_id; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='sender_id') THEN ALTER TABLE public.room_messages RENAME COLUMN sender_id TO user_id; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  fullname text,
  email text,
  username text UNIQUE,
  avatar_url text,
  role text CHECK (role IN ('admin', 'teacher', 'student')),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.teacher_communities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid REFERENCES public.profiles(id),
  community_name text NOT NULL,
  community_username text UNIQUE NOT NULL,
  community_password text,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.class_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES public.teacher_communities(id),
  room_name text NOT NULL,
  room_type text CHECK (room_type IN ('chat', 'live', 'announcements', 'files')),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.room_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE public.live_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text CHECK (status IN ('live', 'ended', 'scheduled')),
  started_at timestamp with time zone,
  ended_at timestamp with time zone
);

CREATE TABLE public.room_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  user_name text,
  user_avatar text,
  created_at timestamp with time zone DEFAULT now()
);`}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 p-4 border border-red-100 rounded-xl text-red-500">
              {fetchError}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => user && fetchProfile(user.id)}
            className="w-full bg-brand-blue py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
          >
            Retry Access
          </button>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-slate-100 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-all border border-slate-200"
          >
            Switch Account / Logout
          </button>
        </div>
      </div>
    );
  }

  const getAuthLabel = (ar: string, en: string, fr: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  if (!user) {
    return (
      <div 
        className="flex min-h-screen flex-col lg:flex-row bg-cover bg-center text-slate-900 font-sans relative overflow-x-hidden"
        style={{ backgroundImage: "url('/back.png')" }}
      >
        {/* Semi-translucent overlay to enable crisp readability on top of custom background */}
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[1.5px] pointer-events-none z-0" />

        {/* Ambient background blur blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/25 rounded-full blur-3xl pointer-events-none z-0" />
        <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-indigo-200/25 rounded-full blur-3xl pointer-events-none z-0" />

        {/* Floating Educative Animations */}
        {[
          { Icon: BookOpen, className: "text-blue-500/10 top-[15%] left-[8%] w-10 h-10 md:w-16 md:h-16" },
          { Icon: Atom, className: "text-indigo-500/8 top-[12%] right-[10%] w-12 h-12 md:w-20 md:h-20" },
          { Icon: Compass, className: "text-[#2563eb]/10 top-[40%] left-[25%] w-10 h-10 md:w-14 md:h-14" },
          { Icon: Sparkles, className: "text-amber-500/12 top-[65%] right-[25%] w-8 h-8 md:w-12 md:h-12" },
          { Icon: Calculator, className: "text-emerald-500/8 bottom-[25%] left-[10%] w-10 h-10 md:w-14 md:h-14" },
          { Icon: Brain, className: "text-purple-500/8 bottom-[20%] right-[15%] w-12 h-12 md:w-18 md:h-18" },
          { Icon: Globe, className: "text-sky-500/6 top-[5%] left-[45%] w-9 h-9 md:w-12 md:h-12" },
          { Icon: Trophy, className: "text-yellow-500/10 bottom-[35%] left-[40%] w-10 h-10 md:w-14 md:h-14" },
          { Icon: Palette, className: "text-pink-500/8 top-[28%] right-[40%] w-10 h-10 md:w-14 md:h-14" },
          { Icon: Music, className: "text-rose-500/8 bottom-[45%] left-[5%] w-8 h-8 md:w-12 md:h-12" },
          { Icon: Lightbulb, className: "text-yellow-500/10 top-[50%] right-[8%] w-11 h-11 md:w-16 md:h-16" },
          { Icon: PenTool, className: "text-cyan-500/8 top-[55%] left-[15%] w-9 h-9 md:w-12 md:h-12" },
          { Icon: FlaskConical, className: "text-emerald-600/6 top-[78%] left-[30%] w-11 h-11 md:w-16 md:h-16" },
          { Icon: Ruler, className: "text-slate-400/8 top-[32%] left-[5%] w-10 h-10 md:w-14 md:h-14" },
          { Icon: Sigma, className: "text-blue-600/8 bottom-[12%] left-[48%] w-9 h-9 md:w-12 md:h-12" },
          { Icon: GraduationCap, className: "text-indigo-600/8 top-[22%] left-[35%] w-12 h-12 md:w-16 md:h-16" },
          { Icon: School, className: "text-violet-500/6 bottom-[8%] right-[32%] w-12 h-12 md:w-16 md:h-16" }
        ].map(({ Icon, className }, idx) => (
          <motion.div
            key={idx}
            className={`absolute pointer-events-none select-none z-0 ${className}`}
            animate={{
              y: [0, -25, 25, 0],
              x: [0, 20, -20, 0],
              rotate: [0, 25, -25, 0],
            }}
            transition={{
              duration: 9 + idx * 2.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: idx * 0.4
            }}
          >
            <Icon className="w-full h-full stroke-[1.2]" />
          </motion.div>
        ))}

        {/* LEFT COLUMN: Hero content & visual graphics - Hidden on mobile/tablet */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col justify-between p-12 xl:p-16 relative z-10 border-r border-[#e2edf9]/50">
          
          {/* Logo brand header */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-11 w-11 object-contain shrink-0" referrerPolicy="no-referrer" />
            <div className="flex flex-col">
              <span className="font-sans font-black text-lg tracking-tight text-[#0f172a]">
                {getAuthLabel("مدرسة نجاح", "Nadjah School", "École Nadjah")}
              </span>
              <span className="font-sans font-semibold text-[10px] text-slate-400 -mt-0.5 uppercase tracking-wide">
                {getAuthLabel("منصة التعليم المتقدمة", "Advanced Educational Platform", "Plateforme d'Enseignement Avancée")}
              </span>
            </div>
          </div>

          {/* Interactive geometric/diagram desktop backdrop content */}
          <div className="my-auto max-w-xl space-y-10 py-8">
            <div className="space-y-4">
              <h2 className="text-4xl xl:text-5xl font-sans font-extrabold tracking-tight text-slate-800 leading-tight">
                {i18n.language === 'ar' ? (
                  <>
                    تعلم اليوم <br />
                    <span className="text-blue-600 block mt-1">لتنجح غداً</span>
                  </>
                ) : i18n.language === 'fr' ? (
                  <>
                    Apprendre aujourd'hui <br />
                    <span className="text-blue-600 block mt-1">pour réussir demain</span>
                  </>
                ) : (
                  <>
                    Learn today <br />
                    <span className="text-blue-600 block mt-1">to succeed tomorrow</span>
                  </>
                )}
              </h2>
              <p className="text-slate-500 font-semibold text-sm xl:text-base leading-relaxed">
                {getAuthLabel(
                  "منصة تعليمية متكاملة تساعدك على الوصول إلى أهدافك الأكاديمية بسهولة وفعالية",
                  "An integrated educational platform designed to help you reach your academic goals with ease and efficiency.",
                  "Une plateforme éducative intégrée conçue pour vous aider à atteindre vos objectifs académiques avec facilité et efficacité."
                )}
              </p>
            </div>

            {/* Feature cards layout */}
            <div className="space-y-4">
              {/* Feature 1 */}
              <div className="flex items-center gap-4 bg-white/70 backdrop-blur-md p-4 rounded-[20px] border border-white/40 shadow-sm hover:translate-x-1 hover:bg-white transition-all duration-300">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    {getAuthLabel("تعليم متطور", "Advanced Learning", "Apprentissage Avancé")}
                  </h4>
                  <p className="text-slate-400 text-xs font-semibold">
                    {getAuthLabel("مناهج حديثة ومحتوى تفاعلي", "Modern curricula and interactive content", "Programmes d'études modernes et contenu interactif")}
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-4 bg-white/70 backdrop-blur-md p-4 rounded-[20px] border border-white/40 shadow-sm hover:translate-x-1 hover:bg-white transition-all duration-300">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    {getAuthLabel("متابعة التقدم", "Progress Tracking", "Suivi du Progrès")}
                  </h4>
                  <p className="text-slate-400 text-xs font-semibold">
                    {getAuthLabel("تقارير مفصلة عن أدائك الأكاديمي", "Detailed reports on your academic performance", "Rapports détaillés sur vos performances")}
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-4 bg-white/70 backdrop-blur-md p-4 rounded-[20px] border border-white/40 shadow-sm hover:translate-x-1 hover:bg-white transition-all duration-300">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    {getAuthLabel("مجتمع تعليمي", "Educational Community", "Communauté Éducative")}
                  </h4>
                  <p className="text-slate-400 text-xs font-semibold">
                    {getAuthLabel("تواصل وتعاون مع زملائك ومعلميك", "Communication and collaboration with peers and teachers", "Communication et collaboration avec pairs")}
                  </p>
                </div>
              </div>
            </div>

            {/* Translucent quote module */}
            <div className="relative bg-white/40 border border-white/60 p-5 rounded-2xl shadow-sm text-slate-600 max-w-md">
              <span className="absolute -top-3 left-4 text-3xl font-serif text-blue-600 leading-none">“</span>
              <p className="font-medium text-xs md:text-sm italic pl-2 leading-relaxed">
                {getAuthLabel(
                  "التعليم هو المفتاح الذهبي لحرية المستقبل",
                  "Education is the golden key to future freedom.",
                  "L'éducation est la clé d'or pour la liberté du futur."
                )}
              </p>
              <p className="text-right text-[10px] uppercase font-black tracking-widest text-[#2563eb] mt-2">
                {getAuthLabel("— جورج واشنطن", "— George Washington", "— George Washington")}
              </p>
            </div>
          </div>

          {/* Sizable spacer below so bottom stats ribbon doesn't overlap */}
          <div className="h-10" />
        </div>

        {/* RIGHT COLUMN: Authentication Card Area */}
        <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen relative z-10">
          
          {/* Header language toggles */}
          <div className="flex justify-center gap-2 mb-6">
            {['en', 'fr', 'ar'].map((lng) => (
              <button
                key={lng}
                onClick={() => toggleLanguage(lng)}
                className={`px-4 py-1.5 text-[11px] font-bold uppercase rounded-full transition-all cursor-pointer ${
                  i18n.language === lng 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "bg-white/80 border border-slate-100/90 text-slate-400 hover:bg-slate-100"
                }`}
              >
                {lng === 'ar' ? 'العربية' : lng === 'fr' ? 'FRANÇAIS' : 'ENGLISH'}
              </button>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="w-full max-w-[520px] bg-white border border-slate-100 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.08)] rounded-[32px] p-8 sm:p-12 space-y-7 relative"
          >
            {/* Logo image */}
            <div className="flex justify-center">
              <img src="/logo.png" alt="Logo" className="h-[84px] w-auto object-contain hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
            </div>

            {/* School Title matching image */}
            <div className="space-y-1.5 text-center">
              <h1 className="font-sans text-2xl font-black tracking-tight text-slate-800 font-display">
                {getAuthLabel("مدرسة نجاح", "Nadjah School", "École Nadjah")}
              </h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider leading-none">
                {getAuthLabel("منصة البث الأكاديمي المتقدمة", "Advanced Academic Broadcasting Platform", "Plateforme de Diffusion Académique")}
              </p>
            </div>

            {/* Form system */}
            <div className="space-y-4 text-slate-900">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-brand-blue/5 border border-brand-blue/10 p-4 rounded-xl"
                >
                  <div className="text-[10px] text-brand-blue font-bold tracking-wide leading-relaxed">
                    {authError.includes('PENDING_OR_INVALID') ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-brand-blue mb-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <p className="font-black uppercase tracking-tight italic">Waiting for Manager</p>
                        </div>
                        <p className="text-slate-600 leading-relaxed font-medium">
                          Verification is <span className="text-brand-blue">Manual</span>. The manager must add your email to the system directly.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex items-center gap-2">
                            <Database className="h-3 w-3 text-brand-blue" />
                            <p className="text-[9px] text-brand-blue font-black uppercase tracking-widest">Manager Workspace</p>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-relaxed font-medium">
                            The manager must add your email to the database manually.<br/><br/>
                            <span className="text-slate-900 font-bold">Admin Check:</span> Supabase &rarr; Auth &rarr; Users &rarr; Add User.<br/>
                            Verify that <span className="text-slate-900 font-bold">"Auto-confirm user"</span> is enabled.
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold italic text-center">
                          Approval typically takes less than 24 hours.
                        </p>
                      </div>
                    ) : authError.includes('CONFIRM_REQUIRED') ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-amber-600 mb-2">
                          <Mail className="h-5 w-5" />
                          <p className="font-black uppercase tracking-tight italic">Email Confirmation</p>
                        </div>
                        <p className="text-slate-600 leading-relaxed font-medium">
                          Your email needs to be confirmed. Please check your inbox for a confirmation link from Supabase.
                        </p>
                      </div>
                    ) : authError}
                  </div>
                </motion.div>
              )}

              <form onSubmit={handleAuth} className="space-y-3">
                {authMode === "signin" ? (
                  <>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text"
                        placeholder={getAuthLabel("اسم المستخدم أو البريد الإلكتروني", "Username or Email Address", "Nom d'utilisateur ou Email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-slate-50/60 border border-slate-200/60 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-semibold shadow-inner-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Full Name field */}
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <input 
                        type="text"
                        placeholder={getAuthLabel("الاسم الكامل للمستخدم", "Full Name", "Nom Complet")}
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        required
                        className="w-full bg-slate-50/60 border border-slate-200/60 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-semibold shadow-inner-sm"
                      />
                    </div>

                    {/* Username field */}
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm select-none">@</span>
                      <input 
                        type="text"
                        placeholder={getAuthLabel("اسم المستخدم الفريد", "Unique Username", "Nom d'utilisateur Unique")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        required
                        className="w-full bg-slate-50/60 border border-slate-200/60 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-semibold shadow-inner-sm"
                      />
                    </div>

                    {/* Role Selector cap */}
                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                        {getAuthLabel("اختر نوع الحساب", "Select Account Type", "Choisir le type de compte")}
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <button
                          type="button"
                          onClick={() => setChosenRole("student")}
                          className={cn(
                            "py-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            chosenRole === "student"
                              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/15"
                              : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                          )}
                        >
                          🧑‍🎓 {getAuthLabel("طالب", "Student", "Éleve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setChosenRole("teacher")}
                          className={cn(
                            "py-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            chosenRole === "teacher"
                              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/15"
                              : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                          )}
                        >
                          🧑‍🏫 {getAuthLabel("أستاذ", "Teacher", "Professeur")}
                        </button>
                      </div>
                    </div>

                    {/* Supabase Free Option Tip */}
                    <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-2xl text-[10px] space-y-1 text-left">
                      <p className="font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5 justify-start">
                        💡 {getAuthLabel("نصيحة لحساب مجاني فوري", "Free Instant Account Tip", "Astuce d'inscription rapide")}
                      </p>
                      <p className="text-amber-800/80 leading-relaxed font-semibold">
                        {i18n.language === 'ar' 
                          ? 'لتفعيل التسجيل المباشر المجاني وبدون تأكيد البريد الإلكتروني، يرجى تعطيل "Confirm email" في إعدادات Supabase.' 
                          : 'To allow instant, zero-cost registrations and bypass real email rules, toggle Off "Confirm email" inside your Supabase Auth Provider settings.'}
                      </p>
                    </div>
                  </>
                )}

                {/* Password / Passcode */}
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="password"
                    placeholder={getAuthLabel("كلمة المرور", "Password / Passcode", "Mot de passe")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-50/60 border border-slate-200/60 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-semibold shadow-inner-sm"
                  />
                </div>

                {/* Remember and links bar */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1 py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-200" defaultChecked />
                    <span>{getAuthLabel("تذكرني", "Remember me", "Se souvenir")}</span>
                  </label>
                  <button type="button" className="text-blue-600 hover:underline">
                    {getAuthLabel("نسيت كلمة المرور؟", "Forgot password?", "Mot de passe oublié ?")}
                  </button>
                </div>

                {/* Enter Submit Button */}
                <button 
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/15 cursor-pointer"
                >
                  {authLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>{authMode === 'signin' ? getAuthLabel("الدخول إلى لوحة التحكم", "Access Dashboard", "Accéder au Tableau") : getAuthLabel("إنشاء حساب جديد", "Register Account", "S'inscrire")}</span>
                      <ArrowRight className={cn("h-4 w-4 shrink-0 transition-transform", i18n.language === 'ar' ? "rotate-180" : "")} />
                    </>
                  )}
                </button>
              </form>

              {/* Toggle AuthMode replaced with empty or kept simple if needed, but since user requested deletion of the toggle, we remove it completely */}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Final safety check
  if (!profile) return null;

  return (
    <AnimatePresence mode="wait">
      {["teacher", "developer"].includes(profile.role?.toString().toLowerCase()) ? (
        <TeacherDashboard key="teacher" profile={profile} />
      ) : (
        <StudentDashboard key="student" profile={profile} />
      )}
    </AnimatePresence>
  );
}
