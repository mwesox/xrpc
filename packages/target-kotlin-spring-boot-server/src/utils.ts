import { toPascalCase } from "@xrpckit/sdk";

const KOTLIN_KEYWORDS = new Set([
  "as",
  "break",
  "class",
  "continue",
  "do",
  "else",
  "false",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "package",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "val",
  "var",
  "when",
  "while",
]);

export function sanitizeKotlinIdentifier(name: string): string {
  let sanitized = name.replace(/[^A-Za-z0-9_]/g, "_");
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  if (!sanitized) {
    sanitized = "value";
  }
  if (KOTLIN_KEYWORDS.has(sanitized)) {
    sanitized = `${sanitized}_`;
  }
  return sanitized;
}

export function toKotlinPascalCase(input: string): string {
  return sanitizeKotlinIdentifier(toPascalCase(input));
}

export function toLowerCamelCase(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (!cleaned) return "value";

  const [first, ...rest] = cleaned.split(/\s+/);
  const firstPart = first.charAt(0).toLowerCase() + first.slice(1);
  const tail = rest.map(
    (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
  );

  return sanitizeKotlinIdentifier([firstPart, ...tail].join(""));
}

export function endpointBaseName(fullName: string): string {
  const parts = fullName.split(".");
  return parts.map((part) => toKotlinPascalCase(part)).join("");
}

export function endpointFunctionName(fullName: string): string {
  const parts = fullName.split(".");
  if (parts.length === 0) return "call";

  const [head, ...tail] = parts;
  const first = toLowerCamelCase(head);
  const rest = tail.map((part) => toKotlinPascalCase(part));
  return sanitizeKotlinIdentifier([first, ...rest].join(""));
}

export function escapeKotlinString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let index = 1;
  while (used.has(name)) {
    name = `${base}${index}`;
    index += 1;
  }
  used.add(name);
  return name;
}
