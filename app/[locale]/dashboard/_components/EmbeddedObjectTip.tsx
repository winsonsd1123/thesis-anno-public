import { Info } from "lucide-react";

/** 醒目提示：Visio 等内置对象与图片化建议（产品规避，无后端解析） */
export function EmbeddedObjectTip({ text }: { text: string }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        borderLeftWidth: 3,
        borderLeftColor: "var(--brand)",
        background: "var(--bg-subtle)",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--text-secondary)",
      }}
    >
      <Info size={18} strokeWidth={2} aria-hidden style={{ color: "var(--brand)", flexShrink: 0, marginTop: 1 }} />
      <span>{text}</span>
    </div>
  );
}
