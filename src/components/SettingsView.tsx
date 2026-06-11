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
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const isAr = i18n.language === 'ar';

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg(isAr ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل." : "Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(isAr ? "كلمات المرور غير متطابقة." : "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccessMsg(isAr ? "تم تحديث كلمة المرور بنجاح!" : "Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password update error:", err);
      setErrorMsg(err.message || (isAr ? "فشل تحديث كلمة المرور." : "Failed to update password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left rtl:sm:text-right w-full">
          <h3 className="text-xl font-bold font-display uppercase tracking-tight text-slate-900">
            {isAr ? "إعدادات الحساب والأمان" : "Account & Security Settings"}
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            {isAr 
              ? "إدارة معلومات حسابك الجامعي الشخصي وتحديث كلمة السر الخاصة بك."
              : "Manage your personal account credentials and update your security passcode."}
          </p>
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
          {isAr ? "بيانات الملف الشخصي" : "Profile Credentials"}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{isAr ? "الاسم الكامل" : "Full Name"}</p>
            <p className="text-xs font-bold text-slate-800">{profile.fullname}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{isAr ? "اسم المستخدم" : "Username"}</p>
            <p className="text-xs font-mono font-bold text-slate-800">@{profile.username}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{isAr ? "البريد الإلكتروني" : "Email Address"}</p>
            <p className="text-xs font-bold text-slate-800 truncate">{profile.email}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{isAr ? "الصفة الحالية" : "Account Role"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-black uppercase text-slate-800">{profile.role}</p>
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
              {isAr ? "تحديث كلمة المرور" : "Change Passcode"}
            </h4>
            <p className="text-[10px] font-medium text-slate-400">
              {isAr ? "لتغيير كلمة المرور الافتراضية وحماية دخولك." : "Update your default collegiate initial password."}
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
              {isAr ? "كلمة المرور الجديدة" : "New Password"}
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
              <input 
                type="password"
                required
                placeholder={isAr ? "أدخل كلمة المرور الجديدة" : "password_min_6_chars"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-800 text-xs focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left rtl:text-right">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
              <input 
                type="password"
                required
                placeholder={isAr ? "تأكيد كلمة المرور الجديدة" : "confirm_password"}
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
                <span>{isAr ? "جاري الحفظ والتسجيل..." : "Updating Settings..."}</span>
              </>
            ) : (
              <span>{isAr ? "تحديث وحفظ كلمة السر" : "Update Security Settings"}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
