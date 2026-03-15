"use client";

import { C } from "./constants";

const FEATURES = [
  {
    icon: "🕵️",
    color: C.brand,
    title: "多智能体协作",
    desc: "格式、逻辑、引用三个专用 AI 智能体并行运行，互不干扰，精准高效。每个 Agent 专注单一领域，结果更深入。",
    tags: ["Format Agent", "Logic Agent", "Reference Agent"],
  },
  {
    icon: "💬",
    color: C.teal,
    title: "对话式智能引导",
    desc: "类 Gemini Deep Research 的对话体验。AI 主动提问、理解意图，自动配置最适合你论文类型的批阅策略。",
    tags: ["ChatGPT 风格", "智能参数提取", "Suggested Chips"],
  },
  {
    icon: "📊",
    color: C.accent,
    title: "可视化批阅过程",
    desc: "实时展示 AI「阅读」和「思考」的过程。打字机效果流式输出，进度卡片状态更新，让等待变成享受。",
    tags: ["流式输出", "进度可视化", "Optimistic UI"],
  },
  {
    icon: "📋",
    color: "#8B5CF6",
    title: "深度格式检查",
    desc: "严格比对 GB/T 7714-2015 国家标准。检查章节序号连续性、图表索引一致性、页码对应关系。",
    tags: ["GB/T 标准", "章节序号", "图表索引"],
  },
  {
    icon: "🧠",
    color: "#0EA5E9",
    title: "逻辑链分析",
    desc: "段落级批注与逻辑漏洞分析。检查摘要四要素、结论与绪论的前后呼应，识别论证逻辑断层。",
    tags: ["段落批注", "逻辑漏洞", "前后呼应"],
  },
  {
    icon: "✍️",
    color: C.success,
    title: "英文摘要润色",
    desc: "专项去除 Chinglish，学术词汇智能替换。修改前后对比展示，提升英文摘要学术表达水准。",
    tags: ["去 Chinglish", "学术词汇", "对比展示"],
  },
];

export function Features() {
  return (
    <section id="features" style={{ padding: "96px 32px", background: C.bgSubtle }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge badge-teal" style={{ marginBottom: 18 }}>
            核心功能
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-1.2px",
              color: C.textPrimary,
              marginBottom: 14,
            }}
          >
            不只是检查，更是
            <span className="gradient-text">深度理解</span>
          </h2>
          <p style={{ fontSize: 17, color: C.textSecondary, maxWidth: 460, margin: "0 auto", lineHeight: 1.65 }}>
            六大维度全面审阅，覆盖中文毕业论文从格式到内容的每一个细节
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card-feature"
              style={{ padding: 28, background: C.surface, minWidth: 0 }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${f.color}10`,
                  border: `1px solid ${f.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  marginBottom: 18,
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.textPrimary,
                  letterSpacing: "-0.3px",
                  marginBottom: 10,
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, marginBottom: 18 }}>
                {f.desc}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: `${f.color}0E`,
                      border: `1px solid ${f.color}1A`,
                      color: f.color,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 100,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
