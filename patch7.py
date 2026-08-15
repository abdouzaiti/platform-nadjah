import re

with open('src/pages/LandingPage.tsx', 'r') as f:
    content = f.read()

# Import TeacherProfileModal
content = content.replace(
    'import { cn } from "../lib/utils";',
    'import { cn } from "../lib/utils";\nimport TeacherProfileModal from "../components/TeacherProfileModal";'
)

# Update interface
content = content.replace(
    'teacher: {\n    fullname: string;\n    avatar_url: string;\n  };',
    'teacher: {\n    id?: string;\n    fullname: string;\n    avatar_url: string;\n    bio?: string;\n    subject?: string;\n    email?: string;\n    phone?: string;\n  };\n  teacher_id: string;'
)

# Add state
content = content.replace(
    'const [searchQuery, setSearchQuery] = useState("");',
    'const [searchQuery, setSearchQuery] = useState("");\n  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);'
)

# Update select query
content = content.replace(
    'profiles(fullname, avatar_url)',
    'profiles(id, fullname, avatar_url, bio, subject, email, phone)'
)

# Update formatted map
content = content.replace(
    'teacher: c.profiles || { fullname: "Unknown Teacher", avatar_url: "" },',
    'teacher_id: c.teacher_id,\n            teacher: c.profiles || { id: c.teacher_id, fullname: "Unknown Teacher", avatar_url: "" },'
)

# Replace "onClick={onJoinClick}" on the button "المزيد" to open teacher modal
content = content.replace(
    'onClick={onJoinClick}\n                    className="flex items-center gap-1.5 text-brand-blue font-bold text-sm hover:text-blue-700 transition-colors group-hover:translate-x-1"',
    'onClick={() => setSelectedTeacher({ ...community.teacher, id: community.teacher.id || community.teacher_id })}\n                    className="flex items-center gap-1.5 text-brand-blue font-bold text-sm hover:text-blue-700 transition-colors group-hover:translate-x-1 cursor-pointer"'
)

# Also allow clicking on teacher name/avatar to open profile
content = content.replace(
    '<div className="flex items-start gap-4 mb-4">',
    '<div className="flex items-start gap-4 mb-4 cursor-pointer" onClick={() => setSelectedTeacher({ ...community.teacher, id: community.teacher.id || community.teacher_id })}>'
)

# Add TeacherProfileModal component at end before final </div>
modal_jsx = """
      <TeacherProfileModal
        isOpen={!!selectedTeacher}
        teacherId={selectedTeacher?.id}
        teacherProfile={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        onActionClick={() => {
          setSelectedTeacher(null);
          onJoinClick();
        }}
      />
    </div>
  );
}
"""

content = re.sub(r'\s*</div>\s*\);\s*}\s*$', modal_jsx, content)

with open('src/pages/LandingPage.tsx', 'w') as f:
    f.write(content)
