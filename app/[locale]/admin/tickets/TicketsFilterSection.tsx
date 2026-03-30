import { getTranslations } from "next-intl/server";
import type { TicketListQueryUi } from "@/lib/services/support-ticket.admin.service";

type Props = {
  ui: TicketListQueryUi;
};

export async function TicketsFilterSection({ ui }: Props) {
  const t = await getTranslations("admin.tickets");

  return (
    <form
      method="get"
      action=""
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "flex-end",
        marginBottom: 24,
        padding: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div>
        <label
          htmlFor="ticketFrom"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {t("filterFrom")}
        </label>
        <input
          id="ticketFrom"
          name="from"
          type="date"
          defaultValue={ui.from}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
      </div>
      <div>
        <label
          htmlFor="ticketTo"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {t("filterTo")}
        </label>
        <input
          id="ticketTo"
          name="to"
          type="date"
          defaultValue={ui.to}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
      </div>
      <div style={{ flex: "1 1 200px", minWidth: 180 }}>
        <label
          htmlFor="ticketEmail"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {t("filterEmail")}
        </label>
        <input
          id="ticketEmail"
          name="email"
          type="search"
          placeholder={t("filterEmailPlaceholder")}
          defaultValue={ui.email}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
      </div>
      <div style={{ minWidth: 160 }}>
        <label
          htmlFor="ticketStatus"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {t("filterStatus")}
        </label>
        <select
          id="ticketStatus"
          name="status"
          defaultValue={ui.status}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
            background: "var(--surface)",
          }}
        >
          <option value="open">{t("statusOptionOpen")}</option>
          <option value="pending">{t("statusOptionPending")}</option>
          <option value="in_progress">{t("statusOptionInProgress")}</option>
          <option value="resolved">{t("statusOptionResolved")}</option>
          <option value="closed">{t("statusOptionClosed")}</option>
          <option value="all">{t("statusOptionAll")}</option>
        </select>
      </div>
      <button
        type="submit"
        style={{
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 600,
          background: "var(--brand)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        {t("filterSubmit")}
      </button>
    </form>
  );
}
