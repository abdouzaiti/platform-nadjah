import React from "react";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types";
import { useTranslation } from "react-i18next";
import { Key, Lock, Loader2, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";

interface SettingsViewProps {
  profile: UserProfile;
}

export default function SettingsView({ profile }: SettingsViewProps) {
  const { i18n } = useTranslation();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [newUsername, setNewUsername] = React.useState(profile.username || "");
  const [loading, setLoading] = React.useState(false);
  const [usernameLoading, setUsernameLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = React.useState<string | null>(null);

  const getLabel = (ar: string, fr: string, en: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg(getLabel(
        "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
        "Le mot de passe doit contenir au moins 6 caractères.",
        "Password must be at least 6 characters long."
      ));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(getLabel(
        "كلمات المرور غير متطابقة.",
        "Les mots de passe ne correspondent pas.",
        "Passwords do not match."
      ));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccessMsg(getLabel(
        "تم تحديث كلمة المرور بنجاح!",
        "Mot de passe mis à jour avec succès !",
        "Password updated successfully!"
      ));
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password update error:", err);
      setErrorMsg(err.message || getLabel(
        "فشل تحديث كلمة المرور.",
        "Échec de la mise à jour du mot de passe.",
        "Failed to update password."
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setUsernameSuccess(null);

    const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    
    if (cleanUsername.length < 3) {
      setUsernameError(getLabel(
        "يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.",
        "Le nom d'utilisateur doit contenir au moins 3 caractères.",
        "Username must be at least 3 characters long."
      ));
      return;
    }

    if (cleanUsername === profile.username) {
      setUsernameError(getLabel(
        "اسم المستخدم الجديد هو نفسه الحالي.",
        "Le nouveau nom d'utilisateur est le même que l'actuel.",
        "New username is the same as current."
      ));
      return;
    }

    setUsernameLoading(true);
    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (existingUser) {
        throw new Error(getLabel(
          "اسم المستخدم هذا مأخوذ بالفعل.",
          "Ce nom d'utilisateur est déjà pris.",
          "This username is already taken."
        ));
      }

      const { error } = await supabase
        .from("profiles")
        .update({ username: cleanUsername })
        .eq("id", profile.id);

      if (error) throw error;

      setUsernameSuccess(getLabel(
        "تم تحديث اسم المستخدم بنجاح! يرجى تحديث الصفحة لرؤية التغييرات.",
        "Nom d'utilisateur mis à jour avec succès ! Veuillez rafraîchir pour voir les changements.",
        "Username updated successfully! Please refresh to see changes."
      ));
      // Refresh page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error("Username update error:", err);
      setUsernameError(err.message || getLabel(
        "فشل تحديث اسم المستخدم.",
        "Échec de la mise à jour du nom d'utilisateur.",
        "Failed to update username."
      ));
    } finally {
      setUsernameLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left rtl:sm:text-right w-full">
          <h3 className="text-xl font-bold font-display uppercase tracking-tight text-slate-900">
            {getLabel(
              "إعدادات الحساب والأمان",
              "Paramètres de Compte & Sécurité",
              "Account & Security Settings"
            )}
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            {getLabel(
              "إدارة معلومات حسابك الجامعي الشخصي وتحديث كلمة السر الخاصة بك.",
              "Gerez vos informations de compte personnelles et mettez à jour votre mot de passe.",
              "Manage your personal account credentials and update your security passcode."
            )}
          </p>
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
          {getLabel(
            "تحديث اسم المستخدم",
            "Changer le nom d'utilisateur",
            "Change Username"
          )}
        </h4>

        {usernameError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{usernameError}</span>
          </motion.div>
        )}

        {usernameSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{usernameSuccess}</span>
          </motion.div>
        )}

        <form onSubmit={handleUpdateUsername} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="space-y-1.5 text-left rtl:text-right flex-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {getLabel("اسم المستخدم الجديد", "Nouveau nom d'utilisateur", "New Username")}
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs select-none group-focus-within:text-brand-blue transition-colors">@</span>
              <input 
                type="text"
                required
                placeholder={getLabel("مثلاً: m_ali24", "Ex: m_ali24", "e.g. m_ali24")}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 transition-all font-medium"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={usernameLoading}
            className="py-3.5 px-6 bg-slate-900 hover:bg-black transition-all disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap h-11"
          >
            {usernameLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>{getLabel("تحديث", "Mettre à jour", "Update Username")}</span>
            )}
          </button>
        </form>
      </div>

      {/* User Info Card (Read only stats) */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
          {getLabel(
            "بيانات الملف الشخصي",
            "Informations du Profil",
            "Profile Credentials"
          )}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
              {getLabel("الاسم الكامل", "Nom Complet", "Full Name")}
            </p>
            <p className="text-xs font-bold text-slate-800">{profile.fullname}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
              {getLabel("اسم المستخدم", "Nom d'utilisateur", "Username")}
            </p>
            <p className="text-xs font-mono font-bold text-slate-800">@{profile.username}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
              {getLabel("البريد الإلكتروني", "Adresse E-mail", "Email Address")}
            </p>
            <p className="text-xs font-bold text-slate-800 truncate">{profile.email}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
              {getLabel("الصفة الحالية", "Rôle du Compte", "Account Role")}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-black uppercase text-slate-800">
                {profile.role === 'developer' || profile.role === 'developper'
                  ? getLabel('المطور', 'Développeur', 'Developer')
                  : profile.role === 'teacher'
                    ? getLabel('أستاذ', 'Professeur', 'Teacher')
                    : getLabel('طالب', 'Étudiant', 'Student')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-brand-blue/10 text-brand-blue rounded-xl">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              {getLabel("تحديث كلمة المرور", "Modifier le mot de passe", "Change Passcode")}
            </h4>
            <p className="text-[10px] font-medium text-slate-400">
              {getLabel(
                "لتغيير كلمة المرور الافتراضية وحماية دخولك.",
                "Mettez à jour votre mot de passe par défaut pour sécuriser votre accès.",
                "Update your default collegiate initial password."
              )}
            </p>
          </div>
        </div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-1.5 text-left rtl:text-right">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {getLabel("كلمة المرور الجديدة", "Nouveau mot de passe", "New Password")}
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
              <input 
                type="password"
                required
                placeholder={getLabel("أدخل كلمة المرور الجديدة", "Entrez le nouveau mot de passe", "New Password")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left rtl:text-right">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {getLabel("تأكيد كلمة المرور الجديدة", "Confirmer le nouveau mot de passe", "Confirm New Password")}
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
              <input 
                type="password"
                required
                placeholder={getLabel("تأكيد كلمة المرور الجديدة", "Confirmer le mot de passe", "Confirm password")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 transition-all font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-blue hover:bg-blue-600 transition-all disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{getLabel("جاري الحفظ والتسجيل...", "Mise à jour...", "Updating Settings...")}</span>
              </>
            ) : (
              <span>{getLabel("تحديث وحفظ كلمة السر", "Enregistrer les modifications", "Update Security Settings")}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
