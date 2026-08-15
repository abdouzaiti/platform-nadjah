import re

with open('src/components/SettingsView.tsx', 'r') as f:
    content = f.read()

# Add states for bio, subject, phone
state_addition = """  const [bio, setBio] = React.useState(profile.bio || "");
  const [subject, setSubject] = React.useState(profile.subject || "");
  const [phone, setPhone] = React.useState(profile.phone || "");
  const [fullname, setFullname] = React.useState(profile.fullname || "");
  const [infoLoading, setInfoLoading] = React.useState(false);
  const [infoSuccess, setInfoSuccess] = React.useState<string | null>(null);
  const [infoError, setInfoError] = React.useState<string | null>(null);

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
"""

content = content.replace('  const [newPassword, setNewPassword] = React.useState("");', state_addition + '\n  const [newPassword, setNewPassword] = React.useState("");')

# Add UI section before User Info Card
ui_section = """
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
"""

content = content.replace('      {/* User Info Card (Read only stats) */}', ui_section + '\n      {/* User Info Card (Read only stats) */}')

with open('src/components/SettingsView.tsx', 'w') as f:
    f.write(content)
