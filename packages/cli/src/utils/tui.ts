import { colors } from '@bunli/utils';
import figlet from 'figlet';

/**
 * TUI utility functions for formatting output with colors and styling
 */

export function formatSuccess(message: string): string {
  return colors.green(`✓ ${message}`);
}

export function formatError(message: string): string {
  return colors.red(`✗ ${message}`);
}

export function formatWarning(message: string): string {
  return colors.yellow(`⚠ ${message}`);
}

export function formatPath(path: string): string {
  return colors.cyan(path);
}

export function formatTarget(target: string): string {
  return colors.magenta(target);
}

export function formatInfo(message: string): string {
  return colors.blue(`ℹ ${message}`);
}

export function showBanner(): void {
  // Get terminal width for centering (default to 80 if not available)
  const terminalWidth = process.stdout.columns || 80;
  
  // Generate ASCII art using figlet
  // Using "Big" font - reliable, dense, and highly readable
  // Text: "xRPC" - lowercase x, uppercase RPC
  // horizontalLayout: 'fitted' makes it more compact and dense
  const asciiText = figlet.textSync('xRPC', {
    font: 'Big',
    horizontalLayout: 'fitted', // Makes it more compact and dense
    verticalLayout: 'default',
  });
  
  // Split into lines and calculate padding
  const asciiLines = asciiText.split('\n');
  const artWidth = Math.max(...asciiLines.map(line => line.length));
  const padding = Math.max(0, Math.floor((terminalWidth - artWidth) / 2));
  const leftPadding = ' '.repeat(padding);
  
  // Create the banner with centered ASCII art
  const tagline = 'Type-safe, Cross-platform RPC Framework';
  const taglinePadding = Math.max(0, Math.floor((terminalWidth - tagline.length) / 2));
  const taglineLeftPadding = ' '.repeat(taglinePadding);
  
  // Bright white color for maximum contrast on dark backgrounds
  // Using pure bright white for best readability
  const brightText = (text: string) => {
    if (!process.stdout.isTTY || process.env.NO_COLOR) {
      return text;
    }
    // Bright white (97) with bold for maximum contrast on dark terminals
    return `\x1b[1m\x1b[97m${text}\x1b[0m`; // Bright white (97 = bright white)
  };
  
  // Apply color to each line and add padding
  // Filter out empty lines for cleaner output
  const nonEmptyLines = asciiLines.filter(line => line.trim().length > 0);
  const coloredLines = nonEmptyLines.map(line => `${leftPadding}${brightText(line)}`).join('\n');
  
  const banner = `
${coloredLines}

${taglineLeftPadding}${colors.cyan(tagline)}
`;
  console.log(banner);
}

export function formatCommand(command: string): string {
  return colors.bold(colors.white(command));
}

export function formatDescription(description: string): string {
  // Use a lighter grey for better contrast on dark backgrounds
  // Instead of dim, use a brighter grey that's still subtle but readable
  if (!process.stdout.isTTY || process.env.NO_COLOR) {
    return description;
  }
  return `\x1b[38;5;250m${description}\x1b[0m`; // Light grey (250) for better contrast
}

export function formatHeader(text: string): string {
  return colors.bold(colors.underline(text));
}

export function formatCode(code: string): string {
  return colors.gray(code);
}

export function createSeparator(): string {
  return colors.dim('─'.repeat(50));
}
