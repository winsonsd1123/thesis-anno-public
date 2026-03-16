export interface UserProfileDTO {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  createdAt: Date;
}

export interface UpdateProfileDTO {
  fullName?: string;
  avatarUrl?: string;
}
