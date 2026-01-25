import {
  type TypeContext,
  TypeMapperBase,
  type TypeMapping,
  type TypeReference,
  type TypeResult,
  toPascalCase,
} from "@xrpckit/sdk";
import { createGoTuplePattern, createGoUnionPattern } from "./patterns";

/**
 * Go type mapper that converts xRPC types to Go types.
 * Extends TypeMapperBase to ensure all type kinds are handled.
 */
export class GoTypeMapper extends TypeMapperBase<string> {
  // Registry of tuple type names for reference during validation
  private tupleTypes: Map<string, TypeReference> = new Map();
  // Registry of union type names
  private unionTypes: Map<string, TypeReference> = new Map();

  /**
   * Complete mapping of all type kinds to Go types.
   * TypeScript enforces exhaustiveness at compile time.
   */
  readonly typeMapping: TypeMapping<string> = {
    object: (ctx) => this.handleObject(ctx),
    array: (ctx) => this.handleArray(ctx),
    primitive: (ctx) => this.handlePrimitive(ctx),
    optional: (ctx) => this.handleOptional(ctx),
    nullable: (ctx) => this.handleNullable(ctx),
    union: (ctx) => this.handleUnion(ctx),
    enum: (ctx) => this.handleEnum(ctx),
    literal: (ctx) => this.handleLiteral(ctx),
    record: (ctx) => this.handleRecord(ctx),
    tuple: (ctx) => this.handleTuple(ctx),
    date: () => this.handleDate(),
  };

  /**
   * Map a primitive base type to Go type.
   */
  mapPrimitive(type: string): string {
    const mapping: Record<string, string> = {
      string: "string",
      number: "float64",
      integer: "int",
      boolean: "bool",
      date: "time.Time",
      uuid: "string",
      email: "string",
      any: "interface{}",
      unknown: "interface{}",
    };

    const result = mapping[type];
    if (!result) {
      console.warn("[GoTypeMapper] Unknown primitive type:", type);
      return "interface{}";
    }
    return result;
  }

  /**
   * Get all registered tuple types that need struct generation
   */
  getTupleTypes(): Map<string, TypeReference> {
    return this.tupleTypes;
  }

  /**
   * Get all registered union types that need wrapper struct generation
   */
  getUnionTypes(): Map<string, TypeReference> {
    return this.unionTypes;
  }

  /**
   * Reset the type registries (call between generation runs)
   */
  override reset(): void {
    super.reset();
    this.tupleTypes.clear();
    this.unionTypes.clear();
  }

  // --- Private handler methods ---

  private handleObject(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    if (name || typeRef.name) {
      return { type: toPascalCase(name || typeRef.name!) };
    }

    // Inline object without name - this should be rare after type collection
    console.warn(
      "[GoTypeMapper] Object without name - falling back to map[string]interface{}:",
      typeRef,
    );
    return { type: "map[string]interface{}" };
  }

  private handleArray(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (!typeRef.elementType) {
      return { type: "[]interface{}" };
    }
    const element = this.mapType(typeRef.elementType);
    return {
      type: `[]${element.type}`,
      imports: element.imports,
    };
  }

  private handlePrimitive(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    const baseType =
      typeof typeRef.baseType === "string" ? typeRef.baseType : "unknown";
    const goType = this.mapPrimitive(baseType);

    // time.Time requires import
    if (goType === "time.Time") {
      return { type: goType, imports: ["time"] };
    }
    return { type: goType };
  }

  private handleOptional(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    // In Go, optional is handled by validation - we use the base type
    if (typeof typeRef.baseType === "object") {
      return this.mapType(typeRef.baseType);
    }

    // String baseType - map to primitive
    if (typeof typeRef.baseType === "string") {
      return { type: this.mapPrimitive(typeRef.baseType) };
    }

    console.warn("[GoTypeMapper] Optional with unknown baseType:", typeRef);
    return { type: "interface{}" };
  }

  private handleNullable(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    // In Go, nullable maps to pointer type
    if (typeof typeRef.baseType === "object") {
      const base = this.mapType(typeRef.baseType);
      return {
        type: `*${base.type}`,
        imports: base.imports,
      };
    }

    if (typeof typeRef.baseType === "string") {
      return { type: `*${this.mapPrimitive(typeRef.baseType)}` };
    }

    console.warn("[GoTypeMapper] Nullable with unknown baseType:", typeRef);
    return { type: "*interface{}" };
  }

  private handleUnion(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    // If the union has a name, use a wrapper struct
    const unionName = name || typeRef.name;
    if (unionName) {
      const goName = toPascalCase(unionName);
      this.unionTypes.set(goName, typeRef);

      // Generate union utility
      const variants =
        typeRef.unionTypes?.map((v) => this.mapType(v).type) ?? [];
      const utility = createGoUnionPattern(goName, variants);

      return {
        type: goName,
        utilities: [utility],
        imports: utility.imports,
      };
    }

    // For anonymous unions, try to determine if all variants are the same type
    if (typeRef.unionTypes && typeRef.unionTypes.length > 0) {
      const variantTypes = typeRef.unionTypes.map((v) => this.mapType(v));
      const allSameType = variantTypes.every(
        (v) => v.type === variantTypes[0].type,
      );
      if (allSameType) {
        return variantTypes[0];
      }

      // Check if it's a nullable union (e.g., string | null)
      const nonNullVariants = typeRef.unionTypes.filter(
        (v) => !(v.kind === "literal" && v.literalValue === null),
      );
      if (nonNullVariants.length === 1) {
        const base = this.mapType(nonNullVariants[0]);
        return {
          type: `*${base.type}`,
          imports: base.imports,
        };
      }
    }

    // Heterogeneous anonymous union - use interface{}
    console.warn(
      "[GoTypeMapper] Anonymous heterogeneous union - using interface{}:",
      typeRef,
    );
    return { type: "interface{}" };
  }

  private handleEnum(_ctx: TypeContext): TypeResult<string> {
    // Enums in Go are typically represented as strings
    // The validation layer handles the enum value checking
    return { type: "string" };
  }

  private handleLiteral(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    if (typeRef.literalValue === null) {
      // null literal - typically handled by nullable wrapper
      return { type: "interface{}" };
    }

    if (typeof typeRef.literalValue === "string") {
      return { type: "string" };
    }

    if (typeof typeRef.literalValue === "number") {
      return { type: "float64" };
    }

    if (typeof typeRef.literalValue === "boolean") {
      return { type: "bool" };
    }

    console.warn("[GoTypeMapper] Unknown literal type:", typeRef);
    return { type: "interface{}" };
  }

  private handleRecord(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (!typeRef.valueType) {
      return { type: "map[string]interface{}" };
    }
    const value = this.mapType(typeRef.valueType);
    return {
      type: `map[string]${value.type}`,
      imports: value.imports,
    };
  }

  private handleTuple(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    // If the tuple has a name, use a struct type
    const tupleName = name || typeRef.name;
    if (tupleName) {
      const goName = toPascalCase(tupleName);
      this.tupleTypes.set(goName, typeRef);

      // Generate tuple struct utility
      const elements =
        typeRef.tupleElements?.map((e) => this.mapType(e).type) ?? [];
      const utility = createGoTuplePattern(goName, elements);

      return {
        type: goName,
        utilities: [utility],
        imports: utility.imports,
      };
    }

    // For anonymous tuples, try to determine if all elements are the same type
    if (typeRef.tupleElements && typeRef.tupleElements.length > 0) {
      const elementTypes = typeRef.tupleElements.map((e) => this.mapType(e));
      const allSameType = elementTypes.every(
        (e) => e.type === elementTypes[0].type,
      );
      if (allSameType) {
        return { type: `[]${elementTypes[0].type}` };
      }
    }

    // Heterogeneous anonymous tuple - best we can do is []interface{}
    console.warn(
      "[GoTypeMapper] Anonymous heterogeneous tuple - using []interface{}:",
      typeRef,
    );
    return { type: "[]interface{}" };
  }

  private handleDate(): TypeResult<string> {
    return {
      type: "time.Time",
      imports: ["time"],
    };
  }
}
