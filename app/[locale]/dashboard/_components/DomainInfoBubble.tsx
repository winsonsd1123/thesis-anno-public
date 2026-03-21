"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";

type DomainInfoBubbleProps = {
  title: string;
  domainPlaceholder: string;
  saveLabel: string;
  savingLabel: string;
  cancelLabel: string;
  initialDomain: string;
  editable?: boolean;
  domainNotSetLabel?: string;
  editPencilAriaLabel?: string;
  onSave: (domain: string) => Promise<{ ok: boolean; message?: string }>;
};

export function DomainInfoBubble({
  title,
  domainPlaceholder,
  saveLabel,
  savingLabel,
  cancelLabel,
  initialDomain,
  editable = true,
  domainNotSetLabel = "—",
  editPencilAriaLabel = "Edit",
  onSave,
}: DomainInfoBubbleProps) {
  const [domain, setDomain] = useState(initialDomain);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDomain);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDomain(initialDomain);
    setDraft(initialDomain);
  }, [initialDomain]);

  function startEdit() {
    setDraft(domain);
    setErr(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(domain);
    setErr(null);
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    const r = await onSave(draft.trim());
    setSaving(false);
    if (!r.ok) {
      setErr(r.message ?? "");
    } else {
      setDomain(draft.trim());
      setEditing(false);
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  const displayValue = domain.trim().length > 0 ? domain.trim() : domainNotSetLabel;
  const isEmpty = domain.trim().length === 0;

  if (editing) {
    return (
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 14px",
          borderRadius: 16,
          border: "1.5px solid var(--brand)",
          background: "var(--surface)",
          boxShadow: "0 0 0 3px var(--brand-bg), var(--shadow-sm)",
          maxWidth: 340,
          animation: "fade-in 0.12s ease",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--brand)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {title}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={domainPlaceholder}
          style={{
            fontSize: 14,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-strong)",
            outline: "none",
            background: "var(--bg-subtle)",
            color: "var(--text-primary)",
            width: "100%",
            minWidth: 220,
          }}
        />
        {err ? (
          <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }} role="alert">{err}</p>
        ) : null}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: 999,
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              background: "var(--brand)",
              color: "#fff",
              opacity: saving ? 0.75 : 1,
            }}
          >
            <Check size={14} strokeWidth={2.5} aria-hidden />
            {saving ? savingLabel : saveLabel}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancelEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              fontWeight: 500,
              padding: "7px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              cursor: "pointer",
              background: "transparent",
              color: "var(--text-secondary)",
            }}
          >
            <X size={14} strokeWidth={2} aria-hidden />
            {cancelLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--bg-subtle)",
          cursor: editable ? "default" : "default",
          transition: "border-color 0.15s, background 0.15s",
          borderColor: hover && editable ? "var(--border-strong)" : "var(--border)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {title}
        </span>
        <span style={{ width: 1, height: 14, background: "var(--border)", flexShrink: 0 }} aria-hidden />
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: isEmpty ? "var(--text-muted)" : "var(--text-primary)",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayValue}
        </span>
      </div>
      {editable ? (
        <button
          type="button"
          aria-label={editPencilAriaLabel}
          onClick={startEdit}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: hover ? "var(--bg-subtle)" : "transparent",
            color: hover ? "var(--brand)" : "var(--text-muted)",
            cursor: "pointer",
            opacity: hover ? 1 : 0,
            pointerEvents: hover ? "auto" : "none",
            transition: "opacity 0.15s ease, color 0.15s ease, background 0.15s ease",
          }}
        >
          <Pencil size={14} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
