"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, ArrowRight } from "lucide-react";
import { getPdfPageCountFromFile } from "@/lib/client/pdfPageCount";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadFormProps = {
  title: string;
  dragLabel: string;
  sizeHint: string;
  clearFileLabel: string;
  domainPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  /** 浏览器内用 PDF.js 读页数阶段 */
  parsingPagesLabel: string;
  parsePagesErrorLabel: string;
  onSubmitUpload: (formData: FormData) => Promise<boolean>;
  errorMessage?: string;
};

export function UploadForm({
  title,
  dragLabel,
  sizeHint,
  clearFileLabel,
  domainPlaceholder,
  submitLabel,
  submittingLabel,
  parsingPagesLabel,
  parsePagesErrorLabel,
  onSubmitUpload,
  errorMessage,
}: UploadFormProps) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [readingPages, setReadingPages] = useState(false);
  const [localParseError, setLocalParseError] = useState("");
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFileChange() {
    const f = fileInputRef.current?.files?.[0];
    setPicked(f ? { name: f.name, size: f.size } : null);
    setLocalParseError("");
  }

  function clearFile() {
    setPicked(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setLocalParseError("");
    setBusy(true);
    setReadingPages(true);
    let pageCount: number;
    try {
      pageCount = await getPdfPageCountFromFile(file);
    } catch {
      setLocalParseError(parsePagesErrorLabel);
      setBusy(false);
      setReadingPages(false);
      return;
    }
    setReadingPages(false);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("domain", domain.trim());
    fd.set("pageCount", String(pageCount));
    let success = false;
    try {
      success = await onSubmitUpload(fd);
    } finally {
      setBusy(false);
    }
    if (!success && form.isConnected) {
      form.reset();
      setDomain("");
      setPicked(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: "100%",
        maxWidth: 480,
        borderRadius: 20,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-md)",
        padding: "22px 22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Title */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        name="file"
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {/* Drop zone OR file chip */}
      {!picked ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
          onDragLeave={() => setDropHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropHover(false);
            const f = e.dataTransfer.files?.[0];
            if (!f) return;
            const dt = new DataTransfer();
            dt.items.add(f);
            if (fileInputRef.current) {
              fileInputRef.current.files = dt.files;
              onFileChange();
            }
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            minHeight: 110,
            borderRadius: 12,
            border: dropHover ? "1.5px dashed var(--brand)" : "1.5px dashed var(--border-strong)",
            background: dropHover ? "var(--brand-bg)" : "var(--bg-subtle)",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!dropHover) (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)";
          }}
          onMouseLeave={(e) => {
            if (!dropHover) (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          }}
        >
          <UploadCloud
            size={26}
            strokeWidth={1.5}
            aria-hidden
            style={{ color: dropHover ? "var(--brand)" : "var(--text-muted)" }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{dragLabel}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{sizeHint}</span>
        </button>
      ) : (
        /* File chip */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-subtle)",
          }}
        >
          <FileText
            size={20}
            strokeWidth={1.5}
            aria-hidden
            style={{ color: "var(--brand)", flexShrink: 0 }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
            title={picked.name}
          >
            {picked.name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
            {formatFileSize(picked.size)}
          </span>
          <button
            type="button"
            aria-label={clearFileLabel}
            onClick={clearFile}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
              flexShrink: 0,
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-muted)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

      {/* Error */}
      {localParseError || errorMessage ? (
        <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }} role="alert">
          {localParseError || errorMessage}
        </p>
      ) : null}

      {/* Domain */}
      <input
        type="text"
        name="domain"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder={domainPlaceholder}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 14,
          borderRadius: 10,
          border: "1px solid var(--border)",
          outline: "none",
          background: "var(--surface)",
          color: "var(--text-primary)",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onFocus={(e) => {
          (e.target as HTMLElement).style.borderColor = "var(--brand)";
          (e.target as HTMLElement).style.boxShadow = "0 0 0 3px var(--brand-bg)";
        }}
        onBlur={(e) => {
          (e.target as HTMLElement).style.borderColor = "var(--border)";
          (e.target as HTMLElement).style.boxShadow = "none";
        }}
      />

      {/* Submit row */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={busy || !picked}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            padding: "10px 20px",
            borderRadius: 999,
            border: "none",
            cursor: busy || !picked ? "not-allowed" : "pointer",
            opacity: busy || !picked ? 0.45 : 1,
            background: !picked || busy ? "var(--bg-muted)" : "var(--brand)",
            color: !picked || busy ? "var(--text-secondary)" : "#fff",
            boxShadow: picked && !busy ? "0 4px 14px rgba(0,87,255,0.28)" : "none",
            transition: "background 0.2s, box-shadow 0.2s, opacity 0.2s",
          }}
        >
          {busy ? (readingPages ? parsingPagesLabel : submittingLabel) : submitLabel}
          {!busy && <ArrowRight size={14} strokeWidth={2.5} aria-hidden />}
        </button>
      </div>
    </form>
  );
}
