"use client";

import { useState, useEffect } from "react";
import { C } from "./constants";

const FULL_TEXT = "基于深度学习的图像识别研究";

export function HeroPreview({ typedText }: { typedText: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 2200);
    return () => clearInterval(t);
  }, []);

  const agents = [
    { name: "格式审查 Agent", icon: "📋", color: C.brand, progress: 100, status: "done" as const },
    { name: "逻辑分析 Agent", icon: "🧠", color: C.teal, progress: 68, status: "running" as const },
    { name: "引用核查 Agent", icon: "📚", color: C.accent, progress: 31, status: "running" as const },
  ];

  return (
    <div
      className="animate-float-slow"
      style={{
        background: C.surface,
        border: `1.5px solid ${C.border}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(15,23,42,0.12), 0 4px 16px rgba(0,87,255,0.06)",
      }}
    >
      <div
        style={{
          background: C.bgSubtle,
          borderBottom: `1px solid ${C.border}`,
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#FE5F57", display: "inline-block" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E", display: "inline-block" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 10, fontSize: 12, color: C.textMuted, fontFamily: "inherit" }}>
          ThesisAI · 审阅进行中
        </span>
        <span className="badge badge-teal" style={{ marginLeft: "auto", fontSize: 11, padding: "2px 10px" }}>
          Live
        </span>
      </div>

      <div style={{ padding: 20 }}>
        <div
          style={{
            background: C.bgSubtle,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
              《{typedText || "基于深度学习..."}》
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 13,
                  background: C.brand,
                  marginLeft: 2,
                  verticalAlign: "middle",
                  animation: typedText.length < FULL_TEXT.length ? "blink 1s infinite" : "none",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
              硕士论文 · 计算机视觉 · 86 页
            </div>
          </div>
          <span className="badge badge-brand" style={{ fontSize: 11, padding: "3px 10px" }}>
            审阅中
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <div className="chat-ai" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: C.brand, marginBottom: 4, fontWeight: 700 }}>
              🤖 ThesisAI
            </div>
            <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.5 }}>
              已识别【计算机视觉】领域硕士论文。重点查逻辑还是格式？
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["重点查逻辑", "重点查格式", "全部详查"].map((chip, i) => (
                <span
                  key={chip}
                  style={{
                    background: i === 0 ? C.brandBg : C.bgSubtle,
                    border: `1px solid ${i === 0 ? "rgba(0,87,255,0.2)" : C.border}`,
                    color: i === 0 ? C.brand : C.textSecondary,
                    fontSize: 11,
                    fontWeight: i === 0 ? 600 : 400,
                    padding: "3px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div className="chat-user" style={{ padding: "8px 14px", maxWidth: "70%" }}>
              <div style={{ fontSize: 13, color: C.textPrimary }}>重点查逻辑分析 🎯</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: C.bgSubtle,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            智能体协作中
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {agents.map((agent, i) => (
              <div
                key={agent.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: tick % 3 === i ? 1 : 0.55,
                  transition: "opacity 0.4s ease",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: `${agent.color}12`,
                    border: `1px solid ${agent.color}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {agent.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500 }}>{agent.name}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{agent.progress}%</span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: C.bgMuted,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${agent.progress}%`,
                        background:
                          agent.status === "done"
                            ? `linear-gradient(90deg, ${C.success}, #34d399)`
                            : `linear-gradient(90deg, ${agent.color}, ${agent.color}99)`,
                        borderRadius: 2,
                        transition: "width 1.2s ease",
                      }}
                    />
                  </div>
                </div>
                <span className={`status-dot ${agent.status}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
