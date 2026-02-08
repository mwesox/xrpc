import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function indexToLineOffset(
  text: string,
  index: number,
): {
  line: number;
  offset: number;
} {
  let line = 1;
  let offset = 1;

  for (let i = 0; i < index; i++) {
    if (text[i] === "\n") {
      line += 1;
      offset = 1;
    } else {
      offset += 1;
    }
  }

  return { line, offset };
}

function lineOffsetToIndex(text: string, line: number, offset: number): number {
  let currentLine = 1;
  let index = 0;

  while (currentLine < line && index < text.length) {
    if (text[index] === "\n") {
      currentLine += 1;
    }
    index += 1;
  }

  return index + offset - 1;
}

interface PendingRequest {
  resolve: (message: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  command: string;
}

class TSServerClient {
  private process: ChildProcessWithoutNullStreams;
  private pending = new Map<number, PendingRequest>();
  private seq = 0;
  private stdoutBuffer = Buffer.alloc(0);
  private stderrText = "";

  constructor(tsserverPath: string, cwd: string) {
    const nodePath = Bun.which("node");
    if (!nodePath) {
      throw new Error("node executable not found in PATH");
    }

    this.process = spawn(
      nodePath,
      [
        tsserverPath,
        "--disableAutomaticTypingAcquisition",
        "--allowLocalPluginLoads",
      ],
      {
        cwd,
        stdio: "pipe",
      },
    );

    this.process.stdout.on("data", (chunk: Buffer) => {
      try {
        this.consumeStdoutChunk(chunk);
      } catch (error) {
        this.failAll(
          error instanceof Error
            ? error
            : new Error(`Failed to parse tsserver stdout: ${String(error)}`),
        );
      }
    });

    this.process.stderr.on("data", (chunk: Buffer) => {
      this.stderrText += chunk.toString("utf8");
    });

    this.process.on("error", (error) => {
      this.failAll(
        new Error(
          `tsserver process error: ${error.message}. stderr: ${this.stderrText}`,
        ),
      );
    });

    this.process.on("exit", () => {
      this.failAll(
        new Error(`tsserver exited unexpectedly. stderr: ${this.stderrText}`),
      );
    });
  }

  async request(command: string, args: Record<string, unknown>): Promise<any> {
    const seq = ++this.seq;
    const body = JSON.stringify({
      seq,
      type: "request",
      command,
      arguments: args,
    });

    const result = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(
          new Error(
            `Timed out waiting for tsserver response to ${command}. stderr: ${this.stderrText}`,
          ),
        );
      }, 15_000);

      this.pending.set(seq, {
        resolve,
        reject,
        timer,
        command,
      });
    });

    await this.writeRaw(body);
    return result;
  }

  async notify(command: string, args: Record<string, unknown>): Promise<void> {
    const seq = ++this.seq;
    const body = JSON.stringify({
      seq,
      type: "request",
      command,
      arguments: args,
    });

    await this.writeRaw(body);
  }

  async stop(): Promise<void> {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("tsserver client stopped"));
    }
    this.pending.clear();

    if (!this.process.killed) {
      this.process.kill();
    }

    await Promise.race([
      new Promise<void>((resolve) => {
        this.process.once("exit", () => resolve());
      }),
      sleep(2_000),
    ]);
  }

  private async writeRaw(body: string): Promise<void> {
    const message = `${body}\n`;

    await new Promise<void>((resolve, reject) => {
      this.process.stdin.write(message, "utf8", (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private consumeStdoutChunk(chunk: Buffer): void {
    this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk]);

    while (true) {
      const headerEnd = this.stdoutBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        break;
      }

      const header = this.stdoutBuffer.slice(0, headerEnd).toString("utf8");
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
      if (!lengthMatch) {
        throw new Error(`Malformed tsserver message header: ${header}`);
      }

      const contentLength = Number.parseInt(lengthMatch[1], 10);
      const payloadStart = headerEnd + 4;
      const payloadEnd = payloadStart + contentLength;

      if (this.stdoutBuffer.length < payloadEnd) {
        break;
      }

      const payload = this.stdoutBuffer
        .slice(payloadStart, payloadEnd)
        .toString("utf8");
      this.stdoutBuffer = this.stdoutBuffer.slice(payloadEnd);

      const message = JSON.parse(payload);
      this.handleMessage(message);
    }
  }

  private handleMessage(message: any): void {
    if (message.type !== "response") {
      return;
    }

    const pending = this.pending.get(message.request_seq);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(message.request_seq);

    if (message.success) {
      pending.resolve(message);
      return;
    }

    pending.reject(
      new Error(
        `tsserver ${pending.command} failed: ${message.message ?? "unknown error"}. stderr: ${this.stderrText}`,
      ),
    );
  }

  private failAll(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function ensurePluginBuild(): Promise<string> {
  const entry = join(process.cwd(), "packages/ts-plugin/dist/index.js");

  const build = Bun.spawn([
    "bun",
    "run",
    "--filter=./packages/ts-plugin",
    "build",
  ]);
  await build.exited;

  if (build.exitCode !== 0 || !existsSync(entry)) {
    throw new Error("Failed to build @xrpckit/ts-plugin for tsserver E2E test");
  }

  return entry;
}

describe("xrpc ts plugin tsserver e2e", () => {
  let fixtureRoot = "";
  let contractPath = "";
  let appPath = "";
  let serverAppPath = "";
  let contractText = "";
  let appText = "";
  let serverAppText = "";

  beforeAll(async () => {
    const pluginEntry = await ensurePluginBuild();

    fixtureRoot = await mkdtemp(join(process.cwd(), "tmp/tsserver-e2e-"));

    contractPath = join(fixtureRoot, "src/contract.ts");
    appPath = join(fixtureRoot, "src/app.ts");
    serverAppPath = join(fixtureRoot, "src/server-app.ts");

    contractText = `
import { group, createRouter, query } from "xrpckit";

const taskDef = group("task", {
  list: query({
    input: null as any,
    output: null as any,
  }),
});

export const router = createRouter({ internalTask: taskDef });
`;

    const typesText = `
import { router } from "../contract";

export type __xrpcTaskListInput = typeof router.internalTask.list;
`;

    const clientText = `
import type { __xrpcTaskListInput } from "./types";

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
`;

    const serverText = `
import type { __xrpcTaskListInput } from "./types";

export interface Handlers {
  /** @xrpcEndpoint task.list */
  "task.list": (params: unknown) => unknown;
}
`;

    appText = `
import { createClient } from "./xrpc/client";

const api = createClient({});
api.task.list({ limit: 10 });
`;

    serverAppText = `
import type { Handlers } from "./xrpc/server";

const handlers: Handlers = {
  "task.list": (_params) => null,
};

void handlers;
`;

    const tsconfigText = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: false,
          noEmit: true,
          plugins: [{ name: "@xrpckit/ts-plugin" }],
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    );

    const pluginPackageRoot = join(
      fixtureRoot,
      "node_modules/@xrpckit/ts-plugin",
    );
    await mkdir(join(pluginPackageRoot, "dist"), { recursive: true });
    await copyFile(pluginEntry, join(pluginPackageRoot, "dist/index.js"));
    await writeFile(
      join(pluginPackageRoot, "package.json"),
      JSON.stringify(
        {
          name: "@xrpckit/ts-plugin",
          version: "0.0.0-test",
          main: "dist/index.js",
        },
        null,
        2,
      ),
      "utf-8",
    );

    await mkdir(join(fixtureRoot, "src/xrpc"), { recursive: true });
    await writeFile(contractPath, contractText, "utf-8");
    await writeFile(join(fixtureRoot, "src/xrpc/types.ts"), typesText, "utf-8");
    await writeFile(
      join(fixtureRoot, "src/xrpc/client.ts"),
      clientText,
      "utf-8",
    );
    await writeFile(
      join(fixtureRoot, "src/xrpc/server.ts"),
      serverText,
      "utf-8",
    );
    await writeFile(appPath, appText, "utf-8");
    await writeFile(serverAppPath, serverAppText, "utf-8");
    await writeFile(join(fixtureRoot, "tsconfig.json"), tsconfigText, "utf-8");
  });

  afterAll(async () => {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("resolves definition requests to contract endpoints", async () => {
    const tsserverPath = require.resolve("typescript/lib/tsserver.js");
    const client = new TSServerClient(tsserverPath, fixtureRoot);

    try {
      await client.notify("open", { file: appPath });
      await client.notify("open", { file: serverAppPath });
      await sleep(200);

      await client.request("projectInfo", {
        file: appPath,
        needFileNameList: false,
      });

      const callIndex = appText.indexOf("list(");
      expect(callIndex).toBeGreaterThan(0);
      const callPosition = indexToLineOffset(appText, callIndex + 1);

      const callDefinition = await client.request("definition", {
        file: appPath,
        line: callPosition.line,
        offset: callPosition.offset,
      });

      const callBody = callDefinition.body as Array<any>;
      expect(Array.isArray(callBody)).toBe(true);
      expect(callBody.length).toBeGreaterThan(0);

      const contractCallSpan = callBody.find(
        (span) => span.file === contractPath,
      );
      expect(contractCallSpan).toBeDefined();

      const callStart = lineOffsetToIndex(
        contractText,
        contractCallSpan.start.line,
        contractCallSpan.start.offset,
      );
      const callEnd = lineOffsetToIndex(
        contractText,
        contractCallSpan.end.line,
        contractCallSpan.end.offset,
      );
      expect(contractText.slice(callStart, callEnd)).toBe("list");

      const keyIndex = serverAppText.indexOf('"task.list"');
      expect(keyIndex).toBeGreaterThan(0);
      const keyPosition = indexToLineOffset(serverAppText, keyIndex + 2);

      const keyDefinition = await client.request("definition", {
        file: serverAppPath,
        line: keyPosition.line,
        offset: keyPosition.offset,
      });

      const keyBody = keyDefinition.body as Array<any>;
      expect(Array.isArray(keyBody)).toBe(true);
      expect(keyBody.length).toBeGreaterThan(0);

      const contractKeySpan = keyBody.find(
        (span) => span.file === contractPath,
      );
      expect(contractKeySpan).toBeDefined();

      const keyStart = lineOffsetToIndex(
        contractText,
        contractKeySpan.start.line,
        contractKeySpan.start.offset,
      );
      const keyEnd = lineOffsetToIndex(
        contractText,
        contractKeySpan.end.line,
        contractKeySpan.end.offset,
      );
      expect(contractText.slice(keyStart, keyEnd)).toBe("list");
    } finally {
      await client.stop();
    }
  }, 30_000);
});
