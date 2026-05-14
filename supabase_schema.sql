-- Final Database Overhaul for Nadjat Live
-- Clean up old architecture
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.recorded_lessons CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.years CASCADE;
DROP TABLE IF EXISTS public.levels CASCADE;
DROP TABLE IF EXISTS public.streams CASCADE;
DROP TABLE IF EXISTS public.live_streams CASCADE;

-- Cleanup existing new tables if present for a fresh start
DROP TABLE IF EXISTS public.recordings CASCADE;
DROP TABLE IF EXISTS public.room_messages CASCADE;
DROP TABLE IF EXISTS public.live_sessions CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.class_rooms CASCADE;
DROP TABLE IF EXISTS public.teacher_communities CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  fullname text NOT NULL,
  email text NOT NULL,
  username text UNIQUE NOT NULL,
  avatar_url text,
  role text CHECK (role IN ('admin', 'teacher', 'student')) NOT NULL DEFAULT 'student',
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Teacher Communities
CREATE TABLE public.teacher_communities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_name text NOT NULL,
  community_username text UNIQUE NOT NULL,
  community_password text,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Class Rooms
CREATE TABLE public.class_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES public.teacher_communities(id) ON DELETE CASCADE NOT NULL,
  room_name text NOT NULL,
  room_type text CHECK (room_type IN ('chat', 'live', 'announcements', 'files')) NOT NULL DEFAULT 'chat',
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Room Members
CREATE TABLE public.room_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- 5. Live Sessions
CREATE TABLE public.live_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  live_password text,
  status text CHECK (status IN ('live', 'ended', 'scheduled')) NOT NULL DEFAULT 'scheduled',
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Room Messages (Chat)
CREATE TABLE public.room_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.class_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message_text text NOT NULL,
  user_name text, -- Denormalized for quick access
  user_avatar text, -- Denormalized for quick access
  created_at timestamp with time zone DEFAULT now()
);

-- 7. Recordings (Replay System)
CREATE TABLE public.recordings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE CASCADE NOT NULL,
  video_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Adjust as needed)

-- Profiles: Users can read all, update own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Communities: Viewable by all (for discovery), teachers can manage own
CREATE POLICY "Communities are viewable by all" ON public.teacher_communities FOR SELECT USING (true);
CREATE POLICY "Teachers can insert communities" ON public.teacher_communities FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own communities" ON public.teacher_communities FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own communities" ON public.teacher_communities FOR DELETE USING (auth.uid() = teacher_id);

-- Rooms: Viewable by all, teachers can manage
CREATE POLICY "Rooms are viewable by all" ON public.class_rooms FOR SELECT USING (true);
CREATE POLICY "Teachers can manage rooms in their communities" ON public.class_rooms 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teacher_communities 
      WHERE id = community_id AND teacher_id = auth.uid()
    )
  );

-- Room Members: Students can view their rooms, and join
CREATE POLICY "Users can see their room memberships" ON public.room_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Teachers can see members of their rooms" ON public.room_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.class_rooms r 
    JOIN public.teacher_communities c ON r.community_id = c.id
    WHERE r.id = room_id AND c.teacher_id = auth.uid()
  )
);
CREATE POLICY "Users can join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Live Sessions: All can see, teachers manage
CREATE POLICY "Sessions are viewable by all" ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY "Teachers can manage sessions" ON public.live_sessions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.class_rooms r 
    JOIN public.teacher_communities c ON r.community_id = c.id
    WHERE r.id = room_id AND c.teacher_id = auth.uid()
  )
);

-- Messages: Read if a member, insert if a member
CREATE POLICY "Messages are viewable by room members" ON public.room_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = room_messages.room_id AND user_id = auth.uid()
  ) OR EXISTS (
     SELECT 1 FROM public.class_rooms r 
     JOIN public.teacher_communities c ON r.community_id = c.id
     WHERE r.id = room_id AND c.teacher_id = auth.uid()
  )
);
CREATE POLICY "Members can post messages" ON public.room_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_messages.room_id AND user_id = auth.uid()) OR
    EXISTS (
       SELECT 1 FROM public.class_rooms r 
       JOIN public.teacher_communities c ON r.community_id = c.id
       WHERE r.id = room_id AND c.teacher_id = auth.uid()
    )
  )
);

-- Recordings: Viewable by all
CREATE POLICY "Recordings are viewable by all" ON public.recordings FOR SELECT USING (true);
CREATE POLICY "Teachers can insert recordings" ON public.recordings FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_sessions s
    JOIN public.class_rooms r ON s.room_id = r.id
    JOIN public.teacher_communities c ON r.community_id = c.id
    WHERE s.id = live_session_id AND c.teacher_id = auth.uid()
  )
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_communities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_rooms;
