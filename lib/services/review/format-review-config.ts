import engineBaselineJson from "@/config/format-rule-packs/engine-baseline.json";
import formatGuidelinesZhPayload from "@/config/format-guidelines.default.zh.payload.json";
import { formatEngineBaselineSchema, type FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";

/** 解析一次；通过静态 import 打进包内，Trigger / Vercel 无 repo 根目录 config/ 也能用 */
const engineBaselineParsed = formatEngineBaselineSchema.parse(engineBaselineJson);

function getDefaultFormatGuidelinesZhMarkdown(): string {
  const m = formatGuidelinesZhPayload.markdown;
  if (typeof m !== "string" || !m.trim()) {
    throw new Error("format-guidelines.default.zh.payload.json: missing markdown");
  }
  return m;
}

export function loadEngineBaselineFromDisk(): FormatEngineBaseline {
  return engineBaselineParsed;
}

export function loadDefaultFormatGuidelinesZhFromDisk(): string {
  return getDefaultFormatGuidelinesZhMarkdown();
}
