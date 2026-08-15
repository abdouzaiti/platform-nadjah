import re

with open('src/pages/LandingPage.tsx', 'r') as f:
    app = f.read()

target = "profiles(fullname, avatar_url),"
replacement = "profiles(fullname, avatar_url)"
app = app.replace(target, replacement)

with open('src/pages/LandingPage.tsx', 'w') as f:
    f.write(app)
