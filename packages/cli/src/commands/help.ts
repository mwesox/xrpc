import { listTargets } from "../registry";
import {
  createSeparator,
  formatBoxFooter,
  formatBoxHeader,
  formatBoxLine,
  formatCode,
  formatCommand,
  formatDescription,
  formatHeader,
  formatInfo,
  formatPath,
  formatSecondary,
  formatTarget,
  formatTreeItem,
} from "../utils/tui";

export async function showHelp(command?: string): Promise<void> {
  if (command) {
    showCommandHelp(command);
  } else {
    showGeneralHelp();
  }
}

function showGeneralHelp(): void {
  console.log();
  console.log(formatBoxHeader("xRPC CLI Help"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(formatSecondary("Type-safe, cross-platform RPC framework")),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  // Commands section
  console.log(formatBoxHeader("Commands"));
  console.log(formatBoxLine(""));

  console.log(formatBoxLine(formatCommand("generate")));
  console.log(
    formatBoxLine(
      formatSecondary(
        "  Generate type-safe clients and servers from API contracts",
      ),
    ),
  );
  console.log(
    formatBoxLine(formatSecondary("  Usage: xrpc generate [options]")),
  );
  console.log(
    formatBoxLine(
      formatSecondary("  Options: -i/--input, -o/--output, -t/--targets"),
    ),
  );
  console.log(formatBoxLine(""));

  console.log(formatBoxLine(formatCommand("validate")));
  console.log(
    formatBoxLine(
      formatSecondary("  Validate API contract for type safety and structure"),
    ),
  );
  console.log(formatBoxLine(formatSecondary("  Usage: xrpc validate [file]")));
  console.log(formatBoxLine(""));

  console.log(formatBoxLine(formatCommand("init")));
  console.log(
    formatBoxLine(
      formatSecondary(
        "  Initialize xRPC in your project with interactive setup",
      ),
    ),
  );
  console.log(formatBoxLine(formatSecondary("  Usage: xrpc init")));
  console.log(formatBoxLine(""));

  console.log(formatBoxLine(formatCommand("help")));
  console.log(
    formatBoxLine(
      formatSecondary(
        "  Show this help message or help for a specific command",
      ),
    ),
  );
  console.log(formatBoxLine(formatSecondary("  Usage: xrpc help [command]")));
  console.log(formatBoxLine(""));

  console.log(formatBoxFooter());
  console.log();

  // Targets section
  console.log(formatBoxHeader("Available Targets"));
  console.log(formatBoxLine(""));
  const targets = listTargets();
  for (let i = 0; i < targets.length; i++) {
    const isLast = i === targets.length - 1;
    console.log(
      formatBoxLine(formatTreeItem(formatTarget(targets[i]), isLast)),
    );
  }
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  // Examples section
  console.log(formatBoxHeader("Examples"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatSecondary("# Generate Go server code")));
  console.log(
    formatBoxLine(
      formatCode("xrpc generate -i src/api.ts -o generated -t go-server"),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(formatSecondary("# Generate code for multiple targets")),
  );
  console.log(
    formatBoxLine(
      formatCode(
        "xrpc generate -i src/api.ts -o generated -t go-server,ts-client",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatSecondary("# Interactive mode")));
  console.log(formatBoxLine(formatCode("xrpc generate")));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(
    formatInfo("For more information, visit: https://github.com/xrpc/xrpc"),
  );
  console.log();
}

function showCommandHelp(command: string): void {
  switch (command) {
    case "generate":
      showGenerateHelp();
      break;
    case "validate":
      showValidateHelp();
      break;
    case "init":
      showInitHelp();
      break;
    default:
      console.log(formatDescription(`Unknown command: ${command}`));
      console.log(
        formatDescription('Run "xrpc help" to see all available commands.'),
      );
  }
}

function showGenerateHelp(): void {
  console.log();
  console.log(formatBoxHeader("Generate Command"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(
      formatSecondary(
        "Generate type-safe clients and servers from API contracts defined with Zod schemas.",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Usage"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCode("xrpc generate [options]")));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Options"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCommand("-i, --input <path>")));
  console.log(
    formatBoxLine(
      formatSecondary("  Path to API contract file (e.g., src/api.ts)"),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCommand("-o, --output <directory>")));
  console.log(
    formatBoxLine(
      formatSecondary(
        "  Output directory for generated code (default: generated)",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCommand("-t, --targets <targets>")));
  console.log(
    formatBoxLine(
      formatSecondary("  Comma-separated list of targets to generate"),
    ),
  );
  const targets = listTargets();
  for (let i = 0; i < targets.length; i++) {
    const isLast = i === targets.length - 1;
    console.log(
      formatBoxLine(
        formatSecondary("  ") +
          formatTreeItem(formatTarget(targets[i]), isLast),
      ),
    );
  }
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Examples"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatSecondary("# Generate Go server code")));
  console.log(
    formatBoxLine(
      formatCode("xrpc generate -i src/api.ts -o generated -t go-server"),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(formatSecondary("# Generate for multiple targets")),
  );
  console.log(
    formatBoxLine(
      formatCode("xrpc generate -i api.ts -o out -t go-server,ts-client"),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(
      formatSecondary("# Interactive mode (prompts for missing arguments)"),
    ),
  );
  console.log(formatBoxLine(formatCode("xrpc generate")));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatInfo("The generate command will:"));
  console.log(formatSecondary("  1. Parse your TypeScript/Zod API contract"));
  console.log(formatSecondary("  2. Extract endpoints and types"));
  console.log(
    formatSecondary("  3. Generate type-safe code for selected targets"),
  );
  console.log(formatSecondary("  4. Write files to the output directory"));
  console.log();
}

function showValidateHelp(): void {
  console.log();
  console.log(formatBoxHeader("Validate Command"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(
      formatSecondary(
        "Validate an API contract file for type safety, syntax, and structure.",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Usage"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCode("xrpc validate [file]")));
  console.log(formatBoxLine(formatCode("xrpc validate -f <file>")));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Options"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCommand("-f, --file <path>")));
  console.log(
    formatBoxLine(
      formatSecondary("  Path to API contract file (e.g., src/api.ts)"),
    ),
  );
  console.log(
    formatBoxLine(
      formatSecondary("  Can also be provided as a positional argument"),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("What it validates"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatTreeItem("TypeScript syntax errors", false)));
  console.log(
    formatBoxLine(
      formatTreeItem("Contract structure (router, endpoints)", false),
    ),
  );
  console.log(
    formatBoxLine(
      formatTreeItem("Endpoint definitions (query/mutation types)", false),
    ),
  );
  console.log(
    formatBoxLine(
      formatTreeItem("Schema validity (input/output schemas)", true),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Examples"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatSecondary("# Validate contract file")));
  console.log(formatBoxLine(formatCode("xrpc validate src/api.ts")));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatSecondary("# Interactive mode")));
  console.log(formatBoxLine(formatCode("xrpc validate")));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(
    formatInfo(
      "The validate command helps catch errors before code generation.",
    ),
  );
  console.log(
    formatSecondary("Use it in CI/CD pipelines to ensure contract validity."),
  );
  console.log();
}

function showInitHelp(): void {
  console.log();
  console.log(formatBoxHeader("Init Command"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(
      formatSecondary(
        "Initialize xRPC in your project with an interactive setup wizard.",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Usage"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCode("xrpc init")));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("What it does"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(formatCommand("1. Detects your project structure")),
  );
  console.log(
    formatBoxLine(
      formatSecondary(
        "   Identifies monorepo type, scans for apps, finds existing contracts",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCommand("2. Guides you through setup")));
  console.log(
    formatBoxLine(
      formatSecondary(
        "   Choose contract, select targets, configure output directories",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatCommand("3. Creates configuration files")));
  console.log(
    formatBoxLine(
      formatSecondary(
        "   xrpc.toml, sample contract, API package (for monorepos)",
      ),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Supported Monorepos"));
  console.log(formatBoxLine(""));
  console.log(formatBoxLine(formatTreeItem("Nx", false)));
  console.log(formatBoxLine(formatTreeItem("Turborepo", false)));
  console.log(formatBoxLine(formatTreeItem("pnpm workspaces", false)));
  console.log(formatBoxLine(formatTreeItem("Bun workspaces", false)));
  console.log(formatBoxLine(formatTreeItem("Yarn workspaces", false)));
  console.log(formatBoxLine(formatTreeItem("npm workspaces", true)));
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(formatBoxHeader("Detected App Types"));
  console.log(formatBoxLine(""));
  console.log(
    formatBoxLine(formatTreeItem("Next.js, React, Vite → ts-client", false)),
  );
  console.log(formatBoxLine(formatTreeItem("Go → go-server", false)));
  console.log(
    formatBoxLine(
      formatTreeItem("Python, Node.js (detected, no target yet)", true),
    ),
  );
  console.log(formatBoxLine(""));
  console.log(formatBoxFooter());
  console.log();

  console.log(
    formatInfo('After running init, use "xrpc generate" to generate code.'),
  );
  console.log();
}
