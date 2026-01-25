import { describe, expect, it, beforeEach } from "bun:test";
import type { TypeReference } from "../parser/contract";
import {
  TYPE_KINDS,
  VALIDATION_KINDS,
  isTypeKind,
  isValidationKind,
  getValidationsForType,
} from "./types";
import type { TypeMapping, ValidationMapping, TypeContext, ValidationContext } from "./types";
import { TypeMapperBase } from "./type-mapper";
import { ValidationMapperBase } from "./validation-mapper";
import { UtilityCollector } from "./utility-collector";

describe("framework types", () => {
  describe("TYPE_KINDS", () => {
    it("should contain all 11 type kinds", () => {
      expect(TYPE_KINDS).toHaveLength(11);
      expect(TYPE_KINDS).toContain("object");
      expect(TYPE_KINDS).toContain("array");
      expect(TYPE_KINDS).toContain("primitive");
      expect(TYPE_KINDS).toContain("optional");
      expect(TYPE_KINDS).toContain("nullable");
      expect(TYPE_KINDS).toContain("union");
      expect(TYPE_KINDS).toContain("enum");
      expect(TYPE_KINDS).toContain("literal");
      expect(TYPE_KINDS).toContain("record");
      expect(TYPE_KINDS).toContain("tuple");
      expect(TYPE_KINDS).toContain("date");
    });
  });

  describe("VALIDATION_KINDS", () => {
    it("should contain all 13 validation kinds", () => {
      expect(VALIDATION_KINDS).toHaveLength(13);
      // String validations
      expect(VALIDATION_KINDS).toContain("minLength");
      expect(VALIDATION_KINDS).toContain("maxLength");
      expect(VALIDATION_KINDS).toContain("email");
      expect(VALIDATION_KINDS).toContain("url");
      expect(VALIDATION_KINDS).toContain("uuid");
      expect(VALIDATION_KINDS).toContain("regex");
      // Number validations
      expect(VALIDATION_KINDS).toContain("min");
      expect(VALIDATION_KINDS).toContain("max");
      expect(VALIDATION_KINDS).toContain("int");
      expect(VALIDATION_KINDS).toContain("positive");
      expect(VALIDATION_KINDS).toContain("negative");
      // Array validations
      expect(VALIDATION_KINDS).toContain("minItems");
      expect(VALIDATION_KINDS).toContain("maxItems");
    });
  });

  describe("isTypeKind", () => {
    it("should return true for valid type kinds", () => {
      expect(isTypeKind("object")).toBe(true);
      expect(isTypeKind("array")).toBe(true);
      expect(isTypeKind("primitive")).toBe(true);
    });

    it("should return false for invalid type kinds", () => {
      expect(isTypeKind("invalid")).toBe(false);
      expect(isTypeKind("")).toBe(false);
      expect(isTypeKind("Object")).toBe(false); // Case sensitive
    });
  });

  describe("isValidationKind", () => {
    it("should return true for valid validation kinds", () => {
      expect(isValidationKind("minLength")).toBe(true);
      expect(isValidationKind("email")).toBe(true);
      expect(isValidationKind("min")).toBe(true);
    });

    it("should return false for invalid validation kinds", () => {
      expect(isValidationKind("invalid")).toBe(false);
      expect(isValidationKind("")).toBe(false);
    });
  });

  describe("getValidationsForType", () => {
    it("should return string validations for string type", () => {
      const validations = getValidationsForType("string");
      expect(validations).toContain("minLength");
      expect(validations).toContain("maxLength");
      expect(validations).toContain("email");
      expect(validations).toContain("url");
      expect(validations).toContain("uuid");
      expect(validations).toContain("regex");
    });

    it("should return number validations for number type", () => {
      const validations = getValidationsForType("number");
      expect(validations).toContain("min");
      expect(validations).toContain("max");
      expect(validations).toContain("int");
      expect(validations).toContain("positive");
      expect(validations).toContain("negative");
    });

    it("should return array validations for array type", () => {
      const validations = getValidationsForType("array");
      expect(validations).toContain("minItems");
      expect(validations).toContain("maxItems");
    });

    it("should return empty array for unknown types", () => {
      expect(getValidationsForType("boolean")).toEqual([]);
      expect(getValidationsForType("unknown")).toEqual([]);
    });
  });
});

describe("UtilityCollector", () => {
  let collector: UtilityCollector;

  beforeEach(() => {
    collector = new UtilityCollector();
  });

  it("should add and retrieve utilities", () => {
    collector.add({
      id: "test1",
      code: "function test1() {}",
    });

    expect(collector.size()).toBe(1);
    expect(collector.has("test1")).toBe(true);
    expect(collector.get("test1")?.code).toBe("function test1() {}");
  });

  it("should deduplicate utilities with includeOnce", () => {
    collector.add({
      id: "test1",
      code: "code1",
      includeOnce: true,
    });

    collector.add({
      id: "test1",
      code: "code2",
      includeOnce: true,
    });

    expect(collector.size()).toBe(1);
    expect(collector.get("test1")?.code).toBe("code1"); // First one wins
  });

  it("should replace utilities without includeOnce", () => {
    collector.add({
      id: "test1",
      code: "code1",
      includeOnce: false,
    });

    collector.add({
      id: "test1",
      code: "code2",
      includeOnce: false,
    });

    expect(collector.size()).toBe(1);
    expect(collector.get("test1")?.code).toBe("code2"); // Last one wins
  });

  it("should collect imports", () => {
    collector.add({
      id: "test1",
      code: "code1",
      imports: ["fmt", "strings"],
    });

    collector.add({
      id: "test2",
      code: "code2",
      imports: ["fmt", "net/http"], // fmt is duplicate
    });

    const imports = collector.getImports();
    expect(imports).toContain("fmt");
    expect(imports).toContain("strings");
    expect(imports).toContain("net/http");
    expect(imports).toHaveLength(3); // Deduplicated
  });

  it("should sort utilities by priority", () => {
    collector.add({ id: "low", code: "low", priority: 10 });
    collector.add({ id: "high", code: "high", priority: 100 });
    collector.add({ id: "medium", code: "medium", priority: 50 });

    const utilities = collector.getAll();
    expect(utilities[0].id).toBe("high");
    expect(utilities[1].id).toBe("medium");
    expect(utilities[2].id).toBe("low");
  });

  it("should generate combined code", () => {
    collector.add({ id: "a", code: "a" });
    collector.add({ id: "b", code: "b" });

    const code = collector.generateCode();
    expect(code).toContain("a");
    expect(code).toContain("b");
  });

  it("should clear all utilities", () => {
    collector.add({ id: "test", code: "code", imports: ["fmt"] });
    collector.clear();

    expect(collector.size()).toBe(0);
    expect(collector.getImports()).toEqual([]);
  });
});

describe("TypeMapperBase", () => {
  // Create a concrete implementation for testing
  class TestTypeMapper extends TypeMapperBase<string> {
    readonly typeMapping: TypeMapping<string> = {
      object: (ctx) => ({ type: ctx.name ?? "Object" }),
      array: (ctx) => {
        const element = ctx.typeRef.elementType
          ? this.mapType(ctx.typeRef.elementType).type
          : "unknown";
        return { type: `${element}[]` };
      },
      primitive: (ctx) => ({ type: this.getBaseType(ctx.typeRef) }),
      optional: (ctx) => {
        if (typeof ctx.typeRef.baseType === "object") {
          return { type: `${this.mapType(ctx.typeRef.baseType).type}?` };
        }
        return { type: `${ctx.typeRef.baseType}?` };
      },
      nullable: (ctx) => {
        if (typeof ctx.typeRef.baseType === "object") {
          return { type: `${this.mapType(ctx.typeRef.baseType).type} | null` };
        }
        return { type: `${ctx.typeRef.baseType} | null` };
      },
      union: (ctx) => ({ type: "union" }),
      enum: (ctx) => ({ type: "enum" }),
      literal: (ctx) => ({ type: `literal(${ctx.typeRef.literalValue})` }),
      record: (ctx) => ({ type: "Record" }),
      tuple: (ctx) => ({ type: "tuple" }),
      date: () => ({ type: "Date" }),
    };
  }

  let mapper: TestTypeMapper;

  beforeEach(() => {
    mapper = new TestTypeMapper();
  });

  it("should map primitive types", () => {
    const result = mapper.mapType({
      kind: "primitive",
      baseType: "string",
    });
    expect(result.type).toBe("string");
  });

  it("should map object types with name", () => {
    const result = mapper.mapType({
      kind: "object",
      name: "User",
      properties: [],
    });
    expect(result.type).toBe("User");
  });

  it("should map array types", () => {
    const result = mapper.mapType({
      kind: "array",
      elementType: {
        kind: "primitive",
        baseType: "string",
      },
    });
    expect(result.type).toBe("string[]");
  });

  it("should map optional types", () => {
    const result = mapper.mapType({
      kind: "optional",
      baseType: {
        kind: "primitive",
        baseType: "string",
      },
    });
    expect(result.type).toBe("string?");
  });

  it("should map nullable types", () => {
    const result = mapper.mapType({
      kind: "nullable",
      baseType: {
        kind: "primitive",
        baseType: "string",
      },
    });
    expect(result.type).toBe("string | null");
  });

  it("should map date types", () => {
    const result = mapper.mapType({ kind: "date" });
    expect(result.type).toBe("Date");
  });

  it("should throw for unknown type kinds", () => {
    expect(() => {
      mapper.mapType({ kind: "unknown" as any });
    }).toThrow("Unknown type kind");
  });

  it("should verify completeness", () => {
    expect(() => mapper.verifyCompleteness()).not.toThrow();
  });
});

describe("ValidationMapperBase", () => {
  // Create a concrete implementation for testing
  class TestValidationMapper extends ValidationMapperBase<string> {
    readonly validationMapping: ValidationMapping<string> = {
      minLength: (ctx) => ({ validation: `len >= ${ctx.value}` }),
      maxLength: (ctx) => ({ validation: `len <= ${ctx.value}` }),
      email: () => ({ validation: "isEmail" }),
      url: () => ({ validation: "isURL" }),
      uuid: () => ({ validation: "isUUID" }),
      regex: (ctx) => ({ validation: `matches(${ctx.value})` }),
      min: (ctx) => ({ validation: `>= ${ctx.value}` }),
      max: (ctx) => ({ validation: `<= ${ctx.value}` }),
      int: () => ({ validation: "isInt" }),
      positive: () => ({ validation: "> 0" }),
      negative: () => ({ validation: "< 0" }),
      minItems: (ctx) => ({ validation: `items >= ${ctx.value}` }),
      maxItems: (ctx) => ({ validation: `items <= ${ctx.value}` }),
    };
  }

  let mapper: TestValidationMapper;

  beforeEach(() => {
    mapper = new TestValidationMapper();
  });

  it("should map minLength validation", () => {
    const result = mapper.mapValidation("minLength", {
      rule: "minLength",
      value: 5,
      fieldName: "name",
      fieldPath: "input.name",
      baseType: "string",
      isRequired: true,
      allRules: { minLength: 5 },
    });
    expect(result.validation).toBe("len >= 5");
  });

  it("should map number validations", () => {
    const result = mapper.mapValidation("min", {
      rule: "min",
      value: 0,
      fieldName: "age",
      fieldPath: "input.age",
      baseType: "number",
      isRequired: true,
      allRules: { min: 0 },
    });
    expect(result.validation).toBe(">= 0");
  });

  it("should get applicable rules for string", () => {
    const rules = mapper.getApplicableRules("string");
    expect(rules).toContain("minLength");
    expect(rules).toContain("email");
    expect(rules).not.toContain("min"); // Number rule
  });

  it("should get applicable rules for number", () => {
    const rules = mapper.getApplicableRules("number");
    expect(rules).toContain("min");
    expect(rules).toContain("int");
    expect(rules).not.toContain("minLength"); // String rule
  });

  it("should verify completeness", () => {
    expect(() => mapper.verifyCompleteness()).not.toThrow();
  });

  it("should throw for unknown validation kinds", () => {
    expect(() => {
      mapper.mapValidation("unknown" as any, {
        rule: "unknown" as any,
        value: 5,
        fieldName: "test",
        fieldPath: "test",
        baseType: "string",
        isRequired: true,
        allRules: {},
      });
    }).toThrow("Unknown validation kind");
  });
});

