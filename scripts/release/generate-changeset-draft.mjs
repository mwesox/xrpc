import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPublishablePackages } from "./config.mjs";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);

function hasArg(flag) {
  return process.argv.includes(flag);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return process.argv[idx + 1] ?? "";
}

function info(message) {
  console.log(`[changeset:auto] ${message}`);
}

function fail(message) {
  console.error(`[changeset:auto] ERROR: ${message}`);
  process.exit(1);
}

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function normalizePath(file) {
  return file.replaceAll("\\", "/");
}

function isChangesetMarkdown(file) {
  const normalized = normalizePath(file);
  if (!normalized.startsWith(".changeset/")) return false;
  const base = path.basename(normalized);
  return base.endsWith(".md") && base !== "README.md";
}

function isVersionOnlyPackageFile(file) {
  const normalized = normalizePath(file);
  return (
    /\/package\.json$/.test(normalized) ||
    /\/CHANGELOG\.md$/.test(normalized) ||
    /\/README\.md$/.test(normalized)
  );
}

function getDefaultBase() {
  try {
    return runGit(["merge-base", "HEAD", "origin/main"]);
  } catch {
    return runGit(["rev-parse", "HEAD~1"]);
  }
}

function getChangedFiles(base, head) {
  const range = `${base}...${head}`;
  const out = runGit(["diff", "--name-only", range]);
  if (!out) return [];
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function makeFilename() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  let file = `.changeset/auto-${stamp}.md`;
  let suffix = 1;

  while (existsSync(file)) {
    file = `.changeset/auto-${stamp}-${suffix}.md`;
    suffix += 1;
  }

  return file;
}

function main() {
  const apply = hasArg("--apply");
  const force = hasArg("--force");
  const bump = getArg("--bump") || "patch";
  const base = getArg("--base") || getDefaultBase();
  const head = getArg("--head") || runGit(["rev-parse", "HEAD"]);

  if (!VALID_BUMPS.has(bump)) {
    fail(`Invalid bump "${bump}". Use one of: patch, minor, major.`);
  }

  const changedFiles = getChangedFiles(base, head);
  if (changedFiles.length === 0) {
    info("No changed files detected.");
    return;
  }

  const existingChangesets = changedFiles.filter(isChangesetMarkdown);
  if (existingChangesets.length > 0 && !force) {
    info(`Changeset already present in diff (${existingChangesets.join(", ")}). Skipping.`);
    return;
  }

  const publishablePackages = getPublishablePackages();
  const packageDirs = publishablePackages.map((pkg) => `${pkg.dir}/`);
  const dirToName = new Map(
    publishablePackages.map((pkg) => [`${pkg.dir}/`, pkg.name]),
  );

  const packageChanges = changedFiles.filter((file) =>
    packageDirs.some((dir) => normalizePath(file).startsWith(normalizePath(dir))),
  );

  const releaseAffectingChanges = packageChanges.filter(
    (file) => !isVersionOnlyPackageFile(file),
  );

  if (releaseAffectingChanges.length === 0) {
    info("No release-affecting changes in publishable packages.");
    return;
  }

  const impactedPackages = new Set();
  for (const file of releaseAffectingChanges) {
    const normalized = normalizePath(file);
    for (const dir of packageDirs) {
      const normalizedDir = normalizePath(dir);
      if (normalized.startsWith(normalizedDir)) {
        const name = dirToName.get(dir);
        if (name) impactedPackages.add(name);
      }
    }
  }

  const names = [...impactedPackages].sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    info("No publishable package names resolved from changed files.");
    return;
  }

  const frontmatter = names.map((name) => `"${name}": ${bump}`).join("\n");
  const content = `---
${frontmatter}
---

Auto-generated changeset draft.

- TODO: replace with a short summary of user-facing changes.
- Adjust bump levels (patch/minor/major) if needed.
`;

  if (!apply) {
    info("Preview (use --apply to write file):");
    console.log(content);
    return;
  }

  const filename = makeFilename();
  writeFileSync(filename, content, "utf8");
  info(`Created ${filename}`);
}

main();
