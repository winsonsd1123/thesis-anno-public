import { createAdminClient } from "@/lib/supabase/admin";

/** 与 DB `transaction_type` 枚举对齐（含 billing v3 局部退款） */
export type CreditTransactionType =
  | "deposit"
  | "consumption"
  | "refund"
  | "partial_refund"
  | "admin_adjustment"
  | "bonus";

export type CreditTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  type: CreditTransactionType;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ListTransactionsOptions = {
  page: number;
  limit: number;
  /** 单类型精确筛选 */
  type?: CreditTransactionType | null;
  /** 多类型（如退款含 refund + partial_refund）；与 `type` 互斥，优先 `typesIn` */
  typesIn?: CreditTransactionType[] | null;
};

export type ListTransactionsResult = {
  rows: CreditTransactionRow[];
  total: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const transactionDAL = {
  async listForUser(userId: string, options: ListTransactionsOptions): Promise<ListTransactionsResult> {
    const page = Math.max(1, options.page);
    const limit = Math.min(Math.max(1, options.limit), MAX_LIMIT);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = createAdminClient();
    let q = supabase
      .from("credit_transactions")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (options.typesIn && options.typesIn.length > 0) {
      q = q.in("type", options.typesIn);
    } else if (options.type) {
      q = q.eq("type", options.type);
    }

    const { data, error, count } = await q;

    if (error) throw new Error(`CREDIT_TX_LIST: ${error.message}`);

    return {
      rows: (data ?? []) as CreditTransactionRow[],
      total: count ?? 0,
    };
  },
};

export const TRANSACTION_PAGE_DEFAULT_LIMIT = DEFAULT_LIMIT;
