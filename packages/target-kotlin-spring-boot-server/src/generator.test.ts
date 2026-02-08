import { describe, expect, it } from "bun:test";
import type { ContractDefinition } from "@xrpckit/sdk";
import { kotlinSpringBootServerTarget } from "./generator";

function getFileContent(
  files: Array<{ path: string; content: string }>,
  path: string,
): string {
  return files.find((file) => file.path === path)?.content ?? "";
}

describe("kotlin-spring-boot-server target", () => {
  it("generates Spring Boot Kotlin server files", () => {
    const contract: ContractDefinition = {
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
                validation: { minLength: 1, maxLength: 100 },
              },
              {
                name: "email",
                required: false,
                type: {
                  kind: "optional",
                  baseType: { kind: "primitive", baseType: "string" },
                },
                validation: { email: true },
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
    };

    const output = kotlinSpringBootServerTarget.generate({
      contract,
      outputDir: "out",
    });

    expect(output.files).toHaveLength(6);

    const types = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/types/GeneratedTypes.kt",
    );
    const handlers = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/server/Handlers.kt",
    );
    const dispatcher = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/server/XrpcDispatcher.kt",
    );
    const controller = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/server/XrpcController.kt",
    );
    const models = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/model/RpcModels.kt",
    );

    expect(types).toContain("package xrpc.generated.rpc.types");
    expect(types).toContain("data class GreetingInput(");
    expect(types).toContain("@field:Size(min = 1, max = 100)");
    expect(types).toContain("@field:Email");

    expect(handlers).toContain("interface Handlers");
    expect(handlers).toContain(
      "fun greetingHello(params: GreetingInput): GreetingOutput",
    );

    expect(dispatcher).toContain("class XrpcDispatcher(");
    expect(dispatcher).toContain(
      '"greeting.hello" -> handleGreetingHello(request)',
    );
    expect(dispatcher).toContain(
      "private inline fun <reified T> convertParams",
    );

    expect(controller).toContain("@RestController");
    expect(controller).toContain('@RequestMapping("${xrpc.path:/rpc}")');

    expect(models).toContain("enum class RpcErrorCode");
    expect(models).toContain("data class RpcRequest(");
  });

  it("sanitizes Kotlin identifiers for keywords", () => {
    const contract: ContractDefinition = {
      routers: [],
      types: [],
      endpoints: [
        {
          name: "when",
          type: "query",
          fullName: "class.when",
          input: {
            kind: "object",
            name: "Input",
            properties: [
              {
                name: "class",
                required: true,
                type: { kind: "primitive", baseType: "string" },
              },
            ],
          },
          output: {
            kind: "object",
            name: "Output",
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

    const output = kotlinSpringBootServerTarget.generate({
      contract,
      outputDir: "out",
    });

    const handlers = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/server/Handlers.kt",
    );
    const types = getFileContent(
      output.files,
      "src/main/kotlin/xrpc/generated/rpc/types/GeneratedTypes.kt",
    );

    expect(handlers).toContain("fun class_When(");
    expect(types).toContain("val class_: String");
  });
});
