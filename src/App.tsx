import React from "react";
import { auth, db, handleFirestoreError, signInWithGoogle, OperationType } from "./lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { UserProfile, UserRole } from "./types";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import { LogIn, GraduationCap, School, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [showRoleSelect, setShowRoleSelect] = React.useState(false);

  React.useEffect(() => {
    async function fetchProfile() {
      if (user) {
        setProfileLoading(true);
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setShowRoleSelect(true);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
        setShowRoleSelect(false);
      }
    }
    fetchProfile();
  }, [user]);

  const handleRoleSelect = async (role: UserRole) => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const newProfile = {
        uid: user.uid,
        displayName: user.displayName || "User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        role,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", user.uid), newProfile);
      setProfile(newProfile as any);
      setShowRoleSelect(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || profileLoading || (user && !profile && !showRoleSelect)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-brand-darkest text-brand-blue">
        <Loader2 className="h-8 w-8 animate-spin" />
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

          <button
            onClick={signInWithGoogle}
            className="group relative flex w-full items-center justify-center space-x-3 rounded-2xl bg-brand-blue py-4 text-white font-bold transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98]"
          >
            <LogIn className="h-5 w-5" />
            <span>Sign in with Google</span>
          </button>
          
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
