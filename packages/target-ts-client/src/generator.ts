import {
  TYPE_KINDS,
  type Target,
  type TargetInput,
  type TargetOutput,
  type TargetSupport,
  VALIDATION_KINDS,
  validateSupport,
} from "@xrpckit/sdk";
import { TsClientGenerator } from "./client-generator";
import { TsTypeGenerator } from "./type-generator";

/**
 * TypeScript client code generator that produces type-safe RPC clients from xRPC contracts.
 *
 * Generates two files:
 * - types.ts: Type exports using Zod's InferInput/InferOutput
 * - client.ts: RPC client with typed methods
 *
 * Note: This target relies on Zod for runtime validation and schema inference.
 */
const support: TargetSupport = {
  supportedTypes: [...TYPE_KINDS],
  supportedValidations: [...VALIDATION_KINDS],
  notes: [
    "Uses Zod for type inference and runtime validation",
    "Generates fully typed RPC client functions",
    "Requires the original contract file for schema imports",
  ],
};

function getContractPath(
  options?: Record<string, unknown>,
): string | undefined {
  if (
    options &&
    typeof options.contractPath === "string" &&
    options.contractPath
  ) {
    return options.contractPath;
  }
  return undefined;
}

function generateTsClient(input: TargetInput): TargetOutput {
  const { contract, outputDir } = input;
  const diagnostics = validateSupport(contract, support, "ts-client");

  const contractPath = getContractPath(input.options);
  if (!contractPath) {
    diagnostics.push({
      severity: "error",
      message:
        "contractPath is required for ts-client target. Pass it via target options.",
    });
  }

  const hasErrors = diagnostics.some((issue) => issue.severity === "error");
  if (hasErrors) {
    return { files: [], diagnostics };
  }

  const typeGenerator = new TsTypeGenerator(contractPath!, outputDir);
  const clientGenerator = new TsClientGenerator();

  return {
    files: [
      {
        path: "types.ts",
        content: typeGenerator.generateTypes(contract),
      },
      {
        path: "client.ts",
        content: clientGenerator.generateClient(contract),
      },
    ],
    diagnostics,
  };
}

export const tsClientTarget: Target = {
  name: "ts-client",
  generate: generateTsClient,
};
