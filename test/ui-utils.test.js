import test from "node:test";
import assert from "node:assert/strict";
import { formatExact, parseLocalizedDecimal } from "../src/ui-utils.js";

test("accepts comma decimal input without changing the core contract", () => {
  assert.equal(parseLocalizedDecimal(" 2,54 "), "2.54");
});

test("formats exact values with locale separators and half-up display rounding", () => {
  assert.equal(formatExact({ rational: { numerator: "1", denominator: "2" } }, "ru-RU"), "0,5");
  assert.equal(formatExact({ rational: { numerator: "1", denominator: "3" } }, "en-US"), "0.333");
});
