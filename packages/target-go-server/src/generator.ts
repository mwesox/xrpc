import {
  type ContractDefinition,
  type Property,
  TYPE_KINDS,
  type Target,
  type TargetInput,
  type TargetOutput,
  type TargetSupport,
  type TypeDefinition,
  type TypeReference,
  VALIDATION_KINDS,
  toPascalCase,
  validateSupport,
} from "@xrpckit/sdk";
import { GoServerGenerator } from "./server-generator";
import { GoTypeCollector } from "./type-collector";
import { GoTypeGenerator } from "./type-generator";
import { GoValidationGenerator } from "./validation-generator";

/**
 * Go server code generator that produces idiomatic Go HTTP handlers from xRPC contracts.
 *
 * Generates three files:
 * - types.go: Struct definitions, handler types, middleware types
 * - router.go: HTTP routing and JSON handling
 * - validation.go: Input validation functions
 */
const support: TargetSupport = {
  supportedTypes: [...TYPE_KINDS],
  supportedValidations: [...VALIDATION_KINDS],
  notes: [
    "Generates idiomatic Go code using standard library only",
    "Uses net/http for HTTP handling",
    "Uses encoding/json for JSON marshaling",
    "Validation uses net/mail for email, net/url for URLs, regexp for patterns",
  ],
};

function getPackageName(options?: Record<string, unknown>): string {
  if (
    options &&
    typeof options.packageName === "string" &&
    options.packageName
  ) {
    return options.packageName;
  }
  return "server";
}

function isNullableType(typeRef: TypeReference): boolean {
  if (typeRef.kind === "nullable") {
    return true;
  }

  if (typeRef.kind === "optional" && typeof typeRef.baseType === "object") {
    return isNullableType(typeRef.baseType);
  }

  if (typeRef.kind === "union" && typeRef.unionTypes) {
    const nonNullVariants = typeRef.unionTypes.filter(
      (variant) =>
        !(variant.kind === "literal" && variant.literalValue === null),
    );
    return nonNullVariants.length === 1;
  }

  return false;
}

function collectRequiredNullableFields(contract: ContractDefinition): string[] {
  const results = new Set<string>();
  const visited = new Set<string>();

  const collectFromProperties = (
    properties: Property[],
    parentName: string,
  ): void => {
    for (const prop of properties) {
      const propPath = `${parentName}.${prop.name}`;
      if (prop.required && isNullableType(prop.type)) {
        results.add(propPath);
      }
      collectFromTypeRef(prop.type, `${parentName}${toPascalCase(prop.name)}`);
    }
  };

  const collectFromTypeRef = (
    typeRef: TypeReference,
    contextName: string,
  ): void => {
    if (typeRef.kind === "optional" || typeRef.kind === "nullable") {
      if (typeof typeRef.baseType === "object") {
        collectFromTypeRef(typeRef.baseType, contextName);
      }
      return;
    }

    if (typeRef.kind === "object" && typeRef.properties) {
      const typeName = typeRef.name ? toPascalCase(typeRef.name) : contextName;
      collectFromProperties(typeRef.properties, typeName);
      return;
    }

    if (typeRef.kind === "array" && typeRef.elementType) {
      collectFromTypeRef(typeRef.elementType, `${contextName}Item`);
      return;
    }

    if (typeRef.kind === "record" && typeRef.valueType) {
      collectFromTypeRef(typeRef.valueType, `${contextName}Value`);
      return;
    }

    if (typeRef.kind === "tuple" && typeRef.tupleElements) {
      typeRef.tupleElements.forEach((elem, index) => {
        collectFromTypeRef(elem, `${contextName}V${index}`);
      });
      return;
    }

    if (typeRef.kind === "union" && typeRef.unionTypes) {
      typeRef.unionTypes.forEach((variant, index) => {
        collectFromTypeRef(variant, `${contextName}Variant${index}`);
      });
    }
  };

  const collectFromTypeDefinition = (
    typeDef: TypeDefinition,
    typeName: string,
  ): void => {
    if (visited.has(typeName)) return;
    visited.add(typeName);

    if (typeDef.properties) {
      collectFromProperties(typeDef.properties, typeName);
    }

    if (typeDef.kind === "array" && typeDef.elementType) {
      collectFromTypeRef(typeDef.elementType, `${typeName}Item`);
    }
  };

  for (const type of contract.types) {
    collectFromTypeDefinition(type, toPascalCase(type.name));
  }

  for (const endpoint of contract.endpoints) {
    collectFromTypeRef(endpoint.input, `${endpoint.fullName}.input`);
    collectFromTypeRef(endpoint.output, `${endpoint.fullName}.output`);
  }

  return Array.from(results);
}

function generateGoServer(input: TargetInput): TargetOutput {
  const { contract } = input;
  const diagnostics = validateSupport(contract, support, "go-server");
  const requiredNullableFields = collectRequiredNullableFields(contract);
  for (const field of requiredNullableFields) {
    diagnostics.push({
      severity: "warning",
      message: `Field "${field}" is required and nullable. Go cannot distinguish missing values from null, so validation only runs when the value is present.`,
    });
  }
  const hasErrors = diagnostics.some((issue) => issue.severity === "error");
  if (hasErrors) {
    return { files: [], diagnostics };
  }

  const packageName = getPackageName(input.options);
  const typeCollector = new GoTypeCollector();
  const collectedTypes = typeCollector.collectTypes(contract);

  const typeGenerator = new GoTypeGenerator(packageName);
  const serverGenerator = new GoServerGenerator(packageName);
  const validationGenerator = new GoValidationGenerator(packageName);

  return {
    files: [
      {
        path: "types.go",
        content: typeGenerator.generateTypes(contract, collectedTypes),
      },
      {
        path: "router.go",
        content: serverGenerator.generateServer(contract),
      },
      {
        path: "validation.go",
        content: validationGenerator.generateValidation(
          contract,
          collectedTypes,
        ),
      },
    ],
    diagnostics,
  };
}

export const goTarget: Target = {
  name: "go-server",
  generate: generateGoServer,
};
