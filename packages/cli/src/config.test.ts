import { describe, expect, test } from "bun:test";
import {
  type ModuleConfig,
  type XrpcConfig,
  extractModules,
  extractTargets,
  isMultiModule,
} from "./config";

describe("config", () => {
  describe("extractTargets", () => {
    test("extracts string values as targets", () => {
      const config: XrpcConfig = {
        contract: "./contract.ts",
        "go-server": "./backend",
        "ts-client": "./frontend",
      };

      const targets = extractTargets(config);
      expect(targets).toEqual({
        "go-server": "./backend",
        "ts-client": "./frontend",
      });
    });

    test("skips reserved keys", () => {
      const config: XrpcConfig = {
        contract: "./contract.ts",
        "go-server": "./backend",
      };

      const targets = extractTargets(config);
      expect(targets).toEqual({ "go-server": "./backend" });
      expect(targets).not.toHaveProperty("contract");
    });

    test("works with module config", () => {
      const moduleConfig: ModuleConfig = {
        contract: "./users/contract.ts",
        "go-server": "./backend/users",
        "ts-client": "./frontend/users",
      };

      const targets = extractTargets(moduleConfig);
      expect(targets).toEqual({
        "go-server": "./backend/users",
        "ts-client": "./frontend/users",
      });
    });
  });

  describe("isMultiModule", () => {
    test("returns false for single-contract config", () => {
      const config: XrpcConfig = {
        contract: "./contract.ts",
        "go-server": "./backend",
      };

      expect(isMultiModule(config)).toBe(false);
    });

    test("returns true for multi-module config", () => {
      const config: XrpcConfig = {
        users: {
          contract: "./users/contract.ts",
          "go-server": "./backend/users",
        },
        orders: {
          contract: "./orders/contract.ts",
          "go-server": "./backend/orders",
        },
      };

      expect(isMultiModule(config)).toBe(true);
    });

    test("returns false for empty config", () => {
      const config: XrpcConfig = {};
      expect(isMultiModule(config)).toBe(false);
    });

    test("returns false when contract is present even with objects", () => {
      // This is a weird edge case, but contract takes precedence
      const config: XrpcConfig = {
        contract: "./contract.ts",
        users: {
          contract: "./users/contract.ts",
        },
      };

      expect(isMultiModule(config)).toBe(false);
    });
  });

  describe("extractModules", () => {
    test("wraps single-contract config in default module", () => {
      const config: XrpcConfig = {
        contract: "./contract.ts",
        "go-server": "./backend",
        "ts-client": "./frontend",
      };

      const modules = extractModules(config);
      expect(Object.keys(modules)).toEqual(["default"]);
      expect(modules.default).toEqual({
        contract: "./contract.ts",
        "go-server": "./backend",
        "ts-client": "./frontend",
      });
    });

    test("extracts multi-module config", () => {
      const config: XrpcConfig = {
        users: {
          contract: "./users/contract.ts",
          "go-server": "./backend/users",
        },
        orders: {
          contract: "./orders/contract.ts",
          "go-server": "./backend/orders",
          "ts-client": "./frontend/orders",
        },
      };

      const modules = extractModules(config);
      expect(Object.keys(modules).sort()).toEqual(["orders", "users"]);
      expect(modules.users).toEqual({
        contract: "./users/contract.ts",
        "go-server": "./backend/users",
      });
      expect(modules.orders).toEqual({
        contract: "./orders/contract.ts",
        "go-server": "./backend/orders",
        "ts-client": "./frontend/orders",
      });
    });

    test("skips modules without contract field", () => {
      // Intentionally malformed config to test runtime validation
      // (TOML parsing can produce objects missing required fields)
      const config = {
        users: {
          contract: "./users/contract.ts",
          "go-server": "./backend/users",
        },
        invalid: {
          "go-server": "./backend/invalid",
        },
      } as unknown as XrpcConfig;

      const modules = extractModules(config);
      expect(Object.keys(modules)).toEqual(["users"]);
    });
  });
});
