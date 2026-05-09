import React from "react";
import { supabase, supabaseConfigured, isProperAnonKey } from "./lib/supabase";
import { UserProfile, UserRole } from "./types";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import { LogIn, GraduationCap, School, Loader2, Database, Key, CheckCircle2, Mail, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [showRoleSelect, setShowRoleSelect] = React.useState(false);
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
        .single();

      if (error) {
        if (error.code === "PGRST116") { // Not found
          setShowRoleSelect(true);
        } else {
          throw error;
        }
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      setFetchError(err.message || "Failed to load user profile");
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
        // Clear errors when we have a valid user
        setFetchError(null);
      } else {
        setProfile(null);
        setShowRoleSelect(false);
        // Don't clear errors automatically here, as it might clear the link error
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
        setAuthError("PENDING_OR_INVALID: Identity not verified. If you've submitted your request, it is likely awaiting manual approval by the School Manager.");
      } else if (msg.includes('Email not confirmed')) {
        setAuthError("CONFIRM_REQUIRED: Your account is created but email confirmation is required. Please check your inbox or contact the administrator.");
      } else {
        setAuthError(err.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (!user) return;
    setProfileLoading(true);
    setFetchError(null);
    try {
      const newProfile = {
        uid: user.id,
        displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || "User",
        email: user.email || "",
        photoURL: user.user_metadata?.avatar_url || "",
        role,
        createdAt: new Date().toISOString(),
      };
      
      const { error } = await supabase.from("users").upsert(newProfile);
      if (error) throw error;
      
      setProfile(newProfile as any);
      setShowRoleSelect(false);
    } catch (err: any) {
      console.error("Role assignment error:", err);
      setFetchError(err.message || "Failed to set user role");
    } finally {
      setProfileLoading(false);
    }
  };

  const isStuck = user && !profile && !showRoleSelect && !profileLoading && !fetchError;

  if (!supabaseConfigured) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-darkest p-8 text-center overflow-y-auto">
        <div className="w-20 h-20 bg-brand-blue/10 rounded-3xl flex items-center justify-center mb-8 border border-brand-blue/20">
          <Database className="h-10 w-10 text-brand-blue" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
          Database Configuration Required
        </h2>
        <p className="max-w-md text-slate-400 mb-8 text-sm leading-relaxed">
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
            <div key={i} className={`bg-white/5 border ${item.error ? 'border-red-500/50 bg-red-500/5' : 'border-white/5'} p-4 rounded-2xl flex items-center gap-4`}>
              <div className={`h-10 w-10 ${item.error ? 'bg-red-500/20' : 'bg-slate-800'} rounded-xl flex items-center justify-center`}>
                <item.icon className={`h-5 w-5 ${item.error ? 'text-red-400' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${item.error ? 'text-red-400' : 'text-brand-blue'} leading-none mb-1`}>{item.label}</p>
                <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-4 bg-brand-blue/10 border border-brand-blue/20 rounded-2xl flex items-start gap-4 max-w-sm text-left">
          <CheckCircle2 className="h-5 w-5 text-brand-blue shrink-0 mt-0.5" />
          <p className="text-[10px] text-brand-blue font-bold uppercase tracking-wider leading-relaxed">
            Enter these in the <span className="underline">Secrets panel</span>. If you just added them, try clicking the "Retry" button below or refreshing the page.
          </p>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
        >
          Refresh & Retry
        </button>
      </div>
    );
  }

  if (loading || profileLoading || isStuck) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-darkest text-brand-blue space-y-6">
        <Loader2 className="h-10 w-10 animate-spin" />
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Syncing with Nadjah Cloud</p>
          {isStuck && <p className="text-[8px] text-slate-600 italic">This usually takes a few seconds...</p>}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-darkest p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
          <School className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Access Interrupted</h2>
        <div className={`max-w-md text-sm mb-8 font-medium ${fetchError?.includes('GOOGLE_NOT_ENABLED') || fetchError?.includes('link is invalid') || fetchError?.includes('RATE_LIMIT') || fetchError?.includes('invalid_client') ? 'text-brand-blue bg-brand-blue/10 p-4 rounded-xl border border-brand-blue/20' : 'text-slate-500'}`}>
          {fetchError?.includes('GOOGLE_NOT_ENABLED') 
            ? "Google Login is not enabled in your Supabase project. Go to Authentication > Providers in Supabase and enable 'Google'."
            : fetchError?.includes('invalid_client')
            ? "Erreur 401: invalid_client. This means the Client ID or Secret in your Supabase Google Provider settings is wrong. Double-check your Google Cloud Console credentials."
            : fetchError?.includes('link is invalid')
            ? "The sign-in code is invalid or has expired. Ensure you are using the most recent code sent to your email."
            : fetchError?.includes('RATE_LIMIT')
            ? (
              <div className="space-y-4">
                <p>Supabase limits emails to one per minute by default to prevent spam.</p>
                <div className="bg-slate-900/50 p-4 rounded-xl text-left border border-white/5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-blue">To make it unlimited:</p>
                  <ol className="text-[10px] text-slate-400 list-decimal pl-4 space-y-1 font-medium">
                    <li>Go to your <strong>Supabase Dashboard</strong></li>
                    <li>Navigate to <strong>Authentication → Settings</strong></li>
                    <li>Find <strong>Rate Limits</strong> at the bottom</li>
                    <li>Increase <strong>Email Rate Limit</strong> and <strong>Max Emails per Hour</strong></li>
                  </ol>
                </div>
              </div>
            )
            : (fetchError || "Verify your connection or authorized domains.")}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => user ? fetchProfile(user.id) : window.location.reload()}
            className="w-full bg-brand-blue py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20"
          >
            Retry Access
          </button>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-white/5 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all border border-white/5"
          >
            Switch Account
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-darkest p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/20 to-transparent pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 rounded-[32px] bg-slate-900/40 p-10 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-blue-500/10 relative z-10"
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue shadow-xl shadow-blue-500/20">
              <School className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-center font-display text-4xl font-black tracking-tighter uppercase text-slate-50">
                Ecole <span className="text-brand-blue">Nadjah</span>
              </h1>
              <p className="text-center text-sm font-medium text-slate-400">
                Premium Virtual Learning Platform
              </p>
            </div>
          </div>

          <div className="w-full space-y-6">
            {authError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-brand-blue/10 border border-brand-blue/20 p-4 rounded-xl"
              >
                <div className="text-[10px] text-brand-blue font-bold tracking-wide leading-relaxed">
                  {authError.includes('PENDING_OR_INVALID') ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-brand-blue mb-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="font-black uppercase tracking-tight italic">Waiting for Manager</p>
                      </div>
                      <p className="text-slate-300 leading-relaxed font-medium">
                        Verification is <span className="text-brand-blue">Manual</span>. The manager must add your email to the system directly.
                      </p>
                      <div className="bg-brand-blue/10 p-4 rounded-xl border border-brand-blue/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-brand-blue" />
                          <p className="text-[9px] text-brand-blue font-black uppercase tracking-widest">Admin Instructions</p>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-relaxed">
                          To fix this: Go to <strong>Supabase → Auth → Add User</strong>. Enter email/password and ensure <strong>Auto-confirm user</strong> is checked.
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold italic">
                        Approval typically takes less than 24 hours.
                      </p>
                    </div>
                  ) : authError.includes('CONFIRM_REQUIRED') ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-amber-500 mb-2">
                        <Mail className="h-5 w-5" />
                        <p className="font-black uppercase tracking-tight italic">Email Confirmation</p>
                      </div>
                      <p className="text-slate-300 leading-relaxed font-medium">
                        Your email needs to be confirmed. Please check your inbox for a confirmation link from Supabase.
                      </p>
                    </div>
                  ) : authError}
                </div>
              </motion.div>
            )}

            <form onSubmit={signInWithEmail} className="space-y-3">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-brand-blue transition-colors" />
                <input 
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-brand-blue/50 transition-all font-medium"
                />
              </div>
              <div className="relative group">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-brand-blue transition-colors" />
                <input 
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-brand-blue/50 transition-all font-medium"
                />
              </div>
              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-brand-blue hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20"
              >
                {authLoading ? "Authenticating..." : "Access Dashboard"}
                {!authLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            
            <p className="text-[10px] text-slate-500 font-medium text-center px-4 leading-relaxed">
              Don't have an account? Access is granted manually by the <span className="text-slate-400">School Administrator</span> after verification.
            </p>

            <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">or use</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <button
                  onClick={signInWithGoogle}
                  className="group relative flex w-full items-center justify-center space-x-3 rounded-2xl bg-white/5 py-4 text-white font-bold transition-all hover:bg-white/10 hover:border-white/20 border border-white/10 active:scale-[0.98]"
                >
                  <div className="h-5 w-5 bg-white rounded-full p-1 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="Google" className="h-full w-full" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest">Google Account</span>
                </button>
              </div>
          
          <div className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            Professional Streaming Engine
          </div>
        </motion.div>
      </div>
    );
  }

  if (showRoleSelect) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-darkest p-4">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/10 to-transparent pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-3xl space-y-12 text-center relative z-10"
        >
          <div className="space-y-4">
            <h2 className="font-display text-5xl font-black tracking-tight text-white uppercase italic">Identify Yourself</h2>
            <p className="text-lg text-slate-400 font-medium">Select your role to access the Nadjah dashboard</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <button
              onClick={() => handleRoleSelect("teacher")}
              className="group flex h-80 flex-col items-center justify-center space-y-6 rounded-[40px] bg-slate-900/40 p-8 border border-white/5 backdrop-blur-xl transition-all hover:border-brand-blue/50 hover:bg-slate-900/60"
            >
              <div className="rounded-[28px] bg-slate-800 p-6 transition-all group-hover:bg-brand-blue group-hover:shadow-2xl group-hover:shadow-blue-500/40">
                <GraduationCap className="h-14 w-14 text-brand-blue group-hover:text-white" />
              </div>
              <div className="space-y-2">
                <span className="block text-2xl font-black text-white uppercase tracking-tight">Teacher</span>
                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300">Host, Stream & Manage Classes</span>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect("student")}
              className="group flex h-80 flex-col items-center justify-center space-y-6 rounded-[40px] bg-slate-900/40 p-8 border border-white/5 backdrop-blur-xl transition-all hover:border-brand-blue/50 hover:bg-slate-900/60"
            >
              <div className="rounded-[28px] bg-slate-800 p-6 transition-all group-hover:bg-brand-blue group-hover:shadow-2xl group-hover:shadow-blue-500/40">
                <School className="h-14 w-14 text-brand-blue group-hover:text-white" />
              </div>
              <div className="space-y-2">
                <span className="block text-2xl font-black text-white uppercase tracking-tight">Student</span>
                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300">Watch, Learn & Engage</span>
              </div>
            </button>
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
