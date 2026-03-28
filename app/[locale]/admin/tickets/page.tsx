import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/utils/admin";
import { listOpenTickets } from "@/lib/actions/support-ticket.admin.actions";
import TicketsTableClient from "./TicketsTableClient";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.tickets");
  const tickets = await listOpenTickets();

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

      <TicketsTableClient tickets={tickets} />
    </div>
  );
}
