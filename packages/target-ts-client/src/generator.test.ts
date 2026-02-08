import { describe, expect, it } from "bun:test";
import type { ContractDefinition, TypeReference } from "@xrpckit/sdk";
import { tsClientTarget } from "./generator";

describe("ts-client target", () => {
  it("generates client helpers for grouped and flat endpoints", () => {
    const greetingInput: TypeReference = {
      kind: "object",
      name: "GreetingInput",
      properties: [
        {
          name: "name",
          required: true,
          type: { kind: "primitive", baseType: "string" },
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
          sourcePath: "internalGreeting.hello",
        },
        {
          name: "ping",
          type: "query",
          input: pingInput,
          output: pingOutput,
          fullName: "ping",
          sourcePath: "ping",
        },
      ],
    };

    const output = tsClientTarget.generate({
      contract,
      outputDir: "out",
      options: {
        contractPath: "src/contract.ts",
      },
    });

    const typesFile = output.files.find((file) => file.path === "types.ts");
    const clientFile = output.files.find((file) => file.path === "client.ts");

    expect(typesFile).toBeDefined();
    expect(clientFile).toBeDefined();

    const typesContent = typesFile?.content ?? "";
    expect(typesContent).toContain("router.internalGreeting.hello");
    expect(typesContent).toContain("router.ping");

    const clientContent = clientFile?.content ?? "";
    expect(clientContent).toContain("createClient");
    expect(clientContent).toContain("/** @xrpcEndpoint greeting.hello */");
    expect(clientContent).toContain("/** @xrpcEndpoint ping */");
    expect(clientContent).toContain("export async function greetingHello");
    expect(clientContent).toContain("export async function ping");
    expect(clientContent).toContain("ping: (input: PingInput");
    expect(clientContent).toContain("greeting: {");
  });
});
