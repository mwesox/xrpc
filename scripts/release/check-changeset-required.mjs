import { execFileSync } from "node:child_process";
import path from "node:path";
import { getPublishablePackageDirs } from "./config.mjs";

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return process.argv[idx + 1] ?? "";
}

function fail(message) {
  console.error(`[release:changeset-check] ERROR: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[release:changeset-check] ${message}`);
}

function getChangedFiles(base, head) {
  const range = base && head ? `${base}...${head}` : "HEAD~1...HEAD";
  const out = execFileSync("git", ["diff", "--name-only", range], {
    encoding: "utf8",
  }).trim();

  if (!out) return [];
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function isChangesetMarkdown(file) {
  if (!file.startsWith(".changeset/")) return false;
  const base = path.basename(file);
  return base.endsWith(".md") && base !== "README.md";
}

function isVersionOnlyPackageFile(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    /\/package\.json$/.test(normalized) ||
    /\/CHANGELOG\.md$/.test(normalized) ||
    /\/README\.md$/.test(normalized)
  );
}

function main() {
  const base = getArg("--base") || process.env.GITHUB_BASE_SHA || "";
  const head = getArg("--head") || process.env.GITHUB_HEAD_SHA || "";

  const changedFiles = getChangedFiles(base, head);
  if (changedFiles.length === 0) {
    info("No changed files detected. Skipping changeset requirement check.");
    return;
  }

  const publishablePackageDirs = [...getPublishablePackageDirs()];
  const packageChanges = changedFiles.filter((file) =>
    publishablePackageDirs.some((dir) => file.startsWith(dir)),
  );

  if (packageChanges.length === 0) {
    info("No publishable package files changed.");
    return;
  }

  const releaseAffectingChanges = packageChanges.filter((file) => !isVersionOnlyPackageFile(file));

  if (releaseAffectingChanges.length === 0) {
    info("Only version/changelog/readme package files changed. No new changeset required.");
    return;
  }

  const hasChangesetFile = changedFiles.some(isChangesetMarkdown);
  if (!hasChangesetFile) {
    fail(
      `Publishable package changes detected but no .changeset/*.md found. Add a changeset. Files: ${releaseAffectingChanges.join(", ")}`,
    );
  }

  info("Changeset requirement satisfied.");
}

main();
