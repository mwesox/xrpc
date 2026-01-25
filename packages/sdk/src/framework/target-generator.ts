import type { ContractDefinition, TypeReference } from "../parser/contract";
import type { GeneratedFiles, GeneratorConfig } from "../codegen/base-generator";
import { BaseCodeGenerator } from "../codegen/base-generator";
import type { TypeMapperBase } from "./type-mapper";
import type { ValidationMapperBase } from "./validation-mapper";
import type {
  ContractIssue,
  ContractValidationResult,
  TargetCapabilities,
  TypeKind,
  ValidationKind,
} from "./types";
import { TYPE_KINDS, VALIDATION_KINDS } from "./types";

/**
 * Abstract base class for target code generators that extends BaseCodeGenerator
 * and integrates the type/validation mapping framework.
 *
 * Target generators extend this class to:
 * 1. Declare their capabilities (which types/validations they support)
 * 2. Use type and validation mappers for consistent handling
 * 3. Validate contracts before generation
 *
 * @template TypeOut - The type representation in the target language
 * @template ValidationOut - The validation code representation
 *
 * @example
 * ```typescript
 * class GoCodeGenerator extends TargetGeneratorBase<string, string> {
 *   readonly name = "go-server";
 *   readonly typeMapper = new GoTypeMapper();
 *   readonly validationMapper = new GoValidationMapper();
 *
 *   readonly capabilities: TargetCapabilities = {
 *     name: "go-server",
 *     supportedTypes: TYPE_KINDS,
 *     supportedValidations: VALIDATION_KINDS,
 *   };
 *
 *   generate(contract: ContractDefinition): GeneratedFiles {
 *     // Validate contract
 *     const validation = this.validateContract(contract);
 *     if (!validation.valid) {
 *       // Handle validation errors...
 *     }
 *     // Generate code...
 *   }
 * }
 * ```
 */
export abstract class TargetGeneratorBase<
  TypeOut,
  ValidationOut
> extends BaseCodeGenerator {
  /**
   * The name of this target (e.g., "go-server", "ts-client").
   */
  abstract readonly name: string;

  /**
   * The type mapper for converting xRPC types to target types.
   */
  abstract readonly typeMapper: TypeMapperBase<TypeOut>;

  /**
   * The validation mapper for converting xRPC validations to target code.
   */
  abstract readonly validationMapper: ValidationMapperBase<ValidationOut>;

  /**
   * Optional capability declarations for this target.
   * If provided, used for contract validation and warnings.
   */
  readonly capabilities?: TargetCapabilities;

  constructor(config: GeneratorConfig) {
    super(config);
  }

  /**
   * Validate a contract against this target's capabilities.
   *
   * @param contract - The contract to validate
   * @returns Validation result with issues
   */
  validateContract(contract: ContractDefinition): ContractValidationResult {
    const issues: ContractIssue[] = [];

    // If no capabilities declared, assume all types/validations supported
    if (!this.capabilities) {
      return { valid: true, issues: [] };
    }

    // Collect all types and validations used in the contract
    const usedTypes = new Set<TypeKind>();
    const usedValidations = new Set<ValidationKind>();

    // Traverse the contract to collect used types and validations
    for (const type of contract.types) {
      this.collectTypesAndValidations(
        type,
        usedTypes,
        usedValidations,
        type.name
      );
    }

    for (const endpoint of contract.endpoints) {
      this.collectTypesAndValidations(
        endpoint.input,
        usedTypes,
        usedValidations,
        `${endpoint.fullName}.input`
      );
      this.collectTypesAndValidations(
        endpoint.output,
        usedTypes,
        usedValidations,
        `${endpoint.fullName}.output`
      );
    }

    // Check for unsupported types
    const supportedTypes = new Set(this.capabilities.supportedTypes);
    for (const usedType of usedTypes) {
      if (!supportedTypes.has(usedType)) {
        const unsupported = this.capabilities.unsupportedTypes?.find(
          (u) => u.kind === usedType
        );
        if (unsupported) {
          issues.push({
            severity: "warning",
            message: `Type "${usedType}" has limited support: ${unsupported.reason}`,
            suggestion: unsupported.fallback
              ? `Will fall back to: ${unsupported.fallback}`
              : undefined,
          });
        } else {
          issues.push({
            severity: "error",
            message: `Type "${usedType}" is not supported by ${this.name}`,
          });
        }
      }
    }

    // Check for unsupported validations
    const supportedValidations = new Set(this.capabilities.supportedValidations);
    for (const usedValidation of usedValidations) {
      if (!supportedValidations.has(usedValidation)) {
        const unsupported = this.capabilities.unsupportedValidations?.find(
          (u) => u.kind === usedValidation
        );
        if (unsupported) {
          issues.push({
            severity: "warning",
            message: `Validation "${usedValidation}" has limited support: ${unsupported.reason}`,
          });
        } else {
          issues.push({
            severity: "warning",
            message: `Validation "${usedValidation}" is not supported by ${this.name}`,
          });
        }
      }
    }

    // Determine validity (errors = invalid, warnings = valid with issues)
    const hasErrors = issues.some((i) => i.severity === "error");

    return {
      valid: !hasErrors,
      issues,
    };
  }

  /**
   * Recursively collect types and validations from a type reference.
   */
  private collectTypesAndValidations(
    typeRef: TypeReference | undefined,
    usedTypes: Set<TypeKind>,
    usedValidations: Set<ValidationKind>,
    path: string
  ): void {
    if (!typeRef) return;

    // Add this type kind
    usedTypes.add(typeRef.kind as TypeKind);

    // Collect validations from this type
    if (typeRef.validation) {
      for (const key of Object.keys(typeRef.validation)) {
        if (
          VALIDATION_KINDS.includes(key as ValidationKind) &&
          typeRef.validation[key as keyof typeof typeRef.validation] !== undefined
        ) {
          usedValidations.add(key as ValidationKind);
        }
      }
    }

    // Recurse into nested types
    if (typeRef.properties) {
      for (const prop of typeRef.properties) {
        this.collectTypesAndValidations(
          prop.type,
          usedTypes,
          usedValidations,
          `${path}.${prop.name}`
        );

        // Collect validations from property
        if (prop.validation) {
          for (const key of Object.keys(prop.validation)) {
            if (
              VALIDATION_KINDS.includes(key as ValidationKind) &&
              prop.validation[key as keyof typeof prop.validation] !== undefined
            ) {
              usedValidations.add(key as ValidationKind);
            }
          }
        }
      }
    }

    // Handle array element types
    if (typeRef.elementType) {
      this.collectTypesAndValidations(
        typeRef.elementType,
        usedTypes,
        usedValidations,
        `${path}[]`
      );
    }

    // Handle optional/nullable base types
    if (typeRef.baseType && typeof typeRef.baseType === "object") {
      this.collectTypesAndValidations(
        typeRef.baseType,
        usedTypes,
        usedValidations,
        path
      );
    }

    // Handle union types
    if (typeRef.unionTypes) {
      for (let i = 0; i < typeRef.unionTypes.length; i++) {
        this.collectTypesAndValidations(
          typeRef.unionTypes[i],
          usedTypes,
          usedValidations,
          `${path}[${i}]`
        );
      }
    }

    // Handle tuple elements
    if (typeRef.tupleElements) {
      for (let i = 0; i < typeRef.tupleElements.length; i++) {
        this.collectTypesAndValidations(
          typeRef.tupleElements[i],
          usedTypes,
          usedValidations,
          `${path}[${i}]`
        );
      }
    }

    // Handle record value types
    if (typeRef.valueType) {
      this.collectTypesAndValidations(
        typeRef.valueType,
        usedTypes,
        usedValidations,
        `${path}.value`
      );
    }
  }

  /**
   * Reset the mappers before generation.
   * Call this at the start of generate() to clear accumulated state.
   */
  protected resetMappers(): void {
    this.typeMapper.reset();
    this.validationMapper.reset();
  }

  /**
   * Verify that the type and validation mappers are complete.
   * Call this in constructor or at generation time for extra safety.
   */
  protected verifyMappers(): void {
    this.typeMapper.verifyCompleteness();
    this.validationMapper.verifyCompleteness();
  }
}

/**
 * Helper to create full TargetCapabilities from partial input.
 * Fills in defaults for missing fields.
 */
export function createCapabilities(
  name: string,
  options?: Partial<Omit<TargetCapabilities, "name">>
): TargetCapabilities {
  return {
    name,
    supportedTypes: options?.supportedTypes ?? [...TYPE_KINDS],
    unsupportedTypes: options?.unsupportedTypes,
    supportedValidations: options?.supportedValidations ?? [...VALIDATION_KINDS],
    unsupportedValidations: options?.unsupportedValidations,
    notes: options?.notes,
  };
}
