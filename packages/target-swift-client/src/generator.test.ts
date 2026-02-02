import { describe, expect, it } from "bun:test";
import type { ContractDefinition, TypeReference } from "@xrpckit/sdk";
import { swiftClientTarget } from "./generator";

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
      ],
      endpoints: [
        {
          name: "hello",
          type: "query",
          input: greetingInput,
          output: greetingOutput,
          fullName: "greeting.hello",
        },
      ],
    };

    const output = swiftClientTarget.generate({
      contract,
      outputDir: "out",
    });

    const typesFile = output.files.find((file) => file.path === "Types.swift");
    const clientFile = output.files.find((file) => file.path === "Client.swift");

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
      "public func hello(_ input: GreetingInput) async throws -> GreetingOutput",
    );
    expect(clientContent).toContain(
      "try await client.call(\"greeting.hello\", params: input)",
    );
  });
});
