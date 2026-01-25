import type { ValidationRules } from "../parser/contract";
import type {
  GeneratedUtility,
  ValidationContext,
  ValidationHandler,
  ValidationKind,
  ValidationMapping,
  ValidationResult,
} from "./types";
import {
  ARRAY_VALIDATIONS,
  NUMBER_VALIDATIONS,
  STRING_VALIDATIONS,
  VALIDATION_KINDS,
  isValidationKind,
} from "./types";
import { UtilityCollector } from "./utility-collector";

/**
 * Abstract base class for mapping xRPC validation rules to target language code.
 *
 * Target generators extend this class and provide an exhaustive validationMapping
 * that handles all 14 validation kinds. TypeScript enforces completeness at compile time.
 *
 * @template V - The validation code representation (e.g., string for code snippets, null for no-op)
 *
 * @example
 * ```typescript
 * class GoValidationMapper extends ValidationMapperBase<string> {
 *   readonly validationMapping: ValidationMapping<string> = {
 *     minLength: (ctx) => ({
 *       validation: `len(${ctx.fieldPath}) < ${ctx.value}`,
 *     }),
 *     maxLength: (ctx) => ({
 *       validation: `len(${ctx.fieldPath}) > ${ctx.value}`,
 *     }),
 *     // ... all 14 validation kinds
 *   };
 * }
 * ```
 */
export abstract class ValidationMapperBase<V> {
  /**
   * Complete mapping of all validation kinds to handlers.
   * Subclasses must implement this with handlers for all 14 validation kinds.
   * TypeScript enforces exhaustiveness at compile time.
   */
  abstract readonly validationMapping: ValidationMapping<V>;

  /**
   * Utility collector for tracking generated utilities across validation mappings.
   */
  protected utilityCollector = new UtilityCollector();

  /**
   * Map a single validation rule to the target language.
   *
   * @param rule - The validation rule kind
   * @param ctx - The validation context
   * @returns The validation result with code, utilities, and imports
   */
  mapValidation(
    rule: ValidationKind,
    ctx: ValidationContext,
  ): ValidationResult<V> {
    // Validate that the rule is known
    if (!isValidationKind(rule)) {
      throw new Error(
        `Unknown validation kind: "${rule}". ` +
          `Valid kinds are: ${VALIDATION_KINDS.join(", ")}`,
      );
    }

    // Get the handler for this validation kind
    const handler = this.validationMapping[rule];

    // This should never happen if validationMapping is properly typed
    if (!handler) {
      throw new Error(
        `Missing handler for validation kind: "${rule}". All validation kinds must be handled by the validation mapper.`,
      );
    }

    // Call the handler
    const result = handler(ctx);

    // Collect utilities
    if (result.utilities) {
      for (const utility of result.utilities) {
        this.utilityCollector.add(utility);
      }
    }

    return result;
  }

  /**
   * Map all validation rules from a ValidationRules object.
   *
   * @param rules - The validation rules object
   * @param fieldName - The field name
   * @param fieldPath - The field path
   * @param baseType - The base type of the field
   * @param isRequired - Whether the field is required
   * @returns Array of validation results for applicable rules
   */
  mapAllValidations(
    rules: ValidationRules,
    fieldName: string,
    fieldPath: string,
    baseType: string,
    isRequired: boolean,
  ): ValidationResult<V>[] {
    const results: ValidationResult<V>[] = [];

    // Get applicable validations for this base type
    const applicableRules = this.getApplicableRules(baseType);

    // Process each rule that exists and is applicable
    for (const rule of applicableRules) {
      const value = rules[rule as keyof ValidationRules];
      if (value !== undefined) {
        const ctx: ValidationContext = {
          rule,
          value,
          fieldName,
          fieldPath,
          baseType,
          isRequired,
          allRules: rules,
        };
        results.push(this.mapValidation(rule, ctx));
      }
    }

    return results;
  }

  /**
   * Get validation rules that apply to a given base type.
   */
  getApplicableRules(baseType: string): ValidationKind[] {
    switch (baseType) {
      case "string":
        return STRING_VALIDATIONS;
      case "number":
      case "integer":
        return NUMBER_VALIDATIONS;
      case "array":
        return ARRAY_VALIDATIONS;
      default:
        return [];
    }
  }

  /**
   * Check if a validation rule applies to a given base type.
   */
  isRuleApplicable(rule: ValidationKind, baseType: string): boolean {
    return this.getApplicableRules(baseType).includes(rule);
  }

  /**
   * Get all collected utilities from validation mappings.
   */
  getCollectedUtilities(): GeneratedUtility[] {
    return this.utilityCollector.getAll();
  }

  /**
   * Get all collected imports from utilities.
   */
  getCollectedImports(): string[] {
    return this.utilityCollector.getImports();
  }

  /**
   * Reset the utility collector.
   */
  reset(): void {
    this.utilityCollector = new UtilityCollector();
  }

  /**
   * Verify that the validation mapping handles all validation kinds.
   * This is a runtime check that complements TypeScript's compile-time checking.
   *
   * @throws Error if any validation kind is missing a handler
   */
  verifyCompleteness(): void {
    const missingKinds: ValidationKind[] = [];

    for (const kind of VALIDATION_KINDS) {
      if (!(kind in this.validationMapping) || !this.validationMapping[kind]) {
        missingKinds.push(kind);
      }
    }

    if (missingKinds.length > 0) {
      throw new Error(
        `Validation mapper is incomplete. Missing handlers for: ${missingKinds.join(", ")}`,
      );
    }
  }
}

/**
 * Create a validation handler that returns null (no-op).
 * Use this for targets that delegate validation to runtime (e.g., TS with Zod).
 */
export function createNoOpValidationHandler(): ValidationHandler<null> {
  return (): ValidationResult<null> => ({
    validation: null,
  });
}

/**
 * Create a validation handler that warns about unsupported validations.
 *
 * @param kind - The validation kind
 * @param warningFn - Optional function to call with warning message
 */
export function createUnsupportedValidationHandler<V>(
  kind: ValidationKind,
  defaultValue: V,
  warningFn?: (message: string) => void,
): ValidationHandler<V> {
  return (ctx: ValidationContext): ValidationResult<V> => {
    const message = `Validation "${kind}" is not supported for this target.`;
    if (warningFn) {
      warningFn(message);
    } else {
      console.warn(`[ValidationMapper] ${message}`, ctx);
    }
    return { validation: defaultValue };
  };
}
