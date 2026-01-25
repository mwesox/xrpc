import {
  type TypeMapping,
  type TypeResult,
  type TypeContext,
  TypeMapperBase,
  toPascalCase,
} from "@xrpckit/sdk";
import { createTsEnumPattern, createTsTuplePattern } from "./patterns";

/**
 * TypeScript type mapper that converts xRPC types to TypeScript types.
 * Extends TypeMapperBase to ensure all type kinds are handled.
 *
 * Note: The TypeScript client target primarily uses Zod's InferInput/InferOutput
 * for type inference. This mapper is provided for completeness and can be used
 * for generating standalone TypeScript types without Zod dependency.
 */
export class TsTypeMapper extends TypeMapperBase<string> {
  /**
   * Complete mapping of all type kinds to TypeScript types.
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
   * Map a primitive base type to TypeScript type.
   */
  mapPrimitive(type: string): string {
    const mapping: Record<string, string> = {
      string: "string",
      number: "number",
      integer: "number",
      boolean: "boolean",
      date: "Date",
      uuid: "string",
      email: "string",
      any: "unknown",
      unknown: "unknown",
    };

    return mapping[type] ?? "unknown";
  }

  // --- Private handler methods ---

  private handleObject(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    // If the object has a name, use interface reference
    if (name || typeRef.name) {
      return { type: toPascalCase(name || typeRef.name!) };
    }

    // Inline object - generate inline type
    if (typeRef.properties && typeRef.properties.length > 0) {
      const props = typeRef.properties.map((prop) => {
        const propType = this.mapType(prop.type).type;
        const optional = !prop.required ? "?" : "";
        return `${prop.name}${optional}: ${propType}`;
      });
      return { type: `{ ${props.join("; ")} }` };
    }

    return { type: "Record<string, unknown>" };
  }

  private handleArray(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (!typeRef.elementType) {
      return { type: "unknown[]" };
    }
    const element = this.mapType(typeRef.elementType);
    // Wrap complex types in parentheses for array syntax
    const elementType = element.type.includes("|") || element.type.includes("&")
      ? `(${element.type})`
      : element.type;
    return { type: `${elementType}[]` };
  }

  private handlePrimitive(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    const baseType =
      typeof typeRef.baseType === "string" ? typeRef.baseType : "unknown";
    return { type: this.mapPrimitive(baseType) };
  }

  private handleOptional(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    // In TypeScript, optional means T | undefined
    if (typeof typeRef.baseType === "object") {
      const base = this.mapType(typeRef.baseType);
      return { type: `${base.type} | undefined` };
    }

    if (typeof typeRef.baseType === "string") {
      return { type: `${this.mapPrimitive(typeRef.baseType)} | undefined` };
    }

    return { type: "unknown | undefined" };
  }

  private handleNullable(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    // In TypeScript, nullable means T | null
    if (typeof typeRef.baseType === "object") {
      const base = this.mapType(typeRef.baseType);
      return { type: `${base.type} | null` };
    }

    if (typeof typeRef.baseType === "string") {
      return { type: `${this.mapPrimitive(typeRef.baseType)} | null` };
    }

    return { type: "unknown | null" };
  }

  private handleUnion(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    // Generate union type
    if (typeRef.unionTypes && typeRef.unionTypes.length > 0) {
      const variants = typeRef.unionTypes.map((v) => this.mapType(v).type);
      const unionType = variants.join(" | ");

      // If named, could generate type alias utility
      if (name || typeRef.name) {
        // For named unions, just return the type - type alias generated elsewhere
        return { type: toPascalCase(name || typeRef.name!) };
      }

      return { type: unionType };
    }

    return { type: "unknown" };
  }

  private handleEnum(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    if (typeRef.enumValues && typeRef.enumValues.length > 0) {
      // If named, use the enum name
      if (name || typeRef.name) {
        const enumName = toPascalCase(name || typeRef.name!);
        const utility = createTsEnumPattern(enumName, typeRef.enumValues);
        return {
          type: enumName,
          utilities: [utility],
        };
      }

      // Anonymous enum - inline union
      const values = typeRef.enumValues.map((v) =>
        typeof v === "string" ? `"${v}"` : String(v)
      );
      return { type: values.join(" | ") };
    }

    return { type: "string" };
  }

  private handleLiteral(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    if (typeRef.literalValue === null) {
      return { type: "null" };
    }

    if (typeof typeRef.literalValue === "string") {
      return { type: `"${typeRef.literalValue}"` };
    }

    if (typeof typeRef.literalValue === "number") {
      return { type: String(typeRef.literalValue) };
    }

    if (typeof typeRef.literalValue === "boolean") {
      return { type: String(typeRef.literalValue) };
    }

    return { type: "unknown" };
  }

  private handleRecord(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (!typeRef.valueType) {
      return { type: "Record<string, unknown>" };
    }
    const value = this.mapType(typeRef.valueType);
    return { type: `Record<string, ${value.type}>` };
  }

  private handleTuple(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    if (typeRef.tupleElements && typeRef.tupleElements.length > 0) {
      const elements = typeRef.tupleElements.map((e) => this.mapType(e).type);
      const tupleType = `[${elements.join(", ")}]`;

      // If named, generate utility
      if (name || typeRef.name) {
        const tupleName = toPascalCase(name || typeRef.name!);
        const utility = createTsTuplePattern(tupleName, elements);
        return {
          type: tupleName,
          utilities: [utility],
        };
      }

      return { type: tupleType };
    }

    return { type: "unknown[]" };
  }

  private handleDate(): TypeResult<string> {
    return { type: "Date" };
  }
}
