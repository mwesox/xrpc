import type { TypeReference } from "../parser/contract";
import type {
  GeneratedUtility,
  TypeContext,
  TypeHandler,
  TypeKind,
  TypeMapping,
  TypeResult,
} from "./types";
import { TYPE_KINDS, isTypeKind } from "./types";
import { UtilityCollector } from "./utility-collector";

/**
 * Abstract base class for mapping xRPC types to target language types.
 *
 * Target generators extend this class and provide an exhaustive typeMapping
 * that handles all 11 type kinds. TypeScript enforces completeness at compile time.
 *
 * @template T - The type representation in the target language (e.g., string for Go/TS)
 *
 * @example
 * ```typescript
 * class GoTypeMapper extends TypeMapperBase<string> {
 *   readonly typeMapping: TypeMapping<string> = {
 *     object: (ctx) => ({ type: ctx.name ? toPascalCase(ctx.name) : "interface{}" }),
 *     array: (ctx) => {
 *       const element = this.mapType(ctx.typeRef.elementType!);
 *       return { type: `[]${element.type}` };
 *     },
 *     // ... all 11 type kinds
 *   };
 * }
 * ```
 */
export abstract class TypeMapperBase<T> {
  /**
   * Complete mapping of all type kinds to handlers.
   * Subclasses must implement this with handlers for all 11 type kinds.
   * TypeScript enforces exhaustiveness at compile time.
   */
  abstract readonly typeMapping: TypeMapping<T>;

  /**
   * Utility collector for tracking generated utilities across type mappings.
   */
  protected utilityCollector = new UtilityCollector();

  /**
   * Map a TypeReference to the target language type.
   *
   * @param typeRef - The type reference to map
   * @param options - Optional context for the mapping
   * @returns The mapped type result with type, utilities, and imports
   */
  mapType(
    typeRef: TypeReference,
    options: {
      name?: string;
      depth?: number;
      parentName?: string;
      fieldName?: string;
    } = {}
  ): TypeResult<T> {
    const ctx: TypeContext = {
      typeRef,
      name: options.name ?? typeRef.name,
      depth: options.depth ?? 0,
      parentName: options.parentName,
      fieldName: options.fieldName,
    };

    // Validate that the kind is known
    if (!isTypeKind(typeRef.kind)) {
      throw new Error(
        `Unknown type kind: "${typeRef.kind}". ` +
          `Valid kinds are: ${TYPE_KINDS.join(", ")}`
      );
    }

    // Get the handler for this type kind
    const handler = this.typeMapping[typeRef.kind as TypeKind];

    // This should never happen if typeMapping is properly typed
    if (!handler) {
      throw new Error(
        `Missing handler for type kind: "${typeRef.kind}". ` +
          `All type kinds must be handled by the type mapper.`
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
   * Get all collected utilities from type mappings.
   * Call this after mapping all types to get utilities to include in output.
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
   * Call this between generation runs to clear accumulated utilities.
   */
  reset(): void {
    this.utilityCollector = new UtilityCollector();
  }

  /**
   * Helper to recursively map a nested type.
   * Increments depth and passes parent context.
   */
  protected mapNestedType(
    typeRef: TypeReference,
    parentName?: string,
    fieldName?: string
  ): TypeResult<T> {
    return this.mapType(typeRef, {
      name: typeRef.name,
      depth: 1, // Nested types are always at depth > 0
      parentName,
      fieldName,
    });
  }

  /**
   * Get the base type from a TypeReference, unwrapping optional/nullable.
   */
  protected getBaseType(typeRef: TypeReference): string {
    if (typeRef.kind === "optional" || typeRef.kind === "nullable") {
      if (typeRef.baseType) {
        if (typeof typeRef.baseType === "string") {
          return typeRef.baseType;
        }
        return this.getBaseType(typeRef.baseType);
      }
    }
    if (typeof typeRef.baseType === "string") {
      return typeRef.baseType;
    }
    return typeRef.kind;
  }

  /**
   * Verify that the type mapping handles all type kinds.
   * This is a runtime check that complements TypeScript's compile-time checking.
   *
   * @throws Error if any type kind is missing a handler
   */
  verifyCompleteness(): void {
    const missingKinds: TypeKind[] = [];

    for (const kind of TYPE_KINDS) {
      if (!(kind in this.typeMapping) || !this.typeMapping[kind]) {
        missingKinds.push(kind);
      }
    }

    if (missingKinds.length > 0) {
      throw new Error(
        `Type mapper is incomplete. Missing handlers for: ${missingKinds.join(", ")}`
      );
    }
  }
}

/**
 * Create a type handler that returns an error for unsupported types.
 * Use this as a placeholder for types your target doesn't support.
 *
 * @param kind - The type kind
 * @param fallbackType - The fallback type to use
 * @param warningFn - Optional function to call with warning message
 */
export function createUnsupportedTypeHandler<T>(
  kind: TypeKind,
  fallbackType: T,
  warningFn?: (message: string) => void
): TypeHandler<T> {
  return (ctx: TypeContext): TypeResult<T> => {
    const message = `Type kind "${kind}" is not fully supported. Using fallback type.`;
    if (warningFn) {
      warningFn(message);
    } else {
      console.warn(`[TypeMapper] ${message}`, ctx);
    }
    return { type: fallbackType };
  };
}
