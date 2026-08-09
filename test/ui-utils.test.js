import test from "node:test";
import assert from "node:assert/strict";
import { convertUnitExact, convertUnitValue, formatExact, parseLocalizedDecimal } from "../src/ui-utils.js";

test("accepts comma decimal input without changing the core contract", () => {
  assert.equal(parseLocalizedDecimal(" 2,54 "), "2.54");
});

test("formats exact values with locale separators and half-up display rounding", () => {
  assert.equal(formatExact({ rational: { numerator: "1", denominator: "2" } }, "ru-RU"), "0,5");
  assert.equal(formatExact({ rational: { numerator: "1", denominator: "3" } }, "en-US"), "0.333");
});

test("converts lengths exactly and keeps 10 cm distinct from 4 inches", () => {
  assert.deepEqual(convertUnitExact("10", "cm", "in"), { numerator: 500n, denominator: 127n });
  assert.equal(convertUnitValue("10", "cm", "in", "length", "en-US"), "3.937008");
  assert.equal(convertUnitValue("3.937008", "in", "cm", "length", "en-US"), "10");
});

test("converts density in the inverse direction", () => {
  assert.equal(convertUnitValue("2", "cm", "in", "density", "en-US"), "5.08");
  assert.equal(convertUnitValue("5.08", "in", "cm", "density", "en-US"), "2");
});
