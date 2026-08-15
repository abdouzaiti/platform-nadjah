import re

with open('src/App.tsx', 'r') as f:
    app = f.read()

if 'import LandingPage' not in app:
    app = app.replace('import StudentDashboard from "./pages/StudentDashboard";', 
        'import StudentDashboard from "./pages/StudentDashboard";\nimport LandingPage from "./pages/LandingPage";')

if 'const [showAuth, setShowAuth] = React.useState(false);' not in app:
    app = app.replace('const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");',
        'const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");\n  const [showAuth, setShowAuth] = React.useState(false);')

# We want to insert the condition inside `if (!user) {`
target = "  if (!user) {\n    return ("
replacement = "  if (!user) {\n    if (!showAuth) return <LandingPage onJoinClick={() => setShowAuth(true)} />;\n    return ("
app = app.replace(target, replacement)

with open('src/App.tsx', 'w') as f:
    f.write(app)
