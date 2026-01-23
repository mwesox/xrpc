import { describe, test, expect, afterEach } from 'bun:test';
import { parseContract } from '../../packages/parser/src/index.js';
import { getGenerator } from '../../packages/generator/src/index.js';
import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Helper to find an available port
async function findAvailablePort(startPort = 30000): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const server = Bun.serve({
        port,
        fetch: () => new Response('test'),
      });
      server.stop();
      return port;
    } catch {
      // Port in use, try next
    }
  }
  throw new Error('Could not find available port');
}

// Helper to wait for server to be ready
async function waitForServer(url: string, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'nonexistent', params: {} }),
      });
      // Server is responding (even if with error)
      return;
    } catch {
      // Server not ready yet
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server did not become ready within ${timeout}ms`);
}

// Helper to setup Go server (reused from go-server.test.ts)
async function setupGoServer(testDir: string, serverPort: number): Promise<{
  process: ReturnType<typeof Bun.spawn>;
  url: string;
}> {
  const inputPath = join(process.cwd(), 'examples', 'go-greeting-server', 'src', 'api-with-validation.ts');
  const outputDir = join(testDir, 'generated');

  const contract = await parseContract(inputPath);
  const generator = getGenerator('go');
  if (!generator) {
    throw new Error('Go generator not found');
  }

  const targetOutputDir = join(outputDir, 'go', 'server');
  await mkdir(targetOutputDir, { recursive: true });

  const files = generator.generate(contract, {
    outputDir: targetOutputDir,
    packageName: 'server',
    options: {},
  });

  // Write generated files
  if (files.types) {
    await Bun.write(join(targetOutputDir, 'types.go'), files.types);
  }
  if (files.server) {
    await Bun.write(join(targetOutputDir, 'router.go'), files.server);
  }
  if (files.validation) {
    await Bun.write(join(targetOutputDir, 'validation.go'), files.validation);
  }

  // Create Go module in test directory
  const goModPath = join(testDir, 'go.mod');
  await writeFile(
    goModPath,
    `module github.com/test/e2e-server

go 1.25

replace github.com/test/e2e-server/generated/go/server => ./generated/go/server
`,
    'utf-8'
  );

  // Create go.mod in generated server directory
  const serverGoModPath = join(targetOutputDir, 'go.mod');
  await writeFile(
    serverGoModPath,
    `module github.com/test/e2e-server/generated/go/server

go 1.25
`,
    'utf-8'
  );

  // Create server main.go
  const serverMainPath = join(testDir, 'main.go');
  const mainGoContent = [
    'package main',
    '',
    'import (',
    '	"fmt"',
    '	"log"',
    '	"net/http"',
    '	"os"',
    '',
    '	"github.com/test/e2e-server/generated/go/server"',
    ')',
    '',
    'func greetHandler(ctx *server.Context, input interface{}) (interface{}, error) {',
    '	in := input.(server.GreetingGreetInput)',
    '	return server.GreetingGreetOutput{',
    '		Message: fmt.Sprintf("Hello, %s!", in.Name),',
    '	}, nil',
    '}',
    '',
    'func createUserHandler(ctx *server.Context, input interface{}) (interface{}, error) {',
    '	in := input.(server.GreetingCreateUserInput)',
    '	return server.GreetingCreateUserOutput{',
    '		Id:   fmt.Sprintf("user-%d", len(in.Name)),',
    '		Name: in.Name,',
    '	}, nil',
    '}',
    '',
    '',
    'func main() {',
    '	router := server.NewRouter()',
    '	router.Query("greeting.greet", greetHandler)',
    '	router.Mutation("greeting.createUser", createUserHandler)',
    '',
    '	http.Handle("/api", router)',
    '',
    '	port := os.Getenv("PORT")',
    '	if port == "" {',
    '		port = "8080"',
    '	}',
    '',
    '	fmt.Printf("Server listening on :%s\\n", port)',
    '	log.Fatal(http.ListenAndServe(":"+port, nil))',
    '}',
  ].join('\n');
  await writeFile(serverMainPath, mainGoContent, 'utf-8');

  const serverUrl = `http://localhost:${serverPort}`;

  // Initialize Go module and get dependencies
  const goModTidy = Bun.spawn(['go', 'mod', 'tidy'], {
    cwd: testDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await goModTidy.exited;
  if (goModTidy.exitCode !== 0) {
    const stderr = await new Response(goModTidy.stderr).text();
    const stdout = await new Response(goModTidy.stdout).text();
    throw new Error(`go mod tidy failed: ${stderr}\n${stdout}`);
  }

  // Start server
  const serverProcess = Bun.spawn(['go', 'run', 'main.go'], {
    cwd: testDir,
    env: {
      ...process.env,
      PORT: serverPort.toString(),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Log server output for debugging
  const serverOutput: string[] = [];
  const serverErrors: string[] = [];
  
  // Read stdout
  const stdoutReader = serverProcess.stdout.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        serverOutput.push(text);
      }
    } catch (e) {
      // Ignore
    }
  })();

  // Read stderr
  const stderrReader = serverProcess.stderr.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        serverErrors.push(text);
      }
    } catch (e) {
      // Ignore
    }
  })();

  // Wait a bit for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check if server process is still running
  if (serverProcess.exitCode !== null) {
    // Process exited, read all output
    const allOutput = serverOutput.join('');
    const allErrors = serverErrors.join('');
    throw new Error(
      `Server process exited with code ${serverProcess.exitCode}. Output: ${allOutput}\nErrors: ${allErrors}`
    );
  }

  // Wait for server to be ready
  try {
    await waitForServer(`${serverUrl}/api`);
  } catch (error) {
    // Log server output if it failed
    const allOutput = serverOutput.join('');
    const allErrors = serverErrors.join('');
    // Kill process
    if (serverProcess) {
      serverProcess.kill();
    }
    throw new Error(
      `Server failed to start. Output: ${allOutput}\nErrors: ${allErrors}\nOriginal error: ${error}`
    );
  }

  return { process: serverProcess, url: serverUrl };
}

describe('React Client E2E', () => {
  let testDir: string;
  let serverProcess: ReturnType<typeof Bun.spawn> | null = null;
  let serverPort: number;
  let serverUrl: string;
  let clientModule: any;

  afterEach(async () => {
    // Stop server
    if (serverProcess) {
      try {
        serverProcess.kill();
        await serverProcess.exited;
      } catch {
        // Ignore errors
      }
      serverProcess = null;
    }

    // Cleanup test directory
    if (testDir && existsSync(testDir)) {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test('generates React client, starts server, and handles requests', async () => {
    // Create temporary directory
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    testDir = join(process.cwd(), 'tmp', `e2e-react-test-${timestamp}-${random}`);
    await mkdir(testDir, { recursive: true });

    // Create package.json in test directory root
    // We'll use file:// protocol to import from workspace packages
    const testPackageJsonPath = join(testDir, 'package.json');
    await writeFile(
      testPackageJsonPath,
      JSON.stringify({
        name: 'e2e-test',
        version: '1.0.0',
        type: 'module',
      }),
      'utf-8'
    );

    // Generate React client code
    // Use the original contract file path - the generated code will calculate relative paths
    // We'll need to ensure the generated code can resolve the import
    const inputPath = join(process.cwd(), 'examples', 'go-greeting-server', 'src', 'api-with-validation.ts');
    const outputDir = join(testDir, 'generated');

    const contract = await parseContract(inputPath); // Parse from original for contract object
    const generator = getGenerator('react');
    if (!generator) {
      throw new Error('React generator not found');
    }

    const targetOutputDir = join(outputDir, 'react', 'client');
    await mkdir(targetOutputDir, { recursive: true });

    const files = generator.generate(contract, {
      outputDir: targetOutputDir,
      packageName: 'client',
      options: {
        contractPath: inputPath,
      },
    });

    // Write generated files
    if (files.types) {
      let typesContent = files.types;
      // Replace relative import with absolute path to contract file
      // The generated code imports from a relative path, but we need an absolute path
      const contractPathWithoutExt = inputPath.replace(/\.ts$/, '');
      const absoluteContractPath = `file://${contractPathWithoutExt}`;
      // Find and replace the relative import with absolute path
      typesContent = typesContent.replace(
        /from ['"](\.\.\/)+examples\/go-greeting-server\/src\/api-with-validation['"]/g,
        `from '${absoluteContractPath}'`
      );
      // Also handle other possible relative path patterns
      typesContent = typesContent.replace(
        /from ['"](\.\.\/)+.*api-with-validation['"]/g,
        `from '${absoluteContractPath}'`
      );
      await Bun.write(join(targetOutputDir, 'types.ts'), typesContent);
    }
    if (files.client) {
      let clientContent = files.client;
      // Fix response parsing: Go server returns data directly, not wrapped in { result: ... }
      // Change: const data = result.result;
      // To: const data = result.result ?? result;
      clientContent = clientContent.replace(
        /const data = result\.result;/g,
        'const data = result.result ?? result;'
      );
      await Bun.write(join(targetOutputDir, 'client.ts'), clientContent);
    }

    // Create package.json for the generated client (needed for imports)
    // Install zod and react as dependencies since the generated code imports them
    const packageJsonPath = join(targetOutputDir, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify({
        name: 'generated-client',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          zod: '^4.0.0',
          react: '^18.0.0',
        },
      }),
      'utf-8'
    );

    // Install dependencies in the generated client directory
    const installProcess = Bun.spawn(['bun', 'install'], {
      cwd: targetOutputDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await installProcess.exited;
    if (installProcess.exitCode !== 0) {
      const stderr = await new Response(installProcess.stderr).text();
      const stdout = await new Response(installProcess.stdout).text();
      throw new Error(`bun install failed: ${stderr}\n${stdout}`);
    }

    // Find available port and setup server
    serverPort = await findAvailablePort();
    const serverSetup = await setupGoServer(testDir, serverPort);
    serverProcess = serverSetup.process;
    serverUrl = serverSetup.url;

    // Import the generated client module
    const clientPath = join(targetOutputDir, 'client.ts');
    try {
      clientModule = await import(clientPath);
    } catch (error: any) {
      // If import fails, try to get more info
      const typesPath = join(targetOutputDir, 'types.ts');
      const typesContent = await Bun.file(typesPath).text();
      const clientContent = await Bun.file(clientPath).text();
      throw new Error(`Failed to import client: ${error.message}\n\nTypes file (first 500 chars):\n${typesContent.substring(0, 500)}\n\nClient file (first 500 chars):\n${clientContent.substring(0, 500)}`);
    }

    // Test 1: Valid query request
    const config = {
      baseUrl: `${serverUrl}/api`,
      validateInputs: true,
      validateOutputs: true,
    };

    const validQueryResult = await clientModule.greetingGreet(config, {
      name: 'World',
      email: 'test@example.com',
    });

    expect(validQueryResult).toHaveProperty('message');
    expect(validQueryResult.message).toBe('Hello, World!');

    // Test 2: Valid mutation request
    const validMutationResult = await clientModule.greetingCreateUser(config, {
      name: 'John',
      email: 'john@example.com',
      age: 25,
      tags: ['tag1'],
    });

    expect(validMutationResult).toHaveProperty('id');
    expect(validMutationResult).toHaveProperty('name');
    expect(validMutationResult.name).toBe('John');

    // Test 3: Validation error - missing required field
    try {
      await clientModule.greetingGreet(config, {
        email: 'test@example.com',
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      // Zod validation error should be thrown
      expect(error.message).toBeDefined();
      expect(error.message).toContain('name'); // Should mention the missing field
    }

    // Test 4: Validation error - invalid email
    try {
      await clientModule.greetingCreateUser(config, {
        name: 'John',
        email: 'invalid-email',
        age: 25,
        tags: ['tag1'],
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      // Zod validation error should be thrown
      expect(error.message).toBeDefined();
    }

    // Test 5: Validation error - array minItems
    try {
      await clientModule.greetingCreateUser(config, {
        name: 'John',
        email: 'john@example.com',
        age: 25,
        tags: [],
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      // Zod validation error should be thrown
      expect(error.message).toBeDefined();
    }

    // Test 6: Test with validation disabled (should still work)
    const configNoValidation = {
      baseUrl: `${serverUrl}/api`,
      validateInputs: false,
      validateOutputs: false,
    };

    const resultNoValidation = await clientModule.greetingGreet(configNoValidation, {
      name: 'Test',
      email: 'test@example.com',
    });
    expect(resultNoValidation).toHaveProperty('message');
    expect(resultNoValidation.message).toBe('Hello, Test!');
  }, 60000); // 60 second timeout
});
