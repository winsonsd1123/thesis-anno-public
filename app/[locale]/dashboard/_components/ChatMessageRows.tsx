"use client";

/**
 * 对话流左右布局：ThesisAI 在左，用户在右。
 */

type AssistantMessageRowProps = {
  name: string;
  children: React.ReactNode;
};

export function AssistantMessageRow({ name, children }: AssistantMessageRowProps) {
  return (
    <div
      className="animate-fade-up"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-start",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {/* 头像：品牌渐变圆 + "AI" 字样 */}
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--brand) 0%, var(--teal) 100%)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
          boxShadow: "0 2px 8px rgba(0,87,255,0.22)",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.02em", lineHeight: 1 }}>
          AI
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "calc(100% - 44px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            letterSpacing: 0,
          }}
        >
          {name}
        </span>
        <div style={{ width: "100%" }}>{children}</div>
      </div>
    </div>
  );
}

type UserMessageRowProps = {
  name: string;
  userMark: string;
  children: React.ReactNode;
};

export function UserMessageRow({ name, userMark, children }: UserMessageRowProps) {
  return (
    <div
      className="animate-fade-up"
      role="group"
      aria-label={name}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "calc(100% - 44px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <div style={{ width: "100%", maxWidth: 560, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: "100%" }}>{children}</div>
        </div>
      </div>

      {/* 用户头像 */}
      <div
        aria-hidden
        title={name}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--bg-muted)",
          border: "1.5px solid var(--border-strong)",
          color: "var(--text-secondary)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        {userMark}
      </div>
    </div>
  );
}
