import React from "react";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types";
import { useTranslation } from "react-i18next";
import { Key, Lock, Loader2, CheckCircle2, AlertCircle, ShieldAlert, LogOut, Camera, Upload, Trash2, Image, Sparkles, User, Link2, Film, Copy, Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface SettingsViewProps {
  profile: UserProfile;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=250",
];

export default function SettingsView({ profile }: SettingsViewProps) {
  const { i18n } = useTranslation();
  const [bio, setBio] = React.useState(profile.bio || "");
  const [subject, setSubject] = React.useState(profile.subject || "");
  const [phone, setPhone] = React.useState(profile.phone || "");
  const [fullname, setFullname] = React.useState(profile.fullname || "");
  const [infoLoading, setInfoLoading] = React.useState(false);
  const [infoSuccess, setInfoSuccess] = React.useState<string | null>(null);
  const [infoError, setInfoError] = React.useState<string | null>(null);
  const [copiedEmailSettings, setCopiedEmailSettings] = React.useState(false);

  const copyEmail = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmailSettings(true);
    setTimeout(() => setCopiedEmailSettings(false), 2000);
  };

  const handleUpdateTeacherInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoLoading(true);
    setInfoSuccess(null);
    setInfoError(null);

    let updates: Record<string, any> = {
      fullname,
      name: fullname,
      phone,
      bio,
      subject,
      updated_at: new Date().toISOString()
    };

    let updateErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);

      if (!error) {
        updateErr = null;
        break;
      }

      updateErr = error;
      const msg = error.message || "";
      const match = msg.match(/Could not find the '([^']+)' column/i) || 
                    msg.match(/column "([^"]+)"/i) ||
                    msg.match(/column ([^\s]+) does not exist/i);

      if (match && match[1] && updates[match[1]] !== undefined) {
        delete updates[match[1]];
        continue;
      }
      break;
    }

    if (updateErr) {
      setInfoError(updateErr.message || "Failed to update profile information");
    } else {
      setInfoSuccess(getLabel("تم تحديث معلومات الملف الشخصي بنجاح!", "Informations du profil mises à jour !", "Profile info updated successfully!"));
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
    setInfoLoading(false);
  };

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [newUsername, setNewUsername] = React.useState(profile.username || "");
  const [loading, setLoading] = React.useState(false);
  const [usernameLoading, setUsernameLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = React.useState<string | null>(null);

  // Avatar states
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url || "");
  const [avatarLoading, setAvatarLoading] = React.useState(false);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = React.useState<string | null>(null);
  const [isCustomUrlOpen, setIsCustomUrlOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Bunny.net Stream States
  const [bunnyLibraryId, setBunnyLibraryId] = React.useState(() => {
    try {
      const saved = localStorage.getItem("nadjah_bunny_config");
      return saved ? JSON.parse(saved).libraryId || "" : "";
    } catch { return ""; }
  });
  const [bunnyApiKey, setBunnyApiKey] = React.useState(() => {
    try {
      const saved = localStorage.getItem("nadjah_bunny_config");
      return saved ? JSON.parse(saved).apiKey || "" : "";
    } catch { return ""; }
  });
  const [bunnyCdnHost, setBunnyCdnHost] = React.useState(() => {
    try {
      const saved = localStorage.getItem("nadjah_bunny_config");
      return saved ? JSON.parse(saved).cdnHost || "iframe.mediadelivery.net" : "iframe.mediadelivery.net";
    } catch { return "iframe.mediadelivery.net"; }
  });
  const [bunnySuccess, setBunnySuccess] = React.useState<string | null>(null);

  const handleSaveBunnyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config = {
        libraryId: bunnyLibraryId.trim(),
        apiKey: bunnyApiKey.trim(),
        cdnHost: bunnyCdnHost.trim() || "iframe.mediadelivery.net"
      };
      localStorage.setItem("nadjah_bunny_config", JSON.stringify(config));
      setBunnySuccess(getLabel(
        "تم حفظ إعدادات Bunny.net بنجاح!",
        "Configuration Bunny.net enregistrée avec succès !",
        "Bunny.net settings saved successfully!"
      ));
      setTimeout(() => setBunnySuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const getLabel = (ar: string, fr: string, en: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError(getLabel(
        "يرجى اختيار ملف صورة صالح.",
        "Veuillez sélectionner un fichier image valide.",
        "Please select a valid image file."
      ));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(getLabel(
        "حجم الصورة كبير جداً (الحد الأقصى 5 ميغابايت).",
        "L'image est trop volumineuse (max 5 Mo).",
        "Image size is too large (max 5MB)."
      ));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatarUrl(compressedDataUrl);
          setAvatarError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async (urlToSave?: string) => {
    const finalUrl = urlToSave !== undefined ? urlToSave : avatarUrl;
    setAvatarError(null);
    setAvatarSuccess(null);
    setAvatarLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: finalUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      setAvatarSuccess(getLabel(
        "تم تحديث الصورة الشخصية بنجاح!",
        "Photo de profil mise à jour avec succès !",
        "Profile picture updated successfully!"
      ));
      
      // Short delay and soft reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Avatar update error:", err);
      setAvatarError(err.message || getLabel(
        "فشل تحديث الصورة الشخصية.",
        "Échec de la mise à jour de la photo de profil.",
        "Failed to update profile picture."
      ));
    } finally {
      setAvatarLoading(false);
    }
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
        password: newPassword + "A1",
        data: {
          password: newPassword // Store in metadata for admin visibility
        }
      });

      if (error) throw error;
      
      // Touch profile to trigger realtime updates for admin and store password
      await supabase
        .from('profiles')
        .update({ 
          updated_at: new Date().toISOString(),
          password: newPassword 
        })
        .eq('id', profile.id);

      setSuccessMsg(getLabel(
        "تم تحديث كلمة المرور بنجاح!",
        "Mot de passe mis à jour avec succès !",
        "Password updated successfully!"
      ));
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password update error:", err);
      let errorMessage = err.message || getLabel(
        "فشل تحديث كلمة المرور.",
        "Échec de la mise à jour du mot de passe.",
        "Failed to update password."
      );
      
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
      
      setErrorMsg(errorMessage);
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

      {/* Profile Picture Card */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                {getLabel("الصورة الشخصية", "Photo de Profil", "Profile Picture")}
              </h4>
              <p className="text-[10px] font-medium text-slate-400">
                {getLabel(
                  "تخصيص صورتك الشخصية لتظهر للأعضاء والمعلمين.",
                  "Personnalisez votre photo pour apparaître auprès des membres.",
                  "Customize your avatar visible to students and teachers."
                )}
              </p>
            </div>
          </div>
        </div>

        {avatarError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{avatarError}</span>
          </motion.div>
        )}

        {avatarSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{avatarSuccess}</span>
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-6 pb-2">
          {/* Main Avatar Preview */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={profile.fullname} 
                className="h-24 w-24 rounded-2xl object-cover border-2 border-slate-100 shadow-md transition-all group-hover:brightness-90"
              />
            ) : (
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-brand-blue to-blue-700 text-white flex items-center justify-center font-black text-3xl uppercase shadow-md border-2 border-slate-100">
                {profile.fullname?.charAt(0) || profile.username?.charAt(0) || "U"}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
              title={getLabel("تغيير الصورة", "Changer la photo", "Change Photo")}
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 text-center sm:text-left rtl:sm:text-right flex-1 w-full">
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start rtl:sm:justify-end">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{getLabel("رفع صورة من الجهاز", "Télécharger une image", "Upload Image")}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCustomUrlOpen(!isCustomUrlOpen)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-slate-200/60"
              >
                <Link2 className="h-3.5 w-3.5 text-slate-500" />
                <span>{getLabel("رابط صورة", "Lien d'image", "Image URL")}</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl("");
                    handleSaveAvatar("");
                  }}
                  disabled={avatarLoading}
                  className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{getLabel("حذف الصورة", "Supprimer", "Remove")}</span>
                </button>
              )}
            </div>

            {/* Custom URL Input Field if toggled */}
            {isCustomUrlOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2"
              >
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/my-photo.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-brand-blue"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveAvatar(avatarUrl)}
                    className="px-4 py-2 bg-brand-blue text-white text-xs font-bold rounded-xl"
                  >
                    OK
                  </button>
                </div>
              </motion.div>
            )}

            <p className="text-[10px] text-slate-400 font-medium">
              {getLabel(
                "يدعم JPG، PNG، WEBP. الحد الأقصى 5 ميغابايت.",
                "Formats supportés : JPG, PNG, WEBP. Max 5 Mo.",
                "Supported formats: JPG, PNG, WEBP. Max 5MB."
              )}
            </p>
          </div>
        </div>

        {/* Preset Avatars Selection */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>{getLabel("أو اختر من الصور الرمزية الجاهزة", "Ou choisissez un avatar prédéfini", "Or select a preset avatar")}</span>
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
            {PRESET_AVATARS.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAvatarUrl(url);
                  handleSaveAvatar(url);
                }}
                className={cn(
                  "relative rounded-xl overflow-hidden aspect-square border-2 transition-all hover:scale-105 cursor-pointer group",
                  avatarUrl === url ? "border-brand-blue shadow-md shadow-blue-500/20 ring-2 ring-brand-blue/30" : "border-slate-100 hover:border-slate-300"
                )}
              >
                <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                {avatarUrl === url && (
                  <div className="absolute inset-0 bg-brand-blue/30 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        {avatarUrl !== (profile.avatar_url || "") && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleSaveAvatar()}
              disabled={avatarLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {avatarLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{getLabel("حفظ الصورة الشخصية", "Enregistrer la photo", "Save Profile Picture")}</span>
                </>
              )}
            </button>
          </div>
        )}
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


      {/* Teacher Profile Info Section */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-blue-50 text-brand-blue rounded-xl">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              {getLabel("معلومات الأستاذ والصفحة الشخصية", "Informations du Professeur", "Teacher Profile & Bio")}
            </h4>
            <p className="text-[10px] font-medium text-slate-400">
              {getLabel(
                "أضف تخصصك ونبذة عنك ليراها الطلاب عند الضغط على (المزيد) في مجتمعاتك.",
                "Ajoutez votre spécialité et votre bio pour les étudiants.",
                "Add your subject specialty and bio visible to students."
              )}
            </p>
          </div>
        </div>

        {infoError && (
          <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-3 flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{infoError}</span>
          </div>
        )}

        {infoSuccess && (
          <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{infoSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUpdateTeacherInfo} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {getLabel("الاسم الكامل", "Nom Complet", "Full Name")}
              </label>
              <input
                type="text"
                required
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {getLabel("المادة / التخصص", "Matière / Spécialité", "Subject / Specialty")}
              </label>
              <input
                type="text"
                placeholder={getLabel("مثال: أستاذ الرياضيات والفيزياء", "Ex: Prof de Mathématiques", "e.g. Mathematics Teacher")}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {getLabel("رقم الهاتف (اختياري للتواصل)", "Numéro de téléphone", "Phone Number")}
            </label>
            <input
              type="text"
              placeholder="06 XX XX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {getLabel("نبذة عن الأستاذ والمعلومات للطلاب", "Bio / Description pour les élèves", "Bio / Description for Students")}
            </label>
            <textarea
              rows={3}
              placeholder={getLabel(
                "أكتب هنا نبذة عن مؤهلاتك، سنوات الخبرة، وكيفية مساعدة الطلاب...",
                "Écrivez une brève description de votre expérience...",
                "Write a brief description of your qualifications and experience..."
              )}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-brand-blue resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={infoLoading}
            className="w-full py-3 bg-brand-blue hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {infoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>{getLabel("حفظ معلومات الأستاذ", "Enregistrer les informations", "Save Teacher Info")}</span>
            )}
          </button>
        </form>
      </div>

      {/* Bunny.net Video Host Configuration */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span>{getLabel("استضافة الفيديوهات (Bunny.net Stream)", "Hébergement Vidéo Bunny.net", "Bunny.net Video Hosting")}</span>
              <span className="bg-orange-100 text-orange-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Stream API</span>
            </h4>
            <p className="text-[10px] font-medium text-slate-400">
              {getLabel(
                "إعداد مكتبة Bunny.net الخاصة بك لتضمين وتشغيل الفيديوهات والدروس بسرعة فائقة.",
                "Configurez votre bibliothèque Bunny.net Stream pour des vidéos fluides.",
                "Configure your Bunny.net Stream library for fast video playback."
              )}
            </p>
          </div>
        </div>

        {bunnySuccess && (
          <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{bunnySuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveBunnyConfig} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {getLabel("معرف المكتبة (Library ID)", "ID de la bibliothèque", "Library ID")}
              </label>
              <input
                type="text"
                placeholder="e.g. 123456"
                value={bunnyLibraryId}
                onChange={(e) => setBunnyLibraryId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {getLabel("مضيف الـ CDN / Pull Zone", "CDN Host / Domain", "CDN Hostname")}
              </label>
              <input
                type="text"
                placeholder="e.g. iframe.mediadelivery.net"
                value={bunnyCdnHost}
                onChange={(e) => setBunnyCdnHost(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
              {getLabel("مفتاح API الخاص بـ Bunny (اختياري للرفع المباشر)", "Clé API Bunny (Optionnel)", "Bunny API Key (Optional)")}
            </label>
            <input
              type="password"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={bunnyApiKey}
              onChange={(e) => setBunnyApiKey(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{getLabel("حفظ إعدادات Bunny.net", "Enregistrer la config Bunny", "Save Bunny Settings")}</span>
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
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
                {getLabel("البريد الإلكتروني", "Adresse E-mail", "Email Address")}
              </p>
              <p className="text-xs font-bold text-slate-800 truncate select-all">{profile.email}</p>
            </div>
            {profile.email && (
              <button
                type="button"
                onClick={() => copyEmail(profile.email)}
                className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 text-[11px] font-bold"
                title={getLabel("نسخ البريد الإلكتروني", "Copier l'e-mail", "Copy email")}
              >
                {copiedEmailSettings ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
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

        <div className="pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={async () => {
              window.dispatchEvent(new Event("dev-logout"));
              await supabase.auth.signOut();
            }}
            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-100"
          >
            <LogOut className="h-4 w-4" />
            <span>{getLabel("تسجيل الخروج من الحساب", "Se déconnecter", "Sign Out of Account")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
