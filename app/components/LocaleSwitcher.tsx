"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

type Props = {
  /** 顶栏紧凑样式：更小字号与圆角 */
  compact?: boolean;
};

export function LocaleSwitcher({ compact }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: compact ? 2 : 4 }}>
      {(["zh", "en"] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          style={{
            padding: compact ? "6px 11px" : "4px 10px",
            fontSize: compact ? 12 : 13,
            fontWeight: locale === loc ? 600 : 500,
            color: locale === loc ? "var(--brand-dark)" : "var(--text-muted)",
            background: locale === loc ? "rgba(0, 87, 255, 0.08)" : "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: compact ? 8 : 6,
          }}
        >
          {loc === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
