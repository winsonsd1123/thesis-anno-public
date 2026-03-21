"use client";

import { useCallback, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

type PaperCardBubbleProps = {
  title: string;
  fileName: string;
  pagesLabel: string;
  allowReplace?: boolean;
  replaceLabel?: string;
  replacingLabel?: string;
  onReplaceFile?: (file: File) => Promise<{ ok: boolean; message?: string }>;
};

export function PaperCardBubble({
  title,
  fileName,
  pagesLabel,
  allowReplace = false,
  replaceLabel = "Replace PDF",
  replacingLabel = "Uploading…",
  onReplaceFile,
}: PaperCardBubbleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePick = useCallback(() => {
    if (!allowReplace || replacing) return;
    setErr(null);
    inputRef.current?.click();
  }, [allowReplace, replacing]);

  const onInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f || !onReplaceFile) return;
      setReplacing(true);
      setErr(null);
      const r = await onReplaceFile(f);
      setReplacing(false);
      if (!r.ok) setErr(r.message ?? "");
    },
    [onReplaceFile]
  );

  return (
    <div
      style={{ position: "relative", maxWidth: 400, display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 卡片主体 */}
      <div
        style={{
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          transition: "border-color 0.18s",
          borderColor: hover && allowReplace ? "var(--border-strong)" : "var(--border)",
        }}
      >
        {/* PDF 图标 */}
        <div
          aria-hidden
          style={{
            width: 38,
            height: 46,
            borderRadius: 7,
            background: "linear-gradient(160deg, #EBF2FF 0%, #E9F9F7 100%)",
            border: "1px solid rgba(0,87,255,0.12)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: "0.06em",
              color: "var(--brand)",
              lineHeight: 1,
            }}
          >
            PDF
          </span>
          <span
            style={{
              display: "block",
              width: 16,
              height: 1.5,
              borderRadius: 1,
              background: "rgba(0,87,255,0.25)",
            }}
          />
          <span
            style={{
              display: "block",
              width: 12,
              height: 1.5,
              borderRadius: 1,
              background: "rgba(0,87,255,0.15)",
            }}
          />
        </div>

        {/* 文件信息 */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={fileName}
          >
            {fileName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{pagesLabel}</div>
        </div>

        {/* 更换按钮（仅 hover 且允许时显示） */}
        {allowReplace ? (
          <button
            type="button"
            disabled={replacing}
            onClick={handlePick}
            aria-label={replaceLabel}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              color: "var(--text-secondary)",
              cursor: replacing ? "wait" : "pointer",
              opacity: hover ? 1 : 0,
              pointerEvents: hover ? "auto" : "none",
              transition: "opacity 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            <RotateCcw
              size={11}
              strokeWidth={2.5}
              aria-hidden
              style={{ animation: replacing ? "spin-slow 1.2s linear infinite" : "none" }}
            />
            {replacing ? replacingLabel : replaceLabel}
          </button>
        ) : null}
      </div>

      {err ? (
        <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6, margin: "6px 2px 0" }} role="alert">{err}</p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        aria-hidden
        tabIndex={-1}
        onChange={onInputChange}
      />
    </div>
  );
}
