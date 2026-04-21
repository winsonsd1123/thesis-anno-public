import { getTranslations } from "next-intl/server";
import type { ReviewListQueryUi } from "@/lib/services/review.admin.service";

type Props = {
  ui: ReviewListQueryUi;
};

export async function ReviewsFilterSection({ ui }: Props) {
  const t = await getTranslations("admin.reviews");

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
      <div style={{ flex: "1 1 220px", minWidth: 200 }}>
        <label
          htmlFor="reviewEmail"
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
          id="reviewEmail"
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
