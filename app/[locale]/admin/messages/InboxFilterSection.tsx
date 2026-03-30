import { getTranslations } from "next-intl/server";
import type { AdminInboxListQueryUi } from "@/lib/services/user-inbox.admin.service";

type Props = {
  ui: AdminInboxListQueryUi;
};

export async function InboxFilterSection({ ui }: Props) {
  const t = await getTranslations("admin.inbox");

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
          htmlFor="inboxFrom"
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
          id="inboxFrom"
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
          htmlFor="inboxTo"
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
          id="inboxTo"
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
          htmlFor="inboxEmail"
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
          id="inboxEmail"
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
          htmlFor="inboxRead"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {t("filterRead")}
        </label>
        <select
          id="inboxRead"
          name="read"
          defaultValue={ui.read}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
            background: "var(--surface)",
          }}
        >
          <option value="all">{t("filterReadAll")}</option>
          <option value="unread">{t("filterReadUnread")}</option>
          <option value="read">{t("filterReadRead")}</option>
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
