import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatEngineBaselineSchema, type FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";

const BASELINE_REL = join("config", "format-rule-packs", "engine-baseline.json");
const DEFAULT_NL_REL = join("config", "format-guidelines.default.zh.md");

export function loadEngineBaselineFromDisk(): FormatEngineBaseline {
  const raw = readFileSync(join(process.cwd(), BASELINE_REL), "utf8");
  return formatEngineBaselineSchema.parse(JSON.parse(raw));
}

export function loadDefaultFormatGuidelinesZhFromDisk(): string {
  return readFileSync(join(process.cwd(), DEFAULT_NL_REL), "utf8");
}
