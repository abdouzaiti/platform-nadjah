import re

with open('src/pages/StudentDashboard.tsx', 'r') as f:
    content = f.read()

# Add import
content = content.replace(
    'import StreamPlayer from "../components/StreamPlayer";',
    'import StreamPlayer from "../components/StreamPlayer";\nimport TeacherProfileModal from "../components/TeacherProfileModal";'
)

# Add state
content = content.replace(
    'const [passwordError, setPasswordError] = React.useState("");',
    'const [passwordError, setPasswordError] = React.useState("");\n  const [teacherProfileId, setTeacherProfileId] = React.useState<string | null>(null);'
)

# Add button in community view header or discover cards to view teacher profile
content = content.replace(
    '<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">@{comm.community_username}</p>',
    '<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">@{comm.community_username}</p>\n                      <button onClick={(e) => { e.stopPropagation(); setTeacherProfileId(comm.teacher_id); }} className="mt-1 text-[10px] font-bold text-brand-blue hover:underline block cursor-pointer">👤 {i18n.language === "ar" ? "الملف الشخصي للأستاذ" : "Teacher Profile"}</button>'
)

# Add modal before final closing div
modal_jsx = """
      <TeacherProfileModal
        isOpen={!!teacherProfileId}
        teacherId={teacherProfileId || undefined}
        onClose={() => setTeacherProfileId(null)}
      />
    </div>
  );
}
"""

content = re.sub(r'\s*</div>\s*\);\s*}\s*$', modal_jsx, content)

with open('src/pages/StudentDashboard.tsx', 'w') as f:
    f.write(content)
