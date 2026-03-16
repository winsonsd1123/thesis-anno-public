"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

interface AvatarUploadProps {
  currentUrl: string | null;
  onUrlChange: (url: string) => void;
}

export function AvatarUpload({ currentUrl, onUrlChange }: AvatarUploadProps) {
  const t = useTranslations("dashboard.profileForm");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    onUrlChange(urlData.publicUrl);
    setUploading(false);
  }

  return (
    <div className="avatar-upload" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div
        className="avatar-upload-preview"
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--bg-muted)",
          border: "2px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontSize: 32,
              color: "var(--text-muted)",
              fontWeight: 300,
              fontFamily: "Sora, sans-serif",
            }}
          >
            ?
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          style={{
            padding: "10px 18px",
            fontSize: 14,
            width: "fit-content",
          }}
        >
          {uploading ? t("uploadingAvatar") : t("uploadAvatar")}
        </button>
        {error && (
          <p
            style={{
              fontSize: 13,
              color: "var(--danger)",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
