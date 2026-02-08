import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { ContractDefinition, TypeReference } from "@xrpckit/sdk";
import { goTarget } from "../../target-go-server/src/generator";
import { swiftClientTarget } from "./generator";

function getGeneratedFile(
  output: ReturnType<typeof swiftClientTarget.generate>,
  path: string,
) {
  return output.files.find((file) => file.path === path);
}

function canTypecheckSwift(): boolean {
  const result = Bun.spawnSync(["swiftc", "--version"]);
  return result.exitCode === 0;
}

function assertCompilesWithSwiftc(
  output: ReturnType<typeof swiftClientTarget.generate>,
): void {
  if (!canTypecheckSwift()) {
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "xrpc-swift-test-"));
  try {
    for (const file of output.files) {
      writeFileSync(join(tempDir, file.path), file.content, "utf8");
    }

    const typecheck = Bun.spawnSync([
      "swiftc",
      "-typecheck",
      join(tempDir, "Types.swift"),
      join(tempDir, "Client.swift"),
    ]);

    if (typecheck.exitCode !== 0) {
      const stderr = Buffer.from(typecheck.stderr).toString("utf8");
      const stdout = Buffer.from(typecheck.stdout).toString("utf8");
      throw new Error(
        `swiftc -typecheck failed.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      );
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function toFileMap(output: {
  files: Array<{ path: string; content: string }>;
}): Record<string, string> {
  return Object.fromEntries(
    output.files.map((file) => [file.path, file.content]),
  );
}

describe("swift-client target", () => {
  it("generates Swift types and client with expected shapes", () => {
    const greetingInput: TypeReference = {
      kind: "object",
      name: "GreetingInput",
      properties: [
        {
          name: "name",
          required: true,
          type: { kind: "primitive", baseType: "string" },
        },
        {
          name: "tag",
          required: false,
          type: {
            kind: "optional",
            baseType: { kind: "primitive", baseType: "string" },
          },
        },
        {
          name: "scores",
          required: true,
          type: {
            kind: "array",
            elementType: { kind: "primitive", baseType: "number" },
          },
        },
      ],
    };

    const greetingOutput: TypeReference = {
      kind: "object",
      name: "GreetingOutput",
      properties: [
        {
          name: "message",
          required: true,
          type: { kind: "primitive", baseType: "string" },
        },
      ],
    };

    const pingInput: TypeReference = {
      kind: "object",
      name: "PingInput",
      properties: [],
    };

    const pingOutput: TypeReference = {
      kind: "object",
      name: "PingOutput",
      properties: [
        {
          name: "ok",
          required: true,
          type: { kind: "primitive", baseType: "boolean" },
        },
      ],
    };

    const contract: ContractDefinition = {
      routers: [],
      types: [
        {
          name: "GreetingInput",
          kind: "object",
          properties: greetingInput.properties,
        },
        {
          name: "GreetingOutput",
          kind: "object",
          properties: greetingOutput.properties,
        },
        {
          name: "PingInput",
          kind: "object",
          properties: pingInput.properties,
        },
        {
          name: "PingOutput",
          kind: "object",
          properties: pingOutput.properties,
        },
      ],
      endpoints: [
        {
          name: "hello",
          type: "query",
          input: greetingInput,
          output: greetingOutput,
          fullName: "greeting.hello",
          groupName: "greeting",
        },
        {
          name: "ping",
          type: "query",
          input: pingInput,
          output: pingOutput,
          fullName: "ping",
        },
      ],
    };

    const output = swiftClientTarget.generate({
      contract,
      outputDir: "out",
    });

    const typesFile = getGeneratedFile(output, "Types.swift");
    const clientFile = getGeneratedFile(output, "Client.swift");

    expect(typesFile).toBeDefined();
    expect(clientFile).toBeDefined();

    const typesContent = typesFile?.content ?? "";
    expect(typesContent).toContain("public struct GreetingInput");
    expect(typesContent).toContain("public let name: String");
    expect(typesContent).toContain("public let tag: String?");
    expect(typesContent).toContain("public let scores: [Double]");
    expect(typesContent).toContain(
      "public init(name: String, tag: String? = nil, scores: [Double])",
    );

    const clientContent = clientFile?.content ?? "";
    expect(clientContent).toContain("public struct ApiClient");
    expect(clientContent).toContain(
      "public func ping(_ input: PingInput) async throws -> PingOutput",
    );
    expect(clientContent).toContain('try await client.call("ping", params: input)');
    expect(clientContent).toContain(
      "public func hello(_ input: GreetingInput) async throws -> GreetingOutput",
    );
    expect(clientContent).toContain(
      'try await client.call("greeting.hello", params: input)',
    );
  });

  it("does not mutate contract when discovering inline object names", () => {
    const contract: ContractDefinition = {
      routers: [],
      types: [],
      endpoints: [
        {
          name: "list",
          type: "query",
          fullName: "task.list",
          input: {
            kind: "object",
            name: "ListInput",
            properties: [
              {
                name: "items",
                required: true,
                type: {
                  kind: "array",
                  elementType: {
                    kind: "object",
                    properties: [
                      {
                        name: "id",
                        required: true,
                        type: { kind: "primitive", baseType: "string" },
                      },
                    ],
                  },
                },
              },
            ],
          },
          output: {
            kind: "object",
            name: "ListOutput",
            properties: [],
          },
        },
      ],
    };

    const before = JSON.stringify(contract);
    const output = swiftClientTarget.generate({ contract, outputDir: "out" });
    const after = JSON.stringify(contract);

    expect(after).toBe(before);
    const typesContent = getGeneratedFile(output, "Types.swift")?.content ?? "";
    expect(typesContent).toContain("public struct ListInputItemsItem");
    expect(typesContent).toContain("public let items: [ListInputItemsItem]");
  });

  it("sanitizes Swift identifiers and generated code typechecks", () => {
    const contract: ContractDefinition = {
      routers: [],
      types: [],
      endpoints: [
        {
          name: "class",
          type: "query",
          fullName: "class.class",
          input: {
            kind: "object",
            name: "In",
            properties: [
              {
                name: "value",
                required: true,
                type: {
                  kind: "enum",
                  name: "Mixed",
                  enumValues: ["a", 1],
                },
              },
            ],
          },
          output: {
            kind: "object",
            name: "Out",
            properties: [
              {
                name: "ok",
                required: true,
                type: { kind: "primitive", baseType: "boolean" },
              },
            ],
          },
        },
      ],
    };

    const output = swiftClientTarget.generate({ contract, outputDir: "out" });
    const clientContent =
      getGeneratedFile(output, "Client.swift")?.content ?? "";

    expect(clientContent).toContain("public var class_: ClassClient");
    expect(clientContent).toContain(
      "public func class_(_ input: In) async throws -> Out",
    );
    assertCompilesWithSwiftc(output);
  });

  it("runs automated verification loop across regression contracts", () => {
    const contracts: ContractDefinition[] = [
      {
        routers: [],
        types: [],
        endpoints: [
          {
            name: "hello",
            type: "query",
            fullName: "greeting.hello",
            input: {
              kind: "object",
              name: "GreetingInput",
              properties: [
                {
                  name: "name",
                  required: true,
                  type: { kind: "primitive", baseType: "string" },
                },
              ],
            },
            output: {
              kind: "object",
              name: "GreetingOutput",
              properties: [
                {
                  name: "message",
                  required: true,
                  type: { kind: "primitive", baseType: "string" },
                },
              ],
            },
          },
        ],
      },
      {
        routers: [],
        types: [],
        endpoints: [
          {
            name: "class",
            type: "query",
            fullName: "class.class",
            input: {
              kind: "object",
              name: "In",
              properties: [
                {
                  name: "value",
                  required: true,
                  type: {
                    kind: "enum",
                    name: "Mixed",
                    enumValues: ["a", 1],
                  },
                },
              ],
            },
            output: {
              kind: "object",
              name: "Out",
              properties: [
                {
                  name: "ok",
                  required: true,
                  type: { kind: "primitive", baseType: "boolean" },
                },
              ],
            },
          },
        ],
      },
      {
        routers: [],
        types: [],
        endpoints: [
          {
            name: "list",
            type: "query",
            fullName: "task.list",
            input: {
              kind: "object",
              name: "ListInput",
              properties: [
                {
                  name: "items",
                  required: true,
                  type: {
                    kind: "array",
                    elementType: {
                      kind: "object",
                      properties: [
                        {
                          name: "id",
                          required: true,
                          type: { kind: "primitive", baseType: "string" },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            output: {
              kind: "object",
              name: "ListOutput",
              properties: [
                {
                  name: "total",
                  required: true,
                  type: { kind: "primitive", baseType: "number" },
                },
              ],
            },
          },
        ],
      },
    ];

    for (const contract of contracts) {
      const beforeContract = JSON.stringify(contract);
      const goBefore = goTarget.generate({ contract, outputDir: "out" });
      const swiftOutput = swiftClientTarget.generate({
        contract,
        outputDir: "out",
      });
      const goAfter = goTarget.generate({ contract, outputDir: "out" });

      assertCompilesWithSwiftc(swiftOutput);

      expect(JSON.stringify(contract)).toBe(beforeContract);
      expect(toFileMap(goAfter)).toEqual(toFileMap(goBefore));
    }
  });
});
