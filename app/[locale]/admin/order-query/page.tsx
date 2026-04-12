import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/utils/admin";
import { adminTransactionService } from "@/lib/services/admin-transaction.service";
import { OrderQueryFilterSection } from "./OrderQueryFilterSection";
import OrderQueryTableClient from "./OrderQueryTableClient";

export default async function AdminOrderQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; email?: string; from?: string; to?: string; type?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.orderQuery");
  const sp = await searchParams;
  const { rows, page, total, totalPages, ui } = await adminTransactionService.listOrderQueryForAdmin(sp);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}
        >
          {t("title")}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t("subtitle")}</p>
      </div>

      <OrderQueryFilterSection ui={ui} />

      <OrderQueryTableClient rows={rows} page={page} total={total} totalPages={totalPages} ui={ui} />
    </div>
  );
}
