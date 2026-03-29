import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEduCnEmailDomain } from "./edu-credit-grant.service";

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
