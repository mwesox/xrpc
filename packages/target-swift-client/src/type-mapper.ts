import {
  type TypeContext,
  TypeMapperBase,
  type TypeMapping,
  type TypeReference,
  type TypeResult,
  toPascalCase,
} from "@xrpckit/sdk";

export class SwiftTypeMapper extends TypeMapperBase<string> {
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

  mapPrimitive(type: string): string {
    const mapping: Record<string, string> = {
      string: "String",
      number: "Double",
      integer: "Int",
      boolean: "Bool",
      date: "Date",
      uuid: "String",
      email: "String",
      any: "XRPCAny",
      unknown: "XRPCAny",
    };

    return mapping[type] ?? "XRPCAny";
  }

  private handleObject(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    if (name || typeRef.name) {
      return { type: toPascalCase(name || typeRef.name!) };
    }

    return { type: "[String: XRPCAny]" };
  }

  private handleArray(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (!typeRef.elementType) {
      return { type: "[XRPCAny]" };
    }
    const element = this.mapType(typeRef.elementType);
    return { type: `[${element.type}]` };
  }

  private handlePrimitive(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    const baseType =
      typeof typeRef.baseType === "string" ? typeRef.baseType : "unknown";
    return { type: this.mapPrimitive(baseType) };
  }

  private handleOptional(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (typeof typeRef.baseType === "object") {
      const base = this.mapType(typeRef.baseType);
      return { type: this.wrapOptional(base.type) };
    }
    if (typeof typeRef.baseType === "string") {
      return { type: this.wrapOptional(this.mapPrimitive(typeRef.baseType)) };
    }
    return { type: "XRPCAny?" };
  }

  private handleNullable(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (typeof typeRef.baseType === "object") {
      const base = this.mapType(typeRef.baseType);
      return { type: this.wrapOptional(base.type) };
    }
    if (typeof typeRef.baseType === "string") {
      return { type: this.wrapOptional(this.mapPrimitive(typeRef.baseType)) };
    }
    return { type: "XRPCAny?" };
  }

  private handleUnion(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;
    const unionName = name || typeRef.name;

    if (unionName) {
      return { type: toPascalCase(unionName) };
    }

    if (typeRef.unionTypes && typeRef.unionTypes.length > 0) {
      const mapped = typeRef.unionTypes.map((v) => this.mapType(v).type);
      const allSame = mapped.every((t) => t === mapped[0]);
      if (allSame) {
        return { type: mapped[0] };
      }

      const nonNullVariants = typeRef.unionTypes.filter(
        (variant) => !(variant.kind === "literal" && variant.literalValue === null),
      );
      if (nonNullVariants.length === 1) {
        const base = this.mapType(nonNullVariants[0]);
        return { type: this.wrapOptional(base.type) };
      }
    }

    return { type: "XRPCAny" };
  }

  private handleEnum(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    if (name || typeRef.name) {
      return { type: toPascalCase(name || typeRef.name!) };
    }

    if (typeRef.enumValues && typeRef.enumValues.length > 0) {
      const stringOnly = typeRef.enumValues.every((v) => typeof v === "string");
      const numberOnly = typeRef.enumValues.every((v) => typeof v === "number");
      if (stringOnly) return { type: "String" };
      if (numberOnly) return { type: "Double" };
    }

    return { type: "XRPCAny" };
  }

  private handleLiteral(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;

    if (typeRef.literalValue === null) {
      return { type: "XRPCNull" };
    }

    if (typeof typeRef.literalValue === "string") {
      return { type: "String" };
    }

    if (typeof typeRef.literalValue === "number") {
      return { type: "Double" };
    }

    if (typeof typeRef.literalValue === "boolean") {
      return { type: "Bool" };
    }

    return { type: "XRPCAny" };
  }

  private handleRecord(ctx: TypeContext): TypeResult<string> {
    const { typeRef } = ctx;
    if (!typeRef.valueType) {
      return { type: "[String: XRPCAny]" };
    }
    const value = this.mapType(typeRef.valueType);
    return { type: `[String: ${value.type}]` };
  }

  private handleTuple(ctx: TypeContext): TypeResult<string> {
    const { typeRef, name } = ctx;

    if (name || typeRef.name) {
      return { type: toPascalCase(name || typeRef.name!) };
    }

    if (typeRef.tupleElements && typeRef.tupleElements.length > 0) {
      const elementTypes = typeRef.tupleElements.map((e) => this.mapType(e));
      const allSame = elementTypes.every((t) => t.type === elementTypes[0].type);
      if (allSame) {
        return { type: `[${elementTypes[0].type}]` };
      }
    }

    return { type: "[XRPCAny]" };
  }

  private handleDate(): TypeResult<string> {
    return { type: "Date" };
  }

  private wrapOptional(type: string): string {
    return type.endsWith("?") ? type : `${type}?`;
  }
}

export function isNullLiteral(typeRef: TypeReference): boolean {
  return typeRef.kind === "literal" && typeRef.literalValue === null;
}
