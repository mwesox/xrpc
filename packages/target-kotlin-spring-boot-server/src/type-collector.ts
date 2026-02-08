import type { ContractDefinition, TypeReference } from "@xrpckit/sdk";
import { toPascalCase } from "@xrpckit/sdk";
import { endpointBaseName, toKotlinPascalCase, uniqueName } from "./utils";

export interface CollectedType {
  name: string;
  typeRef: TypeReference;
  source: string;
}

export class KotlinTypeCollector {
  private readonly collected = new Map<string, CollectedType>();
  private readonly refNames = new WeakMap<TypeReference, string>();
  private readonly usedNames = new Set<string>();

  collectTypes(contract: ContractDefinition): CollectedType[] {
    this.collected.clear();
    this.usedNames.clear();

    for (const type of contract.types) {
      this.usedNames.add(toKotlinPascalCase(type.name));
    }

    for (const endpoint of contract.endpoints) {
      if (endpoint.input.name) {
        this.usedNames.add(toKotlinPascalCase(endpoint.input.name));
      }
      if (endpoint.output.name) {
        this.usedNames.add(toKotlinPascalCase(endpoint.output.name));
      }
    }

    for (const type of contract.types) {
      this.processTypeRef(type, type.name, `types.${type.name}`, true);
    }

    for (const endpoint of contract.endpoints) {
      const base = endpointBaseName(endpoint.fullName);
      this.processTypeRef(
        endpoint.input,
        endpoint.input.name ?? `${base}Input`,
        `${endpoint.fullName}.input`,
      );
      this.processTypeRef(
        endpoint.output,
        endpoint.output.name ?? `${base}Output`,
        `${endpoint.fullName}.output`,
      );
    }

    return Array.from(this.collected.values());
  }

  getTypeName(typeRef: TypeReference): string | undefined {
    if (typeRef.name) {
      return toKotlinPascalCase(typeRef.name);
    }
    return this.refNames.get(typeRef);
  }

  private processTypeRef(
    typeRef: TypeReference,
    suggestedName: string,
    source: string,
    forceCollect = false,
  ): void {
    if (typeRef.kind === "optional" || typeRef.kind === "nullable") {
      if (typeof typeRef.baseType === "object") {
        this.processTypeRef(
          typeRef.baseType,
          suggestedName,
          `${source}.${typeRef.kind}`,
          forceCollect,
        );
      }
      return;
    }

    const kindNeedsType =
      typeRef.kind === "object" ||
      typeRef.kind === "enum" ||
      typeRef.kind === "union" ||
      typeRef.kind === "tuple";

    const shouldCollect = forceCollect || kindNeedsType || !!typeRef.name;
    let resolvedName = typeRef.name
      ? toKotlinPascalCase(typeRef.name)
      : toKotlinPascalCase(suggestedName);

    if (!typeRef.name && shouldCollect) {
      resolvedName = uniqueName(resolvedName, this.usedNames);
    }

    if (shouldCollect) {
      this.usedNames.add(resolvedName);
      this.refNames.set(typeRef, resolvedName);
      if (!this.collected.has(resolvedName)) {
        this.collected.set(resolvedName, {
          name: resolvedName,
          typeRef,
          source,
        });
      }
    }

    const nestedContext =
      this.getTypeName(typeRef) ?? toPascalCase(suggestedName);

    if (typeRef.kind === "object" && typeRef.properties) {
      for (const property of typeRef.properties) {
        this.processTypeRef(
          property.type,
          `${nestedContext}${toPascalCase(property.name)}`,
          `${source}.${property.name}`,
        );
      }
      return;
    }

    if (typeRef.kind === "array" && typeRef.elementType) {
      this.processTypeRef(
        typeRef.elementType,
        `${nestedContext}Item`,
        `${source}.array`,
      );
      return;
    }

    if (typeRef.kind === "record" && typeRef.valueType) {
      this.processTypeRef(
        typeRef.valueType,
        `${nestedContext}Value`,
        `${source}.record`,
      );
      return;
    }

    if (typeRef.kind === "tuple" && typeRef.tupleElements) {
      typeRef.tupleElements.forEach((element, index) => {
        this.processTypeRef(
          element,
          `${nestedContext}Item${index}`,
          `${source}.tuple[${index}]`,
        );
      });
      return;
    }

    if (typeRef.kind === "union" && typeRef.unionTypes) {
      typeRef.unionTypes.forEach((variant, index) => {
        this.processTypeRef(
          variant,
          `${nestedContext}Variant${index}`,
          `${source}.union[${index}]`,
        );
      });
    }
  }
}
