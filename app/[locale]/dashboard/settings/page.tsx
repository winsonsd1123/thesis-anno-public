import { getProfile } from "@/lib/actions/profile.actions";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "./ProfileForm";

export default async function SettingsPage() {
  const profile = await getProfile();
  const t = await getTranslations("dashboard");

  return (
    <div
      className="settings-page"
      style={{
        position: "relative",
        minHeight: "calc(100vh - 56px)",
        padding: "32px 0 48px",
      }}
    >
      {/* 背景装饰 - 与 landing 一致的 subtle 风格 */}
      <div
        className="grid-bg"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          background: "rgba(0,87,255,0.04)",
          borderRadius: "50%",
          filter: "blur(80px)",
          top: -120,
          right: -80,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          background: "rgba(0,180,166,0.05)",
          borderRadius: "50%",
          filter: "blur(80px)",
          bottom: -60,
          left: -60,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto" }}>
        {/* 页面标题区 */}
        <header
          style={{
            marginBottom: 32,
            opacity: 0,
            animation: "fade-up 0.5s ease-out 0.05s forwards",
          }}
        >
          <div
            className="badge badge-brand"
            style={{ marginBottom: 16, display: "inline-flex" }}
          >
            <span className="status-dot running" style={{ width: 6, height: 6 }} />
            {t("settings")}
          </div>
          <h1
            style={{
              fontFamily: "Sora, sans-serif",
              fontSize: "clamp(26px, 4vw, 32px)",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              color: "var(--text-primary)",
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            {t("personalSettings")}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t("settingsSubtitle")}
          </p>
        </header>

        {/* 表单卡片 */}
        <div
          style={{
            opacity: 0,
            animation: "fade-up 0.55s ease-out 0.15s forwards",
          }}
        >
          <ProfileForm profile={profile} />
        </div>
      </div>
    </div>
  );
}
