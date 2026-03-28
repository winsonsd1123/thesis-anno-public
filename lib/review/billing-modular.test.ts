import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sumModuleCostsForPlan } from "@/lib/config/billing";

describe("sumModuleCostsForPlan", () => {
  const mockCosts = {
    logic: 120,
    format: 120,
    aitrace: 30,
    reference: 30,
  };

  it("calculates total cost correctly when all modules are enabled", () => {
    const planOptions = {
      logic: true,
      format: true,
      aitrace: true,
      reference: true,
    };
    const total = sumModuleCostsForPlan(mockCosts, planOptions);
    assert.equal(total, 300);
  });

  it("calculates total cost correctly when only some modules are enabled", () => {
    const planOptions = {
      logic: true,
      format: false,
      aitrace: true,
      reference: false,
    };
    const total = sumModuleCostsForPlan(mockCosts, planOptions);
    assert.equal(total, 150); // 120 + 30
  });

  it("calculates total cost as 0 when no modules are enabled", () => {
    const planOptions = {
      logic: false,
      format: false,
      aitrace: false,
      reference: false,
    };
    const total = sumModuleCostsForPlan(mockCosts, planOptions);
    assert.equal(total, 0);
  });
});
