import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  fetchUserTransactions,
  type TransactionFilterParam,
} from "@/lib/actions/transaction.actions";
import { TransactionList } from "@/app/components/billing/TransactionList";

const FILTERS: TransactionFilterParam[] = ["all", "deposit", "consumption", "refunds"];

function parseFilter(raw: string | undefined): TransactionFilterParam {
  const v = (raw ?? "all").toLowerCase();
  return FILTERS.includes(v as TransactionFilterParam) ? (v as TransactionFilterParam) : "all";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filter = parseFilter(sp.filter);

  const result = await fetchUserTransactions({ page, filter });
  const t = await getTranslations("billing.transactions");

  if (!result.ok) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ color: "var(--text-secondary)" }}>{t("errorAuth")}</p>
        <Link href="/login" style={{ color: "var(--brand)" }}>
          {t("goLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>{t("subtitle")}</p>
        </div>
        <Link
          href="/dashboard/billing"
          style={{
            fontSize: 14,
            color: "var(--brand)",
            textDecoration: "none",
            fontWeight: 600,
            alignSelf: "center",
          }}
        >
          {t("goBilling")}
        </Link>
      </div>

      <TransactionList
        items={result.items}
        total={result.total}
        page={result.page}
        limit={result.limit}
        filter={filter}
      />
    </div>
  );
}
