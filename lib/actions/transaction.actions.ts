"use server";

import { createClient } from "@/lib/supabase/server";
import {
  transactionDAL,
  type CreditTransactionRow,
  type CreditTransactionType,
  type ListTransactionsOptions,
  TRANSACTION_PAGE_DEFAULT_LIMIT,
} from "@/lib/dal/transaction.dal";
import { orderDAL, type OrderRow } from "@/lib/dal/order.dal";
import { reviewDAL } from "@/lib/dal/review.dal";
import type { ReviewRow } from "@/lib/types/review";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REVIEW_RELATED_TYPES: CreditTransactionType[] = [
  "consumption",
  "refund",
  "partial_refund",
];

export type TransactionReviewSummary = Pick<
  ReviewRow,
  "id" | "file_name" | "cost" | "cost_breakdown" | "refunded_amount"
>;

export type TransactionListItem = {
  transaction: CreditTransactionRow;
  order: OrderRow | null;
  review: TransactionReviewSummary | null;
  /** 扣费/流水侧快照，优先于 review 表（与 DB 写入一致） */
  costBreakdown: Record<string, number> | null;
};

export type FetchUserTransactionsResult =
  | { ok: true; items: TransactionListItem[]; total: number; page: number; limit: number }
  | { ok: false; error: string };

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function parseReviewId(ref: string | null): number | null {
  if (!ref || !/^\d+$/.test(ref)) return null;
  const n = parseInt(ref, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickCostBreakdown(
  tx: CreditTransactionRow,
  review: TransactionReviewSummary | null
): Record<string, number> | null {
  const meta = tx.metadata;
  const raw = meta && typeof meta === "object" ? (meta as Record<string, unknown>).cost_breakdown : undefined;
  if (raw && typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    if (Object.keys(out).length > 0) return out;
  }
  const rb = review?.cost_breakdown;
  if (rb && typeof rb === "object") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rb)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    if (Object.keys(out).length > 0) return out;
  }
  return null;
}

function toReviewSummary(row: ReviewRow): TransactionReviewSummary {
  return {
    id: row.id,
    file_name: row.file_name,
    cost: row.cost,
    cost_breakdown: row.cost_breakdown ?? null,
    refunded_amount: row.refunded_amount,
  };
}

/** URL / UI 筛选：refunds = refund + partial_refund */
export type TransactionFilterParam = "all" | "deposit" | "consumption" | "refunds";

const VALID_FILTERS: TransactionFilterParam[] = ["all", "deposit", "consumption", "refunds"];

export async function fetchUserTransactions(params: {
  page?: number;
  limit?: number;
  filter?: TransactionFilterParam | null;
}): Promise<FetchUserTransactionsResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : TRANSACTION_PAGE_DEFAULT_LIMIT;

  const raw = params.filter ?? "all";
  const f: TransactionFilterParam = VALID_FILTERS.includes(raw as TransactionFilterParam)
    ? (raw as TransactionFilterParam)
    : "all";
  const listOpts: ListTransactionsOptions = { page, limit };
  if (f === "deposit") listOpts.type = "deposit";
  else if (f === "consumption") listOpts.type = "consumption";
  else if (f === "refunds") listOpts.typesIn = ["refund", "partial_refund"];

  const { rows, total } = await transactionDAL.listForUser(user.id, listOpts);

  const orderIds = new Set<string>();
  const reviewIds = new Set<number>();

  for (const tx of rows) {
    const ref = tx.reference_id;
    if (!ref) continue;
    if (tx.type === "deposit" && isUuid(ref)) {
      orderIds.add(ref);
    }
    if (REVIEW_RELATED_TYPES.includes(tx.type)) {
      const rid = parseReviewId(ref);
      if (rid !== null) reviewIds.add(rid);
    }
    if (tx.type === "partial_refund" && tx.metadata && typeof tx.metadata === "object") {
      const ridRaw = (tx.metadata as Record<string, unknown>).review_id;
      if (typeof ridRaw === "number" && Number.isFinite(ridRaw)) reviewIds.add(ridRaw);
      if (typeof ridRaw === "string" && /^\d+$/.test(ridRaw)) reviewIds.add(parseInt(ridRaw, 10));
    }
  }

  const orderMap = new Map<string, OrderRow>();
  await Promise.all(
    [...orderIds].map(async (id) => {
      const o = await orderDAL.getById(id);
      if (o) orderMap.set(id, o);
    })
  );

  const reviewMap = await reviewDAL.getByIdsForUser([...reviewIds], user.id);

  const items: TransactionListItem[] = rows.map((tx) => {
    let order: OrderRow | null = null;
    let review: TransactionReviewSummary | null = null;

    const ref = tx.reference_id;
    if (ref && tx.type === "deposit" && isUuid(ref)) {
      order = orderMap.get(ref) ?? null;
    }
    if (ref && REVIEW_RELATED_TYPES.includes(tx.type)) {
      const rid = parseReviewId(ref);
      if (rid !== null) {
        const r = reviewMap.get(rid);
        if (r) review = toReviewSummary(r);
      }
    }
    if (!review && tx.type === "partial_refund" && tx.metadata && typeof tx.metadata === "object") {
      const ridRaw = (tx.metadata as Record<string, unknown>).review_id;
      const rid =
        typeof ridRaw === "number"
          ? ridRaw
          : typeof ridRaw === "string" && /^\d+$/.test(ridRaw)
            ? parseInt(ridRaw, 10)
            : null;
      if (rid !== null) {
        const r = reviewMap.get(rid);
        if (r) review = toReviewSummary(r);
      }
    }

    return {
      transaction: tx,
      order,
      review,
      costBreakdown: pickCostBreakdown(tx, review),
    };
  });

  return { ok: true, items, total, page, limit };
}
