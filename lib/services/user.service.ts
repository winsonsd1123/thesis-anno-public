import { profileDAL } from "@/lib/dal/profile.dal";
import type { UpdateProfileDTO } from "@/lib/dtos/user.dto";

export const userService = {
  async getProfile(userId: string) {
    return profileDAL.getById(userId);
  },

  async updateProfile(userId: string, data: UpdateProfileDTO) {
    return profileDAL.update(userId, data);
  },
};
