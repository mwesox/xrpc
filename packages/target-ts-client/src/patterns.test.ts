import { describe, expect, it } from "bun:test";
import {
  createTsBrandedType,
  createTsEnumPattern,
  createTsRecordPattern,
  createTsTuplePattern,
  createTsUnionPattern,
} from "./patterns";

describe("TypeScript patterns", () => {
  describe("createTsEnumPattern", () => {
    it("should generate valid TypeScript enum code for string values", () => {
      const utility = createTsEnumPattern("Status", [
        "active",
        "inactive",
        "pending",
      ]);

      expect(utility.id).toBe("enum_Status");
      expect(utility.code).toContain("export const Status");
      expect(utility.code).toContain('Active: "active"');
      expect(utility.code).toContain('Inactive: "inactive"');
      expect(utility.code).toContain('Pending: "pending"');
      expect(utility.code).toContain("as const");
      expect(utility.code).toContain("export type Status");
      expect(utility.code).toContain("export function isStatus");
      expect(utility.includeOnce).toBe(true);
    });

    it("should generate TypeScript enum for numeric values", () => {
      const utility = createTsEnumPattern("Priority", [1, 2, 3]);

      expect(utility.code).toContain("export enum Priority");
      expect(utility.code).toContain("Value0 = 1");
      expect(utility.code).toContain("Value1 = 2");
      expect(utility.code).toContain("Value2 = 3");
    });

    it("should generate union type for mixed values", () => {
      const utility = createTsEnumPattern("Mixed", ["a", 1, "b", 2]);

      expect(utility.code).toContain("export type Mixed");
      expect(utility.code).toContain("MixedValues");
    });
  });

  describe("createTsTuplePattern", () => {
    it("should generate valid TypeScript tuple type", () => {
      const utility = createTsTuplePattern("Coordinate", ["number", "number"]);

      expect(utility.id).toBe("tuple_Coordinate");
      expect(utility.code).toContain(
        "export type Coordinate = [number, number]",
      );
      expect(utility.code).toContain("export function createCoordinate");
      expect(utility.code).toContain("export function isCoordinate");
      expect(utility.code).toContain("value.length === 2");
    });

    it("should handle different element types", () => {
      const utility = createTsTuplePattern("Triple", [
        "string",
        "number",
        "boolean",
      ]);

      expect(utility.code).toContain("[string, number, boolean]");
      expect(utility.code).toContain("v0: string, v1: number, v2: boolean");
    });
  });

  describe("createTsUnionPattern", () => {
    it("should generate valid TypeScript discriminated union", () => {
      const utility = createTsUnionPattern("Result", [
        { type: "success", valueType: "Data" },
        { type: "error", valueType: "Error" },
      ]);

      expect(utility.id).toBe("union_Result");
      expect(utility.code).toContain("export interface ResultSuccess");
      expect(utility.code).toContain("export interface ResultError");
      expect(utility.code).toContain('type: "success"');
      expect(utility.code).toContain('type: "error"');
      expect(utility.code).toContain(
        "export type Result = ResultSuccess | ResultError",
      );
      expect(utility.code).toContain("isResultSuccess");
      expect(utility.code).toContain("isResultError");
    });
  });

  describe("createTsBrandedType", () => {
    it("should generate branded type without validator", () => {
      const utility = createTsBrandedType("UserId", "string");

      expect(utility.id).toBe("branded_UserId");
      expect(utility.code).toContain("unique symbol");
      expect(utility.code).toContain("export type UserId = string");
      expect(utility.code).toContain("export function createUserId");
    });

    it("should generate branded type with validator", () => {
      const utility = createTsBrandedType(
        "Email",
        "string",
        'value.includes("@")',
      );

      expect(utility.code).toContain("export function isEmail");
      expect(utility.code).toContain('value.includes("@")');
      expect(utility.code).toContain("if (!isEmail(value))");
    });
  });

  describe("createTsRecordPattern", () => {
    it("should generate record type with helpers", () => {
      const utility = createTsRecordPattern("StringMap", "string", "string");

      expect(utility.id).toBe("record_StringMap");
      expect(utility.code).toContain(
        "export type StringMap = Record<string, string>",
      );
      expect(utility.code).toContain("export function createStringMap");
      expect(utility.code).toContain("export function isStringMap");
    });
  });
});
