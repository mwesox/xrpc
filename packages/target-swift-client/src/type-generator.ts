import type { ContractDefinition, Property, TypeReference } from "@xrpckit/sdk";
import { toPascalCase } from "@xrpckit/sdk";
import { SwiftBuilder } from "./swift-builder";
import { SwiftTypeCollector } from "./type-collector";
import { SwiftTypeMapper, isNullLiteral } from "./type-mapper";
import {
  sanitizeSwiftIdentifier,
  toLowerCamelCase,
  uniqueName,
} from "./utils";

export class SwiftTypeGenerator {
  private w: SwiftBuilder;
  private typeMapper: SwiftTypeMapper;
  private collector: SwiftTypeCollector;
  private generatedTypes: Set<string> = new Set();

  constructor() {
    this.w = new SwiftBuilder();
    this.typeMapper = new SwiftTypeMapper();
    this.collector = new SwiftTypeCollector();
  }

  generateTypes(contract: ContractDefinition): string {
    const w = this.w.reset();
    this.typeMapper.reset();
    this.generatedTypes.clear();

    const collectedTypes = this.collector.collectTypes(contract);

    w.import("Foundation").n();

    this.generateSupportTypes();
    w.n();

    const sorted = collectedTypes.sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const type of sorted) {
      this.generateTypeDefinition(type.name, type.typeRef);
      w.n();
    }

    return w.toString();
  }

  private generateSupportTypes(): void {
    const w = this.w;

    w.mark("Support Types");

    w
      .struct("XRPCNull", ["Codable", "Equatable"], (b) => {
        b.l("public init() {}");
        b.n();
        b.l("public init(from decoder: Decoder) throws {");
        b.i()
          .l("let container = try decoder.singleValueContainer()")
          .l("if !container.decodeNil() {")
          .i()
          .l(
            'throw DecodingError.typeMismatch(XRPCNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected null"))',
          )
          .u()
          .l("}")
          .u()
          .l("}");
        b.n();
        b.l("public func encode(to encoder: Encoder) throws {");
        b.i()
          .l("var container = encoder.singleValueContainer()")
          .l("try container.encodeNil()")
          .u()
          .l("}");
      })
      .n();

    w.enum("XRPCAny", ["Codable", "Equatable"], (b) => {
      b.l("case string(String)")
        .l("case number(Double)")
        .l("case bool(Bool)")
        .l("case object([String: XRPCAny])")
        .l("case array([XRPCAny])")
        .l("case null");
      b.n();
      b.l("public init(from decoder: Decoder) throws {");
      b.i();
      b.l("let container = try decoder.singleValueContainer()");
      b.l("if container.decodeNil() { self = .null; return }");
      b.l("if let value = try? container.decode(Bool.self) { self = .bool(value); return }");
      b.l("if let value = try? container.decode(Int.self) { self = .number(Double(value)); return }");
      b.l("if let value = try? container.decode(Double.self) { self = .number(value); return }");
      b.l("if let value = try? container.decode(String.self) { self = .string(value); return }");
      b.l("if let value = try? container.decode([String: XRPCAny].self) { self = .object(value); return }");
      b.l("if let value = try? container.decode([XRPCAny].self) { self = .array(value); return }");
      b.l(
        'throw DecodingError.typeMismatch(XRPCAny.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unsupported JSON value"))',
      );
      b.u();
      b.l("}");
      b.n();
      b.l("public func encode(to encoder: Encoder) throws {");
      b.i();
      b.l("var container = encoder.singleValueContainer()");
      b.l("switch self {");
      b.i();
      b.l("case .string(let value): try container.encode(value)");
      b.l("case .number(let value): try container.encode(value)");
      b.l("case .bool(let value): try container.encode(value)");
      b.l("case .object(let value): try container.encode(value)");
      b.l("case .array(let value): try container.encode(value)");
      b.l("case .null: try container.encodeNil()");
      b.u();
      b.l("}");
      b.u();
      b.l("}");
    });

    w.n();

    w.struct("XRPCEmpty", ["Codable", "Equatable"], (b) => {
      b.l("public init() {}");
    });
  }

  private generateTypeDefinition(name: string, typeRef: TypeReference): void {
    const typeName = toPascalCase(name);
    if (this.generatedTypes.has(typeName)) return;
    this.generatedTypes.add(typeName);

    switch (typeRef.kind) {
      case "object":
        this.generateObjectType(typeName, typeRef.properties ?? []);
        return;
      case "enum":
        this.generateEnumType(typeName, typeRef.enumValues ?? []);
        return;
      case "union":
        this.generateUnionType(typeName, typeRef.unionTypes ?? []);
        return;
      case "tuple":
        this.generateTupleType(typeName, typeRef.tupleElements ?? []);
        return;
      case "array":
        this.generateAliasType(typeName, this.mapType(typeRef));
        return;
      case "record":
        this.generateAliasType(typeName, this.mapType(typeRef));
        return;
      case "primitive":
      case "optional":
      case "nullable":
      case "literal":
      case "date":
        this.generateAliasType(typeName, this.mapType(typeRef));
        return;
      default:
        this.generateAliasType(typeName, "XRPCAny");
    }
  }

  private mapType(typeRef: TypeReference): string {
    return this.typeMapper.mapType(typeRef).type;
  }

  private generateAliasType(name: string, type: string): void {
    this.w.typealias(name, type);
  }

  private generateObjectType(name: string, properties: Property[]): void {
    const w = this.w;
    const usedNames = new Set<string>();
    const propInfos = properties.map((prop) => {
      const sanitized = sanitizeSwiftIdentifier(prop.name);
      const unique = uniqueName(sanitized, usedNames, "_");
      return {
        original: prop.name,
        name: unique,
        type: this.mapType(prop.type),
      };
    });

    w.struct(name, ["Codable", "Equatable"], (b) => {
      for (const prop of propInfos) {
        b.l(`public let ${prop.name}: ${prop.type}`);
      }

      b.n();
      const params = propInfos.map((prop) => {
        const defaultValue = prop.type.endsWith("?") ? " = nil" : "";
        return `${prop.name}: ${prop.type}${defaultValue}`;
      });
      b.l(`public init(${params.join(", ")}) {`);
      b.i();
      for (const prop of propInfos) {
        b.l(`self.${prop.name} = ${prop.name}`);
      }
      b.u();
      b.l("}");

      const codingKeys = propInfos.filter((prop) => prop.name !== prop.original);
      if (codingKeys.length > 0) {
        b.n();
        b.l("enum CodingKeys: String, CodingKey {");
        b.i();
        for (const key of codingKeys) {
          b.l(`case ${key.name} = \"${key.original}\"`);
        }
        b.u();
        b.l("}");
      }
    });
  }

  private generateEnumType(name: string, values: (string | number)[]): void {
    const w = this.w;
    if (values.length === 0) {
      w.enum(name, ["Codable", "Equatable"], (b) => {
        b.l("case unknown");
      });
      return;
    }

    const stringOnly = values.every((v) => typeof v === "string");
    const numberOnly = values.every((v) => typeof v === "number");
    const used = new Set<string>();
    const caseInfos = values.map((value, index) => {
      const base =
        typeof value === "string" ? value : `number${index}`;
      const caseName = this.enumCaseName(base, used);
      return {
        value,
        caseName,
        literal: typeof value === "string" ? `\"${value}\"` : String(value),
      };
    });

    if (stringOnly) {
      w.enum(name, ["String", "Codable", "Equatable"], (b) => {
        caseInfos.forEach((info) => {
          b.l(`case ${info.caseName} = ${info.literal}`);
        });
      });
      return;
    }

    if (numberOnly) {
      w.enum(name, ["Double", "Codable", "Equatable"], (b) => {
        caseInfos.forEach((info) => {
          b.l(`case ${info.caseName} = ${info.literal}`);
        });
      });
      return;
    }

    w.enum(name, ["Codable", "Equatable"], (b) => {
      caseInfos.forEach((info) => {
        b.l(`case ${info.caseName}`);
      });

      b.n();
      b.l("public init(from decoder: Decoder) throws {");
      b.i();
      b.l("let container = try decoder.singleValueContainer()");

      const stringValues = values.filter((v) => typeof v === "string");
      const numberValues = values.filter((v) => typeof v === "number");

      if (stringValues.length > 0) {
        b.l("if let value = try? container.decode(String.self) {");
        b.i();
        b.l("switch value {");
        b.i();
        caseInfos.forEach((info) => {
          if (typeof info.value !== "string") return;
          b.l(`case \"${info.value}\": self = .${info.caseName}`);
        });
        b.l("default: break");
        b.u();
        b.l("}");
        b.l("return");
        b.u();
        b.l("}");
      }

      if (numberValues.length > 0) {
        b.l("if let value = try? container.decode(Double.self) {");
        b.i();
        b.l("switch value {");
        b.i();
        caseInfos.forEach((info) => {
          if (typeof info.value !== "number") return;
          b.l(`case ${info.value}: self = .${info.caseName}`);
        });
        b.l("default: break");
        b.u();
        b.l("}");
        b.l("return");
        b.u();
        b.l("}");
      }

      b.l(
        'throw DecodingError.typeMismatch(' +
          `${name}.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: \"Invalid enum value\"))`,
      );
      b.u();
      b.l("}");

      b.n();
      b.l("public func encode(to encoder: Encoder) throws {");
      b.i();
      b.l("var container = encoder.singleValueContainer()");
      b.l("switch self {");
      b.i();
      caseInfos.forEach((info) => {
        b.l(`case .${info.caseName}: try container.encode(${info.literal})`);
      });
      b.u();
      b.l("}");
      b.u();
      b.l("}");
    });
  }

  private enumCaseName(value: string, used: Set<string>): string {
    const base = sanitizeSwiftIdentifier(toLowerCamelCase(value));
    return uniqueName(base, used, "_");
  }

  private generateUnionType(name: string, variants: TypeReference[]): void {
    const w = this.w;
    if (variants.length === 0) {
      w.enum(name, ["Codable", "Equatable"], (b) => {
        b.l("case unknown");
      });
      return;
    }

    const hasNull = variants.some((variant) => isNullLiteral(variant));
    const used = new Set<string>();

    const orderedVariants = variants
      .filter((variant) => !isNullLiteral(variant))
      .map((variant, index) => ({
        variant,
        index,
        type: this.mapType(variant),
      }))
      .sort((a, b) => {
        if (a.type === "XRPCAny") return 1;
        if (b.type === "XRPCAny") return -1;
        return 0;
      });

    const caseInfos = orderedVariants.map((entry) => ({
      ...entry,
      caseName: this.unionCaseName(entry.variant, used),
    }));

    w.enum(name, ["Codable", "Equatable"], (b) => {
      if (hasNull) {
        b.l("case null");
      }

      for (const entry of caseInfos) {
        b.l(`case ${entry.caseName}(${entry.type})`);
      }

      b.n();
      b.l("public init(from decoder: Decoder) throws {");
      b.i();
      b.l("let container = try decoder.singleValueContainer()");
      if (hasNull) {
        b.l("if container.decodeNil() { self = .null; return }");
      }
      for (const entry of caseInfos) {
        b.l(
          `if let value = try? container.decode(${entry.type}.self) { self = .${entry.caseName}(value); return }`,
        );
      }
      b.l(
        'throw DecodingError.typeMismatch(' +
          `${name}.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: \"Invalid union value\"))`,
      );
      b.u();
      b.l("}");

      b.n();
      b.l("public func encode(to encoder: Encoder) throws {");
      b.i();
      b.l("var container = encoder.singleValueContainer()");
      b.l("switch self {");
      b.i();
      if (hasNull) {
        b.l("case .null: try container.encodeNil()");
      }
      for (const entry of caseInfos) {
        b.l(`case .${entry.caseName}(let value): try container.encode(value)`);
      }
      b.u();
      b.l("}");
      b.u();
      b.l("}");
    });
  }

  private unionCaseName(typeRef: TypeReference, used: Set<string>): string {
    let base = "variant";
    if (typeRef.name) {
      base = toLowerCamelCase(typeRef.name);
    } else if (typeRef.kind === "primitive" && typeof typeRef.baseType === "string") {
      base = typeRef.baseType;
    } else if (typeRef.kind === "literal" && typeof typeRef.literalValue === "string") {
      base = typeRef.literalValue;
    }
    base = sanitizeSwiftIdentifier(base);
    return uniqueName(base, used, "_");
  }

  private generateTupleType(name: string, elements: TypeReference[]): void {
    const w = this.w;
    w.struct(name, ["Codable", "Equatable"], (b) => {
      elements.forEach((element, index) => {
        const swiftType = this.mapType(element);
        b.l(`public let v${index}: ${swiftType}`);
      });

      b.n();
      const params = elements.map((element, index) => {
        const swiftType = this.mapType(element);
        return `v${index}: ${swiftType}`;
      });
      b.l(`public init(${params.join(", ")}) {`);
      b.i();
      elements.forEach((_element, index) => {
        b.l(`self.v${index} = v${index}`);
      });
      b.u();
      b.l("}");

      b.n();
      b.l("public init(from decoder: Decoder) throws {");
      b.i();
      b.l("var container = try decoder.unkeyedContainer()");
      elements.forEach((element, index) => {
        const swiftType = this.mapType(element);
        b.l(`self.v${index} = try container.decode(${swiftType}.self)`);
      });
      b.u();
      b.l("}");

      b.n();
      b.l("public func encode(to encoder: Encoder) throws {");
      b.i();
      b.l("var container = encoder.unkeyedContainer()");
      elements.forEach((_element, index) => {
        b.l(`try container.encode(v${index})`);
      });
      b.u();
      b.l("}");
    });
  }
}
