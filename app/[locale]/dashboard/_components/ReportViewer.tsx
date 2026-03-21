"use client";

import { useMemo, useState } from "react";
import type { ReviewResult } from "@/lib/types/review";

type ReportViewerProps = {
  tabStructure: string;
  tabLogic: string;
  tabRefs: string;
  placeholder: string;
  emptySection: string;
  exportLabel: string;
  result: ReviewResult | null;
};

export function ReportViewer({
  tabStructure,
  tabLogic,
  tabRefs,
  placeholder,
  emptySection,
  exportLabel,
  result,
}: ReportViewerProps) {
  const [tab, setTab] = useState<"structure" | "logic" | "refs">("structure");

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "structure", label: tabStructure },
    { id: "logic", label: tabLogic },
    { id: "refs", label: tabRefs },
  ];

  const body = useMemo(() => {
    if (!result) return placeholder;
    if (tab === "structure") {
      const v = result.format_result;
      if (v === undefined || v === null) return emptySection;
      return JSON.stringify(v, null, 2);
    }
    if (tab === "logic") {
      const v = result.logic_result;
      if (v === undefined || v === null) return emptySection;
      return JSON.stringify(v, null, 2);
    }
    const v = result.reference_result;
    if (v === undefined || v === null) return emptySection;
    return JSON.stringify(v, null, 2);
  }, [result, tab, placeholder, emptySection]);

  function handleExport() {
    const blob = new Blob([JSON.stringify(result ?? {}, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "thesis-review-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-md)",
        maxWidth: 720,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-subtle)",
        }}
      >
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: tab === tb.id ? "var(--surface)" : "transparent",
              color: tab === tb.id ? "var(--brand)" : "var(--text-secondary)",
              boxShadow: tab === tb.id ? "var(--shadow-sm)" : "none",
            }}
          >
            {tb.label}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 12 }} />
        <button
          type="button"
          onClick={handleExport}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 16px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            cursor: "pointer",
            background: "var(--surface)",
            color: "var(--text-primary)",
          }}
        >
          {exportLabel}
        </button>
      </div>
      <div style={{ padding: "24px 26px", minHeight: 200 }}>
        <pre
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {body}
        </pre>
      </div>
    </div>
  );
}
