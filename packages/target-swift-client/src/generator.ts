import {
  TYPE_KINDS,
  type Target,
  type TargetInput,
  type TargetOutput,
  type TargetSupport,
  type TypeDefinition,
  type TypeReference,
  type Property,
  VALIDATION_KINDS,
  toPascalCase,
  validateSupport,
} from "@xrpckit/sdk";
import { SwiftClientGenerator } from "./client-generator";
import { SwiftTypeGenerator } from "./type-generator";

const support: TargetSupport = {
  supportedTypes: [...TYPE_KINDS],
  supportedValidations: [],
  unsupportedValidations: VALIDATION_KINDS.map((kind) => ({
    kind,
    reason: "Swift client does not generate runtime validations",
  })),
  notes: [
    "Generates Swift Codable models and an async URLSession client",
    "Uses JSON-RPC over HTTP POST with { method, params } payload",
    "Optional and nullable fields both map to Swift optionals",
  ],
};

function isNullableType(typeRef: TypeReference): boolean {
  if (typeRef.kind === "nullable") {
    return true;
  }

  if (typeRef.kind === "optional" && typeof typeRef.baseType === "object") {
    return isNullableType(typeRef.baseType);
  }

  if (typeRef.kind === "union" && typeRef.unionTypes) {
    const nonNullVariants = typeRef.unionTypes.filter(
      (variant) => !(variant.kind === "literal" && variant.literalValue === null),
    );
    return nonNullVariants.length === 1;
  }

  return false;
}

function collectRequiredNullableFields(
  contract: TargetInput["contract"],
): string[] {
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

function generateSwiftClient(input: TargetInput): TargetOutput {
  const { contract } = input;
  const diagnostics = validateSupport(contract, support, "swift-client");

  const requiredNullableFields = collectRequiredNullableFields(contract);
  for (const field of requiredNullableFields) {
    diagnostics.push({
      severity: "warning",
      message: `Field "${field}" is required and nullable. Swift optionals cannot distinguish missing values from null.`,
    });
  }

  const hasErrors = diagnostics.some((issue) => issue.severity === "error");
  if (hasErrors) {
    return { files: [], diagnostics };
  }

  const typeGenerator = new SwiftTypeGenerator();
  const clientGenerator = new SwiftClientGenerator();

  return {
    files: [
      {
        path: "Types.swift",
        content: typeGenerator.generateTypes(contract),
      },
      {
        path: "Client.swift",
        content: clientGenerator.generateClient(contract),
      },
    ],
    diagnostics,
  };
}

export const swiftClientTarget: Target = {
  name: "swift-client",
  generate: generateSwiftClient,
};
