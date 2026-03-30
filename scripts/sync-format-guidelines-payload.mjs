import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "config", "format-guidelines.default.zh.md");
const outPath = join(root, "config", "format-guidelines.default.zh.payload.json");
const markdown = readFileSync(mdPath, "utf8");
writeFileSync(outPath, `${JSON.stringify({ markdown })}\n`, "utf8");
console.log("wrote", outPath, `(${markdown.length} chars)`);
