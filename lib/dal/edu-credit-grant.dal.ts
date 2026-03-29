import { createAdminClient } from "@/lib/supabase/admin";

export type EduCreditGrantWindowRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  max_claims: number;
};

export type EduCreditGrantClaimWithEmailRow = {
  claim_id: string;
  window_id: string;
  user_id: string;
  credits: number;
  created_at: string;
  user_email: string;
};

export type ListWindowsHistoryParams = {
  page: number;
  pageSize: number;
  /** ISO 8601，含时区；opened_at >= openedAfter */
  openedAfter?: string | null;
  /** ISO 8601；opened_at <= openedBefore */
  openedBefore?: string | null;
  /** 子串匹配 user_email（已转义 ILIKE 特殊字符） */
  emailContains?: string | null;
};

export const EDU_GRANT_HISTORY_PAGE_DEFAULT = 10;
export const EDU_GRANT_HISTORY_PAGE_MAX = 50;

export const eduCreditGrantDAL = {
  async rpcClaimGrant(userId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("claim_edu_credit_grant", {
      p_user_id: userId,
    });
    if (error) throw error;
  },

  async rpcOpenWindow(adminId: string, maxClaims: number): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("open_edu_credit_grant_window", {
      p_admin_id: adminId,
      p_max_claims: maxClaims,
    });
    if (error) throw error;
    if (!data || typeof data !== "string") {
      throw new Error("EDU_GRANT_OPEN_WINDOW_NO_ID");
    }
    return data;
  },

  async rpcCloseWindow(): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("close_edu_credit_grant_window");
    if (error) throw error;
  },

  async getOpenWindow(): Promise<EduCreditGrantWindowRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("edu_credit_grant_windows")
      .select("id, opened_at, closed_at, opened_by, max_claims")
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`EDU_GRANT_DAL_OPEN_WINDOW: ${error.message}`);
    return data as EduCreditGrantWindowRow | null;
  },

  async countClaimsForWindow(windowId: string): Promise<number> {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("edu_credit_grant_claims")
      .select("*", { count: "exact", head: true })
      .eq("window_id", windowId);

    if (error) throw new Error(`EDU_GRANT_DAL_COUNT: ${error.message}`);
    return count ?? 0;
  },

  /**
   * 管理端历史：按轮分页。依赖视图 `edu_credit_grant_claims_with_email`（见 docs/sql/20260332）。
   */
  async listWindowsHistory(
    params: ListWindowsHistoryParams
  ): Promise<{ rows: EduCreditGrantWindowRow[]; total: number }> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(
      Math.max(1, params.pageSize),
      EDU_GRANT_HISTORY_PAGE_MAX
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createAdminClient();
    let windowIdsFilter: string[] | null = null;

    const rawEmail = params.emailContains?.trim();
    if (rawEmail) {
      const escaped = rawEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
      const { data: hitRows, error: hitErr } = await supabase
        .from("edu_credit_grant_claims_with_email")
        .select("window_id")
        .ilike("user_email", `%${escaped}%`);

      if (hitErr) {
        throw new Error(`EDU_GRANT_DAL_HISTORY_EMAIL: ${hitErr.message}`);
      }
      windowIdsFilter = [...new Set((hitRows ?? []).map((r) => r.window_id as string))];
      if (windowIdsFilter.length === 0) {
        return { rows: [], total: 0 };
      }
    }

    let q = supabase
      .from("edu_credit_grant_windows")
      .select("id, opened_at, closed_at, opened_by, max_claims", { count: "exact" })
      .order("opened_at", { ascending: false });

    if (params.openedAfter) {
      q = q.gte("opened_at", params.openedAfter);
    }
    if (params.openedBefore) {
      q = q.lte("opened_at", params.openedBefore);
    }
    if (windowIdsFilter) {
      q = q.in("id", windowIdsFilter);
    }

    const { data, error, count } = await q.range(from, to);

    if (error) throw new Error(`EDU_GRANT_DAL_HISTORY: ${error.message}`);

    return {
      rows: (data ?? []) as EduCreditGrantWindowRow[],
      total: count ?? 0,
    };
  },

  async listClaimsWithEmailForWindows(
    windowIds: string[]
  ): Promise<EduCreditGrantClaimWithEmailRow[]> {
    if (windowIds.length === 0) return [];

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("edu_credit_grant_claims_with_email")
      .select("claim_id, window_id, user_id, credits, created_at, user_email")
      .in("window_id", windowIds)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`EDU_GRANT_DAL_CLAIMS_EMAIL: ${error.message}`);

    return (data ?? []) as EduCreditGrantClaimWithEmailRow[];
  },
};
