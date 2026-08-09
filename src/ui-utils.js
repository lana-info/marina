export function parseLocalizedDecimal(value) {
  if (typeof value !== "string") return value;
  return value.trim().replace(",", ".");
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
  const separator = locale.startsWith("ru") ? "," : ".";
  return `${negative ? "-" : ""}${integer.toString()}${separator}${fraction}`;
}

export function formatDate(timestamp, locale = "ru-RU") {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(timestamp));
}
