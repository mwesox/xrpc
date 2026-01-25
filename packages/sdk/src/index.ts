// Parser exports
export { parseContract } from "./parser";
export type {
  ContractDefinition,
  Router,
  EndpointGroup,
  Endpoint,
  TypeDefinition,
  Property,
  ValidationRules,
  TypeReference,
  MiddlewareDefinition,
} from "./parser";

// Codegen exports
export { CodeWriter } from "./codegen/code-writer";
export {
  BaseCodeGenerator,
  type GeneratorConfig,
  type GeneratedFiles,
} from "./codegen/base-generator";
export { toPascalCase, toCamelCase, toSnakeCase } from "./codegen/utils";

// Framework exports - for building target generators
export {
  // Constants
  TYPE_KINDS,
  VALIDATION_KINDS,
  STRING_VALIDATIONS,
  NUMBER_VALIDATIONS,
  ARRAY_VALIDATIONS,
  // Type guards
  isTypeKind,
  isValidationKind,
  getValidationsForType,
  // Base classes
  TypeMapperBase,
  ValidationMapperBase,
  TargetGeneratorBase,
  UtilityCollector,
  // Helpers
  createUnsupportedTypeHandler,
  createNoOpValidationHandler,
  createUnsupportedValidationHandler,
  createCapabilities,
} from "./framework";

// Framework types
export type {
  TypeKind,
  ValidationKind,
  TypeContext,
  ValidationContext,
  GeneratedUtility,
  TypeResult,
  ValidationResult,
  TypeHandler,
  ValidationHandler,
  TypeMapping,
  ValidationMapping,
  TargetCapabilities,
  ContractIssue,
  ContractValidationResult,
} from "./framework";
