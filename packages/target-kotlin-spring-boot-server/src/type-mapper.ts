import type { ValidationRules } from "@xrpckit/sdk";
import {
  type TypeContext,
  TypeMapperBase,
  type TypeMapping,
  type TypeReference,
  type TypeResult,
} from "@xrpckit/sdk";
import { toKotlinPascalCase } from "./utils";

export type KotlinMapOptions = {
  preferInt?: boolean;
};

export class KotlinTypeMapper extends TypeMapperBase<string> {
  constructor(
    private readonly getKnownTypeName: (
      typeRef: TypeReference,
    ) => string | undefined,
  ) {
    super();
  }

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
    date: () => ({ type: "OffsetDateTime" }),
  };

  mapTypeWith(typeRef: TypeReference, options: KotlinMapOptions = {}): string {
    if (typeRef.kind === "primitive") {
      const baseType =
        typeof typeRef.baseType === "string" ? typeRef.baseType : "unknown";
      return this.mapPrimitive(baseType, options.preferInt === true);
    }

    if (
      (typeRef.kind === "optional" || typeRef.kind === "nullable") &&
      typeof typeRef.baseType === "object"
    ) {
      const nested = this.mapTypeWith(typeRef.baseType, options);
      return this.ensureNullable(nested);
    }

    return this.mapType(typeRef).type;
  }

  mapPropertyType(
    typeRef: TypeReference,
    rules: ValidationRules | undefined,
    required: boolean,
  ): string {
    const mapped = this.mapTypeWith(typeRef, {
      preferInt: rules?.int === true,
    });
    if (!required) {
      return this.ensureNullable(mapped);
    }
    return mapped;
  }

  private handleObject(ctx: TypeContext): TypeResult<string> {
    const known = this.getKnownTypeName(ctx.typeRef);
    if (ctx.name) return { type: toKotlinPascalCase(ctx.name) };
    if (ctx.typeRef.name) return { type: toKotlinPascalCase(ctx.typeRef.name) };
    if (known) return { type: toKotlinPascalCase(known) };
    return { type: "Map<String, Any?>" };
  }

  private handleArray(ctx: TypeContext): TypeResult<string> {
    const element = ctx.typeRef.elementType
      ? this.mapTypeWith(ctx.typeRef.elementType)
      : "Any?";
    return { type: `List<${element}>` };
  }

  private handlePrimitive(ctx: TypeContext): TypeResult<string> {
    const baseType =
      typeof ctx.typeRef.baseType === "string"
        ? ctx.typeRef.baseType
        : "unknown";
    return { type: this.mapPrimitive(baseType) };
  }

  private handleOptional(ctx: TypeContext): TypeResult<string> {
    if (typeof ctx.typeRef.baseType === "object") {
      return {
        type: this.ensureNullable(this.mapTypeWith(ctx.typeRef.baseType)),
      };
    }

    if (typeof ctx.typeRef.baseType === "string") {
      return {
        type: this.ensureNullable(this.mapPrimitive(ctx.typeRef.baseType)),
      };
    }

    return { type: "Any?" };
  }

  private handleNullable(ctx: TypeContext): TypeResult<string> {
    if (typeof ctx.typeRef.baseType === "object") {
      return {
        type: this.ensureNullable(this.mapTypeWith(ctx.typeRef.baseType)),
      };
    }

    if (typeof ctx.typeRef.baseType === "string") {
      return {
        type: this.ensureNullable(this.mapPrimitive(ctx.typeRef.baseType)),
      };
    }

    return { type: "Any?" };
  }

  private handleUnion(ctx: TypeContext): TypeResult<string> {
    const known = this.getKnownTypeName(ctx.typeRef);
    if (ctx.name) return { type: toKotlinPascalCase(ctx.name) };
    if (ctx.typeRef.name) return { type: toKotlinPascalCase(ctx.typeRef.name) };
    if (known) return { type: known };

    if (ctx.typeRef.unionTypes && ctx.typeRef.unionTypes.length > 0) {
      const nonNullVariants = ctx.typeRef.unionTypes.filter(
        (variant) =>
          !(variant.kind === "literal" && variant.literalValue === null),
      );
      if (nonNullVariants.length === 1) {
        return {
          type: this.ensureNullable(this.mapTypeWith(nonNullVariants[0])),
        };
      }

      const mapped = nonNullVariants.map((variant) =>
        this.mapTypeWith(variant),
      );
      const allSame =
        mapped.length > 0 && mapped.every((type) => type === mapped[0]);
      if (allSame) {
        return { type: mapped[0] };
      }
    }

    return { type: "Any?" };
  }

  private handleEnum(ctx: TypeContext): TypeResult<string> {
    const known = this.getKnownTypeName(ctx.typeRef);
    if (ctx.name) return { type: toKotlinPascalCase(ctx.name) };
    if (ctx.typeRef.name) return { type: toKotlinPascalCase(ctx.typeRef.name) };
    if (known) return { type: known };

    const enumValues = ctx.typeRef.enumValues;
    if (!enumValues || enumValues.length === 0) {
      return { type: "String" };
    }

    if (enumValues.every((value) => typeof value === "number")) {
      return { type: "Double" };
    }

    return { type: "String" };
  }

  private handleLiteral(ctx: TypeContext): TypeResult<string> {
    const value = ctx.typeRef.literalValue;
    if (value === null) return { type: "Any?" };
    if (typeof value === "string") return { type: "String" };
    if (typeof value === "number") return { type: "Double" };
    if (typeof value === "boolean") return { type: "Boolean" };
    return { type: "Any?" };
  }

  private handleRecord(ctx: TypeContext): TypeResult<string> {
    const value = ctx.typeRef.valueType
      ? this.mapTypeWith(ctx.typeRef.valueType)
      : "Any?";
    return { type: `Map<String, ${value}>` };
  }

  private handleTuple(ctx: TypeContext): TypeResult<string> {
    const known = this.getKnownTypeName(ctx.typeRef);
    if (ctx.name) return { type: toKotlinPascalCase(ctx.name) };
    if (ctx.typeRef.name) return { type: toKotlinPascalCase(ctx.typeRef.name) };
    if (known) return { type: known };

    if (ctx.typeRef.tupleElements && ctx.typeRef.tupleElements.length > 0) {
      const mapped = ctx.typeRef.tupleElements.map((element) =>
        this.mapTypeWith(element),
      );
      const allSame = mapped.every((type) => type === mapped[0]);
      if (allSame) {
        return { type: `List<${mapped[0]}>` };
      }
    }

    return { type: "List<Any?>" };
  }

  private mapPrimitive(type: string, preferInt = false): string {
    if (type === "number" && preferInt) {
      return "Int";
    }

    const mapping: Record<string, string> = {
      string: "String",
      number: "Double",
      integer: "Int",
      boolean: "Boolean",
      date: "OffsetDateTime",
      uuid: "String",
      email: "String",
      url: "String",
      any: "Any?",
      unknown: "Any?",
    };

    return mapping[type] ?? "Any?";
  }

  private ensureNullable(type: string): string {
    return type.endsWith("?") ? type : `${type}?`;
  }
}
