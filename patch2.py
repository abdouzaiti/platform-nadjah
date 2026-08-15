import re

with open('src/App.tsx', 'r') as f:
    app = f.read()

target = "          {/* Header language toggles */}"
replacement = """          {/* Back button to landing page */}
          <div className="absolute top-8 left-8 sm:top-12 sm:left-12">
            <button 
              onClick={() => setShowAuth(false)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors bg-white/50 backdrop-blur px-4 py-2 rounded-xl"
            >
              &larr; {getAuthLabel('العودة', 'Back', 'Retour')}
            </button>
          </div>
          
          {/* Header language toggles */}"""

app = app.replace(target, replacement)

with open('src/App.tsx', 'w') as f:
    f.write(app)
