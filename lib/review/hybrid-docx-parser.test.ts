import assert from "node:assert";
import { test } from "node:test";
import { stripMammothMarkdownEscapes } from "./hybrid-docx-parser";

test("stripMammothMarkdownEscapes removes backslash before period (list escape)", () => {
  assert.strictEqual(stripMammothMarkdownEscapes("End of sentence\\. Next"), "End of sentence. Next");
});

test("stripMammothMarkdownEscapes handles multiple common mammoth escapes", () => {
  assert.strictEqual(
    stripMammothMarkdownEscapes("\\*emphasis\\_ and \\(parens\\)"),
    "*emphasis_ and (parens)"
  );
});

test("stripMammothMarkdownEscapes unescapes brackets", () => {
  assert.strictEqual(stripMammothMarkdownEscapes("\\[1\\]"), "[1]");
});

test("stripMammothMarkdownEscapes leaves unrelated backslashes", () => {
  assert.strictEqual(stripMammothMarkdownEscapes("path\\to\\file"), "path\\to\\file");
});
