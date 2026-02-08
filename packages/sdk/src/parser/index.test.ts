import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseContract } from "./index";

const tempDirs: string[] = [];

async function createContractFile(content: string): Promise<string> {
  const tmpRoot = join(process.cwd(), "tests", "fixtures");
  await mkdir(tmpRoot, { recursive: true });
  const dir = await mkdtemp(join(tmpRoot, "tmp-parser-"));
  tempDirs.push(dir);

  const contractPath = join(dir, "contract.ts");
  await writeFile(contractPath, content, "utf-8");

  return contractPath;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    await rm(dir, { recursive: true, force: true });
  }
});

describe("parseContract", () => {
  it("parses explicit group names, key mismatch, and flat endpoints", async () => {
    const contractPath = await createContractFile(`
      import { createRouter, group, query } from "xrpckit";

      const userGroup = group("user", {
        get: query({
          input: {} as any,
          output: {} as any,
        }),
      });

      export const router = createRouter({
        internalUser: userGroup,
        ping: query({
          input: {} as any,
          output: {} as any,
        }),
      });
    `);

    const contract = await parseContract(contractPath);
    expect(contract.endpoints.length).toBe(2);

    const userGet = contract.endpoints.find((e) => e.fullName === "user.get");
    expect(userGet).toBeDefined();
    expect(userGet?.groupName).toBe("user");
    expect(userGet?.sourcePath).toBe("internalUser.get");

    const ping = contract.endpoints.find((e) => e.fullName === "ping");
    expect(ping).toBeDefined();
    expect(ping?.groupName).toBeUndefined();
    expect(ping?.sourcePath).toBe("ping");

    expect(contract.routers[0]?.endpointGroups.length).toBe(1);
    expect(contract.routers[0]?.endpointGroups[0]?.name).toBe("user");
  });

  it("throws for duplicate explicit group names", async () => {
    const contractPath = await createContractFile(`
      import { createRouter, group, query } from "xrpckit";

      const first = group("task", {
        list: query({
          input: {} as any,
          output: {} as any,
        }),
      });

      const second = group("task", {
        get: query({
          input: {} as any,
          output: {} as any,
        }),
      });

      export const router = createRouter({
        first,
        second,
      });
    `);

    await expect(parseContract(contractPath)).rejects.toThrow(
      'Duplicate endpoint group name "task"',
    );
  });

  it("throws when a flat endpoint collides with a group name", async () => {
    const contractPath = await createContractFile(`
      import { createRouter, group, query } from "xrpckit";

      const taskGroup = group("task", {
        list: query({
          input: {} as any,
          output: {} as any,
        }),
      });

      export const router = createRouter({
        taskGroup,
        task: query({
          input: {} as any,
          output: {} as any,
        }),
      });
    `);

    await expect(parseContract(contractPath)).rejects.toThrow(
      'conflicts with an endpoint group named "task"',
    );
  });
});
