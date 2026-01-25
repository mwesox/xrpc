import type { TypeReference, ValidationRules } from "../parser/contract";

/**
 * All type kinds supported by xRPC contracts.
 * Target generators must handle all of these to be considered complete.
 */
export const TYPE_KINDS = [
  "object",
  "array",
  "primitive",
  "optional",
  "nullable",
  "union",
  "enum",
  "literal",
  "record",
  "tuple",
  "date",
] as const;

/**
 * A type kind that can appear in xRPC contracts.
 */
export type TypeKind = (typeof TYPE_KINDS)[number];

/**
 * All validation rules supported by xRPC contracts.
 * Target generators must handle all of these to be considered complete.
 */
export const VALIDATION_KINDS = [
  // String validations (6)
  "minLength",
  "maxLength",
  "email",
  "url",
  "uuid",
  "regex",
  // Number validations (5)
  "min",
  "max",
  "int",
  "positive",
  "negative",
  // Array validations (2)
  "minItems",
  "maxItems",
] as const;

/**
 * A validation kind that can appear in xRPC contracts.
 */
export type ValidationKind = (typeof VALIDATION_KINDS)[number];

/**
 * Validation kinds that apply to string types.
 */
export const STRING_VALIDATIONS: ValidationKind[] = [
  "minLength",
  "maxLength",
  "email",
  "url",
  "uuid",
  "regex",
];

/**
 * Validation kinds that apply to number types.
 */
export const NUMBER_VALIDATIONS: ValidationKind[] = [
  "min",
  "max",
  "int",
  "positive",
  "negative",
];

/**
 * Validation kinds that apply to array types.
 */
export const ARRAY_VALIDATIONS: ValidationKind[] = ["minItems", "maxItems"];

/**
 * Context provided when mapping a type.
 */
export interface TypeContext {
  /** The type reference being mapped */
  typeRef: TypeReference;
  /** The name of the type (if available) */
  name?: string;
  /** Current nesting depth (0 = top level) */
  depth: number;
  /** Parent type name (for nested types) */
  parentName?: string;
  /** Field name (if this is a property type) */
  fieldName?: string;
}

/**
 * Context provided when mapping a validation rule.
 */
export interface ValidationContext {
  /** The validation rule being mapped */
  rule: ValidationKind;
  /** The value of the validation rule */
  value: unknown;
  /** The field name being validated */
  fieldName: string;
  /** The field path (for nested fields, e.g., "input.user.name") */
  fieldPath: string;
  /** The base type of the field (e.g., "string", "number") */
  baseType: string;
  /** Whether the field is required */
  isRequired: boolean;
  /** The full validation rules object */
  allRules: ValidationRules;
}

/**
 * A utility function or type that should be generated alongside the main output.
 */
export interface GeneratedUtility {
  /** Unique identifier for this utility (used for deduplication) */
  id: string;
  /** The generated code for this utility */
  code: string;
  /** Required imports for this utility */
  imports?: string[];
  /** If true, this utility should only be included once even if referenced multiple times */
  includeOnce?: boolean;
  /** Optional priority for ordering (higher = earlier in output) */
  priority?: number;
}

/**
 * Result of mapping a type to target language.
 */
export interface TypeResult<T> {
  /** The mapped type representation */
  type: T;
  /** Utility functions/types to include in output */
  utilities?: GeneratedUtility[];
  /** Imports required for this type */
  imports?: string[];
}

/**
 * Result of mapping a validation rule to target language.
 */
export interface ValidationResult<V> {
  /** The validation code/representation */
  validation: V;
  /** Utility functions/types to include in output */
  utilities?: GeneratedUtility[];
  /** Imports required for this validation */
  imports?: string[];
}

/**
 * Handler function for mapping a specific type kind.
 */
export type TypeHandler<T> = (ctx: TypeContext) => TypeResult<T>;

/**
 * Handler function for mapping a specific validation rule.
 */
export type ValidationHandler<V> = (
  ctx: ValidationContext,
) => ValidationResult<V>;

/**
 * Complete mapping of all type kinds to handlers.
 * TypeScript enforces exhaustiveness at compile time.
 */
export type TypeMapping<T> = {
  [K in TypeKind]: TypeHandler<T>;
};

/**
 * Complete mapping of all validation kinds to handlers.
 * TypeScript enforces exhaustiveness at compile time.
 */
export type ValidationMapping<V> = {
  [K in ValidationKind]: ValidationHandler<V>;
};

/**
 * Declares which features a target supports.
 * Used to provide early warnings about schema incompatibility.
 */
export interface TargetCapabilities {
  /** Target name (e.g., "go-server", "ts-client") */
  name: string;

  /** Types that are fully supported */
  supportedTypes: TypeKind[];

  /** Types that have limited or no support */
  unsupportedTypes?: {
    kind: TypeKind;
    reason: string;
    fallback?: string;
  }[];

  /** Validations that are fully supported */
  supportedValidations: ValidationKind[];

  /** Validations that have limited or no support */
  unsupportedValidations?: {
    kind: ValidationKind;
    reason: string;
  }[];

  /** Additional notes about the target */
  notes?: string[];
}

/**
 * Issue found during contract validation.
 */
export interface ContractIssue {
  /** Severity of the issue */
  severity: "error" | "warning";
  /** Description of the issue */
  message: string;
  /** Path to the problematic element (e.g., "greeting.greet.input.name") */
  path?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Result of validating a contract against target capabilities.
 */
export interface ContractValidationResult {
  /** Whether the contract is valid for this target */
  valid: boolean;
  /** Issues found during validation */
  issues: ContractIssue[];
}

/**
 * Check if a kind is a valid TypeKind.
 */
export function isTypeKind(kind: string): kind is TypeKind {
  return TYPE_KINDS.includes(kind as TypeKind);
}

/**
 * Check if a key is a valid ValidationKind.
 */
export function isValidationKind(key: string): key is ValidationKind {
  return VALIDATION_KINDS.includes(key as ValidationKind);
}

/**
 * Get the applicable validation kinds for a base type.
 */
export function getValidationsForType(baseType: string): ValidationKind[] {
  switch (baseType) {
    case "string":
      return STRING_VALIDATIONS;
    case "number":
      return NUMBER_VALIDATIONS;
    case "array":
      return ARRAY_VALIDATIONS;
    default:
      return [];
  }
}
