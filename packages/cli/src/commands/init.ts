import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { listTargets } from "../registry";
import {
  type DetectedApp,
  type DetectedContract,
  type DetectedProject,
  detectApps,
  detectExistingContracts,
  detectProject,
  getAppTypeLabel,
  getMonorepoLabel,
} from "../utils/detection";
import {
  type FileToCreate,
  type TargetConfig,
  generateMonorepoApiPackageFiles,
  generateSingleProjectFiles,
  generateTomlTemplate,
} from "../utils/templates";
import {
  createSeparator,
  drawBox,
  formatBoxFooter,
  formatBoxHeader,
  formatBoxLine,
  formatDescription,
  formatDetected,
  formatError,
  formatFileToCreate,
  formatHeader,
  formatInfo,
  formatMonorepoBadge,
  formatPath,
  formatSecondary,
  formatStep,
  formatSuccess,
  formatTarget,
  formatTreeItem,
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
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
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
  packageLocation: string,
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
