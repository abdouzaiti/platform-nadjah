import re

with open('src/pages/LandingPage.tsx', 'r') as f:
    app = f.read()

app = app.replace("class_rooms(id, room_members(count))", "")
app = app.replace("memberCount += r.room_members[0].count || 0;", "")

with open('src/pages/LandingPage.tsx', 'w') as f:
    f.write(app)
