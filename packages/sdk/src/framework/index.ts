// Types and constants

// Target generator framework
export { createCapabilities, TargetGeneratorBase } from "./target-generator";
// Type mapping
export {
  createUnsupportedTypeHandler,
  TypeMapperBase,
} from "./type-mapper";
export {
  ARRAY_VALIDATIONS,
  type ContractIssue,
  type ContractValidationResult,
  type GeneratedUtility,
  getValidationsForType,
  // Type guards
  isTypeKind,
  isValidationKind,
  NUMBER_VALIDATIONS,
  STRING_VALIDATIONS,
  type TargetCapabilities,
  // Constants
  TYPE_KINDS,
  type TypeContext,
  type TypeHandler,
  // Types
  type TypeKind,
  type TypeMapping,
  type TypeResult,
  VALIDATION_KINDS,
  type ValidationContext,
  type ValidationHandler,
  type ValidationKind,
  type ValidationMapping,
  type ValidationResult,
} from "./types";
// Utility collection
export { UtilityCollector } from "./utility-collector";
// Validation mapping
export {
  createNoOpValidationHandler,
  createUnsupportedValidationHandler,
  ValidationMapperBase,
} from "./validation-mapper";
