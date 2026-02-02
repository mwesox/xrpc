import {
  type ContractDefinition,
  type Property,
  type TypeReference,
  toPascalCase,
} from "@xrpckit/sdk";
import { uniqueName } from "./utils";

export interface CollectedType {
  name: string;
  typeRef: TypeReference;
  source: string;
}

export class SwiftTypeCollector {
  private collectedTypes: Map<string, CollectedType> = new Map();
  private usedNames: Set<string> = new Set();

  collectTypes(contract: ContractDefinition): CollectedType[] {
    this.collectedTypes.clear();
    this.usedNames.clear();

    for (const type of contract.types) {
      this.usedNames.add(toPascalCase(type.name));
    }

    for (const endpoint of contract.endpoints) {
      if (endpoint.input.name) {
        this.usedNames.add(toPascalCase(endpoint.input.name));
      }
      if (endpoint.output.name) {
        this.usedNames.add(toPascalCase(endpoint.output.name));
      }
    }

    for (const endpoint of contract.endpoints) {
      this.processTypeReference(
        endpoint.input,
        endpoint.input.name || `${endpoint.name}Input`,
        `${endpoint.fullName}.input`,
      );
      this.processTypeReference(
        endpoint.output,
        endpoint.output.name || `${endpoint.name}Output`,
        `${endpoint.fullName}.output`,
      );
    }

    return Array.from(this.collectedTypes.values());
  }

  private processProperty(prop: Property, parentContext: string): void {
    const propContext = `${parentContext}${toPascalCase(prop.name)}`;
    this.processTypeReference(
      prop.type,
      propContext,
      `${parentContext}.${prop.name}`,
    );
  }

  private processTypeReference(
    typeRef: TypeReference,
    suggestedName: string,
    source: string,
  ): void {
    if (typeRef.kind === "optional" || typeRef.kind === "nullable") {
      if (typeRef.name) {
        this.addCollectedType(toPascalCase(typeRef.name), typeRef, source);
      }
      if (typeof typeRef.baseType === "object") {
        this.processTypeReference(
          typeRef.baseType,
          suggestedName,
          `${source}.${typeRef.kind}`,
        );
      }
      return;
    }

    if (typeRef.name) {
      this.addCollectedType(toPascalCase(typeRef.name), typeRef, source);
    }

    if (typeRef.kind === "object" && typeRef.properties) {
      if (!typeRef.name) {
        const assignedName = this.assignUniqueName(suggestedName);
        typeRef.name = assignedName;
        this.addCollectedType(assignedName, typeRef, source);
      }

      const contextName = toPascalCase(typeRef.name);
      for (const prop of typeRef.properties) {
        this.processProperty(prop, contextName);
      }
      return;
    }

    if (typeRef.kind === "array" && typeRef.elementType) {
      const elementName = suggestedName.endsWith("Item")
        ? suggestedName
        : `${suggestedName}Item`;
      this.processTypeReference(
        typeRef.elementType,
        elementName,
        `${source}.array`,
      );
      return;
    }

    if (typeRef.kind === "record" && typeRef.valueType) {
      this.processTypeReference(
        typeRef.valueType,
        `${suggestedName}Value`,
        `${source}.record`,
      );
      return;
    }

    if (typeRef.kind === "tuple" && typeRef.tupleElements) {
      typeRef.tupleElements.forEach((elem, index) => {
        this.processTypeReference(
          elem,
          `${suggestedName}V${index}`,
          `${source}.tuple[${index}]`,
        );
      });
      return;
    }

    if (typeRef.kind === "union" && typeRef.unionTypes) {
      typeRef.unionTypes.forEach((variant, index) => {
        this.processTypeReference(
          variant,
          `${suggestedName}Variant${index}`,
          `${source}.union[${index}]`,
        );
      });
      return;
    }
  }

  private addCollectedType(
    name: string,
    typeRef: TypeReference,
    source: string,
  ): void {
    if (this.collectedTypes.has(name)) return;
    this.collectedTypes.set(name, { name, typeRef, source });
  }

  private assignUniqueName(baseName: string): string {
    const pascal = toPascalCase(baseName);
    return uniqueName(pascal, this.usedNames);
  }
}
