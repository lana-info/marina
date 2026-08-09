export function parseLocalizedDecimal(value) {
  if (typeof value !== "string") return value;
  return value.trim().replace(",", ".");
}

function gcd(a, b) {
  a = a < 0n ? -a : a;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

function normalize(numerator, denominator) {
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function parseExactDecimal(value) {
  const normalized = parseLocalizedDecimal(value);
  if (typeof normalized !== "string" || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(normalized)) return null;
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * denominator + BigInt(fraction || "0");
  return normalize(negative ? -numerator : numerator, denominator);
}

export function convertUnitExact(value, from, to, kind = "length") {
  const parsed = parseExactDecimal(value);
  if (!parsed || from === to) return parsed;
  const cmPerInch = { numerator: 254n, denominator: 100n };
  const multiply = (left, right) => normalize(left.numerator * right.numerator, left.denominator * right.denominator);
  const divide = (left, right) => normalize(left.numerator * right.denominator, left.denominator * right.numerator);
  const convertingToInches = from === "cm" && to === "in";
  if (kind === "density") return convertingToInches ? multiply(parsed, cmPerInch) : divide(parsed, cmPerInch);
  return convertingToInches ? divide(parsed, cmPerInch) : multiply(parsed, cmPerInch);
}

export function convertUnitValue(value, from, to, kind = "length", locale = "ru-RU") {
  const exact = convertUnitExact(value, from, to, kind);
  return exact ? formatExact({ rational: { numerator: exact.numerator.toString(), denominator: exact.denominator.toString() } }, locale, 6) : value;
}

export function formatExact(exact, locale = "ru-RU", digits = 3) {
  const numerator = BigInt(exact.rational.numerator);
  const denominator = BigInt(exact.rational.denominator);
  if (denominator === 1n) return numerator.toString();
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const integer = absolute / denominator;
  const remainder = absolute % denominator;
  const scale = 10n ** BigInt(digits);
  const rounded = (remainder * scale * 2n + denominator) / (denominator * 2n);
  if (rounded === scale) return `${negative ? "-" : ""}${(integer + 1n).toString()}`;
  const fraction = rounded.toString().padStart(digits, "0").replace(/0+$/, "");
  if (!fraction) return `${negative ? "-" : ""}${integer.toString()}`;
  const separator = locale.startsWith("ru") ? "," : ".";
  return `${negative ? "-" : ""}${integer.toString()}${separator}${fraction}`;
}

export function formatDate(timestamp, locale = "ru-RU") {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(timestamp));
}
