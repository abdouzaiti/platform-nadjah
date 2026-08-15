import re

with open('src/pages/LandingPage.tsx', 'r') as f:
    app = f.read()

# Replace the member count UI
target_ui = """<div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-bold">{community.member_count}</span>
                  </div>"""
replacement_ui = """<div className="flex items-center gap-1.5 text-brand-blue bg-blue-50 px-3 py-1.5 rounded-lg">
                    <School className="h-4 w-4" />
                    <span className="text-xs font-bold">{i18n.language === 'ar' ? 'مجتمع تعليمي' : 'Educational Community'}</span>
                  </div>"""

app = app.replace(target_ui, replacement_ui)

with open('src/pages/LandingPage.tsx', 'w') as f:
    f.write(app)
