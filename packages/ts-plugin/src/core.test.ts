import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import { resolveXrpcDefinitions } from "./core";

async function createFixture(
  files: Record<string, string>,
): Promise<{ rootDir: string; paths: Record<string, string> }> {
  const rootDir = await mkdtemp(join(tmpdir(), "xrpc-ts-plugin-"));
  const paths: Record<string, string> = {};

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(rootDir, relativePath);
    paths[relativePath] = absolutePath;
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf-8");
  }

  return { rootDir, paths };
}

function createProgram(rootNames: string[]): ts.Program {
  return ts.createProgram({
    rootNames,
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: false,
      skipLibCheck: true,
    },
  });
}

function getSpanText(
  program: ts.Program,
  definition: ts.DefinitionInfo,
): string {
  const sourceText =
    program.getSourceFile(definition.fileName)?.text ??
    readFileSync(definition.fileName, "utf-8");
  return sourceText.slice(
    definition.textSpan.start,
    definition.textSpan.start + definition.textSpan.length,
  );
}

describe("xrpc ts plugin resolver", () => {
  it("resolves api.group.method calls to contract endpoint definitions with explicit group()", async () => {
    const fixture = await createFixture({
      "src/contract.ts": `
        declare function createRouter(value: unknown): unknown;
        declare function group(name: string, value: unknown): unknown;
        declare function createEndpoint(value: unknown): unknown;
        declare function query(value: unknown): unknown;

        const taskDef = group("task", {
          list: query({ input: null, output: null }),
        });

        export const router = createRouter({ internalTask: taskDef });
      `,
      "src/xrpc/types.ts": `
        import { router } from "../contract";
        export type __xrpcEndpoint_task_list = typeof router.internalTask.list;
      `,
      "src/xrpc/client.ts": `
        import type { __xrpcEndpoint_task_list } from "./types";

        /** @xrpcEndpoint task.list */
        export async function taskList(config: unknown, input: unknown) {
          return { config, input };
        }

        export function createClient(config: unknown) {
          return {
            task: {
              list: (input: unknown) => taskList(config, input),
            },
          };
        }
      `,
      "src/app.ts": `
        import { createClient } from "./xrpc/client";

        const api = createClient({});
        api.task.list({});
      `,
    });

    try {
      const program = createProgram(Object.values(fixture.paths));
      const appPath = fixture.paths["src/app.ts"];
      const appSource = program.getSourceFile(appPath)!;
      const appText = appSource.text;
      const position = appText.lastIndexOf("list") + 1;

      const definitions = resolveXrpcDefinitions(
        ts,
        program,
        appSource,
        position,
      );

      expect(definitions).toBeDefined();
      expect(definitions?.length).toBe(1);
      expect(definitions?.[0].fileName.endsWith("src/contract.ts")).toBe(true);
      expect(getSpanText(program, definitions![0])).toBe("list");
    } finally {
      await rm(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it("resolves ts-server handler keys to contract endpoint definitions", async () => {
    const fixture = await createFixture({
      "src/contract.ts": `
        declare function createRouter(value: unknown): unknown;
        declare function query(value: unknown): unknown;

        export const router = createRouter({
          ping: query({ input: null, output: null }),
        });
      `,
      "src/xrpc/types.ts": `
        import { router } from "../contract";
        export type __xrpcEndpoint_ping = typeof router.ping;
      `,
      "src/xrpc/server.ts": `
        import type { __xrpcEndpoint_ping } from "./types";

        export interface Handlers {
          /** @xrpcEndpoint ping */
          "ping": (params: unknown) => unknown;
        }
      `,
      "src/server-app.ts": `
        import type { Handlers } from "./xrpc/server";

        const handlers: Handlers = {
          "ping": (_params) => null,
        };

        void handlers;
      `,
    });

    try {
      const program = createProgram(Object.values(fixture.paths));
      const appPath = fixture.paths["src/server-app.ts"];
      const appSource = program.getSourceFile(appPath)!;
      const appText = appSource.text;
      const position = appText.indexOf('"ping"') + 2;

      const definitions = resolveXrpcDefinitions(
        ts,
        program,
        appSource,
        position,
      );

      expect(definitions).toBeDefined();
      expect(definitions?.length).toBe(1);
      expect(definitions?.[0].fileName.endsWith("src/contract.ts")).toBe(true);
      expect(getSpanText(program, definitions![0])).toBe("ping");
    } finally {
      await rm(fixture.rootDir, { recursive: true, force: true });
    }
  });
});
