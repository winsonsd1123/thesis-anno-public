"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {(["zh", "en"] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          style={{
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: locale === loc ? 600 : 400,
            color: locale === loc ? "var(--brand)" : "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            borderRadius: 6,
          }}
        >
          {loc === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
