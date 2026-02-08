import { execFileSync, execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getPublishablePackages,
  getWorkspaceDependencyViolations,
  packageToTagName,
} from "./config.mjs";

function hasArg(flag) {
  return process.argv.includes(flag);
}

function log(message) {
  console.log(`[release:publish] ${message}`);
}

function fail(message) {
  console.error(`\n[release:publish] ERROR: ${message}`);
  process.exit(1);
}

function parseSemver(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!m) return null;

  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split(".") : [],
  };
}

function comparePrerelease(a, b) {
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i += 1) {
    const left = a[i];
    const right = b[i];

    if (left === undefined) return -1;
    if (right === undefined) return 1;

    const leftNum = /^\d+$/.test(left) ? Number(left) : null;
    const rightNum = /^\d+$/.test(right) ? Number(right) : null;

    if (leftNum !== null && rightNum !== null) {
      if (leftNum !== rightNum) return leftNum > rightNum ? 1 : -1;
      continue;
    }

    if (leftNum !== null && rightNum === null) return -1;
    if (leftNum === null && rightNum !== null) return 1;

    if (left !== right) return left > right ? 1 : -1;
  }

  return 0;
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);

  if (!left || !right) {
    return null;
  }

  if (left.major !== right.major) return left.major > right.major ? 1 : -1;
  if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
  if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;

  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;

  return comparePrerelease(left.prerelease, right.prerelease);
}

function npmViewLatestVersion(name) {
  const result = spawnSync(
    "npm",
    ["view", name, "version", "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  if (result.status !== 0) {
    const stderr = (result.stderr || "").toString();
    if (stderr.includes("E404") || stderr.includes("Not Found")) {
      return null;
    }

    fail(`Failed to query npm for ${name}: ${stderr.trim()}`);
  }

  const raw = result.stdout.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) return parsed[0] ?? null;
    return parsed?.version ?? null;
  } catch {
    return raw.replaceAll('"', "");
  }
}

function ensureTagDoesNotExist(tag) {
  const local = execSync(`git tag --list "${tag}"`, { encoding: "utf8" }).trim();
  if (local.length > 0) {
    fail(`Tag already exists locally: ${tag}`);
  }

  const remote = execSync(`git ls-remote --tags origin "refs/tags/${tag}"`, {
    encoding: "utf8",
  }).trim();

  if (remote.length > 0) {
    fail(`Tag already exists on origin: ${tag}`);
  }
}

function inspectPackedManifest(packageDir) {
  const packDestination = path.join(os.tmpdir(), "xrpc-release-pack");
  mkdirSync(packDestination, { recursive: true });

  const out = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", packDestination],
    { encoding: "utf8", cwd: packageDir },
  ).trim();

  const parsed = JSON.parse(out);
  const info = Array.isArray(parsed) ? parsed[0] : parsed;
  const tarballPath = path.join(packDestination, info.filename);

  const manifestRaw = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
  });

  return JSON.parse(manifestRaw);
}

function validatePackedManifest(pkg) {
  const packedManifest = inspectPackedManifest(pkg.dir);
  const violations = getWorkspaceDependencyViolations(packedManifest);
  if (violations.length > 0) {
    const details = violations
      .map((v) => `${v.section}.${v.name}=${v.range}`)
      .join(", ");
    fail(`Packed manifest for ${pkg.name} contains workspace protocol deps: ${details}`);
  }

  if (packedManifest.version !== pkg.version) {
    fail(
      `Packed manifest version mismatch for ${pkg.name}: expected ${pkg.version}, got ${packedManifest.version}`,
    );
  }
}

function publishPackage(pkg) {
  execFileSync("npm", ["publish", "--access", "public", "--tag", "latest"], {
    cwd: pkg.dir,
    stdio: "inherit",
  });
}

function createTag(pkg) {
  const tag = packageToTagName(pkg.name, pkg.version);
  ensureTagDoesNotExist(tag);

  execFileSync(
    "git",
    ["tag", "-a", tag, "-m", `release: ${pkg.name}@${pkg.version}`],
    { stdio: "inherit" },
  );

  return tag;
}

function main() {
  const dryRun = hasArg("--dry-run");
  const token = process.env.NODE_AUTH_TOKEN || process.env.NPM_XRPC_APIKEY;

  if (!dryRun && !token) {
    fail("Missing npm auth token. Set NODE_AUTH_TOKEN or NPM_XRPC_APIKEY.");
  }

  const packages = getPublishablePackages();
  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun,
    packages: [],
    totals: {
      publishable: packages.length,
      willPublish: 0,
      skipped: 0,
      published: 0,
    },
  };

  for (const pkg of packages) {
    const npmLatest = npmViewLatestVersion(pkg.name);

    let decision = "publish";
    let reason = "new package";

    if (npmLatest) {
      const cmp = compareSemver(pkg.version, npmLatest);
      if (cmp === null) {
        fail(`Cannot compare semver for ${pkg.name}: local=${pkg.version}, npm=${npmLatest}`);
      }

      if (cmp < 0) {
        fail(
          `Local version for ${pkg.name} (${pkg.version}) is lower than npm latest (${npmLatest}).`,
        );
      }

      if (cmp === 0) {
        decision = "skip";
        reason = "version already published";
      } else {
        reason = `npm latest is ${npmLatest}`;
      }
    }

    const result = {
      name: pkg.name,
      version: pkg.version,
      dir: pkg.dir,
      npmLatest,
      decision,
      reason,
      tag: null,
      status: dryRun ? "planned" : "pending",
    };

    if (decision === "skip") {
      summary.totals.skipped += 1;
      result.status = "skipped";
      summary.packages.push(result);
      log(`skip ${pkg.name}@${pkg.version} (${reason})`);
      continue;
    }

    validatePackedManifest(pkg);
    summary.totals.willPublish += 1;

    if (dryRun) {
      result.status = "would-publish";
      summary.packages.push(result);
      log(`dry-run publish ${pkg.name}@${pkg.version} (${reason})`);
      continue;
    }

    log(`publishing ${pkg.name}@${pkg.version}`);
    publishPackage(pkg);

    const tag = createTag(pkg);
    result.tag = tag;
    result.status = "published";

    summary.totals.published += 1;
    summary.packages.push(result);
    log(`published ${pkg.name}@${pkg.version} and created tag ${tag}`);
  }

  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/release-summary.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  log(`wrote tmp/release-summary.json`);
  log(
    `summary: publishable=${summary.totals.publishable}, willPublish=${summary.totals.willPublish}, skipped=${summary.totals.skipped}, published=${summary.totals.published}`,
  );

  if (!dryRun && summary.totals.published === 0) {
    log("No packages published in this run.");
  }
}

main();
