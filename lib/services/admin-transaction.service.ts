import {
  ADMIN_ORDER_QUERY_PAGE_SIZE,
  transactionDAL,
  type AdminCreditTransactionRow,
  type AdminTransactionTypeFilter,
  type CreditTransactionType,
} from "@/lib/dal/transaction.dal";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ALL_TX_TYPES: CreditTransactionType[] = [
  "deposit",
  "consumption",
  "refund",
  "partial_refund",
  "admin_adjustment",
  "bonus",
];

export type OrderQueryUi = {
  page: number;
  email: string;
  from: string;
  to: string;
  type: AdminTransactionTypeFilter;
};

function normalizeTypeFilter(raw: string | undefined): AdminTransactionTypeFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "refunds") return "refunds";
  if (ALL_TX_TYPES.includes(raw as CreditTransactionType)) {
    return raw as CreditTransactionType;
  }
  return "all";
}

function parseDateToUtcBoundaries(
  fromRaw: string | undefined,
  toRaw: string | undefined
): { fromUtcInclusive?: string; toUtcInclusive?: string } {
  const from = (fromRaw ?? "").trim();
  const to = (toRaw ?? "").trim();
  let fromUtcInclusive: string | undefined;
  let toUtcInclusive: string | undefined;
  if (from.length > 0 && DATE_RE.test(from)) {
    fromUtcInclusive = `${from}T00:00:00.000Z`;
  }
  if (to.length > 0 && DATE_RE.test(to)) {
    toUtcInclusive = `${to}T23:59:59.999Z`;
  }
  return { fromUtcInclusive, toUtcInclusive };
}

export function parseOrderQuerySearchParams(sp: {
  page?: string;
  email?: string;
  from?: string;
  to?: string;
  type?: string;
}): OrderQueryUi {
  const raw = (sp.page ?? "1").trim();
  const parsed = parseInt(raw, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const email = (sp.email ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const type = normalizeTypeFilter(sp.type);
  return { page, email, from, to, type };
}

export const adminTransactionService = {
  parseOrderQuerySearchParams,

  async listOrderQueryForAdmin(sp: {
    page?: string;
    email?: string;
    from?: string;
    to?: string;
    type?: string;
  }): Promise<{
    rows: AdminCreditTransactionRow[];
    page: number;
    total: number;
    totalPages: number;
    ui: OrderQueryUi;
  }> {
    const ui = parseOrderQuerySearchParams(sp);
    const { fromUtcInclusive, toUtcInclusive } = parseDateToUtcBoundaries(ui.from, ui.to);
    const emailSubstr = ui.email.length > 0 ? ui.email : undefined;

    const { rows, total } = await transactionDAL.listForAdmin({
      page: ui.page,
      limit: ADMIN_ORDER_QUERY_PAGE_SIZE,
      emailSubstr,
      fromUtcInclusive,
      toUtcInclusive,
      typeFilter: ui.type,
    });

    const totalPages = Math.max(1, Math.ceil(total / ADMIN_ORDER_QUERY_PAGE_SIZE));

    return {
      rows,
      page: ui.page,
      total,
      totalPages,
      ui,
    };
  },
};
