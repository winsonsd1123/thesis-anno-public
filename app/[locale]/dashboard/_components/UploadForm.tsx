"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, ArrowRight } from "lucide-react";
import { isAllowedDocx } from "@/lib/browser/thesis-file";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCX_ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type UploadFormProps = {
  title: string;
  dragLabel: string;
  sizeHint: string;
  clearFileLabel: string;
  domainPlaceholder: string;
  submitLabel: string;
  submitBusyLabel: string;
  invalidFileLabel: string;
  onSubmit: (formData: FormData) => Promise<boolean>;
  errorMessage?: string;
};

export function UploadForm({
  title,
  dragLabel,
  sizeHint,
  clearFileLabel,
  domainPlaceholder,
  submitLabel,
  submitBusyLabel,
  invalidFileLabel,
  onSubmit,
  errorMessage,
}: UploadFormProps) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [localFileError, setLocalFileError] = useState("");
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function trySetFile(file: File | undefined | null): boolean {
    if (!file) return false;
    if (!isAllowedDocx(file)) {
      setLocalFileError(invalidFileLabel);
      setPicked(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return false;
    }
    setLocalFileError("");
    setPicked({ name: file.name, size: file.size });
    return true;
  }

  function onFileChange() {
    const f = fileInputRef.current?.files?.[0];
    if (f) trySetFile(f);
    else {
      setPicked(null);
      setLocalFileError("");
    }
  }

  function clearFile() {
    setPicked(null);
    setLocalFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    if (!isAllowedDocx(file)) {
      setLocalFileError(invalidFileLabel);
      return;
    }
    setLocalFileError("");
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("domain", domain.trim());
    try {
      await onSubmit(fd);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
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
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          ref={fileInputRef}
          name="file"
          type="file"
          accept={DOCX_ACCEPT}
          style={{ display: "none" }}
          onChange={onFileChange}
        />

        {!picked ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDropHover(true);
            }}
            onDragLeave={() => setDropHover(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropHover(false);
              const f = e.dataTransfer.files?.[0];
              if (!f) return;
              if (!isAllowedDocx(f)) {
                setLocalFileError(invalidFileLabel);
                if (fileInputRef.current) fileInputRef.current.value = "";
                return;
              }
              const dt = new DataTransfer();
              dt.items.add(f);
              if (fileInputRef.current) {
                fileInputRef.current.files = dt.files;
                trySetFile(f);
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
            <FileText size={20} strokeWidth={1.5} aria-hidden style={{ color: "var(--brand)", flexShrink: 0 }} />
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
              }}
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}

        {localFileError || errorMessage ? (
          <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }} role="alert">
            {localFileError || errorMessage}
          </p>
        ) : null}

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
          }}
        />

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
            }}
          >
            {busy ? submitBusyLabel : submitLabel}
            {!busy && <ArrowRight size={14} strokeWidth={2.5} aria-hidden />}
          </button>
        </div>
      </form>
    </div>
  );
}
