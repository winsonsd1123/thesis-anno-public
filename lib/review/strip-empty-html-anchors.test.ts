import assert from "node:assert";
import { test } from "node:test";
import { stripEmptyHtmlAnchors } from "./strip-empty-html-anchors";

test("removes Word TOC empty anchors from location line", () => {
  assert.strictEqual(
    stripEmptyHtmlAnchors(
      '致谢 · <a id="_Toc123644539"></a><a id="_Toc124174063"></a><a id="_Toc123644578"></a>致谢 - 第 2 段'
    ),
    "致谢 · 致谢 - 第 2 段"
  );
});

test("keeps anchor tags that contain link text", () => {
  assert.strictEqual(
    stripEmptyHtmlAnchors('<a href="https://example.com">Example</a> 正文'),
    '<a href="https://example.com">Example</a> 正文'
  );
});
