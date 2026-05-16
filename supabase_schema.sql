-- Ecole Nadjah Final Unified Schema
-- This schema combines the new modular architecture (Communities/Rooms) 
-- with the request-based registration system requested by the user.

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0.1 Repair Profiles Table (Ensures columns exist even if table was created previously)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='fullname') THEN
        ALTER TABLE public.profiles ADD COLUMN fullname text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='name') THEN
        ALTER TABLE public.profiles ADD COLUMN name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE public.profiles ADD COLUMN username text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url text;
    END IF;
END $$;

-- 1. Profiles Table (Main User Data)
-- We include all common column names for compatibility
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  fullname text,
  name text,
  email text NOT NULL,
  username text UNIQUE,
  phone text,
  avatar_url text,
  role text CHECK (role IN ('admin', 'teacher', 'student', 'ADMIN', 'TEACHER', 'STUDENT', 'GUEST')) NOT NULL DEFAULT 'GUEST',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Educational Structure (Legacy/Reference)
CREATE TABLE IF NOT EXISTS levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(level_id, name),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS year_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_id UUID REFERENCES years(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE(year_id, subject_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Registration System
CREATE TABLE IF NOT EXISTS registration_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    parent_phone TEXT,
    role TEXT CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')),
    level_id UUID REFERENCES levels(id),
    year_id UUID REFERENCES years(id),
    subject_name TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Modular School System (The Core Engine)

-- Ensure compatibility if tables were already created with old column names
DO $$ 
BEGIN 
    -- If room_members was created with student_id instead of user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_members' AND column_name='student_id') THEN
        ALTER TABLE public.room_members RENAME COLUMN student_id TO user_id;
    END IF;
    -- If room_messages was created with sender_id instead of user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='sender_id') THEN
        ALTER TABLE public.room_messages RENAME COLUMN sender_id TO user_id;
    END IF;
    -- In case the tables exist but are missing user_id entirely
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_members') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_members' AND column_name='user_id') THEN
        ALTER TABLE public.room_members ADD COLUMN user_id uuid REFERENCES public.profiles(id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_messages') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='user_id') THEN
        ALTER TABLE public.room_messages ADD COLUMN user_id uuid REFERENCES public.profiles(id);
    END IF;
    -- Ensure message_text exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_messages') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='message_text') THEN
        ALTER TABLE public.room_messages ADD COLUMN message_text text;
    END IF;
    -- Ensure user_avatar exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_messages') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='user_avatar') THEN
        ALTER TABLE public.room_messages ADD COLUMN user_avatar text;
    END IF;
    -- Ensure user_name exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_messages') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='recipient_id') THEN
        ALTER TABLE public.room_messages ADD COLUMN recipient_id uuid REFERENCES public.profiles(id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_messages') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='content') THEN
        ALTER TABLE public.room_messages ADD COLUMN content text;
    END IF;
    -- Ensure live_password is nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='live_sessions' AND column_name='live_password' AND is_nullable = 'NO') THEN
        ALTER TABLE public.live_sessions ALTER COLUMN live_password DROP NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.teacher_communities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_name text NOT NULL,
  community_username text UNIQUE NOT NULL,
  community_password text,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES public.teacher_communities(id) ON DELETE CASCADE NOT NULL,
  room_name text NOT NULL,
  room_username text,
  room_password text,
  room_type text CHECK (room_type IN ('chat', 'live', 'announcements', 'files')) NOT NULL DEFAULT 'chat',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  live_password text,
  status text CHECK (status IN ('live', 'ended', 'scheduled', 'LIVE', 'ENDED', 'SCHEDULED')) NOT NULL DEFAULT 'scheduled',
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  content text,
  recipient_id uuid REFERENCES public.profiles(id),
  user_name text,
  user_avatar text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE CASCADE NOT NULL,
  video_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Migrate legacy message_text if needed
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='message_text') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_messages' AND column_name='message') THEN
        ALTER TABLE public.room_messages RENAME COLUMN message_text TO message;
    END IF;
END $$;


-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.teacher_communities TO authenticated;
GRANT ALL ON public.class_rooms TO authenticated;
GRANT ALL ON public.room_members TO authenticated;
GRANT ALL ON public.live_sessions TO authenticated;
GRANT ALL ON public.room_messages TO authenticated;
GRANT ALL ON public.recordings TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.teacher_communities TO anon;
GRANT SELECT ON public.class_rooms TO anon;

-- DROP AND RECREATE POLICIES
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Communities viewable by all" ON public.teacher_communities;
DROP POLICY IF EXISTS "Teachers manage communities" ON public.teacher_communities;
DROP POLICY IF EXISTS "Rooms viewable by all" ON public.class_rooms;
DROP POLICY IF EXISTS "Teachers manage rooms" ON public.class_rooms;
DROP POLICY IF EXISTS "Members view memberships" ON public.room_members;
DROP POLICY IF EXISTS "Users join rooms" ON public.room_members;
DROP POLICY IF EXISTS "Messages viewable" ON public.room_messages;
DROP POLICY IF EXISTS "Post messages" ON public.room_messages;
DROP POLICY IF EXISTS "Live sessions viewable" ON public.live_sessions;
DROP POLICY IF EXISTS "Teachers manage live" ON public.live_sessions;
DROP POLICY IF EXISTS "Recordings viewable" ON public.recordings;
DROP POLICY IF EXISTS "Teachers manage recordings" ON public.recordings;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Modular system policies
CREATE POLICY "Communities viewable by all" ON public.teacher_communities FOR SELECT USING (true);
CREATE POLICY "Teachers manage communities" ON public.teacher_communities FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Rooms viewable by all" ON public.class_rooms FOR SELECT USING (true);
CREATE POLICY "Teachers manage rooms" ON public.class_rooms FOR ALL USING (EXISTS (SELECT 1 FROM public.teacher_communities WHERE id = community_id AND teacher_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.teacher_communities WHERE id = community_id AND teacher_id = auth.uid()));

CREATE POLICY "Members view memberships" ON public.room_members FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id WHERE r.id = room_id AND c.teacher_id = auth.uid()));
CREATE POLICY "Users join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Messages viewable" ON public.room_messages FOR SELECT USING (
  (content IS NULL OR content != 'private') AND (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_messages.room_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id WHERE r.id = room_id AND c.teacher_id = auth.uid())
  )
  OR
  (content = 'private' AND (
    user_id = auth.uid() 
    OR recipient_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id WHERE r.id = room_id AND c.teacher_id = auth.uid())
  ))
);
CREATE POLICY "Post messages" ON public.room_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Live sessions viewable" ON public.live_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = live_sessions.room_id AND user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id WHERE r.id = room_id AND c.teacher_id = auth.uid()));
CREATE POLICY "Teachers manage live" ON public.live_sessions FOR ALL USING (EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id WHERE r.id = room_id AND c.teacher_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id WHERE r.id = room_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Recordings viewable" ON public.recordings FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members JOIN public.live_sessions ON room_members.room_id = live_sessions.room_id WHERE recordings.live_session_id = live_sessions.id AND user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id JOIN public.live_sessions l ON r.id = l.room_id WHERE l.id = live_session_id AND c.teacher_id = auth.uid()));
CREATE POLICY "Teachers manage recordings" ON public.recordings FOR ALL USING (EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id JOIN public.live_sessions l ON r.id = l.room_id WHERE l.id = live_session_id AND c.teacher_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.class_rooms r JOIN public.teacher_communities c ON r.community_id = c.id JOIN public.live_sessions l ON r.id = l.room_id WHERE l.id = live_session_id AND c.teacher_id = auth.uid()));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;
INSERT INTO levels (id, name) VALUES 
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ابتدائي (Primaire)'),
('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'متوسط (Moyen)'),
('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'ثانوي (Secondaire)'),
('d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8a', 'تكوين (Formation)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- TRIGGER FOR PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, fullname, username, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    LOWER(REGEXP_REPLACE(SPLIT_PART(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g')),
    'GUEST'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
