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
import { GoServerGenerator } from "./server-generator";
import { GoTypeCollector } from "./type-collector";
import { GoTypeGenerator } from "./type-generator";
import { GoValidationGenerator } from "./validation-generator";
import { GoTypeMapper } from "./type-mapper";
import { GoValidationMapper } from "./validation-mapper";

/**
 * Go server code generator that produces idiomatic Go HTTP handlers from xRPC contracts.
 *
 * Extends TargetGeneratorBase to use the framework's type and validation mapping system.
 * Generates three files:
 * - types.go: Struct definitions, handler types, middleware types
 * - router.go: HTTP routing and JSON handling
 * - validation.go: Input validation functions
 */
export class GoCodeGenerator extends TargetGeneratorBase<string, import("./validation-mapper").GoValidationCode> {
  readonly name = "go-server";

  readonly typeMapper: GoTypeMapper;
  readonly validationMapper: GoValidationMapper;

  readonly capabilities: TargetCapabilities = createCapabilities("go-server", {
    supportedTypes: [...TYPE_KINDS],
    unsupportedTypes: [
      // All types are supported, but some have fallbacks
    ],
    supportedValidations: [...VALIDATION_KINDS],
    unsupportedValidations: [
      // All validations are supported
    ],
    notes: [
      "Generates idiomatic Go code using standard library only",
      "Uses net/http for HTTP handling",
      "Uses encoding/json for JSON marshaling",
      "Validation uses net/mail for email, net/url for URLs, regexp for patterns",
    ],
  });

  private typeGenerator: GoTypeGenerator;
  private serverGenerator: GoServerGenerator;
  private validationGenerator: GoValidationGenerator;
  private typeCollector: GoTypeCollector;

  constructor(config: GeneratorConfig) {
    super(config);
    const packageName = config.packageName || "server";

    // Initialize framework mappers
    this.typeMapper = new GoTypeMapper();
    this.validationMapper = new GoValidationMapper();

    // Initialize existing generators
    this.typeCollector = new GoTypeCollector();
    this.typeGenerator = new GoTypeGenerator(packageName);
    this.serverGenerator = new GoServerGenerator(packageName);
    this.validationGenerator = new GoValidationGenerator(packageName);
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

    // Run type collector once to discover and name all nested inline types
    // This mutates the contract with assigned names that both generators will see
    const collectedTypes = this.typeCollector.collectTypes(contract);

    return {
      types: this.typeGenerator.generateTypes(contract, collectedTypes),
      server: this.serverGenerator.generateServer(contract),
      validation: this.validationGenerator.generateValidation(
        contract,
        collectedTypes
      ),
    };
  }
}
