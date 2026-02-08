import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PACKAGES_DIR = "packages";

function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function listPackageDirs() {
  if (!existsSync(PACKAGES_DIR)) {
    throw new Error(`Missing directory: ${PACKAGES_DIR}`);
  }

  return readdirSync(PACKAGES_DIR)
    .map((name) => path.join(PACKAGES_DIR, name))
    .filter((dir) => existsSync(path.join(dir, "package.json")));
}

function getPriority(name) {
  if (name === "xrpckit") return 10;
  if (name === "@xrpckit/sdk") return 20;
  if (name.startsWith("@xrpckit/target-")) return 30;
  if (name === "@xrpckit/cli") return 40;
  if (name === "@xrpckit/ts-plugin") return 50;
  return 90;
}

function comparePackageOrder(a, b) {
  const pa = getPriority(a.name);
  const pb = getPriority(b.name);

  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name);
}

export function packageToTagSlug(name) {
  return name.replace(/^@/, "").replace(/\//g, "-");
}

export function packageToTagName(name, version) {
  return `npm/${packageToTagSlug(name)}/v${version}`;
}

export function getAllPackages() {
  return listPackageDirs().map((dir) => {
    const manifestPath = path.join(dir, "package.json");
    const manifest = readJSON(manifestPath);

    return {
      name: manifest.name,
      version: manifest.version,
      private: manifest.private === true,
      dir,
      manifestPath,
      manifest,
    };
  });
}

export function getPublishablePackages() {
  return getAllPackages()
    .filter((pkg) => !pkg.private)
    .sort(comparePackageOrder);
}

export function getPublishablePackageDirs() {
  return new Set(getPublishablePackages().map((pkg) => `${pkg.dir}/`));
}

export function getPublishablePackageNames() {
  return new Set(getPublishablePackages().map((pkg) => pkg.name));
}

export function getWorkspaceDependencyViolations(manifest) {
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];

  const violations = [];

  for (const section of sections) {
    const deps = manifest[section] ?? {};
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === "string" && range.startsWith("workspace:")) {
        violations.push({ section, name, range });
      }
    }
  }

  return violations;
}

export function formatPackageSummary(packages) {
  return packages
    .map((pkg) => `- ${pkg.name}@${pkg.version} (${pkg.dir})`)
    .join("\n");
}
