import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { initCommand, type InitOptions } from './init';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';

// Helper to create mock prompt and spinner
function createMocks(selectResponses: (string | string[])[]) {
  let selectIndex = 0;

  const mockPrompt = async (_message: string, options?: { default?: string }): Promise<string> => {
    return options?.default || 'Y';
  };

  mockPrompt.select = async (
    _message: string,
    _options: { options: string[]; multiple?: boolean }
  ): Promise<string | string[]> => {
    return selectResponses[selectIndex++] || [];
  };

  const mockSpinner = (_message: string) => ({
    start: () => {},
    succeed: (_msg?: string) => {},
    fail: (_msg?: string) => {},
  });

  return { mockPrompt, mockSpinner };
}

describe('init command', () => {
  const testDir = join(import.meta.dir, `../../../.test-init-${Date.now()}`);

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  test('creates xrpc.toml in empty project', async () => {
    // Setup: Create minimal project structure
    await mkdir(testDir, { recursive: true });
    await Bun.write(join(testDir, 'package.json'), '{"name": "test"}');

    // Mock prompts - simulate user accepting defaults
    const promptResponses: string[] = [];
    let promptIndex = 0;

    const mockPrompt = async (message: string, options?: { default?: string }): Promise<string> => {
      // Return default values or 'Y' for confirmations
      const response = promptResponses[promptIndex++];
      if (response !== undefined) {
        return response;
      }
      // Return default if available, otherwise 'Y'
      return options?.default || 'Y';
    };

    mockPrompt.select = async (
      _message: string,
      _options: { options: string[]; multiple?: boolean }
    ): Promise<string | string[]> => {
      return ['go-server'];
    };

    const mockSpinner = (_message: string) => ({
      start: () => {},
      succeed: (_msg?: string) => {},
      fail: (_msg?: string) => {},
    });

    // Suppress console output during test
    const originalLog = console.log;
    console.log = () => {};

    // Change to test directory and run
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      await initCommand({ prompt: mockPrompt, spinner: mockSpinner } as InitOptions);
    } finally {
      process.chdir(originalCwd);
      console.log = originalLog;
    }

    // Verify xrpc.toml was created
    const tomlPath = join(testDir, 'xrpc.toml');
    expect(existsSync(tomlPath)).toBe(true);

    const tomlContent = await readFile(tomlPath, 'utf-8');
    const parsed = parseToml(tomlContent);
    // New flat format: contract + target-name = output-path
    expect(parsed.contract).toBeDefined();
    expect(parsed['go-server']).toBeDefined();
  });

  test('creates xrpc.toml when selecting react-client for detected React app', async () => {
    // Setup: Create React project structure
    await mkdir(join(testDir, 'src'), { recursive: true });
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test-react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      })
    );
    // Create a simple React component to make detection more realistic
    await writeFile(
      join(testDir, 'src/App.tsx'),
      'export default function App() { return <div>Hello</div>; }'
    );

    // Mock: Select react-client target
    const { mockPrompt, mockSpinner } = createMocks([
      ['react-client'], // Select react-client as target
    ]);

    // Suppress console output
    const originalLog = console.log;
    console.log = () => {};

    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      await initCommand({ prompt: mockPrompt, spinner: mockSpinner } as InitOptions);
    } finally {
      process.chdir(originalCwd);
      console.log = originalLog;
    }

    // Verify xrpc.toml was created
    const tomlPath = join(testDir, 'xrpc.toml');
    expect(existsSync(tomlPath)).toBe(true);

    const tomlContent = await readFile(tomlPath, 'utf-8');
    const parsed = parseToml(tomlContent);

    // Verify flat structure: contract + target-name = output-path
    expect(parsed.contract).toBeDefined();
    expect(parsed['react-client']).toBeDefined();
  });

  test('creates xrpc.toml with go-server for detected Go backend', async () => {
    // Setup: Create Go project structure
    await mkdir(testDir, { recursive: true });
    await writeFile(
      join(testDir, 'go.mod'),
      'module example.com/backend\n\ngo 1.21'
    );
    await writeFile(
      join(testDir, 'main.go'),
      'package main\n\nfunc main() {}'
    );

    // Mock: Select go-server target
    const { mockPrompt, mockSpinner } = createMocks([
      ['go-server'], // Select go-server as target
    ]);

    const originalLog = console.log;
    console.log = () => {};

    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      await initCommand({ prompt: mockPrompt, spinner: mockSpinner } as InitOptions);
    } finally {
      process.chdir(originalCwd);
      console.log = originalLog;
    }

    // Verify xrpc.toml was created
    const tomlPath = join(testDir, 'xrpc.toml');
    expect(existsSync(tomlPath)).toBe(true);

    const tomlContent = await readFile(tomlPath, 'utf-8');
    const parsed = parseToml(tomlContent);

    // Verify flat structure: contract + target-name = output-path
    expect(parsed.contract).toBeDefined();
    expect(parsed['go-server']).toBeDefined();
  });

  test('creates contract file when none exists', async () => {
    // Setup: Create empty project
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'package.json'), '{"name": "test"}');

    const { mockPrompt, mockSpinner } = createMocks([
      ['react-client'],
    ]);

    const originalLog = console.log;
    console.log = () => {};

    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      await initCommand({ prompt: mockPrompt, spinner: mockSpinner } as InitOptions);
    } finally {
      process.chdir(originalCwd);
      console.log = originalLog;
    }

    // Verify contract file was created
    const contractPath = join(testDir, 'src/contract.ts');
    expect(existsSync(contractPath)).toBe(true);

    // Verify it contains valid xRPC schema imports
    const contractContent = await readFile(contractPath, 'utf-8');
    expect(contractContent).toContain('@xrpckit/schema');
    expect(contractContent).toContain('createRouter');
  });
});
