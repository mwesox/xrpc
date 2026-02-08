import {
  type Target,
  type TargetInput,
  type TargetOutput,
  type TargetSupport,
  TYPE_KINDS,
  VALIDATION_KINDS,
  validateSupport,
} from "@xrpckit/sdk";
import { KotlinServerGenerator } from "./server-generator";
import { KotlinTypeGenerator } from "./type-generator";
import { KotlinValidationGenerator } from "./validation-generator";

const support: TargetSupport = {
  supportedTypes: [...TYPE_KINDS],
  supportedValidations: [...VALIDATION_KINDS],
  notes: [
    "Generates Spring Boot compatible Kotlin server code",
    "Uses JSON-RPC style method + params over HTTP POST",
    "Applies Jakarta/Hibernate bean validation annotations on generated DTOs",
  ],
};

function getPackageRoot(options?: Record<string, unknown>): string {
  if (
    options &&
    typeof options.packageName === "string" &&
    options.packageName
  ) {
    return options.packageName.endsWith(".generated")
      ? options.packageName
      : `${options.packageName}.generated`;
  }

  return "xrpc.generated";
}

function generateKotlinSpringBootServer(input: TargetInput): TargetOutput {
  const diagnostics = validateSupport(
    input.contract,
    support,
    "kotlin-spring-boot-server",
  );

  const hasErrors = diagnostics.some((issue) => issue.severity === "error");
  if (hasErrors) {
    return { files: [], diagnostics };
  }

  const contract = JSON.parse(
    JSON.stringify(input.contract),
  ) as TargetInput["contract"];
  const packageRoot = getPackageRoot(input.options);
  const packagePath = packageRoot.replace(/\./g, "/");

  const typeGenerator = new KotlinTypeGenerator(packageRoot);
  const serverGenerator = new KotlinServerGenerator(packageRoot);
  const validationGenerator = new KotlinValidationGenerator(packageRoot);

  const generatedTypes = typeGenerator.generateTypes(contract);

  return {
    files: [
      {
        path: `src/main/kotlin/${packagePath}/rpc/model/RpcModels.kt`,
        content: serverGenerator.generateModels(),
      },
      {
        path: `src/main/kotlin/${packagePath}/rpc/types/GeneratedTypes.kt`,
        content: generatedTypes.content,
      },
      {
        path: `src/main/kotlin/${packagePath}/rpc/validation/ValidationSupport.kt`,
        content: validationGenerator.generateValidationSupport(),
      },
      {
        path: `src/main/kotlin/${packagePath}/rpc/server/Handlers.kt`,
        content: serverGenerator.generateHandlers(
          contract,
          generatedTypes.endpointTypes,
        ),
      },
      {
        path: `src/main/kotlin/${packagePath}/rpc/server/XrpcDispatcher.kt`,
        content: serverGenerator.generateDispatcher(
          contract,
          generatedTypes.endpointTypes,
        ),
      },
      {
        path: `src/main/kotlin/${packagePath}/rpc/server/XrpcController.kt`,
        content: serverGenerator.generateController(),
      },
    ],
    diagnostics,
  };
}

export const kotlinSpringBootServerTarget: Target = {
  name: "kotlin-spring-boot-server",
  generate: generateKotlinSpringBootServer,
};
