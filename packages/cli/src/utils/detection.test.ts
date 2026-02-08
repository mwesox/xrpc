import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import {
  detectApps,
  detectExistingContracts,
  detectProject,
} from "./detection";
import { generatePackageJsonTemplate, generateTomlTemplate } from "./templates";

const EXAMPLE_DIR = join(
  import.meta.dir,
  "../../../../examples/x-rpc-todo-app",
);

// =============================================================================
// DETECTION TESTS
// =============================================================================

describe("detection utilities", () => {
  test("detects turborepo monorepo with apps", async () => {
    const project = await detectProject(EXAMPLE_DIR);

    expect(project.monorepoType).toBe("turbo");
    expect(project.appsDir).toBe("apps");
    expect(project.packagesDir).toBe("packages");

    const apps = await detectApps(EXAMPLE_DIR, project);
    const appNames = apps.map((a) => a.name);

    expect(appNames).toContain("web");
    expect(appNames).toContain("go-backend");

    // Verify target suggestions
    const webApp = apps.find((a) => a.name === "web");
    const goApp = apps.find((a) => a.name === "go-backend");
    expect(webApp?.suggestedTarget).toBe("ts-client");
    expect(goApp?.suggestedTarget).toBe("go-server");
  });

  test("finds existing contract file", async () => {
    const contracts = await detectExistingContracts(EXAMPLE_DIR);

    expect(contracts.length).toBeGreaterThan(0);
    expect(contracts.some((c) => c.path.includes("contract.ts"))).toBe(true);
  });

  test("detects Spring Boot app and suggests kotlin-spring-boot-server", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "xrpc-spring-detect-"));

    try {
      await writeFile(
        join(tempRoot, "build.gradle.kts"),
        [
          "plugins {",
          '  id("org.springframework.boot") version "3.3.0"',
          '  id("io.spring.dependency-management") version "1.1.6"',
          '  kotlin("jvm") version "2.0.0"',
          "}",
        ].join("\n"),
      );

      const project = await detectProject(tempRoot);
      const apps = await detectApps(tempRoot, project);

      expect(apps.length).toBe(1);
      expect(apps[0]?.type).toBe("spring");
      expect(apps[0]?.isServer).toBe(true);
      expect(apps[0]?.suggestedTarget).toBe("kotlin-spring-boot-server");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// TEMPLATE TESTS
// =============================================================================

describe("template generation", () => {
  test("generates valid TOML config", () => {
    const toml = generateTomlTemplate({
      contractPath: "packages/api/src/contract.ts",
      targets: [
        { name: "go-server", outputPath: "apps/backend" },
        { name: "ts-client", outputPath: "apps/web" },
      ],
    });

    // Should parse without throwing
    const parsed = parseToml(toml);

    // New flat format: contract + target-name = output-path
    expect(parsed.contract).toBe("packages/api/src/contract.ts");
    expect(parsed["go-server"]).toBe("apps/backend");
    expect(parsed["ts-client"]).toBe("apps/web");
  });

  test("generates valid package.json", () => {
    const json = generatePackageJsonTemplate({ name: "@repo/api" });

    // Should parse without throwing
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe("@repo/api");
    expect(parsed.dependencies.xrpckit).toBeDefined();
    expect(parsed.dependencies.zod).toBeDefined();
  });
});
