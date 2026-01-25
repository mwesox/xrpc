import {
  type ContractDefinition,
  type GeneratedFiles,
  type GeneratorConfig,
  TargetGeneratorBase,
  createCapabilities,
  TYPE_KINDS,
  VALIDATION_KINDS,
  type TargetCapabilities,
} from "@xrpckit/sdk";
import { TsClientGenerator } from "./client-generator";
import { TsTypeGenerator } from "./type-generator";
import { TsTypeMapper } from "./type-mapper";
import { TsValidationMapper } from "./validation-mapper";

/**
 * TypeScript client code generator that produces type-safe RPC clients from xRPC contracts.
 *
 * Extends TargetGeneratorBase to use the framework's type and validation mapping system.
 * Generates two files:
 * - types.ts: Type exports using Zod's InferInput/InferOutput
 * - client.ts: RPC client with typed methods
 *
 * Note: This target relies on Zod for runtime validation, so the validation mapper
 * is a no-op that delegates to Zod schemas.
 */
export class TsCodeGenerator extends TargetGeneratorBase<string, null> {
  readonly name = "ts-client";

  readonly typeMapper: TsTypeMapper;
  readonly validationMapper: TsValidationMapper;

  readonly capabilities: TargetCapabilities = createCapabilities("ts-client", {
    supportedTypes: [...TYPE_KINDS],
    unsupportedTypes: [
      // All types are supported through Zod
    ],
    supportedValidations: [...VALIDATION_KINDS],
    unsupportedValidations: [
      // All validations are supported through Zod
    ],
    notes: [
      "Uses Zod for type inference and runtime validation",
      "Generates fully typed RPC client functions",
      "Requires the original contract file for schema imports",
    ],
  });

  private typeGenerator: TsTypeGenerator;
  private clientGenerator: TsClientGenerator;
  private contractPath: string;

  constructor(config: GeneratorConfig) {
    super(config);

    // Get contract path from config (required for ts-client target)
    const contractPath =
      (config.options?.contractPath as string) || config.outputDir;
    if (!contractPath) {
      throw new Error(
        "contractPath is required for ts-client target. Pass it via GeneratorConfig.options.contractPath"
      );
    }

    // Initialize framework mappers
    this.typeMapper = new TsTypeMapper();
    this.validationMapper = new TsValidationMapper();

    // Initialize existing generators
    this.contractPath = contractPath;
    this.typeGenerator = new TsTypeGenerator(contractPath, config.outputDir);
    this.clientGenerator = new TsClientGenerator();
  }

  generate(contract: ContractDefinition): GeneratedFiles {
    // Reset mappers for new generation run
    this.resetMappers();

    // Validate contract against capabilities
    const validation = this.validateContract(contract);
    if (!validation.valid) {
      const errors = validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message);
      throw new Error(
        `Contract validation failed for ${this.name}:\n${errors.join("\n")}`
      );
    }

    // Log warnings if any
    const warnings = validation.issues.filter((i) => i.severity === "warning");
    if (warnings.length > 0) {
      for (const warning of warnings) {
        console.warn(`[${this.name}] ${warning.message}`);
      }
    }

    return {
      types: this.typeGenerator.generateTypes(contract),
      client: this.clientGenerator.generateClient(contract),
    };
  }
}
