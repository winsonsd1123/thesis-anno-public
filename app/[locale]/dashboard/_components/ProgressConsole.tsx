import type { CSSProperties } from "react";
import { useState } from "react";

export type ProgressConsoleAgent = {
  key: string;
  label: string;
  badge: string;
  badgeTone: "pending" | "running" | "done" | "failed" | "skipped";
  description: string;
  /** null = 不确定条动画（无法从后端得到比例时） */
  barFillPercent: number | null;
  /** 条数摘要，如「3 / 12 条」 */
  metricsLine?: string;
};

type ProgressConsoleProps = {
  title: string;
  /** 省略或空字符串则不展示副标题行 */
  subtitle?: string;
  barFootnote: string;
  agents: ProgressConsoleAgent[];
  logLines: string[];
  /** 手动刷新回调，有值时展示刷新按钮 */
  onRefresh?: () => Promise<void> | void;
  /** 刷新按钮文案 */
  refreshLabel?: string;
  /** 刷新中文案 */
  refreshingLabel?: string;
};

const badgeStyles: Record<ProgressConsoleAgent["badgeTone"], { bg: string; color: string; border: string }> = {
  pending: {
    bg: "rgba(148, 163, 184, 0.12)",
    color: "#94A3B8",
    border: "rgba(148, 163, 184, 0.35)",
  },
  running: {
    bg: "rgba(51, 120, 255, 0.18)",
    color: "#93C5FD",
    border: "rgba(51, 120, 255, 0.45)",
  },
  done: {
    bg: "rgba(0, 180, 166, 0.15)",
    color: "#5EEAD4",
    border: "rgba(0, 180, 166, 0.4)",
  },
  failed: {
    bg: "rgba(239, 68, 68, 0.14)",
    color: "#FCA5A5",
    border: "rgba(239, 68, 68, 0.4)",
  },
  skipped: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748B",
    border: "rgba(100, 116, 139, 0.3)",
  },
};

export function ProgressConsole({
  title,
  subtitle,
  barFootnote,
  agents,
  logLines,
  onRefresh,
  refreshLabel = "刷新",
  refreshingLabel = "刷新中…",
}: ProgressConsoleProps) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="progress-console-root">
      <div className="progress-console-header">
        <div className="progress-console-title-row">
          <div className="progress-console-title">{title}</div>
          {onRefresh ? (
            <button
              type="button"
              className="progress-console-refresh-btn"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              aria-label={refreshing ? refreshingLabel : refreshLabel}
            >
              <span
                className="progress-console-refresh-icon"
                data-spinning={refreshing ? "true" : "false"}
                aria-hidden
              >
                ↻
              </span>
              <span className="progress-console-refresh-label">
                {refreshing ? refreshingLabel : refreshLabel}
              </span>
            </button>
          ) : null}
        </div>
        {subtitle?.trim() ? <p className="progress-console-subtitle">{subtitle}</p> : null}
        <p className="progress-console-footnote">{barFootnote}</p>
      </div>

      <div className="progress-console-body">
        {agents.map((a) => {
          const tone = badgeStyles[a.badgeTone];
          const indeterminate = a.badgeTone === "running" && a.barFillPercent === null;
          const fillGradient =
            a.badgeTone === "done"
              ? "linear-gradient(90deg, var(--teal), #34D399)"
              : a.badgeTone === "failed"
                ? "linear-gradient(90deg, #DC2626, #F87171)"
                : "linear-gradient(90deg, var(--brand-dark), var(--brand-light))";
          const fillStyle: CSSProperties = indeterminate
            ? {
                backgroundImage:
                  "linear-gradient(90deg, transparent, rgba(51, 120, 255, 0.35), #3378FF, rgba(51, 120, 255, 0.35), transparent)",
                backgroundSize: "200% 100%",
              }
            : {
                width: `${Math.min(100, Math.max(0, a.barFillPercent ?? 0))}%`,
                backgroundImage: fillGradient,
              };
          return (
            <div key={a.key} className="progress-console-row" data-row-tone={a.badgeTone}>
              <div className="progress-console-row-head">
                <div className="progress-console-row-title">
                  <span className="progress-console-dot" data-tone={a.badgeTone} aria-hidden />
                  <span className="progress-console-label">{a.label}</span>
                </div>
                <span
                  className="progress-console-badge"
                  style={{
                    background: tone.bg,
                    color: tone.color,
                    borderColor: tone.border,
                  }}
                >
                  {a.badge}
                </span>
              </div>
              <p className="progress-console-desc">{a.description}</p>
              {a.metricsLine ? <div className="progress-console-metrics">{a.metricsLine}</div> : null}
              <div className="progress-console-track" data-indeterminate={indeterminate ? "true" : "false"}>
                <div
                  className="progress-console-fill"
                  data-indeterminate={indeterminate ? "true" : "false"}
                  style={fillStyle}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="progress-console-log">
        {logLines.map((line, i) => (
          <div
            key={i}
            className="progress-console-log-line"
            data-active={i === logLines.length - 1 ? "true" : "false"}
          >
            <span className="progress-console-log-prompt">{">"}</span>
            {line}
            {i === logLines.length - 1 ? <span className="review-console-caret progress-console-caret" /> : null}
          </div>
        ))}
      </div>

      <style jsx>{`
        .progress-console-root {
          border-radius: 20px;
          border: 1px solid var(--border);
          background: linear-gradient(165deg, #0f172a 0%, #0c1222 48%, #0a0f1a 100%);
          color: #e2e8f0;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          max-width: 720px;
          position: relative;
        }
        .progress-console-root::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(ellipse 120% 80% at 100% 0%, rgba(0, 87, 255, 0.09), transparent 55%),
            radial-gradient(ellipse 90% 60% at 0% 100%, rgba(0, 180, 166, 0.06), transparent 50%);
          pointer-events: none;
        }
        .progress-console-header {
          position: relative;
          padding: 18px 22px 14px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }
        .progress-console-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .progress-console-title {
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #f8fafc;
        }
        .progress-console-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px 5px 10px;
          border-radius: 999px;
          border: 1px solid rgba(51, 120, 255, 0.35);
          background: rgba(51, 120, 255, 0.1);
          color: #93c5fd;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
          flex-shrink: 0;
        }
        .progress-console-refresh-btn:hover:not(:disabled) {
          background: rgba(51, 120, 255, 0.2);
          border-color: rgba(51, 120, 255, 0.6);
        }
        .progress-console-refresh-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .progress-console-refresh-icon {
          font-size: 14px;
          line-height: 1;
          display: inline-block;
        }
        .progress-console-refresh-icon[data-spinning="true"] {
          animation: _pc_spin 0.7s linear infinite;
        }
        @keyframes _pc_spin {
          to { transform: rotate(360deg); }
        }
        .progress-console-refresh-label {
          line-height: 1;
        }
        .progress-console-subtitle {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.55;
          color: #94a3b8;
        }
        .progress-console-footnote {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.5;
          color: #64748b;
        }
        .progress-console-body {
          position: relative;
          padding: 16px 20px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .progress-console-row {
          padding: 12px 0 14px;
          border-bottom: 1px solid rgba(51, 65, 85, 0.45);
        }
        .progress-console-row:last-child {
          border-bottom: none;
        }
        .progress-console-row-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .progress-console-row-title {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .progress-console-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          flex-shrink: 0;
          background: #475569;
          box-shadow: 0 0 0 3px rgba(71, 85, 105, 0.25);
        }
        .progress-console-dot[data-tone="running"] {
          background: var(--brand-light);
          box-shadow: 0 0 0 3px rgba(51, 120, 255, 0.35);
          animation: pulse-brand 2s ease-in-out infinite;
        }
        .progress-console-dot[data-tone="done"] {
          background: var(--teal);
          box-shadow: 0 0 0 3px rgba(0, 180, 166, 0.3);
        }
        .progress-console-dot[data-tone="failed"] {
          background: #f87171;
          box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.25);
        }
        .progress-console-dot[data-tone="skipped"] {
          background: #64748b;
          box-shadow: none;
        }
        .progress-console-label {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          letter-spacing: 0.01em;
        }
        .progress-console-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid;
          flex-shrink: 0;
          letter-spacing: 0.04em;
        }
        .progress-console-desc {
          font-size: 12px;
          line-height: 1.65;
          color: #cbd5e1;
          margin: 0 0 8px 0;
          padding-left: 18px;
        }
        .progress-console-metrics {
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: #7dd3fc;
          padding-left: 18px;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }
        .progress-console-track {
          margin-left: 18px;
          height: 7px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
          position: relative;
        }
        .progress-console-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.45s ease;
        }
        .progress-console-fill[data-indeterminate="true"] {
          width: 42% !important;
          border-radius: 999px;
          background-size: 200% 100% !important;
          animation: progress-console-shimmer 1.35s ease-in-out infinite;
        }
        .progress-console-track[data-indeterminate="true"] .progress-console-fill {
          box-shadow: 0 0 12px rgba(51, 120, 255, 0.35);
        }
        @keyframes progress-console-shimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
        .progress-console-log {
          position: relative;
          margin: 0 12px 14px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.14);
          padding: 14px 16px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11.5px;
          line-height: 1.65;
          max-height: 168px;
          overflow: auto;
        }
        .progress-console-log-line {
          color: #94a3b8;
        }
        .progress-console-log-line[data-active="true"] {
          color: #93c5fd;
        }
        .progress-console-log-prompt {
          opacity: 0.45;
          margin-right: 8px;
          user-select: none;
        }
        .progress-console-caret {
          display: inline-block;
          width: 7px;
          height: 13px;
          margin-left: 4px;
          background: var(--brand-light);
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}
