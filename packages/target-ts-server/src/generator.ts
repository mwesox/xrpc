import {
  TYPE_KINDS,
  type Target,
  type TargetInput,
  type TargetOutput,
  type TargetSupport,
  VALIDATION_KINDS,
  validateSupport,
} from "@xrpckit/sdk";
import { TsServerGenerator } from "./server-generator";
import { TsTypeGenerator } from "./type-generator";

/**
 * TypeScript server code generator that produces type-safe RPC handlers from xRPC contracts.
 *
 * Generates two files:
 * - types.ts: Type exports using Zod's InferInput/InferOutput
 * - server.ts: RPC handler utilities and method dispatch
 *
 * Note: This target relies on Zod for runtime validation and schema inference.
 */
const support: TargetSupport = {
  supportedTypes: [...TYPE_KINDS],
  supportedValidations: [...VALIDATION_KINDS],
  notes: [
    "Uses Zod for type inference and runtime validation",
    "Generates a server-side dispatcher and Fetch/Bun handler",
    "Requires the original contract file for schema imports",
  ],
};

function getContractPath(options?: Record<string, unknown>): string | undefined {
  if (
    options &&
    typeof options.contractPath === "string" &&
    options.contractPath
  ) {
    return options.contractPath;
  }
  return undefined;
}

function generateTsServer(input: TargetInput): TargetOutput {
  const { contract, outputDir } = input;
  const diagnostics = validateSupport(contract, support, "ts-server");

  const contractPath = getContractPath(input.options);
  if (!contractPath) {
    diagnostics.push({
      severity: "error",
      message:
        "contractPath is required for ts-server target. Pass it via target options.",
    });
  }

  const hasErrors = diagnostics.some((issue) => issue.severity === "error");
  if (hasErrors) {
    return { files: [], diagnostics };
  }

  const typeGenerator = new TsTypeGenerator(contractPath!, outputDir);
  const serverGenerator = new TsServerGenerator();

  return {
    files: [
      {
        path: "types.ts",
        content: typeGenerator.generateTypes(contract),
      },
      {
        path: "server.ts",
        content: serverGenerator.generateServer(contract),
      },
    ],
    diagnostics,
  };
}

export const tsServerTarget: Target = {
  name: "ts-server",
  generate: generateTsServer,
};
