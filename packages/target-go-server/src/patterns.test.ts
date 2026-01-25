import { describe, expect, it } from "bun:test";
import {
  createGoBigIntPattern,
  createGoDatePattern,
  createGoEnumPattern,
  createGoTuplePattern,
  createGoUnionPattern,
} from "./patterns";

describe("Go patterns", () => {
  describe("createGoEnumPattern", () => {
    it("should generate valid Go enum code", () => {
      const utility = createGoEnumPattern("Status", [
        "active",
        "inactive",
        "pending",
      ]);

      expect(utility.id).toBe("enum_Status");
      expect(utility.code).toContain("type Status string");
      expect(utility.code).toContain("StatusActive");
      expect(utility.code).toContain("StatusInactive");
      expect(utility.code).toContain("StatusPending");
      expect(utility.code).toContain("func (e Status) IsValid() bool");
      expect(utility.code).toContain(
        "func ParseStatus(s string) (Status, error)",
      );
      expect(utility.includeOnce).toBe(true);
    });

    it("should filter out non-string values", () => {
      const utility = createGoEnumPattern("Mixed", ["a", 1, "b", 2] as any);

      expect(utility.code).toContain("MixedA");
      expect(utility.code).toContain("MixedB");
      expect(utility.code).not.toContain("Mixed1");
    });
  });

  describe("createGoTuplePattern", () => {
    it("should generate valid Go tuple struct", () => {
      const utility = createGoTuplePattern("Coordinate", [
        "float64",
        "float64",
      ]);

      expect(utility.id).toBe("tuple_Coordinate");
      expect(utility.code).toContain("type Coordinate struct");
      expect(utility.code).toContain("V0 float64");
      expect(utility.code).toContain("V1 float64");
      expect(utility.code).toContain("MarshalJSON");
      expect(utility.code).toContain("UnmarshalJSON");
      expect(utility.imports).toContain("encoding/json");
      expect(utility.imports).toContain("fmt");
    });

    it("should handle different element types", () => {
      const utility = createGoTuplePattern("Mixed", ["string", "int", "bool"]);

      expect(utility.code).toContain("V0 string");
      expect(utility.code).toContain("V1 int");
      expect(utility.code).toContain("V2 bool");
      expect(utility.code).toContain("expected 3 elements");
    });
  });

  describe("createGoUnionPattern", () => {
    it("should generate valid Go union wrapper", () => {
      const utility = createGoUnionPattern("Result", ["string", "int"]);

      expect(utility.id).toBe("union_Result");
      expect(utility.code).toContain("type Result struct");
      expect(utility.code).toContain("Value interface{}");
      expect(utility.code).toContain("AsString");
      expect(utility.code).toContain("AsInt");
      expect(utility.imports).toContain("encoding/json");
    });

    it("should handle pointer types", () => {
      const utility = createGoUnionPattern("Optional", ["*string", "*int"]);

      expect(utility.code).toContain("AsString");
      expect(utility.code).toContain("AsInt");
    });
  });

  describe("createGoBigIntPattern", () => {
    it("should generate BigInt wrapper code", () => {
      const utility = createGoBigIntPattern();

      expect(utility.id).toBe("bigint");
      expect(utility.code).toContain("type BigInt struct");
      expect(utility.code).toContain("*big.Int");
      expect(utility.code).toContain("MarshalJSON");
      expect(utility.code).toContain("UnmarshalJSON");
      expect(utility.imports).toContain("math/big");
      expect(utility.imports).toContain("fmt");
    });
  });

  describe("createGoDatePattern", () => {
    it("should generate DateTime wrapper code", () => {
      const utility = createGoDatePattern();

      expect(utility.id).toBe("datetime");
      expect(utility.code).toContain("type DateTime struct");
      expect(utility.code).toContain("time.Time");
      expect(utility.code).toContain("dateTimeFormats");
      expect(utility.code).toContain("RFC3339");
      expect(utility.imports).toContain("time");
      expect(utility.imports).toContain("encoding/json");
    });
  });
});
