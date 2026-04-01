import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eduCreditGrantService,
  isEduCnEmailDomain,
} from "./edu-credit-grant.service";

describe("isEduCnEmailDomain", () => {
  it("accepts .edu.cn and .ac.cn suffix", () => {
    assert.equal(isEduCnEmailDomain("u@tsinghua.edu.cn"), true);
    assert.equal(isEduCnEmailDomain("x@mail.tsinghua.edu.cn"), true);
    assert.equal(isEduCnEmailDomain("a@pku.ac.cn"), true);
  });

  it("rejects non-edu domains", () => {
    assert.equal(isEduCnEmailDomain("a@gmail.com"), false);
    assert.equal(isEduCnEmailDomain("a@notedu.cn"), false);
    assert.equal(isEduCnEmailDomain("a@mit.edu"), false);
    assert.equal(isEduCnEmailDomain(""), false);
    assert.equal(isEduCnEmailDomain(null), false);
  });
});

describe("getBillingUiEligibility (balance rule)", () => {
  const okBase = {
    hasOpenWindow: true,
    email: "u@tsinghua.edu.cn",
    emailConfirmed: true,
  };

  it("allows claim when balance is below 100", () => {
    assert.equal(
      eduCreditGrantService.getBillingUiEligibility({ ...okBase, balance: 0 })
        .showApply,
      true
    );
    assert.equal(
      eduCreditGrantService.getBillingUiEligibility({ ...okBase, balance: 99 })
        .showApply,
      true
    );
  });

  it("blocks claim when balance is 100 or more", () => {
    const r = eduCreditGrantService.getBillingUiEligibility({
      ...okBase,
      balance: 100,
    });
    assert.equal(r.showApply, false);
    assert.equal(r.reason, "balance_not_zero");
  });

  it("blocks claim when already claimed in open window", () => {
    const r = eduCreditGrantService.getBillingUiEligibility({
      ...okBase,
      balance: 0,
      claimedInOpenWindow: true,
    });
    assert.equal(r.showApply, false);
    assert.equal(r.reason, "already_claimed_this_round");
  });
});
