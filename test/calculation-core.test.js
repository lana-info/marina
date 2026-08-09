import test from "node:test";
import assert from "node:assert/strict";
import { calculateCounts, calculateGauge } from "../src/calculation-core.js";

test("calculates exact gauge without float conversion", () => {
  assert.deepEqual(calculateGauge({ stitches: "20", rows: "28", width: "10", height: "10", unit: "cm" }), {
    ok: true, contractVersion: "1.0.0", kind: "gauge", unit: "cm",
    stitchDensity: { rational: { numerator: "2", denominator: "1" } },
    rowDensity: { rational: { numerator: "14", denominator: "5" } }
  });
});

test("rounds .5 upward and reports actual size and delta", () => {
  const result = calculateCounts({ stitchDensity: "2.5", rowDensity: "1", targetWidth: "1", targetHeight: "1", unit: "cm", construction: "flat", stitchRule: { rounding: "nearest" }, rowRule: { rounding: "nearest" } });
  assert.deepEqual(result.stitches.raw, { rational: { numerator: "5", denominator: "2" } });
  assert.equal(result.stitches.unconstrainedRounded, "3");
  assert.equal(result.stitches.final, "3");
  assert.deepEqual(result.stitches.actual, { rational: { numerator: "6", denominator: "5" } });
  assert.deepEqual(result.stitches.delta, { rational: { numerator: "1", denominator: "5" } });
});

test("keeps edges outside the flat knitting repeat", () => {
  const result = calculateCounts({ stitchDensity: "1", rowDensity: "1", targetWidth: "53", targetHeight: "1", unit: "cm", construction: "flat", stitchRule: { rounding: "nearest", multiple: "4", offset: "1", edgeStitches: "2" }, rowRule: { rounding: "down" } });
  assert.equal(result.stitches.final, "55");
  assert.equal(result.stitches.edgeStitches, "2");
});

test("returns stable validation errors and rejects edges in round knitting", () => {
  const result = calculateCounts({ stitchDensity: "2", rowDensity: "2", targetWidth: "1", targetHeight: "1", unit: "cm", construction: "round", stitchRule: { rounding: "nearest", edgeStitches: "1" }, rowRule: { rounding: "nearest" } });
  assert.deepEqual(result.errors, [{ code: "edge_stitches_in_round", field: "stitchRule.edgeStitches" }]);
});

test("offset below raw value uses the first allowed count", () => {
  const result = calculateCounts({ stitchDensity: "1", rowDensity: "2.9", targetWidth: "4", targetHeight: "1", unit: "cm", construction: "round", stitchRule: { rounding: "down", multiple: "4", offset: "0" }, rowRule: { rounding: "nearest", multiple: "4", offset: "3" } });
  assert.equal(result.rows.final, "3");
});
