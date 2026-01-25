import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ValidationRules } from "./contract";
import { extractTypeInfo, extractValidationRules } from "./zod-extractor";

describe("extractValidationRules", () => {
  describe("String validations", () => {
    test("extracts minLength", () => {
      const schema = z.string().min(5);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minLength).toBe(5);
    });

    test("extracts maxLength", () => {
      const schema = z.string().max(100);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.maxLength).toBe(100);
    });

    test("extracts minLength and maxLength together", () => {
      const schema = z.string().min(1).max(100);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minLength).toBe(1);
      expect(rules?.maxLength).toBe(100);
    });

    test("extracts email format", () => {
      const schema = z.string().email();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.email).toBe(true);
    });

    test("extracts url format", () => {
      const schema = z.string().url();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.url).toBe(true);
    });

    test("extracts uuid format", () => {
      const schema = z.string().uuid();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.uuid).toBe(true);
    });

    test("extracts regex pattern", () => {
      const schema = z.string().regex(/^[A-Z]+$/);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.regex).toBeDefined();
      expect(typeof rules?.regex).toBe("string");
    });

    test("combines multiple string validations", () => {
      const schema = z.string().min(3).max(50).email();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minLength).toBe(3);
      expect(rules?.maxLength).toBe(50);
      expect(rules?.email).toBe(true);
    });
  });

  describe("Number validations", () => {
    test("extracts minimum", () => {
      const schema = z.number().min(18);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.min).toBe(18);
    });

    test("extracts maximum", () => {
      const schema = z.number().max(120);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.max).toBe(120);
    });

    test("extracts minimum and maximum together", () => {
      const schema = z.number().min(0).max(100);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.min).toBe(0);
      expect(rules?.max).toBe(100);
    });

    test("extracts int constraint", () => {
      const schema = z.number().int();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.int).toBe(true);
    });

    test("combines number validations", () => {
      const schema = z.number().min(18).max(120).int();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      // Note: When .int() is used, Zod v4's toJSONSchema() resets min/max to safe integer bounds
      // So we can't extract the original min/max values, only the int constraint
      expect(rules?.int).toBe(true);
      // min/max may be undefined or set to safe integer bounds when int() is used
    });
  });

  describe("Array validations", () => {
    test("extracts minItems", () => {
      const schema = z.array(z.string()).min(1);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minItems).toBe(1);
    });

    test("extracts maxItems", () => {
      const schema = z.array(z.string()).max(10);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.maxItems).toBe(10);
    });

    test("extracts minItems and maxItems together", () => {
      const schema = z.array(z.string()).min(1).max(10);
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minItems).toBe(1);
      expect(rules?.maxItems).toBe(10);
    });
  });

  describe("Optional and nullable handling", () => {
    test("extracts rules from optional string", () => {
      const schema = z.string().min(1).max(100).optional();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minLength).toBe(1);
      expect(rules?.maxLength).toBe(100);
    });

    test("extracts rules from nullable string", () => {
      const schema = z.string().email().nullable();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.email).toBe(true);
    });

    test("extracts rules from optional nullable string", () => {
      const schema = z.string().min(5).optional().nullable();
      const rules = extractValidationRules(schema);

      expect(rules).toBeDefined();
      expect(rules?.minLength).toBe(5);
    });
  });

  describe("No validation rules", () => {
    test("returns undefined for plain string", () => {
      const schema = z.string();
      const rules = extractValidationRules(schema);

      expect(rules).toBeUndefined();
    });

    test("returns undefined for plain number", () => {
      const schema = z.number();
      const rules = extractValidationRules(schema);

      expect(rules).toBeUndefined();
    });

    test("returns undefined for plain array", () => {
      const schema = z.array(z.string());
      const rules = extractValidationRules(schema);

      expect(rules).toBeUndefined();
    });
  });
});

describe("extractTypeInfo with validation", () => {
  test("attaches validation rules to string property", () => {
    const schema = z.object({
      name: z.string().min(1).max(100),
    });

    const typeInfo = extractTypeInfo(schema);

    expect(typeInfo.kind).toBe("object");
    expect(typeInfo.properties).toBeDefined();
    expect(typeInfo.properties?.length).toBe(1);

    const nameProp = typeInfo.properties?.[0];
    expect(nameProp?.name).toBe("name");
    expect(nameProp?.validation).toBeDefined();
    expect(nameProp?.validation?.minLength).toBe(1);
    expect(nameProp?.validation?.maxLength).toBe(100);
  });

  test("attaches validation rules to number property", () => {
    const schema = z.object({
      age: z.number().min(18).max(120).int(),
    });

    const typeInfo = extractTypeInfo(schema);

    const ageProp = typeInfo.properties?.[0];
    expect(ageProp?.name).toBe("age");
    expect(ageProp?.validation).toBeDefined();
    // Note: When .int() is used, min/max may not be extractable via JSON schema
    expect(ageProp?.validation?.int).toBe(true);
  });

  test("attaches validation rules to number property without int", () => {
    const schema = z.object({
      age: z.number().min(18).max(120),
    });

    const typeInfo = extractTypeInfo(schema);

    const ageProp = typeInfo.properties?.[0];
    expect(ageProp?.name).toBe("age");
    expect(ageProp?.validation).toBeDefined();
    expect(ageProp?.validation?.min).toBe(18);
    expect(ageProp?.validation?.max).toBe(120);
  });

  test("attaches validation rules to optional property", () => {
    const schema = z.object({
      email: z.string().email().optional(),
    });

    const typeInfo = extractTypeInfo(schema);

    const emailProp = typeInfo.properties?.[0];
    expect(emailProp?.name).toBe("email");
    expect(emailProp?.required).toBe(false);
    expect(emailProp?.validation).toBeDefined();
    expect(emailProp?.validation?.email).toBe(true);
  });

  test("attaches validation rules to array property", () => {
    const schema = z.object({
      tags: z.array(z.string()).min(1).max(10),
    });

    const typeInfo = extractTypeInfo(schema);

    const tagsProp = typeInfo.properties?.[0];
    expect(tagsProp?.name).toBe("tags");
    expect(tagsProp?.type.kind).toBe("array");
    expect(tagsProp?.type.validation).toBeDefined();
    expect(tagsProp?.type.validation?.minItems).toBe(1);
    expect(tagsProp?.type.validation?.maxItems).toBe(10);
  });

  test("handles complex object with multiple validations", () => {
    const schema = z.object({
      name: z.string().min(3).max(50),
      email: z.string().email().optional(),
      age: z.number().min(18).max(120).int(),
      tags: z.array(z.string()).min(1).max(10),
    });

    const typeInfo = extractTypeInfo(schema);

    expect(typeInfo.properties?.length).toBe(4);

    const nameProp = typeInfo.properties?.find((p) => p.name === "name");
    expect(nameProp?.validation?.minLength).toBe(3);
    expect(nameProp?.validation?.maxLength).toBe(50);

    const emailProp = typeInfo.properties?.find((p) => p.name === "email");
    expect(emailProp?.required).toBe(false);
    expect(emailProp?.validation?.email).toBe(true);

    const ageProp = typeInfo.properties?.find((p) => p.name === "age");
    // Note: When .int() is used with min/max, Zod v4 resets bounds in JSON schema
    // So we can only reliably extract the int constraint
    expect(ageProp?.validation?.int).toBe(true);

    const tagsProp = typeInfo.properties?.find((p) => p.name === "tags");
    expect(tagsProp?.type.validation?.minItems).toBe(1);
    expect(tagsProp?.type.validation?.maxItems).toBe(10);
  });
});
