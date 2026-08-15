const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Import LandingPage
if (!app.includes('import LandingPage')) {
  app = app.replace('import StudentDashboard from "./pages/StudentDashboard";', 
    'import StudentDashboard from "./pages/StudentDashboard";\nimport LandingPage from "./pages/LandingPage";');
}

// Add state
if (!app.includes('const [showAuth, setShowAuth] = React.useState(false);')) {
  app = app.replace('const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");',
    'const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");\n  const [showAuth, setShowAuth] = React.useState(false);');
}

// Change `if (!user) {` to `if (!user) { if (!showAuth) return <LandingPage onJoinClick={() => setShowAuth(true)} />;`
app = app.replace(/if \(\!user\) \{\n\s*return \(\n\s*<div/, 'if (!user) {\n    if (!showAuth) return <LandingPage onJoinClick={() => setShowAuth(true)} />;\n    return (\n      <div relative');

// Replace the <div relative back to <div className=... (we messed it up slightly in replace, let's do it carefully)
fs.writeFileSync('src/App.tsx', app);
