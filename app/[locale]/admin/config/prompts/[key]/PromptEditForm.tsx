"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
type PromptItem = {
  description: string;
  version: string;
  variables: string[];
  templates: Record<string, string>;
  model_config?: { temperature: number; model: string };
};

type InitialData = {
  key: string;
  description: string;
  version: string;
  templates: Record<string, string>;
  model_config: { temperature: number; model: string };
  allPrompts: Record<string, PromptItem>;
};

function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function PromptEditForm({ initialData }: { initialData: InitialData }) {
  const t = useTranslations("admin.prompts");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"zh" | "en">("zh");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(initialData.description);
  const [version, setVersion] = useState(initialData.version);
  const [temperature, setTemperature] = useState(String(initialData.model_config.temperature));
  const [model, setModel] = useState(initialData.model_config.model);
  const [templates, setTemplates] = useState(initialData.templates);

  const zhContent = templates.zh ?? "";
  const enContent = templates.en ?? "";
  const variables = [
    ...new Set([
      ...extractVariables(zhContent),
      ...extractVariables(enContent),
    ]),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const updatedItem: PromptItem = {
        description,
        version,
        variables,
        templates: {
          zh: templates.zh ?? "",
          en: templates.en ?? "",
        },
        model_config: {
          temperature: parseFloat(temperature) || 0.3,
          model: model || "gemini-1.5-pro",
        },
      };

      const payload = {
        ...initialData.allPrompts,
        [initialData.key]: updatedItem,
      };

      const saveRes = await fetch("/api/admin/config/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? "Save failed");
      }

      router.refresh();
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const updateTemplate = (locale: "zh" | "en", value: string) => {
    setTemplates((prev) => ({ ...prev, [locale]: value }));
  };

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

      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {t("description")}
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
      </div>

      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {t("version")}
        </label>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("temperature")}
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            style={{
              width: 120,
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("model")}
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
      </div>

      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab("zh")}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: activeTab === "zh" ? "var(--brand-bg)" : "transparent",
              color: activeTab === "zh" ? "var(--brand)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t("tabZh")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("en")}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: activeTab === "en" ? "var(--brand-bg)" : "transparent",
              color: activeTab === "en" ? "var(--brand)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t("tabEn")}
          </button>
        </div>
        <textarea
          value={activeTab === "zh" ? zhContent : enContent}
          onChange={(e) => updateTemplate(activeTab, e.target.value)}
          rows={12}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "monospace",
          }}
        />
      </div>

      {variables.length > 0 && (
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("variables")}
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {variables.map((v) => (
              <span
                key={v}
                style={{
                  padding: "4px 10px",
                  background: "var(--bg-muted)",
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

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
        {saving ? t("saving") : t("save")}
      </button>
    </form>
  );
}
