import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';

// =============================================================================
// TYPES
// =============================================================================

export type MonorepoType = 'nx' | 'turbo' | 'bun' | 'pnpm' | 'npm' | 'yarn' | 'none';
export type AppType = 'react' | 'next' | 'vite' | 'go' | 'python' | 'node' | 'unknown';

export interface DetectedProject {
  isExistingProject: boolean;
  monorepoType: MonorepoType;
  workspaceRoot: string;
  appsDir: string | null;
  packagesDir: string | null;
}

export interface DetectedApp {
  name: string;
  path: string;
  type: AppType;
  isClient: boolean;
  isServer: boolean;
  suggestedTarget: string | null;
}

export interface DetectedContract {
  path: string;
  name: string;
}

// =============================================================================
// PROJECT DETECTION
// =============================================================================

/**
 * Detects if the current directory is an existing project.
 */
export async function detectProject(cwd: string): Promise<DetectedProject> {
  const packageJsonPath = join(cwd, 'package.json');
  const isExistingProject = existsSync(packageJsonPath);

  const monorepoType = await detectMonorepoType(cwd);
  const appsDir = await findDirectory(cwd, ['apps', 'applications']);
  const packagesDir = await findDirectory(cwd, ['packages', 'libs', 'modules']);

  return {
    isExistingProject,
    monorepoType,
    workspaceRoot: cwd,
    appsDir,
    packagesDir,
  };
}

/**
 * Detects the type of monorepo in the given directory.
 * Priority order: nx > turbo > pnpm > bun/yarn/npm (based on packageManager field)
 */
export async function detectMonorepoType(cwd: string): Promise<MonorepoType> {
  // Check for Nx
  if (existsSync(join(cwd, 'nx.json'))) {
    return 'nx';
  }

  // Check for Turborepo
  if (existsSync(join(cwd, 'turbo.json'))) {
    return 'turbo';
  }

  // Check for pnpm workspaces
  if (existsSync(join(cwd, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }

  // Check for bun workspaces
  if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) {
    const packageJson = await readPackageJson(cwd);
    if (packageJson?.workspaces) {
      return 'bun';
    }
  }

  // Check package.json for workspaces and packageManager
  const packageJson = await readPackageJson(cwd);
  if (packageJson?.workspaces) {
    const packageManager = packageJson.packageManager as string | undefined;
    if (packageManager?.startsWith('yarn')) {
      return 'yarn';
    }
    if (packageManager?.startsWith('pnpm')) {
      return 'pnpm';
    }
    if (packageManager?.startsWith('bun')) {
      return 'bun';
    }
    // Default to npm if workspaces exist but no specific package manager
    if (existsSync(join(cwd, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  return 'none';
}

// =============================================================================
// APP DETECTION
// =============================================================================

/**
 * Scans for apps in the project directory.
 * Looks in apps/ and packages/ directories for client/server applications.
 */
export async function detectApps(cwd: string, project: DetectedProject): Promise<DetectedApp[]> {
  const apps: DetectedApp[] = [];

  // Scan apps directory
  if (project.appsDir) {
    const appsPath = join(cwd, project.appsDir);
    const appDirs = await getSubdirectories(appsPath);
    for (const dir of appDirs) {
      const app = await detectAppType(join(appsPath, dir), dir);
      if (app) {
        apps.push(app);
      }
    }
  }

  // Scan packages directory
  if (project.packagesDir) {
    const packagesPath = join(cwd, project.packagesDir);
    const packageDirs = await getSubdirectories(packagesPath);
    for (const dir of packageDirs) {
      const app = await detectAppType(join(packagesPath, dir), dir);
      if (app) {
        apps.push(app);
      }
    }
  }

  // If not a monorepo, check root directory
  if (project.monorepoType === 'none') {
    const rootApp = await detectAppType(cwd, basename(cwd));
    if (rootApp) {
      apps.push(rootApp);
    }
  }

  return apps;
}

/**
 * Detects the type of application in a directory.
 */
async function detectAppType(dirPath: string, name: string): Promise<DetectedApp | null> {
  // Check for Go
  if (existsSync(join(dirPath, 'go.mod'))) {
    return {
      name,
      path: dirPath,
      type: 'go',
      isClient: false,
      isServer: true,
      suggestedTarget: 'go-server',
    };
  }

  // Check for Python
  if (existsSync(join(dirPath, 'pyproject.toml')) || existsSync(join(dirPath, 'requirements.txt'))) {
    return {
      name,
      path: dirPath,
      type: 'python',
      isClient: false,
      isServer: true,
      suggestedTarget: null, // python-server not yet available
    };
  }

  // Check package.json for JS/TS apps
  const packageJson = await readPackageJson(dirPath);
  if (!packageJson) {
    return null;
  }

  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  } as Record<string, string> | undefined;

  if (!deps) {
    return null;
  }

  // Check for Next.js
  if (deps['next']) {
    return {
      name,
      path: dirPath,
      type: 'next',
      isClient: true,
      isServer: true,
      suggestedTarget: 'react-client',
    };
  }

  // Check for Vite with React
  if (deps['vite'] && deps['react']) {
    return {
      name,
      path: dirPath,
      type: 'vite',
      isClient: true,
      isServer: false,
      suggestedTarget: 'react-client',
    };
  }

  // Check for React (CRA or other)
  if (deps['react']) {
    return {
      name,
      path: dirPath,
      type: 'react',
      isClient: true,
      isServer: false,
      suggestedTarget: 'react-client',
    };
  }

  // Check for Node.js server frameworks
  if (deps['express'] || deps['fastify'] || deps['koa'] || deps['hono']) {
    return {
      name,
      path: dirPath,
      type: 'node',
      isClient: false,
      isServer: true,
      suggestedTarget: null, // typescript-server not yet available
    };
  }

  return null;
}

// =============================================================================
// CONTRACT DETECTION
// =============================================================================

/**
 * Finds existing contract files in the project.
 * Looks for files matching *contract*.ts, *api*.ts, or files containing router exports.
 */
export async function detectExistingContracts(cwd: string): Promise<DetectedContract[]> {
  const contracts: DetectedContract[] = [];
  const searchDirs = ['src', 'packages', 'libs', '.'];

  for (const dir of searchDirs) {
    const searchPath = join(cwd, dir);
    if (!existsSync(searchPath)) {
      continue;
    }

    try {
      const files = await findContractFiles(searchPath, cwd);
      contracts.push(...files);
    } catch {
      // Directory might not be readable
    }
  }

  // Deduplicate by path
  const seen = new Set<string>();
  return contracts.filter((c) => {
    if (seen.has(c.path)) return false;
    seen.add(c.path);
    return true;
  });
}

/**
 * Recursively finds contract files in a directory.
 */
async function findContractFiles(dirPath: string, basePath: string, depth = 0): Promise<DetectedContract[]> {
  if (depth > 5) return []; // Limit recursion depth

  const contracts: DetectedContract[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        const subContracts = await findContractFiles(fullPath, basePath, depth + 1);
        contracts.push(...subContracts);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Check if filename suggests it's a contract
        const lowerName = entry.name.toLowerCase();
        if (
          lowerName.includes('contract') ||
          lowerName.includes('api') ||
          lowerName.includes('router') ||
          lowerName.includes('schema')
        ) {
          // Verify it contains xRPC schema imports
          const isContract = await isContractFile(fullPath);
          if (isContract) {
            const relativePath = fullPath.replace(basePath + '/', '');
            contracts.push({
              path: relativePath,
              name: entry.name,
            });
          }
        }
      }
    }
  } catch {
    // Directory might not be readable
  }

  return contracts;
}

/**
 * Checks if a file is likely an xRPC contract file.
 */
async function isContractFile(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, 'utf-8');
    // Check for xRPC schema imports
    return (
      content.includes('@xrpckit/schema') ||
      content.includes('createRouter') ||
      content.includes('createEndpoint')
    );
  } catch {
    return false;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Reads and parses a package.json file.
 */
async function readPackageJson(dirPath: string): Promise<Record<string, unknown> | null> {
  const packageJsonPath = join(dirPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Finds the first existing directory from a list of candidates.
 */
async function findDirectory(basePath: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const fullPath = join(basePath, candidate);
    if (existsSync(fullPath)) {
      try {
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          return candidate;
        }
      } catch {
        // Not accessible
      }
    }
  }
  return null;
}

/**
 * Gets all subdirectories of a directory.
 */
async function getSubdirectories(dirPath: string): Promise<string[]> {
  if (!existsSync(dirPath)) {
    return [];
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Maps app type to suggested target name.
 */
export function getTargetForAppType(appType: AppType): string | null {
  switch (appType) {
    case 'react':
    case 'next':
    case 'vite':
      return 'react-client';
    case 'go':
      return 'go-server';
    default:
      return null;
  }
}

/**
 * Returns a human-readable label for monorepo type.
 */
export function getMonorepoLabel(type: MonorepoType): string {
  switch (type) {
    case 'nx':
      return 'Nx';
    case 'turbo':
      return 'Turborepo';
    case 'bun':
      return 'Bun workspaces';
    case 'pnpm':
      return 'pnpm workspaces';
    case 'npm':
      return 'npm workspaces';
    case 'yarn':
      return 'Yarn workspaces';
    case 'none':
      return 'Single project';
  }
}

/**
 * Returns a human-readable label for app type.
 */
export function getAppTypeLabel(type: AppType): string {
  switch (type) {
    case 'react':
      return 'React';
    case 'next':
      return 'Next.js';
    case 'vite':
      return 'Vite + React';
    case 'go':
      return 'Go';
    case 'python':
      return 'Python';
    case 'node':
      return 'Node.js';
    case 'unknown':
      return 'Unknown';
  }
}
