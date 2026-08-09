export const CONTRACT_VERSION = "1.0.0";

const DECIMAL = /^(?:0|0\.[0-9]+|[1-9][0-9]*(?:\.[0-9]+)?|-0\.[0-9]*[1-9][0-9]*|-[1-9][0-9]*(?:\.[0-9]+)?)$/;
const INTEGER = /^(?:0|-?[1-9][0-9]*)$/;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9][0-9]*)$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const ROUNDINGS = new Set(["down", "up", "nearest"]);
const UNITS = new Set(["cm", "in"]);

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

function rational(numerator, denominator = 1n) {
  if (denominator < 0n) [numerator, denominator] = [-numerator, -denominator];
  const divisor = gcd(numerator, denominator);
  return { n: numerator / divisor, d: denominator / divisor };
}

function add(a, b) { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
function subtract(a, b) { return rational(a.n * b.d - b.n * a.d, a.d * b.d); }
function multiply(a, b) { return rational(a.n * b.n, a.d * b.d); }
function divide(a, b) { return rational(a.n * b.d, a.d * b.n); }
function compare(a, b) { return (a.n * b.d > b.n * a.d) - (a.n * b.d < b.n * a.d); }

function exact(value) {
  return { rational: { numerator: value.n.toString(), denominator: value.d.toString() } };
}

function parseDecimal(value) {
  if (typeof value !== "string" || !DECIMAL.test(value)) return null;
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * denominator + BigInt(fraction || "0");
  return rational(negative ? -numerator : numerator, denominator);
}

function parseInteger(value, kind = "integer") {
  const pattern = kind === "positive" ? POSITIVE_INTEGER : kind === "nonNegative" ? NON_NEGATIVE_INTEGER : INTEGER;
  return typeof value === "string" && pattern.test(value) ? BigInt(value) : null;
}

function parseDensity(value) {
  const decimal = parseDecimal(value);
  if (decimal) return decimal;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const numerator = parseInteger(value.numerator);
  const denominator = parseInteger(value.denominator, "positive");
  return numerator === null || denominator === null ? null : rational(numerator, denominator);
}

function failure(kind, errors) {
  return { ok: false, contractVersion: CONTRACT_VERSION, kind, errors };
}

function success(kind, fields) {
  return { ok: true, contractVersion: CONTRACT_VERSION, kind, ...fields };
}

function error(code, field) { return { code, field }; }

function roundRational(value, rounding) {
  const quotient = value.n / value.d;
  const remainder = value.n % value.d;
  if (rounding === "down") return quotient;
  if (rounding === "up") return remainder === 0n ? quotient : quotient + 1n;
  return remainder * 2n < value.d ? quotient : quotient + (remainder === 0n ? 0n : 1n);
}

function constrain(value, multiple, offset, rounding) {
  const offsetValue = rational(offset);
  if (compare(value, offsetValue) < 0) return offset;
  const quotient = divide(subtract(value, offsetValue), rational(multiple));
  return offset + roundRational(quotient, rounding) * multiple;
}

function parseRule(rule, field, errors, withEdges = false) {
  const input = rule && typeof rule === "object" && !Array.isArray(rule) ? rule : {};
  const rounding = input.rounding;
  const multiple = input.multiple === undefined ? 1n : parseInteger(input.multiple, "positive");
  const offset = input.offset === undefined ? 0n : parseInteger(input.offset, "nonNegative");
  if (!ROUNDINGS.has(rounding)) errors.push(error("invalid_rounding", `${field}.rounding`));
  if (input.multiple !== undefined && multiple === null) errors.push(error("invalid_integer", `${field}.multiple`));
  if (input.multiple !== undefined && multiple !== null && multiple <= 0n) errors.push(error("non_positive_multiple", `${field}.multiple`));
  if (input.offset !== undefined && offset === null) errors.push(error("invalid_integer", `${field}.offset`));
  if (multiple !== null && offset !== null && offset >= multiple) errors.push(error("invalid_offset", `${field}.offset`));
  let edgeStitches = 0n;
  if (withEdges) {
    edgeStitches = input.edgeStitches === undefined ? 0n : parseInteger(input.edgeStitches, "nonNegative");
    if (input.edgeStitches !== undefined && edgeStitches === null) errors.push(error("invalid_integer", `${field}.edgeStitches`));
  }
  return { rounding, multiple, offset, edgeStitches, input };
}

function sortErrors(errors, order) {
  return errors.sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));
}

export function calculateGauge(input) {
  const errors = [];
  const stitches = parseInteger(input?.stitches);
  const rows = parseInteger(input?.rows);
  const width = parseDecimal(input?.width);
  const height = parseDecimal(input?.height);
  const unit = input?.unit;
  if (stitches === null) errors.push(error("invalid_integer", "stitches"));
  else if (stitches <= 0n) errors.push(error("non_positive_count", "stitches"));
  if (rows === null) errors.push(error("invalid_integer", "rows"));
  else if (rows <= 0n) errors.push(error("non_positive_count", "rows"));
  if (width === null) errors.push(error("invalid_number", "width"));
  else if (width.n <= 0n) errors.push(error("non_positive_measurement", "width"));
  if (height === null) errors.push(error("invalid_number", "height"));
  else if (height.n <= 0n) errors.push(error("non_positive_measurement", "height"));
  if (!UNITS.has(unit)) errors.push(error("invalid_unit", "unit"));
  if (errors.length) return failure("gauge", sortErrors(errors, ["stitches", "rows", "width", "height", "unit"]));
  return success("gauge", { unit, stitchDensity: exact(divide(rational(stitches), width)), rowDensity: exact(divide(rational(rows), height)) });
}

export function calculateCounts(input) {
  const errors = [];
  const stitchDensity = parseDensity(input?.stitchDensity);
  const rowDensity = parseDensity(input?.rowDensity);
  const targetWidth = parseDecimal(input?.targetWidth);
  const targetHeight = parseDecimal(input?.targetHeight);
  const unit = input?.unit;
  const construction = input?.construction;
  if (stitchDensity === null) errors.push(error(typeof input?.stitchDensity === "object" ? "invalid_rational" : "invalid_number", "stitchDensity"));
  else if (stitchDensity.n <= 0n) errors.push(error("non_positive_density", "stitchDensity"));
  if (rowDensity === null) errors.push(error(typeof input?.rowDensity === "object" ? "invalid_rational" : "invalid_number", "rowDensity"));
  else if (rowDensity.n <= 0n) errors.push(error("non_positive_density", "rowDensity"));
  if (targetWidth === null) errors.push(error("invalid_number", "targetWidth"));
  else if (targetWidth.n <= 0n) errors.push(error("non_positive_measurement", "targetWidth"));
  if (targetHeight === null) errors.push(error("invalid_number", "targetHeight"));
  else if (targetHeight.n <= 0n) errors.push(error("non_positive_measurement", "targetHeight"));
  if (!UNITS.has(unit)) errors.push(error("invalid_unit", "unit"));
  if (construction !== "flat" && construction !== "round") errors.push(error("invalid_construction", "construction"));
  const stitchRule = parseRule(input?.stitchRule, "stitchRule", errors, true);
  const rowRule = parseRule(input?.rowRule, "rowRule", errors);
  if (construction === "round" && stitchRule.edgeStitches !== null && stitchRule.edgeStitches !== 0n) errors.push(error("edge_stitches_in_round", "stitchRule.edgeStitches"));
  const validInputs = stitchDensity?.n > 0n && rowDensity?.n > 0n && targetWidth?.n > 0n && targetHeight?.n > 0n && UNITS.has(unit) && (construction === "flat" || construction === "round") && stitchRule.multiple !== null && stitchRule.offset !== null && rowRule.multiple !== null && rowRule.offset !== null && ROUNDINGS.has(stitchRule.rounding) && ROUNDINGS.has(rowRule.rounding) && stitchRule.edgeStitches !== null;
  if (validInputs) {
    const rawStitches = multiply(stitchDensity, targetWidth);
    const rawRows = multiply(rowDensity, targetHeight);
    const rawBody = subtract(rawStitches, rational(stitchRule.edgeStitches));
    if (rawBody.n < 0n && !(construction === "round" && stitchRule.edgeStitches !== 0n)) errors.push(error("negative_raw_body", "stitchRule.edgeStitches"));
    else {
      const finalBody = constrain(rawBody, stitchRule.multiple, stitchRule.offset, stitchRule.rounding);
      const finalStitches = stitchRule.edgeStitches + finalBody;
      const finalRows = constrain(rawRows, rowRule.multiple, rowRule.offset, rowRule.rounding);
      if (finalStitches === 0n) errors.push(error("zero_result_count", "stitches.final"));
      if (finalRows === 0n) errors.push(error("zero_result_count", "rows.final"));
      if (!errors.length) return success("counts", { unit, construction, stitches: axisResult(rawStitches, finalStitches, stitchRule, targetWidth, stitchDensity, true), rows: axisResult(rawRows, finalRows, rowRule, targetHeight, rowDensity, false) });
    }
  }
  return failure("counts", sortErrors(errors, ["stitchDensity", "rowDensity", "targetWidth", "targetHeight", "unit", "construction", "stitchRule.rounding", "stitchRule.multiple", "stitchRule.offset", "stitchRule.edgeStitches", "rowRule.rounding", "rowRule.multiple", "rowRule.offset", "stitches.final", "rows.final"]));
}

function axisResult(raw, final, rule, target, density, withEdges) {
  const result = { raw: exact(raw), unconstrainedRounded: roundRational(raw, rule.rounding).toString(), final: final.toString(), actual: exact(divide(rational(final), density)), delta: exact(subtract(divide(rational(final), density), target)), rule: { rounding: rule.rounding, multiple: rule.multiple.toString(), offset: rule.offset.toString() } };
  if (withEdges) result.edgeStitches = rule.edgeStitches.toString();
  return result;
}
