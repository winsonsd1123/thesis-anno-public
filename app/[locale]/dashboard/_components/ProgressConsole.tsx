type ProgressConsoleProps = {
  title: string;
  subtitle: string;
  agents: { label: string; progress: number; status: "running" | "done" | "pending" }[];
  logLines: string[];
};

export function ProgressConsole({ title, subtitle, agents, logLines }: ProgressConsoleProps) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid var(--border)",
        background: "var(--text-primary)",
        color: "#E2E8F0",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        maxWidth: 720,
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "#F8FAFC" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>{subtitle}</div>
      </div>
      <div style={{ padding: "16px 20px 8px" }}>
        {agents.map((a) => (
          <div key={a.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#CBD5E1" }}>{a.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: a.status === "done" ? "var(--teal)" : a.status === "running" ? "var(--brand-light)" : "#64748B",
                }}
              >
                {a.status === "done" ? "OK" : a.status === "running" ? "…" : "—"}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "rgba(148, 163, 184, 0.2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${a.progress}%`,
                  borderRadius: 999,
                  background:
                    a.status === "done"
                      ? "linear-gradient(90deg, var(--teal), #34D399)"
                      : "linear-gradient(90deg, var(--brand-dark), var(--brand-light))",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          margin: "0 12px 12px",
          borderRadius: 12,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.15)",
          padding: "14px 16px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.65,
          maxHeight: 160,
          overflow: "auto",
        }}
      >
        {logLines.map((line, i) => (
          <div key={i} style={{ color: i === logLines.length - 1 ? "#93C5FD" : "#94A3B8" }}>
            <span style={{ opacity: 0.5, marginRight: 8 }}>{">"}</span>
            {line}
            {i === logLines.length - 1 && (
              <span
                className="review-console-caret"
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 14,
                  marginLeft: 4,
                  background: "var(--brand-light)",
                  verticalAlign: "middle",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
