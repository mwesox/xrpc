import { describe, test, expect, afterEach } from 'bun:test';
import { parseContract } from '../../packages/parser/src/index.js';
import { getGenerator } from '../../packages/generator/src/index.js';
import { mkdir, rm, writeFile } from 'node:fs/promises';
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

describe('Go Server E2E', () => {
  let testDir: string;
  let serverProcess: ReturnType<typeof Bun.spawn> | null = null;
  let serverPort: number;
  let serverUrl: string;

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

  test('generates Go server, starts it, and handles requests', async () => {
    // Create temporary directory
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    testDir = join(process.cwd(), 'tmp', `e2e-test-${timestamp}-${random}`);
    await mkdir(testDir, { recursive: true });

    // Generate Go code
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

    // Find available port
    serverPort = await findAvailablePort();
    serverUrl = `http://localhost:${serverPort}`;

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
    serverProcess = Bun.spawn(['go', 'run', 'main.go'], {
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
          if (text.includes('Server listening')) {
            // Server is ready
          }
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

    // Test 1: Valid query request
    const validQueryResponse = await fetch(`${serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'greeting.greet',
        params: { name: 'World', email: 'test@example.com' },
      }),
    });

    expect(validQueryResponse.status).toBe(200);
    const validQueryData = await validQueryResponse.json();
    expect(validQueryData).toHaveProperty('message');
    expect(validQueryData.message).toBe('Hello, World!');

    // Test 2: Valid mutation request
    const validMutationResponse = await fetch(`${serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'greeting.createUser',
        params: {
          name: 'John',
          email: 'john@example.com',
          age: 25,
          tags: ['tag1'],
        },
      }),
    });

    expect(validMutationResponse.status).toBe(200);
    const validMutationData = await validMutationResponse.json();
    expect(validMutationData).toHaveProperty('id');
    expect(validMutationData).toHaveProperty('name');
    expect(validMutationData.name).toBe('John');

    // Test 3: Validation error - missing required field
    const missingFieldResponse = await fetch(`${serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'greeting.greet',
        params: { email: 'test@example.com' },
      }),
    });

    expect(missingFieldResponse.status).toBe(400);
    const missingFieldData = await missingFieldResponse.json();
    expect(missingFieldData).toHaveProperty('error');
    expect(missingFieldData).toHaveProperty('errors');
    expect(Array.isArray(missingFieldData.errors)).toBe(true);
    expect(missingFieldData.errors.length).toBeGreaterThan(0);
    const nameError = missingFieldData.errors.find((e: any) => e.field === 'name');
    expect(nameError).toBeDefined();

    // Test 4: Validation error - invalid email
    const invalidEmailResponse = await fetch(`${serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'greeting.createUser',
        params: {
          name: 'John',
          email: 'invalid-email',
          age: 25,
          tags: ['tag1'],
        },
      }),
    });

    expect(invalidEmailResponse.status).toBe(400);
    const invalidEmailData = await invalidEmailResponse.json();
    expect(invalidEmailData).toHaveProperty('error');
    expect(invalidEmailData).toHaveProperty('errors');
    const emailError = invalidEmailData.errors.find((e: any) => e.field === 'email');
    expect(emailError).toBeDefined();

    // Test 5: Validation error - array minItems
    const arrayMinItemsResponse = await fetch(`${serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'greeting.createUser',
        params: {
          name: 'John',
          email: 'john@example.com',
          age: 25,
          tags: [],
        },
      }),
    });

    expect(arrayMinItemsResponse.status).toBe(400);
    const arrayMinItemsData = await arrayMinItemsResponse.json();
    expect(arrayMinItemsData).toHaveProperty('error');
    expect(arrayMinItemsData).toHaveProperty('errors');
    const tagsError = arrayMinItemsData.errors.find((e: any) => e.field === 'tags');
    expect(tagsError).toBeDefined();

    // Test 6: Missing method
    const missingMethodResponse = await fetch(`${serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'nonexistent.method',
        params: {},
      }),
    });

    expect(missingMethodResponse.status).toBe(404);
  }, 60000); // 60 second timeout
});
