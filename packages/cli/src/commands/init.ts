import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { listTargets } from "../registry";
import {
  type DetectedApp,
  type DetectedContract,
  type DetectedProject,
  detectApps,
  detectExistingContracts,
  detectProject,
  getAppTypeLabel,
} from "../utils/detection";
import {
  type FileToCreate,
  generateMonorepoApiPackageFiles,
  generateSingleProjectFiles,
  generateTomlTemplate,
  type TargetConfig,
} from "../utils/templates";
import {
  createSeparator,
  drawBox,
  formatBoxFooter,
  formatBoxHeader,
  formatBoxLine,
  formatDescription,
  formatError,
  formatInfo,
  formatMonorepoBadge,
  formatPath,
  formatSecondary,
  formatStep,
  formatSuccess,
  formatTarget,
  formatTreeItem,
  formatWarning,
  sectionBreak,
  subtleDivider,
} from "../utils/tui";

// =============================================================================
// TYPES
// =============================================================================

type PromptFunction = (
  message: string,
  options?: { default?: string },
) => Promise<string>;
type PromptSelectFunction = {
  select: (
    message: string,
    options: { options: string[]; multiple?: boolean },
  ) => Promise<string | string[]>;
};
type SpinnerInstance = {
  start: () => void;
  succeed: (message?: string) => void;
  fail: (message?: string) => void;
};
type SpinnerFunction = (message: string) => SpinnerInstance;

export interface InitOptions {
  prompt: PromptFunction & PromptSelectFunction;
  spinner: SpinnerFunction;
}

interface WizardState {
  project: DetectedProject;
  apps: DetectedApp[];
  contracts: DetectedContract[];
  contractPath: string;
  createNewPackage: boolean;
  packageName: string;
  packageLocation: string;
  selectedTargets: TargetConfig[];
  filesToCreate: FileToCreate[];
}

interface TsPluginSetupResult {
  patchedTsconfigFiles: string[];
  patchedPackageFiles: string[];
  manualActions: string[];
}

interface JsonPatchResult {
  status: "patched" | "already" | "missing" | "manual";
  reason?: string;
}

const TS_PLUGIN_NAME = "@xrpckit/ts-plugin";
const TS_PLUGIN_VERSION = "^0.0.1";

// =============================================================================
// MAIN INIT COMMAND
// =============================================================================

export async function initCommand(options: InitOptions): Promise<void> {
  const { prompt, spinner } = options;
  const cwd = process.cwd();

  console.log();

  // Check if xrpc.toml already exists
  if (existsSync(join(cwd, "xrpc.toml"))) {
    console.log(formatInfo("Found existing xrpc.toml configuration."));
    const overwrite = await prompt("Overwrite existing configuration?", {
      default: "n",
    });
    if (overwrite.toLowerCase() !== "y" && overwrite.toLowerCase() !== "yes") {
      console.log(
        formatDescription(
          'Setup cancelled. Run "xrpc generate" to use existing config.',
        ),
      );
      return;
    }
    console.log();
  }

  // ==========================================================================
  // PHASE 1: DETECTION
  // ==========================================================================

  const detectSpinner = spinner("Detecting project structure...");
  detectSpinner.start();

  const project = await detectProject(cwd);
  const apps = await detectApps(cwd, project);
  const contracts = await detectExistingContracts(cwd);

  detectSpinner.succeed("Project analysis complete");
  console.log();

  // Display detection results
  displayDetectionResults(project, apps, contracts);

  // ==========================================================================
  // PHASE 2: CONTRACT SETUP
  // ==========================================================================

  const { contractPath, createNewPackage, packageName, packageLocation } =
    await setupContract(prompt, project, contracts);

  // ==========================================================================
  // PHASE 3: TARGET SELECTION
  // ==========================================================================

  const selectedTargets = await selectTargets(
    prompt,
    apps,
    project,
    packageLocation,
  );

  if (selectedTargets.length === 0) {
    console.log(formatError("No targets selected. Setup cancelled."));
    return;
  }

  // ==========================================================================
  // PHASE 4: GENERATE FILE LIST
  // ==========================================================================

  const filesToCreate = generateFileList({
    project,
    apps,
    contracts,
    contractPath,
    createNewPackage,
    packageName,
    packageLocation,
    selectedTargets,
    filesToCreate: [],
  });

  // ==========================================================================
  // PHASE 5: CONFIRMATION
  // ==========================================================================

  console.log();
  console.log(formatStep(3, 3, "Confirmation"));
  console.log();

  // Build file lines for the box
  const fileLines = filesToCreate.map((file) => {
    const pathPart = formatPath(`+ ${file.path}`);
    return `${pathPart}  ${formatSecondary(file.description)}`;
  });

  console.log(drawBox("Files to create", fileLines, 60));

  console.log();
  const confirm = await prompt("Proceed with setup?", { default: "Y" });

  if (
    confirm.toLowerCase() !== "y" &&
    confirm.toLowerCase() !== "yes" &&
    confirm !== ""
  ) {
    console.log(formatDescription("Setup cancelled."));
    return;
  }

  // ==========================================================================
  // PHASE 6: FILE CREATION
  // ==========================================================================

  console.log();
  const writeSpinner = spinner("Creating files...");
  writeSpinner.start();

  try {
    for (const file of filesToCreate) {
      const fullPath = join(cwd, file.path);
      const dir = dirname(fullPath);

      // Create directory if needed
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(fullPath, file.content, "utf-8");
    }

    writeSpinner.succeed(
      `Created ${filesToCreate.length} file${filesToCreate.length !== 1 ? "s" : ""}`,
    );
  } catch (error) {
    writeSpinner.fail("Failed to create files");
    throw error;
  }

  let tsPluginSetup: TsPluginSetupResult | null = null;
  if (needsTsPlugin(selectedTargets)) {
    const pluginSpinner = spinner(`Configuring ${TS_PLUGIN_NAME}...`);
    pluginSpinner.start();
    try {
      tsPluginSetup = await setupTsPlugin(project, apps, selectedTargets, cwd);
      const updateCount =
        tsPluginSetup.patchedTsconfigFiles.length +
        tsPluginSetup.patchedPackageFiles.length;
      if (updateCount > 0) {
        pluginSpinner.succeed(
          `Updated ${updateCount} file${updateCount === 1 ? "" : "s"} for ${TS_PLUGIN_NAME}`,
        );
      } else {
        pluginSpinner.succeed(
          `No safe auto-edits found for ${TS_PLUGIN_NAME} (manual setup required)`,
        );
      }
    } catch (_error) {
      pluginSpinner.fail(`Could not auto-configure ${TS_PLUGIN_NAME}`);
      tsPluginSetup = {
        patchedPackageFiles: [],
        patchedTsconfigFiles: [],
        manualActions: [
          `Install ${TS_PLUGIN_NAME} as a dev dependency and add it to your tsconfig plugins list.`,
        ],
      };
    }
  }

  // ==========================================================================
  // PHASE 7: NEXT STEPS
  // ==========================================================================

  console.log();
  console.log(createSeparator());
  console.log();
  console.log(formatSuccess("Setup complete!"));
  console.log();
  console.log(formatBoxHeader("Next steps"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(`1. Edit ${formatPath(contractPath)} to define your API`),
  );
  console.log(
    formatBoxLine(`2. Run ${formatPath("xrpc generate")} to generate code`),
  );
  console.log(formatBoxLine("3. Import generated code in your apps"));
  if (tsPluginSetup) {
    console.log(
      formatBoxLine(
        tsPluginSetup.manualActions.length > 0
          ? "4. Complete TypeScript plugin setup (see manual steps below)"
          : `4. Restart TypeScript server to enable ${TS_PLUGIN_NAME}`,
      ),
    );
  }
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());

  if (tsPluginSetup?.manualActions.length) {
    console.log();
    console.log(formatWarning(`${TS_PLUGIN_NAME} manual setup:`));
    for (const action of tsPluginSetup.manualActions) {
      console.log(formatSecondary(`  - ${action}`));
    }
  }
  console.log();
}

// =============================================================================
// DISPLAY FUNCTIONS
// =============================================================================

function displayDetectionResults(
  project: DetectedProject,
  apps: DetectedApp[],
  contracts: DetectedContract[],
): void {
  console.log(formatBoxHeader("Project Summary"));
  // Show monorepo type
  console.log(formatBoxLine(""));
  if (project.monorepoType !== "none") {
    console.log(
      formatBoxLine(`${formatMonorepoBadge(project.monorepoType)} monorepo`),
    );
  } else if (project.isExistingProject) {
    console.log(formatBoxLine("Single project"));
  } else {
    console.log(
      formatBoxLine(formatInfo("New project (no package.json found)")),
    );
  }

  // Show detected apps
  if (apps.length > 0) {
    console.log(formatBoxLine(""));
    console.log(formatBoxLine(formatSecondary("Detected apps:")));
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const relativePath = relative(project.workspaceRoot, app.path) || ".";
      const typeLabel = getAppTypeLabel(app.type);
      const roleLabel = app.isServer ? "server" : "frontend";
      const isLast = i === apps.length - 1;
      console.log(
        formatBoxLine(
          formatTreeItem(
            `${formatPath(relativePath)} ${formatSecondary(`(${typeLabel} ${roleLabel})`)}`,
            isLast,
          ),
        ),
      );
    }
  }

  // Show existing contracts
  if (contracts.length > 0) {
    console.log(formatBoxLine(""));
    console.log(
      formatBoxLine(
        formatSecondary(
          `Found ${contracts.length} existing contract${contracts.length !== 1 ? "s" : ""}:`,
        ),
      ),
    );
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      const isLast = i === contracts.length - 1;
      console.log(
        formatBoxLine(formatTreeItem(formatPath(contract.path), isLast)),
      );
    }
  }

  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();
}

// =============================================================================
// CONTRACT SETUP
// =============================================================================

interface ContractSetupResult {
  contractPath: string;
  createNewPackage: boolean;
  packageName: string;
  packageLocation: string;
}

async function setupContract(
  prompt: PromptFunction & PromptSelectFunction,
  project: DetectedProject,
  contracts: DetectedContract[],
): Promise<ContractSetupResult> {
  // If existing contracts found, offer to use them
  if (contracts.length > 0) {
    console.log(formatStep(1, 3, "Contract Setup"));
    subtleDivider();

    const choices = [...contracts.map((c) => c.path), "Create new contract"];

    const selected = await prompt.select(
      "Select existing contract or create new:",
      {
        options: choices,
      },
    );

    subtleDivider();

    if (selected !== "Create new contract") {
      return {
        contractPath: selected as string,
        createNewPackage: false,
        packageName: "",
        packageLocation: "",
      };
    }
  }

  // For monorepos, offer to create a new package
  if (project.monorepoType !== "none" && project.packagesDir) {
    console.log(formatStep(1, 3, "Contract Setup"));
    subtleDivider();

    const createPackage = await prompt("Create new API package?", {
      default: "Y",
    });
    const createNewPackage =
      createPackage.toLowerCase() === "y" ||
      createPackage.toLowerCase() === "yes" ||
      createPackage === "";

    if (createNewPackage) {
      subtleDivider();
      // Determine package name based on monorepo type
      const defaultPackageName =
        project.monorepoType === "nx" ? "@repo/api" : "@repo/api";
      const packageName = await prompt("Package name:", {
        default: defaultPackageName,
      });

      subtleDivider();
      // Determine package location
      const defaultLocation = `${project.packagesDir}/api`;
      const packageLocation = await prompt("Package location:", {
        default: defaultLocation,
      });

      const contractPath = `${packageLocation}/src/contract.ts`;

      sectionBreak();
      return {
        contractPath,
        createNewPackage: true,
        packageName,
        packageLocation,
      };
    }
  }

  // Single project or no package creation - ask for contract path
  console.log(formatStep(1, 3, "Contract Setup"));
  subtleDivider();

  const defaultPath = "src/contract.ts";
  const contractPath = await prompt("Contract file location:", {
    default: defaultPath,
  });

  sectionBreak();
  return {
    contractPath,
    createNewPackage: false,
    packageName: "",
    packageLocation: "",
  };
}

// =============================================================================
// TARGET SELECTION
// =============================================================================

async function selectTargets(
  prompt: PromptFunction & PromptSelectFunction,
  apps: DetectedApp[],
  project: DetectedProject,
  _packageLocation: string,
): Promise<TargetConfig[]> {
  console.log(formatStep(2, 3, "Target Selection"));
  subtleDivider();

  const availableTargets = listTargets();

  // Build target options with suggestions
  const targetOptions = availableTargets.map((target) => {
    const matchingApp = apps.find((app) => app.suggestedTarget === target);
    if (matchingApp) {
      const relativePath =
        relative(project.workspaceRoot, matchingApp.path) || ".";
      return `${target} (detected: ${relativePath})`;
    }
    return target;
  });

  const selected = await prompt.select("Select targets to generate:", {
    options: targetOptions,
    multiple: true,
  });

  const selectedArray = Array.isArray(selected) ? selected : [selected];

  // Extract target names (remove the "(detected: ...)" suffix)
  const targetNames = selectedArray.map((s) => s.split(" (detected:")[0]);

  subtleDivider();

  // Get output paths for each target
  const targets: TargetConfig[] = [];

  for (const targetName of targetNames) {
    // Find matching app for suggested output path
    const matchingApp = apps.find((app) => app.suggestedTarget === targetName);
    let defaultOutput = ".";

    if (matchingApp) {
      defaultOutput = relative(project.workspaceRoot, matchingApp.path) || ".";
    } else if (project.appsDir) {
      // Suggest apps directory for unmatched targets
      const targetType = targetName.includes("client") ? "web" : "backend";
      defaultOutput = `${project.appsDir}/${targetType}`;
    }

    const outputPath = await prompt(
      `Output directory for ${formatTarget(targetName)}:`,
      {
        default: defaultOutput,
      },
    );
    subtleDivider();

    targets.push({
      name: targetName,
      outputPath,
    });
  }

  return targets;
}

// =============================================================================
// FILE GENERATION
// =============================================================================

function generateFileList(state: WizardState): FileToCreate[] {
  const {
    project,
    contractPath,
    createNewPackage,
    packageName,
    packageLocation,
    selectedTargets,
  } = state;

  const tomlConfig = {
    contractPath,
    targets: selectedTargets,
  };

  if (createNewPackage && packageLocation) {
    return generateMonorepoApiPackageFiles(
      packageLocation,
      packageName,
      tomlConfig,
    );
  }

  // Check if contract file already exists
  const contractExists = existsSync(join(project.workspaceRoot, contractPath));

  if (contractExists) {
    // Only create xrpc.toml
    return [
      {
        path: "xrpc.toml",
        content: generateTomlTemplate(tomlConfig),
        description: "xRPC configuration",
      },
    ];
  }

  return generateSingleProjectFiles(contractPath, tomlConfig);
}

function needsTsPlugin(selectedTargets: TargetConfig[]): boolean {
  return selectedTargets.some(
    (target) => target.name === "ts-client" || target.name === "ts-server",
  );
}

async function setupTsPlugin(
  project: DetectedProject,
  apps: DetectedApp[],
  selectedTargets: TargetConfig[],
  cwd: string,
): Promise<TsPluginSetupResult> {
  const result: TsPluginSetupResult = {
    patchedPackageFiles: [],
    patchedTsconfigFiles: [],
    manualActions: [],
  };
  const installCommand = getDevDependencyInstallCommand(project);

  const targetNames = new Set(selectedTargets.map((target) => target.name));
  const candidateDirs = collectTsPluginCandidateDirs(
    project,
    apps,
    targetNames,
  );

  for (const dir of candidateDirs) {
    const packagePath = join(dir, "package.json");
    const packagePatch = await patchPackageJson(packagePath);
    if (packagePatch.status === "patched") {
      result.patchedPackageFiles.push(
        relative(cwd, packagePath) || "package.json",
      );
    } else if (packagePatch.status === "missing") {
      result.manualActions.push(
        `(${relative(cwd, dir) || "."}) Add dev dependency: ${installCommand} ${TS_PLUGIN_NAME}`,
      );
    } else if (packagePatch.status === "manual") {
      result.manualActions.push(
        `(${relative(cwd, packagePath) || packagePath}) Could not patch package.json safely${packagePatch.reason ? `: ${packagePatch.reason}` : ""}. Add dev dependency manually.`,
      );
    }

    const tsconfigPath = join(dir, "tsconfig.json");
    const tsconfigPatch = await patchTsconfig(tsconfigPath);
    if (tsconfigPatch.status === "patched") {
      result.patchedTsconfigFiles.push(
        relative(cwd, tsconfigPath) || "tsconfig.json",
      );
    } else if (tsconfigPatch.status === "missing") {
      result.manualActions.push(
        `(${relative(cwd, dir) || "."}) Add to tsconfig: "compilerOptions.plugins": [{ "name": "${TS_PLUGIN_NAME}" }]`,
      );
    } else if (tsconfigPatch.status === "manual") {
      result.manualActions.push(
        `(${relative(cwd, tsconfigPath) || tsconfigPath}) Could not patch tsconfig safely${tsconfigPatch.reason ? `: ${tsconfigPatch.reason}` : ""}. Add plugin entry manually.`,
      );
    }
  }

  // Remove duplicate manual actions while preserving order.
  result.manualActions = result.manualActions.filter(
    (action, index, items) => items.indexOf(action) === index,
  );

  return result;
}

function collectTsPluginCandidateDirs(
  project: DetectedProject,
  apps: DetectedApp[],
  targetNames: Set<string>,
): string[] {
  const wantsClient = targetNames.has("ts-client");
  const wantsServer = targetNames.has("ts-server");
  const dirs = new Set<string>();

  for (const app of apps) {
    const supportsTsPlugin =
      app.type === "react" ||
      app.type === "next" ||
      app.type === "vite" ||
      app.type === "node";
    if (!supportsTsPlugin) {
      continue;
    }

    if (wantsClient && app.isClient) {
      dirs.add(app.path);
    }

    if (wantsServer && app.isServer) {
      dirs.add(app.path);
    }
  }

  if (dirs.size === 0) {
    dirs.add(project.workspaceRoot);
  }

  return Array.from(dirs);
}

async function patchPackageJson(filePath: string): Promise<JsonPatchResult> {
  if (!existsSync(filePath)) {
    return { status: "missing" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return {
      status: "manual",
      reason: "File is not valid JSON",
    };
  }

  if (!isJsonObject(parsed)) {
    return {
      status: "manual",
      reason: "Root value is not an object",
    };
  }

  let devDependencies = parsed.devDependencies;
  if (devDependencies === undefined) {
    devDependencies = {};
    parsed.devDependencies = devDependencies;
  }

  if (!isJsonObject(devDependencies)) {
    return {
      status: "manual",
      reason: "devDependencies is not an object",
    };
  }

  if (typeof devDependencies[TS_PLUGIN_NAME] === "string") {
    return { status: "already" };
  }

  devDependencies[TS_PLUGIN_NAME] = TS_PLUGIN_VERSION;
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
  return { status: "patched" };
}

async function patchTsconfig(filePath: string): Promise<JsonPatchResult> {
  if (!existsSync(filePath)) {
    return { status: "missing" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return {
      status: "manual",
      reason: "File is not valid JSON",
    };
  }

  if (!isJsonObject(parsed)) {
    return {
      status: "manual",
      reason: "Root value is not an object",
    };
  }

  let compilerOptions = parsed.compilerOptions;
  if (compilerOptions === undefined) {
    compilerOptions = {};
    parsed.compilerOptions = compilerOptions;
  }

  if (!isJsonObject(compilerOptions)) {
    return {
      status: "manual",
      reason: "compilerOptions is not an object",
    };
  }

  let plugins = compilerOptions.plugins;
  if (plugins === undefined) {
    plugins = [];
    compilerOptions.plugins = plugins;
  }

  if (!Array.isArray(plugins)) {
    return {
      status: "manual",
      reason: "compilerOptions.plugins is not an array",
    };
  }

  const alreadyConfigured = plugins.some(
    (entry) => isJsonObject(entry) && entry.name === TS_PLUGIN_NAME,
  );
  if (alreadyConfigured) {
    return { status: "already" };
  }

  plugins.push({ name: TS_PLUGIN_NAME });
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
  return { status: "patched" };
}

function isJsonObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDevDependencyInstallCommand(project: DetectedProject): string {
  switch (project.monorepoType) {
    case "pnpm":
      return "pnpm add -D";
    case "yarn":
      return "yarn add -D";
    case "npm":
      return "npm install -D";
    default:
      return "bun add -d";
  }
}
