import type { AdminDashboardStats } from "@/lib/dal/admin-stats.dal";
import { adminStatsDAL } from "@/lib/dal/admin-stats.dal";

export type { AdminDashboardStats };

/**
 * 管理端运营看板：聚合统计。页面层只应依赖本 Service，由本层调用 DAL。
 */
export const adminStatsService = {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    return adminStatsDAL.getDashboardStats();
  },
};
