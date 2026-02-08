// Parser exports

// Codegen exports
export {
  BaseCodeGenerator,
  CodeWriter,
  type GeneratedFiles,
  type GeneratorConfig,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "./codegen";
// Framework types
export type {
  ContractIssue,
  ContractValidationResult,
  GeneratedUtility,
  TypeContext,
  TypeHandler,
  TypeKind,
  TypeMapping,
  TypeResult,
  ValidationContext,
  ValidationHandler,
  ValidationKind,
  ValidationMapping,
  ValidationResult,
} from "./framework";
// Framework exports - for building target generators
export {
  ARRAY_VALIDATIONS,
  createCapabilities,
  createNoOpValidationHandler,
  // Helpers
  createUnsupportedTypeHandler,
  createUnsupportedValidationHandler,
  getValidationsForType,
  // Type guards
  isTypeKind,
  isValidationKind,
  NUMBER_VALIDATIONS,
  STRING_VALIDATIONS,
  // Base classes
  TargetGeneratorBase,
  // Constants
  TYPE_KINDS,
  TypeMapperBase,
  UtilityCollector,
  VALIDATION_KINDS,
  ValidationMapperBase,
} from "./framework";
export type {
  ContractDefinition,
  Endpoint,
  EndpointGroup,
  MiddlewareDefinition,
  Property,
  Router,
  TypeDefinition,
  TypeReference,
  ValidationRules,
} from "./parser";
export { parseContract } from "./parser";
// Target API (simple interface for code generation)
export {
  type ContractUsage,
  collectContractUsage,
  type Diagnostic,
  type GeneratedFile,
  type Target,
  type TargetInput,
  type TargetOutput,
  type TargetSupport,
  validateSupport,
} from "./target";
