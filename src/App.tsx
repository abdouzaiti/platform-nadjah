import React from "react";
import { supabase, supabaseConfigured, isProperAnonKey } from "./lib/supabase";
import { UserProfile, UserRole } from "./types";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import { LogIn, GraduationCap, School, Loader2, Database, Key, CheckCircle2, Mail, ArrowRight, Video, Languages } from "lucide-react";
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
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);

  const fetchProfile = React.useCallback(async (userId: string) => {
    setProfileLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("uid", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data as UserProfile);
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
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchProfile(currentUser.id);
        setFetchError(null);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
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

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Auth error details:", err);
      const msg = err.message || "";
      if (msg.includes('Invalid login credentials')) {
        setAuthError("PENDING_OR_INVALID: Access Denied. Your account might be pending manual activation by the manager, or the credentials entered are incorrect.");
      } else if (msg.includes('Email not confirmed')) {
        setAuthError("CONFIRM_REQUIRED: Validation Required. Please click the link in your email or ask the manager to check 'Auto-confirm user' in Supabase.");
      } else {
        setAuthError(err.message);
      }
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
        <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">Access Denied</h2>
        
        <div className="max-w-2xl w-full text-sm mb-8 font-medium text-brand-blue bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          {fetchError === 'NOT_REGISTERED' ? (
            <div className="space-y-6 text-left">
              <div className="space-y-2">
                <p className="text-slate-600 leading-relaxed text-sm">
                  Your account is active, but you are not yet authorized in the <strong className="text-slate-900">Nadjah Users</strong> list.
                </p>
                <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] text-brand-blue uppercase font-black tracking-widest">Email:</span>
                    <span className="text-[10px] text-slate-500 font-medium truncate">{user?.email}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] text-brand-blue uppercase font-black tracking-widest">User UID:</span>
                    <span className="text-[10px] text-slate-900 font-mono truncate select-all">{user?.id}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-brand-blue font-black uppercase tracking-widest bg-brand-blue/10 px-2 py-0.5 rounded">Quick Fix SQL</p>
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  </div>
                  <p className="text-[9px] text-slate-500">To allow yourself as a <span className="text-slate-900 font-bold">Teacher</span>, run this in Supabase SQL Editor:</p>
                  <pre className="text-[9px] text-emerald-600 font-mono overflow-x-auto whitespace-pre p-2 bg-white rounded-lg border border-slate-200">
{`INSERT INTO public.users (uid, email, "displayName", role)
VALUES ('${user?.id}', '${user?.email}', '${user?.email?.split('@')[0]}', 'teacher');`}
                  </pre>
                </div>

                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Agora Streaming Ready</p>
                    <p className="text-[9px] text-slate-500 font-medium">Classroom video engine is online and configured.</p>
                  </div>
                </div>

                <div className="bg-brand-blue/5 p-4 rounded-xl border border-brand-blue/10 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Video className="h-3 w-3 text-brand-blue" />
                    <p className="text-[10px] text-brand-blue font-black uppercase tracking-widest">Camera Permissions Tip</p>
                  </div>
                  <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                    If camera access fails, click the <strong>"Open in New Tab"</strong> button in the stream player or your browser's address bar to enable permissions.
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic text-center pt-2">
                After running the SQL, click "Retry Access" below.
              </p>
            </div>
          ) : fetchError === 'TABLES_MISSING' ? (
            <div className="space-y-6 text-left">
              <p className="text-slate-600 leading-relaxed text-sm">
                The database tables are missing. Please run the standard setup SQL:
              </p>
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 font-mono text-[9px] text-emerald-600 overflow-x-auto whitespace-pre max-h-[300px]">
{`CREATE TABLE public.users (
  uid uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text,
  role text CHECK (role IN ('student', 'teacher')),
  "displayName" text,
  "photoURL" text,
  "createdAt" timestamp with time zone DEFAULT now()
);

CREATE TABLE public.streams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  "teacherId" uuid REFERENCES public.users(uid),
  "teacherName" text,
  status text DEFAULT 'offline',
  thumbnail text,
  "viewersCount" integer DEFAULT 0,
  "recordingUrl" text,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "streamId" uuid REFERENCES public.streams(id) ON DELETE CASCADE,
  text text NOT NULL,
  "userId" uuid REFERENCES public.users(uid),
  "userName" text,
  "userPhote" text,
  timestamp timestamp with time zone DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Public Read" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow Public Read Streams" ON public.streams FOR SELECT USING (true);
CREATE POLICY "Allow Public Read Chat" ON public.chat_messages FOR SELECT USING (true);

CREATE POLICY "Teachers Manage Streams" ON public.streams FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND role = 'teacher')
);

CREATE POLICY "Auth Users Insert Chat" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);`}
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

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-blue-100),transparent_50%)] pointer-events-none opacity-50" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6 sm:space-y-8 rounded-[32px] bg-white p-6 sm:p-10 border border-slate-200 shadow-2xl shadow-blue-500/5 relative z-10"
        >
          <div className="flex justify-center gap-2 mb-4">
            {['ar', 'fr', 'en'].map((lng) => (
              <button
                key={lng}
                onClick={() => toggleLanguage(lng)}
                className={`px-3 py-1 text-[10px] font-black uppercase rounded-full transition-all ${
                  i18n.language === lng 
                  ? "bg-brand-blue text-white shadow-md shadow-blue-500/20" 
                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {lng}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center space-y-4 sm:space-y-6">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-brand-blue shadow-xl shadow-blue-500/10 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-1">
              <h1 className="text-center font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase text-slate-900">
                {i18n.language === 'en' ? 'Ecole' : t('login_title').split(' ')[0]} <span className="text-brand-blue">{i18n.language === 'en' ? 'Nadjah' : t('login_title').split(' ')[1]}</span>
              </h1>
              <p className="text-center text-[10px] sm:text-sm font-medium text-slate-400 uppercase tracking-widest">
                {t('login_subtitle')}
              </p>
            </div>
          </div>

          <div className="w-full space-y-6 text-slate-900">
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

            <form onSubmit={signInWithEmail} className="space-y-3">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                <input 
                  type="email"
                  placeholder={t('email_address')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 transition-all font-medium"
                />
              </div>
              <div className="relative group">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                <input 
                  type="password"
                  placeholder={t('password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 transition-all font-medium"
                />
              </div>
              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
              >
                {authLoading ? t('authenticating') : t('access_dashboard')}
                {!authLoading && <ArrowRight className={cn("h-4 w-4", i18n.language === 'ar' ? "rotate-180" : "")} />}
              </button>
            </form>
            
            <p className="text-[10px] text-slate-400 font-medium text-center px-4 leading-relaxed">
              Don't have an account? Access is granted manually by the <span className="text-slate-500 font-bold">School Administrator</span> after verification.
            </p>

            <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">or use</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <button
                  onClick={signInWithGoogle}
                  className="group relative flex w-full items-center justify-center space-x-3 rounded-2xl bg-white py-4 text-slate-600 font-bold transition-all hover:bg-slate-50 border border-slate-200 active:scale-[0.98] shadow-sm"
                >
                  <div className="h-5 w-5 bg-white rounded-full p-1 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                    <img src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="Google" className="h-full w-full" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest">{t('google_account')}</span>
                </button>
              </div>
          
          <div className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
            {t('professional_engine')}
          </div>
        </motion.div>
      </div>
    );
  }

  // Final safety check
  if (!profile) return null;

  return (
    <AnimatePresence mode="wait">
      {profile.role === "teacher" ? (
        <TeacherDashboard key="teacher" profile={profile} />
      ) : (
        <StudentDashboard key="student" profile={profile} />
      )}
    </AnimatePresence>
  );
}
