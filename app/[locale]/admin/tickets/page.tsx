import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/utils/admin";
import { supportTicketAdminService } from "@/lib/services/support-ticket.admin.service";
import TicketsTableClient from "./TicketsTableClient";
import { TicketsFilterSection } from "./TicketsFilterSection";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; email?: string; status?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.tickets");
  const sp = await searchParams;
  const { tickets, ui, truncated } = await supportTicketAdminService.listTicketsForAdmin(sp);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}
        >
          {t("title")}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t("subtitle")}</p>
      </div>

      <TicketsFilterSection ui={ui} />

      <TicketsTableClient tickets={tickets} />

      {truncated && (
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>{t("listTruncated")}</p>
      )}
    </div>
  );
}
