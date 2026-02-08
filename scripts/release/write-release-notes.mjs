import { readFileSync, writeFileSync } from "node:fs";

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function fail(message) {
  console.error(`[release:notes] ERROR: ${message}`);
  process.exit(1);
}

const input = getArg("--input", "tmp/release-summary.json");
const output = getArg("--output", "tmp/release-notes.md");
const runTag = getArg("--run-tag", "");
const commit = getArg("--commit", process.env.GITHUB_SHA || "");

let summary;
try {
  summary = JSON.parse(readFileSync(input, "utf8"));
} catch (error) {
  fail(`Unable to read summary from ${input}: ${error.message}`);
}

const published = (summary.packages || []).filter((pkg) => pkg.status === "published");
const planned = (summary.packages || []).filter((pkg) => pkg.status === "would-publish");
const rows = published.length > 0 ? published : planned;
const modeLabel = summary.dryRun ? "Dry Run" : "Live Release";

const lines = [];
lines.push(`# xRPC npm release - ${modeLabel}`);
lines.push("");
lines.push(`- Generated: ${summary.generatedAt}`);
if (runTag) lines.push(`- Run tag: ${runTag}`);
if (commit) lines.push(`- Commit: ${commit}`);
lines.push("");

if (rows.length === 0) {
  lines.push("No packages were published in this run.");
} else {
  lines.push("| Package | Version | Tag | Status |");
  lines.push("|---|---:|---|---|");
  for (const pkg of rows) {
    lines.push(
      `| \`${pkg.name}\` | \`${pkg.version}\` | ${pkg.tag ? `\`${pkg.tag}\`` : "-"} | ${pkg.status} |`,
    );
  }
}

lines.push("");
lines.push("## Totals");
lines.push("");
lines.push(`- Publishable packages: ${summary.totals?.publishable ?? 0}`);
lines.push(`- Will publish: ${summary.totals?.willPublish ?? 0}`);
lines.push(`- Skipped: ${summary.totals?.skipped ?? 0}`);
lines.push(`- Published: ${summary.totals?.published ?? 0}`);

writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
console.log(`[release:notes] wrote ${output}`);
