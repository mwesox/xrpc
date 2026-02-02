const SWIFT_KEYWORDS = new Set([
  "associatedtype",
  "class",
  "deinit",
  "enum",
  "extension",
  "fileprivate",
  "func",
  "import",
  "init",
  "inout",
  "internal",
  "let",
  "open",
  "operator",
  "private",
  "protocol",
  "public",
  "static",
  "struct",
  "subscript",
  "typealias",
  "var",
  "break",
  "case",
  "continue",
  "default",
  "defer",
  "do",
  "else",
  "fallthrough",
  "for",
  "guard",
  "if",
  "in",
  "repeat",
  "return",
  "switch",
  "where",
  "while",
  "as",
  "Any",
  "catch",
  "false",
  "is",
  "nil",
  "rethrows",
  "super",
  "self",
  "Self",
  "throw",
  "throws",
  "true",
  "try",
  "_",
]);

export function isSwiftKeyword(name: string): boolean {
  return SWIFT_KEYWORDS.has(name);
}

export function isValidSwiftIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !isSwiftKeyword(name);
}

export function sanitizeSwiftIdentifier(name: string): string {
  let sanitized = name.replace(/[^A-Za-z0-9_]/g, "_");
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  if (isSwiftKeyword(sanitized)) {
    sanitized = `${sanitized}_`;
  }
  if (sanitized.length === 0) {
    sanitized = "value";
  }
  return sanitized;
}

export function toLowerCamelCase(input: string): string {
  const cleaned = input
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();

  if (!cleaned) return "value";

  const parts = cleaned.split(/\s+/);
  const first = parts[0].toLowerCase();
  const rest = parts.slice(1).map((part) =>
    part.length > 0 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : "",
  );
  return [first, ...rest].join("");
}

export function uniqueName(
  base: string,
  used: Set<string>,
  suffixSeparator = "",
): string {
  let name = base;
  let counter = 1;
  while (used.has(name)) {
    name = `${base}${suffixSeparator}${counter}`;
    counter++;
  }
  used.add(name);
  return name;
}
