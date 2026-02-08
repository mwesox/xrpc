import { execSync } from "node:child_process";
import { getPublishablePackages, getWorkspaceDependencyViolations } from "./config.mjs";

function hasArg(flag) {
  return process.argv.includes(flag);
}

function fail(message) {
  console.error(`\n[release:preflight] ERROR: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[release:preflight] ${message}`);
}

function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function assertCleanTrackedTree() {
  const out = execSync("git status --porcelain --untracked-files=no", {
    encoding: "utf8",
  }).trim();

  if (out.length > 0) {
    fail("Git working tree has tracked file changes. Commit or stash before release.");
  }
}

function main() {
  const skipGitCheck = hasArg("--skip-git-check");
  const packages = getPublishablePackages();

  if (packages.length === 0) {
    fail("No publishable packages found in packages/*.");
  }

  const seenNames = new Set();

  for (const pkg of packages) {
    if (!pkg.name) {
      fail(`Missing package name in ${pkg.manifestPath}`);
    }

    if (seenNames.has(pkg.name)) {
      fail(`Duplicate package name detected: ${pkg.name}`);
    }
    seenNames.add(pkg.name);

    if (!pkg.version) {
      fail(`Missing package version in ${pkg.manifestPath}`);
    }

    if (pkg.manifest.publishConfig?.access !== "public") {
      fail(`Package ${pkg.name} must set publishConfig.access to \"public\".`);
    }

    const workspaceViolations = getWorkspaceDependencyViolations(pkg.manifest);
    if (workspaceViolations.length > 0) {
      const details = workspaceViolations
        .map((v) => `${v.section}.${v.name}=${v.range}`)
        .join(", ");
      fail(`Package ${pkg.name} still has workspace protocol dependencies: ${details}`);
    }
  }

  if (process.env.CI === "true") {
    const ref = process.env.GITHUB_REF;
    if (ref && ref !== "refs/heads/main") {
      fail(`Release workflow must run on main. Current ref: ${ref}`);
    }
  }

  if (!skipGitCheck) {
    assertCleanTrackedTree();
  }

  const branch = getCurrentBranch();
  if (branch && branch !== "main" && process.env.CI !== "true") {
    info(`Warning: current branch is ${branch}. Releases should be cut from main.`);
  }

  info(`Preflight checks passed for ${packages.length} publishable packages.`);
  for (const pkg of packages) {
    info(`- ${pkg.name}@${pkg.version}`);
  }
}

main();
