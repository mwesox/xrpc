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
  UtilityCollector,
  // Helpers
  createUnsupportedTypeHandler,
  createNoOpValidationHandler,
  createUnsupportedValidationHandler,
} from "./framework";

// Target API (simple interface for code generation)
export {
  type Diagnostic,
  type GeneratedFile,
  type TargetInput,
  type TargetOutput,
  type Target,
  type TargetSupport,
  type ContractUsage,
  collectContractUsage,
  validateSupport,
} from "./target";

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
  ContractIssue,
  ContractValidationResult,
} from "./framework";
