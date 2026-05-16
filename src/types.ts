export type UserRole = "admin" | "teacher" | "student" | "guest" | "ADMIN" | "TEACHER" | "STUDENT" | "GUEST";

export interface UserProfile {
  id: string;
  fullname: string;
  name?: string;
  email: string;
  username: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
}

export interface TeacherCommunity {
  id: string;
  teacher_id: string;
  community_name: string;
  community_username: string;
  community_password?: string;
  description: string;
  created_at: string;
}

export type RoomType = "chat" | "live" | "announcements" | "files";

export interface ClassRoom {
  id: string;
  community_id: string;
  room_name: string;
  room_username?: string;
  room_password?: string;
  room_type: RoomType;
  created_at: string;
}

export interface LiveSession {
  id: string;
  room_id: string;
  title: string;
  live_password?: string;
  status: "live" | "ended" | "scheduled";
  started_at?: string;
  ended_at?: string;
}

export interface ChatMessageData {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  recipient_id?: string;
  message: string;
  content?: string;
  created_at: string;
}

export interface Recording {
  id: string;
  live_session_id: string;
  video_url: string;
  created_at: string;
}
