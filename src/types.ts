export type UserRole = "teacher" | "student";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  createdAt: string;
}

export interface StreamData {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  status: "live" | "offline" | "scheduled";
  thumbnail: string;
  viewersCount: number;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageData {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhoto: string;
  timestamp: string;
}
