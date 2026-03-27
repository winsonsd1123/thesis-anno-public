/**
 * 本地端到端：对指定 docx 跑完整 format 审查（语义 Map-Reduce + 物理轨）。
 *
 * 用法:
 *   pnpm exec tsx scripts/smoke-format-analyze-docx.ts /path/to/paper.docx
 *
 * 依赖: .env.local 中 OPENROUTER_API_KEY（与线上一致）
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { parseHybridDocx } from "../lib/review/hybrid-docx-parser";
import { analyzeFormat, type ReviewAnalyzeContext } from "../lib/services/review/format.service";
import { promptsSchema } from "../lib/schemas/config.schemas";
import {
  loadDefaultFormatGuidelinesZhFromDisk,
  loadEngineBaselineFromDisk,
} from "../lib/services/review/format-review-config";
import {
  extractGlobalSkeleton,
  splitMarkdownByChapters,
} from "../lib/review/format-markdown-chunks";

config({ path: ".env.local" });

const filePath = process.argv[2];
if (!filePath) {
  console.error("用法: pnpm exec tsx scripts/smoke-format-analyze-docx.ts <文件.docx>");
  process.exit(1);
}

async function main() {
  const buf = readFileSync(filePath);
  const hybrid = await parseHybridDocx(buf);

  const promptsRaw = JSON.parse(
    readFileSync(join(process.cwd(), "config", "prompts.default.json"), "utf8")
  );
  const promptsConfig = promptsSchema.parse(promptsRaw);

  const fmtGlobal = promptsConfig.format_semantic_global_system;
  const fmtLocal = promptsConfig.format_semantic_local_system;
  const fmtExtract = promptsConfig.format_physical_spec_extract;
  if (!fmtGlobal?.templates?.zh || !fmtLocal?.templates?.zh || !fmtExtract?.templates?.zh) {
    throw new Error("prompts.default.json 缺少 format_semantic_* 或 format_physical_spec_extract");
  }

  const semanticGlobalMc = fmtGlobal.model_config ?? {
    temperature: 0.25,
    model: "google/gemini-3.1-pro-preview",
  };
  const semanticLocalMc = fmtLocal.model_config ?? {
    temperature: 0.25,
    model: "google/gemini-3.1-flash-lite-preview",
  };
  const extractMc = fmtExtract.model_config ?? {
    temperature: 0.1,
    model: "google/gemini-3.1-flash-lite-preview",
  };

  const formatGuidelines = loadDefaultFormatGuidelinesZhFromDisk();
  const ctx: ReviewAnalyzeContext = {
    domain: null,
    formatReview: {
      formatGuidelines,
      semantic: {
        globalModelConfig: {
          model: semanticGlobalMc.model,
          temperature: semanticGlobalMc.temperature,
        },
        localModelConfig: {
          model: semanticLocalMc.model,
          temperature: semanticLocalMc.temperature,
        },
        globalPromptTemplate: fmtGlobal.templates.zh,
        localPromptTemplate: fmtLocal.templates.zh,
      },
      extract: {
        modelConfig: { model: extractMc.model, temperature: extractMc.temperature },
        promptTemplate: fmtExtract.templates.zh,
      },
      engineBaseline: loadEngineBaselineFromDisk(),
    },
  };

  const skeleton = extractGlobalSkeleton(hybrid.markdown);
  const chunks = splitMarkdownByChapters(hybrid.markdown);
  console.log("\n=== 诊断：Map-Reduce 输入规模 ===");
  console.log("markdown.length", hybrid.markdown.length);
  console.log("globalSkeleton.length", skeleton.length);
  console.log("localChunks.count", chunks.length);
  for (let i = 0; i < Math.min(chunks.length, 8); i++) {
    console.log(`  chunk[${i}] len=${chunks[i]!.length}`);
  }
  if (chunks.length > 8) console.log(`  … 另有 ${chunks.length - 8} 个 chunk`);

  console.log("\n=== 调用 analyzeFormat（将请求 OpenRouter）===");
  const t0 = Date.now();
  const result = await analyzeFormat(hybrid.markdown, hybrid.styleAst, "text", ctx);
  const wallMs = Date.now() - t0;

  console.log("\n=== 结果 ===");
  console.log("wall_clock_ms", wallMs);
  console.log("observability", JSON.stringify(result.observability, null, 2));
  console.log("issues.total", result.issues.length);
  for (const it of result.issues.slice(0, 30)) {
    console.log(
      `- [${it.issue_type}] ${it.severity} | ${it.chapter} | ${it.quote_text.slice(0, 40)}${it.quote_text.length > 40 ? "…" : ""}`
    );
  }
  if (result.issues.length > 30) {
    console.log(`… 另有 ${result.issues.length - 30} 条`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
