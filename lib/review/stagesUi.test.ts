import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReferenceProgressFromLog, stagesToProgressModels } from "./stagesUi";

describe("parseReferenceProgressFromLog", () => {
  it("parses 已核查 a/b 条 from log", () => {
    assert.deepEqual(parseReferenceProgressFromLog("已核查 3/12 条 · 第 2/4 批处理中"), {
      current: 3,
      total: 12,
    });
    assert.deepEqual(parseReferenceProgressFromLog("已核查 0 / 5 条"), { current: 0, total: 5 });
  });

  it("returns null when missing or invalid", () => {
    assert.equal(parseReferenceProgressFromLog(undefined), null);
    assert.equal(parseReferenceProgressFromLog("verifying"), null);
  });
});

describe("stagesToProgressModels", () => {
  const labels = {
    format: "F",
    logic: "L",
    aitrace: "A",
    reference: "R",
  };

  it("sets refCounts and bar fill when reference log has counts", () => {
    const rows = stagesToProgressModels(
      [
        { agent: "reference", status: "running", log: "已核查 4/10 条 · 第 1/2 批处理中" },
      ],
      labels
    );
    const ref = rows.find((r) => r.key === "reference");
    assert.ok(ref);
    assert.equal(ref!.refCounts?.current, 4);
    assert.equal(ref!.refCounts?.total, 10);
    assert.equal(ref!.barFillPercent, 40);
  });

  it("uses indeterminate bar when running without parseable ref log", () => {
    const rows = stagesToProgressModels(
      [{ agent: "format", status: "running", log: "working" }],
      labels
    );
    const fmt = rows.find((r) => r.key === "format");
    assert.equal(fmt!.barFillPercent, null);
  });
});
