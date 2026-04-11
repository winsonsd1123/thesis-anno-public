export type AdminUserListItemDTO = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  isDisabled: boolean;
  lastSignInAt: Date | null;
  authCreatedAt: Date | null;
  profileCreatedAt: Date | null;
};

export type AdminUserDetailDTO = AdminUserListItemDTO;
