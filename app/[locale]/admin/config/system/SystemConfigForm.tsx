"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { SystemConfig } from "@/lib/schemas/config.schemas";

export function SystemConfigForm({ initialConfig }: { initialConfig: SystemConfig }) {
  const t = useTranslations("admin.system");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<SystemConfig>({ ...initialConfig });

  function toggleFlag(key: string) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/config/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flags),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }

      router.refresh();
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const entries = Object.entries(flags);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {error && (
        <div
          style={{
            padding: 12,
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: 8,
            color: "var(--error)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {entries.map(([key, value]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 14, fontFamily: "monospace" }}>{key}</span>
            <button
              type="button"
              onClick={() => toggleFlag(key)}
              style={{
                padding: "6px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: value ? "var(--brand-bg)" : "transparent",
                color: value ? "var(--brand)" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {value ? t("enabled") : t("disabled")}
            </button>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: "12px 24px",
          background: "var(--brand)",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : t("save")}
      </button>
    </form>
  );
}
