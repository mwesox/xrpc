import { type GeneratedUtility, toPascalCase } from "@xrpckit/sdk";

/**
 * Create a TypeScript enum pattern using const object + type union.
 *
 * @param name - The enum type name
 * @param values - The enum values
 * @returns Generated utility with enum code
 *
 * @example
 * ```typescript
 * const utility = createTsEnumPattern("Status", ["active", "inactive", "pending"]);
 * // Generates:
 * // export const Status = {
 * //   Active: "active",
 * //   Inactive: "inactive",
 * //   Pending: "pending",
 * // } as const;
 * // export type Status = (typeof Status)[keyof typeof Status];
 * ```
 */
export function createTsEnumPattern(
  name: string,
  values: (string | number)[]
): GeneratedUtility {
  const stringValues = values.filter((v): v is string => typeof v === "string");
  const numberValues = values.filter((v): v is number => typeof v === "number");

  let code: string;

  if (stringValues.length > 0 && numberValues.length === 0) {
    // String enum - use const object pattern
    const entries = stringValues.map((v) => {
      const key = toPascalCase(v);
      return `  ${key}: "${v}"`;
    });

    code = `export const ${name} = {
${entries.join(",\n")},
} as const;

export type ${name} = (typeof ${name})[keyof typeof ${name}];

export function is${name}(value: unknown): value is ${name} {
  return Object.values(${name}).includes(value as ${name});
}`;
  } else if (numberValues.length > 0 && stringValues.length === 0) {
    // Numeric enum - use TypeScript enum
    const entries = numberValues.map((v, i) => `  Value${i} = ${v}`);

    code = `export enum ${name} {
${entries.join(",\n")},
}

export function is${name}(value: unknown): value is ${name} {
  return typeof value === "number" && Object.values(${name}).includes(value);
}`;
  } else {
    // Mixed enum - use union type
    const allValues = values.map((v) =>
      typeof v === "string" ? `"${v}"` : String(v)
    );

    code = `export type ${name} = ${allValues.join(" | ")};

export const ${name}Values: readonly ${name}[] = [${allValues.join(", ")}] as const;

export function is${name}(value: unknown): value is ${name} {
  return ${name}Values.includes(value as ${name});
}`;
  }

  return {
    id: `enum_${name}`,
    code,
    includeOnce: true,
    priority: 100,
  };
}

/**
 * Create a TypeScript discriminated union pattern.
 *
 * @param name - The union type name
 * @param variants - The variant types with discriminator
 * @returns Generated utility with union code
 *
 * @example
 * ```typescript
 * const utility = createTsUnionPattern("Result", [
 *   { type: "success", valueType: "Data" },
 *   { type: "error", valueType: "Error" },
 * ]);
 * // Generates discriminated union with type guards
 * ```
 */
export function createTsUnionPattern(
  name: string,
  variants: Array<{ type: string; valueType: string }>
): GeneratedUtility {
  const unionTypes = variants.map((v) => `${name}${toPascalCase(v.type)}`);
  const typeGuards = variants.map((v) => {
    const variantName = `${name}${toPascalCase(v.type)}`;
    return `export function is${variantName}(value: ${name}): value is ${variantName} {
  return value.type === "${v.type}";
}`;
  });

  const interfaces = variants.map((v) => {
    const variantName = `${name}${toPascalCase(v.type)}`;
    return `export interface ${variantName} {
  type: "${v.type}";
  value: ${v.valueType};
}`;
  });

  const code = `${interfaces.join("\n\n")}

export type ${name} = ${unionTypes.join(" | ")};

${typeGuards.join("\n\n")}`;

  return {
    id: `union_${name}`,
    code,
    includeOnce: true,
    priority: 80,
  };
}

/**
 * Create a TypeScript tuple type with helpers.
 *
 * @param name - The tuple type name
 * @param elements - The element types
 * @returns Generated utility with tuple code
 */
export function createTsTuplePattern(
  name: string,
  elements: string[]
): GeneratedUtility {
  const tupleType = `[${elements.join(", ")}]`;

  const code = `export type ${name} = ${tupleType};

export function create${name}(${elements.map((e, i) => `v${i}: ${e}`).join(", ")}): ${name} {
  return [${elements.map((_, i) => `v${i}`).join(", ")}];
}

export function is${name}(value: unknown): value is ${name} {
  return Array.isArray(value) && value.length === ${elements.length};
}`;

  return {
    id: `tuple_${name}`,
    code,
    includeOnce: true,
    priority: 70,
  };
}

/**
 * Create a TypeScript branded type pattern for type-safe primitives.
 *
 * @param name - The branded type name
 * @param baseType - The underlying primitive type
 * @param validator - Optional validation function body
 * @returns Generated utility with branded type code
 *
 * @example
 * ```typescript
 * const utility = createTsBrandedType("Email", "string", 'value.includes("@")');
 * // Generates branded type with validation
 * ```
 */
export function createTsBrandedType(
  name: string,
  baseType: string,
  validator?: string
): GeneratedUtility {
  const brandSymbol = `__${name.toLowerCase()}Brand`;

  let code = `declare const ${brandSymbol}: unique symbol;
export type ${name} = ${baseType} & { readonly [${brandSymbol}]: typeof ${brandSymbol} };
`;

  if (validator) {
    code += `
export function is${name}(value: ${baseType}): value is ${name} {
  return ${validator};
}

export function create${name}(value: ${baseType}): ${name} {
  if (!is${name}(value)) {
    throw new Error(\`Invalid ${name}: \${value}\`);
  }
  return value;
}`;
  } else {
    code += `
export function create${name}(value: ${baseType}): ${name} {
  return value as ${name};
}`;
  }

  return {
    id: `branded_${name}`,
    code,
    includeOnce: true,
    priority: 90,
  };
}

/**
 * Create a TypeScript record utility for dynamic key-value maps.
 *
 * @param name - The record type name
 * @param keyType - The key type (usually "string")
 * @param valueType - The value type
 * @returns Generated utility with record helpers
 */
export function createTsRecordPattern(
  name: string,
  keyType: string,
  valueType: string
): GeneratedUtility {
  const code = `export type ${name} = Record<${keyType}, ${valueType}>;

export function create${name}(entries: Array<[${keyType}, ${valueType}]>): ${name} {
  return Object.fromEntries(entries) as ${name};
}

export function is${name}(value: unknown): value is ${name} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}`;

  return {
    id: `record_${name}`,
    code,
    includeOnce: true,
    priority: 60,
  };
}

