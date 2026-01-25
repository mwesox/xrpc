import {
  type ValidationMapping,
  type ValidationResult,
  ValidationMapperBase,
  createNoOpValidationHandler,
} from "@xrpckit/sdk";

/**
 * TypeScript validation mapper that delegates validation to Zod runtime.
 *
 * The TypeScript client uses Zod schemas directly for validation,
 * so this mapper returns null for all validation kinds. It exists
 * to satisfy the framework's completeness requirements.
 *
 * Validation in TypeScript client happens via:
 * - schema.parse() for strict validation
 * - schema.safeParse() for safe validation with error handling
 */
export class TsValidationMapper extends ValidationMapperBase<null> {
  /**
   * Complete mapping of all validation kinds to null (no-op).
   * TypeScript client delegates all validation to Zod runtime.
   */
  readonly validationMapping: ValidationMapping<null> = {
    // String validations - handled by Zod z.string().min(), .max(), .email(), etc.
    minLength: createNoOpValidationHandler(),
    maxLength: createNoOpValidationHandler(),
    email: createNoOpValidationHandler(),
    url: createNoOpValidationHandler(),
    uuid: createNoOpValidationHandler(),
    regex: createNoOpValidationHandler(),

    // Number validations - handled by Zod z.number().min(), .max(), .int(), etc.
    min: createNoOpValidationHandler(),
    max: createNoOpValidationHandler(),
    int: createNoOpValidationHandler(),
    positive: createNoOpValidationHandler(),
    negative: createNoOpValidationHandler(),

    // Array validations - handled by Zod z.array().min(), .max()
    minItems: createNoOpValidationHandler(),
    maxItems: createNoOpValidationHandler(),
  };
}
