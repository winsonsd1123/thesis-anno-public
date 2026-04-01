"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

interface AvatarUploadProps {
  currentUrl: string | null;
  displayName?: string | null;
  onUrlChange: (url: string) => void;
}

function getInitials(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const words = name.trim().split(/\s+/);
  return words
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function UserIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function AvatarUpload({ currentUrl, displayName, onUrlChange }: AvatarUploadProps) {
  const t = useTranslations("dashboard.profileForm");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = getInitials(displayName);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setError(t("errorLogin"));
      setUploading(false);
      return;
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userData.user.id}/${Date.now()}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
    setLocalUrl(urlData.publicUrl);
    onUrlChange(urlData.publicUrl);
    setUploading(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {/* 可点击头像圆圈 */}
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        aria-label={t("uploadAvatar")}
        style={{
          position: "relative",
          width: 64,
          height: 64,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--bg-muted)",
          border: "1.5px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: uploading ? "default" : "pointer",
          padding: 0,
          transition: "border-color 0.2s",
        }}
      >
        {/* 图片 / 首字母 / 用户图标 */}
        {uploading ? (
          <span style={{ color: "var(--text-muted)" }}>
            <SpinnerIcon />
          </span>
        ) : localUrl ? (
          <img
            src={localUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : initials ? (
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--brand)",
              fontFamily: "inherit",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {initials}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>
            <UserIcon />
          </span>
        )}

        {/* 相机覆盖层 (hover) */}
        {!uploading && (
          <span
            className="avatar-hover-overlay"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.18s",
            }}
          >
            <CameraIcon />
          </span>
        )}
      </button>

      {/* 上传按钮 + 错误 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary"
          style={{ padding: "6px 14px", fontSize: 13, width: "fit-content" }}
        >
          {uploading ? t("uploadingAvatar") : t("uploadAvatar")}
        </button>
        {error && (
          <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{error}</p>
        )}
      </div>

      <style>{`
        button:not(:disabled):hover .avatar-hover-overlay { opacity: 1; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
