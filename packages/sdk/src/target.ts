import {
  type TypeKind,
  type ValidationKind,
  isTypeKind,
  isValidationKind,
} from "./framework/types";
import type {
  ContractDefinition,
  TypeReference,
  ValidationRules,
} from "./parser";

export type Diagnostic = {
  severity: "error" | "warning";
  message: string;
  path?: string;
  hint?: string;
};

export type GeneratedFile = {
  path: string;
  content: string;
};

export type TargetInput = {
  contract: ContractDefinition;
  outputDir: string;
  options?: Record<string, unknown>;
};

export type TargetOutput = {
  files: GeneratedFile[];
  diagnostics?: Diagnostic[];
};

export interface Target {
  name: string;
  generate: (input: TargetInput) => TargetOutput;
}

export type TargetSupport = {
  supportedTypes: TypeKind[];
  supportedValidations: ValidationKind[];
  unsupportedTypes?: {
    kind: TypeKind;
    reason: string;
    fallback?: string;
  }[];
  unsupportedValidations?: {
    kind: ValidationKind;
    reason: string;
  }[];
  notes?: string[];
};

type UsageMap<K extends string> = Map<K, string[]>;

export type ContractUsage = {
  types: UsageMap<TypeKind>;
  validations: UsageMap<ValidationKind>;
};

function addUsage<K extends string>(
  map: UsageMap<K>,
  kind: K,
  path: string,
): void {
  const existing = map.get(kind);
  if (!existing) {
    map.set(kind, [path]);
    return;
  }
  if (existing.length < 3 && !existing.includes(path)) {
    existing.push(path);
  }
}

function collectValidations(
  rules: ValidationRules | undefined,
  path: string,
  validations: UsageMap<ValidationKind>,
): void {
  if (!rules) return;
  for (const key of Object.keys(rules)) {
    if (isValidationKind(key)) {
      const value = rules[key as keyof ValidationRules];
      if (value !== undefined) {
        addUsage(validations, key, path);
      }
    }
  }
}

function collectTypeRefUsage(
  typeRef: TypeReference | undefined,
  path: string,
  types: UsageMap<TypeKind>,
  validations: UsageMap<ValidationKind>,
): void {
  if (!typeRef) return;

  if (isTypeKind(typeRef.kind)) {
    addUsage(types, typeRef.kind, path);
  }

  collectValidations(typeRef.validation, path, validations);

  if (typeRef.properties) {
    for (const prop of typeRef.properties) {
      const propPath = `${path}.${prop.name}`;
      collectTypeRefUsage(prop.type, propPath, types, validations);
      collectValidations(prop.validation, propPath, validations);
    }
  }

  if (typeRef.elementType) {
    collectTypeRefUsage(typeRef.elementType, `${path}[]`, types, validations);
  }

  if (typeRef.baseType && typeof typeRef.baseType === "object") {
    collectTypeRefUsage(typeRef.baseType, path, types, validations);
  }

  if (typeRef.unionTypes) {
    for (let i = 0; i < typeRef.unionTypes.length; i++) {
      collectTypeRefUsage(
        typeRef.unionTypes[i],
        `${path}[${i}]`,
        types,
        validations,
      );
    }
  }

  if (typeRef.tupleElements) {
    for (let i = 0; i < typeRef.tupleElements.length; i++) {
      collectTypeRefUsage(
        typeRef.tupleElements[i],
        `${path}[${i}]`,
        types,
        validations,
      );
    }
  }

  if (typeRef.valueType) {
    collectTypeRefUsage(typeRef.valueType, `${path}.value`, types, validations);
  }

  if (typeRef.keyType) {
    collectTypeRefUsage(typeRef.keyType, `${path}.key`, types, validations);
  }
}

export function collectContractUsage(
  contract: ContractDefinition,
): ContractUsage {
  const types: UsageMap<TypeKind> = new Map();
  const validations: UsageMap<ValidationKind> = new Map();

  for (const type of contract.types) {
    const path = type.name ? `types.${type.name}` : "types.unknown";
    collectTypeRefUsage(type, path, types, validations);
  }

  for (const endpoint of contract.endpoints) {
    collectTypeRefUsage(
      endpoint.input,
      `${endpoint.fullName}.input`,
      types,
      validations,
    );
    collectTypeRefUsage(
      endpoint.output,
      `${endpoint.fullName}.output`,
      types,
      validations,
    );
  }

  return { types, validations };
}

export function validateSupport(
  contract: ContractDefinition,
  support: TargetSupport,
  targetName?: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const usage = collectContractUsage(contract);

  const supportedTypes = new Set(support.supportedTypes);
  for (const [kind, paths] of usage.types) {
    if (!supportedTypes.has(kind)) {
      const partial = support.unsupportedTypes?.find(
        (item) => item.kind === kind,
      );
      if (partial) {
        diagnostics.push({
          severity: "warning",
          message: `Type "${kind}" has limited support${targetName ? ` in ${targetName}` : ""}: ${partial.reason}`,
          path: paths[0],
          hint: partial.fallback
            ? `Will fall back to: ${partial.fallback}`
            : undefined,
        });
      } else {
        diagnostics.push({
          severity: "error",
          message: `Type "${kind}" is not supported${targetName ? ` by ${targetName}` : ""}`,
          path: paths[0],
        });
      }
    }
  }

  const supportedValidations = new Set(support.supportedValidations);
  for (const [kind, paths] of usage.validations) {
    if (!supportedValidations.has(kind)) {
      const partial = support.unsupportedValidations?.find(
        (item) => item.kind === kind,
      );
      if (partial) {
        diagnostics.push({
          severity: "warning",
          message: `Validation "${kind}" has limited support${targetName ? ` in ${targetName}` : ""}: ${partial.reason}`,
          path: paths[0],
        });
      } else {
        diagnostics.push({
          severity: "error",
          message: `Validation "${kind}" is not supported${targetName ? ` by ${targetName}` : ""}`,
          path: paths[0],
        });
      }
    }
  }

  return diagnostics;
}
