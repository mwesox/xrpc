import { describe, expect, it } from "bun:test";
import type { ContractDefinition, TypeReference } from "@xrpckit/sdk";
import { tsServerTarget } from "./generator";

describe("ts-server target", () => {
  it("generates server handler utilities and types", () => {
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

    const output = tsServerTarget.generate({
      contract,
      outputDir: "out",
      options: {
        contractPath: "src/contract.ts",
      },
    });

    const typesFile = output.files.find((file) => file.path === "types.ts");
    const serverFile = output.files.find((file) => file.path === "server.ts");

    expect(typesFile).toBeDefined();
    expect(serverFile).toBeDefined();

    const typesContent = typesFile?.content ?? "";
    expect(typesContent).toContain("greetingHelloInputSchema");
    expect(typesContent).toContain("export type GreetingHelloInput");
    expect(typesContent).toContain("export type GreetingHelloOutput");

    const serverContent = serverFile?.content ?? "";
    expect(serverContent).toContain("export interface Handlers");
    expect(serverContent).toContain('"greeting.hello"');
    expect(serverContent).toContain("createRpcHandler");
    expect(serverContent).toContain("createFetchHandler");
    expect(serverContent).toContain("schemaMap");
  });
});
