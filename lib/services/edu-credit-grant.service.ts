import {
  eduCreditGrantDAL,
  EDU_GRANT_HISTORY_PAGE_DEFAULT,
  EDU_GRANT_HISTORY_PAGE_MAX,
} from "@/lib/dal/edu-credit-grant.dal";
import type {
  EduCreditGrantClaimWithEmailRow,
  EduCreditGrantWindowRow,
} from "@/lib/dal/edu-credit-grant.dal";

/** 与 RPC `claim_edu_credit_grant` 内 `v_grant_amount` 保持一致 */
export const EDU_GRANT_CREDIT_AMOUNT = 300;

/** 余额须严格小于该值才可申领（与 RPC 内判断保持一致，修改时请同步 docs/sql 迁移） */
export const EDU_GRANT_MAX_BALANCE_EXCLUSIVE = 100;

/** 与 RPC RAISE 文案一致，供 Service 解析 */
export const EDU_GRANT_ERROR_MARKERS = [
  "EDU_GRANT_NO_OPEN_WINDOW",
  "EDU_GRANT_QUOTA_FULL",
  "EDU_GRANT_EMAIL_NOT_CONFIRMED",
  "EDU_GRANT_NOT_EDU_EMAIL",
  "EDU_GRANT_BALANCE_NOT_ZERO",
  "EDU_GRANT_WALLET_NOT_FOUND",
  "EDU_GRANT_ALREADY_CLAIMED",
  "EDU_GRANT_INVALID_USER",
  "EDU_GRANT_USER_NOT_FOUND",
] as const;

export type EduGrantClaimErrorCode = (typeof EDU_GRANT_ERROR_MARKERS)[number] | "UNKNOWN";

export type EduGrantClaimResult =
  | { ok: true }
  | { ok: false; code: EduGrantClaimErrorCode };

export type EduBillingGrantBlockReason =
  | "no_open_window"
  | "balance_not_zero"
  | "email_not_confirmed"
  | "not_edu_email"
  | "no_email";

function messageIncludesMarker(msg: string): EduGrantClaimErrorCode {
  for (const m of EDU_GRANT_ERROR_MARKERS) {
    if (msg.includes(m)) return m;
  }
  return "UNKNOWN";
}

/** 与数据库 `claim_edu_credit_grant` 内域名规则一致（后缀 `.edu.cn` / `.ac.cn`） */
/** 管理端历史筛选：日期为 UTC 日历日（yyyy-mm-dd）。 */
export function parseHistoryOpenedRangeIso(
  histFrom?: string | null,
  histTo?: string | null
): { openedAfter?: string; openedBefore?: string } {
  const out: { openedAfter?: string; openedBefore?: string } = {};
  if (histFrom && /^\d{4}-\d{2}-\d{2}$/.test(histFrom)) {
    out.openedAfter = `${histFrom}T00:00:00.000Z`;
  }
  if (histTo && /^\d{4}-\d{2}-\d{2}$/.test(histTo)) {
    out.openedBefore = `${histTo}T23:59:59.999Z`;
  }
  return out;
}

export function isEduCnEmailDomain(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return /\.(edu|ac)\.cn$/.test(domain);
}

export const eduCreditGrantService = {
  async claimForAuthenticatedUser(userId: string): Promise<EduGrantClaimResult> {
    try {
      await eduCreditGrantDAL.rpcClaimGrant(userId);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, code: messageIncludesMarker(msg) };
    }
  },

  async openCurrentWindow(adminId: string, maxClaims: number): Promise<string> {
    return eduCreditGrantDAL.rpcOpenWindow(adminId, maxClaims);
  },

  async closeCurrentWindow(): Promise<void> {
    await eduCreditGrantDAL.rpcCloseWindow();
  },

  async getAdminHistoryRounds(input: {
    page: number;
    pageSize?: number;
    histFrom?: string | null;
    histTo?: string | null;
    histEmail?: string | null;
  }): Promise<{
    rounds: Array<EduCreditGrantWindowRow & { claims: EduCreditGrantClaimWithEmailRow[] }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pageSize = Math.min(
      Math.max(1, input.pageSize ?? EDU_GRANT_HISTORY_PAGE_DEFAULT),
      EDU_GRANT_HISTORY_PAGE_MAX
    );
    const { openedAfter, openedBefore } = parseHistoryOpenedRangeIso(
      input.histFrom,
      input.histTo
    );
    const { rows, total } = await eduCreditGrantDAL.listWindowsHistory({
      page: input.page,
      pageSize,
      openedAfter: openedAfter ?? null,
      openedBefore: openedBefore ?? null,
      emailContains: input.histEmail?.trim() || null,
    });

    const ids = rows.map((r) => r.id);
    const claimRows = await eduCreditGrantDAL.listClaimsWithEmailForWindows(ids);
    const byWindow = new Map<string, EduCreditGrantClaimWithEmailRow[]>();
    for (const c of claimRows) {
      const list = byWindow.get(c.window_id) ?? [];
      list.push(c);
      byWindow.set(c.window_id, list);
    }

    const rounds = rows.map((w) => ({
      ...w,
      claims: byWindow.get(w.id) ?? [],
    }));

    return { rounds, total, page: input.page, pageSize };
  },

  async getAdminPanelSnapshot(): Promise<{
    openWindow: EduCreditGrantWindowRow | null;
    claimCount: number;
  }> {
    const openWindow = await eduCreditGrantDAL.getOpenWindow();
    const claimCount = openWindow
      ? await eduCreditGrantDAL.countClaimsForWindow(openWindow.id)
      : 0;
    return { openWindow, claimCount };
  },

  /** 计费页等用户侧仅判断是否存在开放窗口（不返回申领人数）。 */
  async isGrantWindowOpen(): Promise<boolean> {
    const w = await eduCreditGrantDAL.getOpenWindow();
    return w != null;
  },

  getBillingUiEligibility(input: {
    hasOpenWindow: boolean;
    balance: number;
    email: string | null | undefined;
    emailConfirmed: boolean;
  }): { showApply: boolean; reason?: EduBillingGrantBlockReason } {
    if (!input.hasOpenWindow) {
      return { showApply: false, reason: "no_open_window" };
    }
    if (!input.email) {
      return { showApply: false, reason: "no_email" };
    }
    if (!input.emailConfirmed) {
      return { showApply: false, reason: "email_not_confirmed" };
    }
    if (!isEduCnEmailDomain(input.email)) {
      return { showApply: false, reason: "not_edu_email" };
    }
    if (input.balance >= EDU_GRANT_MAX_BALANCE_EXCLUSIVE) {
      return { showApply: false, reason: "balance_not_zero" };
    }
    return { showApply: true };
  },
};
