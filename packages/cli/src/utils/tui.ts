import chalk from "chalk";
import figlet from "figlet";

/**
 * TUI utility functions for formatting output with colors and styling
 */

// =============================================================================
// BOX DRAWING CHARACTERS
// =============================================================================

const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  tee: "├",
  corner: "└",
} as const;

// =============================================================================
// ICONS & SYMBOLS
// =============================================================================

const ICONS = {
  dot: "●",
  dotEmpty: "○",
  check: "✔",
  cross: "✖",
  info: "ℹ",
  warning: "⚠",
  pointer: "❯",
  plus: "+",
} as const;

// =============================================================================
// STATUS FORMATTING
// =============================================================================

export function formatSuccess(message: string): string {
  return chalk.green(`${ICONS.check} ${message}`);
}

export function formatError(message: string): string {
  return chalk.red(`${ICONS.cross} ${message}`);
}

export function formatWarning(message: string): string {
  return chalk.yellow(`${ICONS.warning} ${message}`);
}

export function formatPath(path: string): string {
  return chalk.cyan(path);
}

export function formatTarget(target: string): string {
  return chalk.magenta(target);
}

export function formatInfo(message: string): string {
  return chalk.blue(`${ICONS.info} ${message}`);
}

export function showBanner(): void {
  // Get terminal width for centering (default to 80 if not available)
  const terminalWidth = process.stdout.columns || 80;

  // Generate ASCII art using figlet
  // Using "Big" font - reliable, dense, and highly readable
  // Text: "xRPC" - lowercase x, uppercase RPC
  // horizontalLayout: 'fitted' makes it more compact and dense
  const asciiText = figlet.textSync("xRPC", {
    font: "Big",
    horizontalLayout: "fitted", // Makes it more compact and dense
    verticalLayout: "default",
  });

  // Split into lines and calculate padding
  const asciiLines = asciiText.split("\n");
  const artWidth = Math.max(...asciiLines.map((line) => line.length));
  const padding = Math.max(0, Math.floor((terminalWidth - artWidth) / 2));
  const leftPadding = " ".repeat(padding);

  // Create the banner with centered ASCII art
  const tagline = "Type-safe, Cross-platform RPC Framework";
  const taglinePadding = Math.max(
    0,
    Math.floor((terminalWidth - tagline.length) / 2),
  );
  const taglineLeftPadding = " ".repeat(taglinePadding);

  // Bright white color for maximum contrast on dark backgrounds
  const brightText = (text: string) => {
    if (!process.stdout.isTTY || process.env.NO_COLOR) {
      return text;
    }
    return chalk.bold.white(text);
  };

  // Apply color to each line and add padding
  // Filter out empty lines for cleaner output
  const nonEmptyLines = asciiLines.filter((line) => line.trim().length > 0);
  const coloredLines = nonEmptyLines
    .map((line) => `${leftPadding}${brightText(line)}`)
    .join("\n");

  const banner = `
${coloredLines}

${taglineLeftPadding}${chalk.cyan(tagline)}
`;
  console.log(banner);
}

export function formatCommand(command: string): string {
  return chalk.bold.white(command);
}

export function formatDescription(description: string): string {
  // Use a lighter grey for better contrast on dark backgrounds
  if (!process.stdout.isTTY || process.env.NO_COLOR) {
    return description;
  }
  return chalk.gray(description);
}

export function formatHeader(text: string): string {
  return chalk.bold.underline(text);
}

export function formatCode(code: string): string {
  return chalk.gray(code);
}

export function createSeparator(maxWidth = 50): string {
  const width = Math.min(process.stdout.columns || 80, maxWidth);
  return chalk.dim(BOX.horizontal.repeat(width));
}

export function formatDetected(item: string): string {
  return chalk.cyan(`  ${item}`);
}

export function formatFileToCreate(path: string): string {
  return chalk.green(`  ${ICONS.plus} ${path}`);
}

export function formatMonorepoBadge(type: string): string {
  // Use bright backgrounds and bold text for better contrast on dark terminals
  const badges: Record<string, string> = {
    nx: chalk.bgCyan.black.bold(" Nx "),
    turbo: chalk.bgMagentaBright.black.bold(" Turbo "),
    bun: chalk.bgYellow.black.bold(" Bun "),
    pnpm: chalk.bgRedBright.black.bold(" pnpm "),
    npm: chalk.bgRed.white.bold(" npm "),
    yarn: chalk.bgBlueBright.black.bold(" Yarn "),
    lerna: chalk.bgWhite.black.bold(" Lerna "),
  };
  return badges[type] || chalk.inverse.bold(` ${type} `);
}

// =============================================================================
// BOX DRAWING UTILITIES
// =============================================================================

/**
 * Creates a box header with title (open-ended style for sections)
 * Example: ╭─ Contract Setup ────────────────────────
 */
export function formatBoxHeader(title: string, width = 50): string {
  const titlePart = `${BOX.topLeft}${BOX.horizontal} ${title} `;
  const remaining = width - titlePart.length;
  const line = BOX.horizontal.repeat(Math.max(0, remaining));
  return chalk.dim(titlePart + line);
}

/**
 * Creates a box footer (closing line)
 * Example: ╰──────────────────────────────────────────
 */
export function formatBoxFooter(width = 50): string {
  return chalk.dim(BOX.bottomLeft + BOX.horizontal.repeat(width - 1));
}

/**
 * Creates a box line prefix (for content inside a section)
 * Example: │  Content here
 */
export function formatBoxLine(content: string): string {
  return `${chalk.dim(BOX.vertical)}  ${content}`;
}

/**
 * Creates a full box with title and content
 */
export function drawBox(title: string, lines: string[], width = 50): string {
  const output: string[] = [];

  // Top border with title
  const titlePart = `${BOX.topLeft}${BOX.horizontal} ${title} `;
  const topRemaining = width - titlePart.length - 1;
  output.push(
    chalk.dim(
      titlePart +
        BOX.horizontal.repeat(Math.max(0, topRemaining)) +
        BOX.topRight,
    ),
  );

  // Empty line
  output.push(
    chalk.dim(BOX.vertical) + " ".repeat(width - 2) + chalk.dim(BOX.vertical),
  );

  // Content lines
  for (const line of lines) {
    const padding = width - 4 - stripAnsi(line).length;
    output.push(
      `${chalk.dim(BOX.vertical)}  ${line}${" ".repeat(Math.max(0, padding))}${chalk.dim(BOX.vertical)}`,
    );
  }

  // Empty line
  output.push(
    chalk.dim(BOX.vertical) + " ".repeat(width - 2) + chalk.dim(BOX.vertical),
  );

  // Bottom border
  output.push(
    chalk.dim(
      BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight,
    ),
  );

  return output.join("\n");
}

/**
 * Creates a step indicator for wizard progress
 * Example: ● ○ ○  Contract Setup
 */
export function formatStep(
  current: number,
  total: number,
  label: string,
): string {
  const dots = Array(total)
    .fill(null)
    .map((_, i) =>
      i < current ? chalk.cyan(ICONS.dot) : chalk.dim(ICONS.dotEmpty),
    );
  return `${dots.join(" ")}  ${chalk.bold(label)}`;
}

/**
 * Formats text as secondary/dimmed
 */
export function formatSecondary(text: string): string {
  return chalk.dim(text);
}

/**
 * Creates a tree-style list item
 * Example: ├ Item
 * Example: └ Last item
 */
export function formatTreeItem(text: string, isLast: boolean): string {
  const prefix = isLast ? BOX.corner : BOX.tee;
  return `${chalk.dim(prefix)} ${text}`;
}

/**
 * Creates a status dot (filled or empty)
 */
export function formatStatusDot(active: boolean): string {
  return active ? chalk.cyan(ICONS.dot) : chalk.dim(ICONS.dotEmpty);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Strip ANSI escape codes from a string for accurate length calculation
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

// =============================================================================
// VISUAL HIERARCHY UTILITIES (Phase 2)
// =============================================================================

/**
 * Primary text - for important information (bold white/cyan)
 */
export function formatPrimary(text: string): string {
  return chalk.bold(text);
}

/**
 * Accent color for highlights (cyan)
 */
export function formatAccent(text: string): string {
  return chalk.cyan(text);
}

/**
 * Format a selection choice with icon
 * @param text - The choice text
 * @param isAction - If true, uses action icon (✨), otherwise uses dim dot (○)
 */
export function formatChoice(text: string, isAction = false): string {
  const icon = isAction ? chalk.yellow("✨") : chalk.dim("○");
  return `${icon} ${text}`;
}

/**
 * Create visual break between major sections
 * Adds spacing for better visual separation
 */
export function sectionBreak(): void {
  console.log();
  console.log();
}

/**
 * Create a subtle divider line (lighter than section break)
 */
export function subtleDivider(): void {
  console.log();
}
