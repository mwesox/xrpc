import {
  type ContractDefinition,
  type Property,
  type TypeDefinition,
  type TypeReference,
  toPascalCase,
} from "@xrpckit/sdk";

export interface CollectedType {
  name: string;
  typeRef: TypeReference;
  // Track where this type was collected from for debugging
  source: string;
}

/**
 * GoTypeCollector traverses a contract and collects all types that need
 * Go struct generation, including nested inline objects that don't have names.
 *
 * This solves the problem where inline objects like:
 *   tasks: z.array(z.object({ id: z.string() }))
 *
 * Would generate `[]interface{}` instead of a proper typed struct.
 */
export class GoTypeCollector {
  private collectedTypes: Map<string, CollectedType> = new Map();
  private usedNames: Set<string> = new Set();

  /**
   * Collect all types from a contract that need Go struct generation.
   * This includes:
   * - Named types from contract.types
   * - Anonymous inline objects nested in properties
   * - Array element types that are inline objects
   * - Optional/nullable wrapped inline objects
   */
  collectTypes(contract: ContractDefinition): CollectedType[] {
    this.collectedTypes.clear();
    this.usedNames.clear();

    // First pass: collect all explicitly named types to avoid collisions
    for (const type of contract.types) {
      const pascalName = toPascalCase(type.name);
      this.usedNames.add(pascalName);
    }

    // Second pass: process all types and extract nested types
    for (const type of contract.types) {
      this.processTypeDefinition(type, type.name);
    }

    return Array.from(this.collectedTypes.values());
  }

  /**
   * Process a type definition and extract any nested inline types
   */
  private processTypeDefinition(
    type: TypeDefinition,
    contextName: string,
  ): void {
    if (type.properties) {
      for (const prop of type.properties) {
        this.processProperty(prop, contextName);
      }
    }

    // Handle array types with inline element types
    if (type.kind === "array" && type.elementType) {
      this.processTypeReference(
        type.elementType,
        `${contextName}Item`,
        `${contextName}.elementType`,
      );
    }
  }

  /**
   * Process a property and extract any nested inline types
   */
  private processProperty(prop: Property, parentContext: string): void {
    const propContext = `${parentContext}${toPascalCase(prop.name)}`;
    this.processTypeReference(
      prop.type,
      propContext,
      `${parentContext}.${prop.name}`,
    );
  }

  /**
   * Process a type reference and extract any nested inline types.
   * This is the core function that handles all the different type kinds.
   */
  private processTypeReference(
    typeRef: TypeReference,
    suggestedName: string,
    source: string,
  ): void {
    // Unwrap optional - process the inner type
    if (typeRef.kind === "optional") {
      if (typeof typeRef.baseType === "object") {
        this.processTypeReference(
          typeRef.baseType,
          suggestedName,
          `${source}.optional`,
        );
      }
      return;
    }

    // Unwrap nullable - process the inner type
    if (typeRef.kind === "nullable") {
      if (typeof typeRef.baseType === "object") {
        this.processTypeReference(
          typeRef.baseType,
          suggestedName,
          `${source}.nullable`,
        );
      }
      return;
    }

    // Handle arrays - process element type
    if (typeRef.kind === "array" && typeRef.elementType) {
      // For arrays, the element type gets "Item" suffix
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

    // Handle inline objects without names - these need to be collected
    if (typeRef.kind === "object" && typeRef.properties && !typeRef.name) {
      const assignedName = this.assignUniqueName(suggestedName);

      // Assign the name to the type reference (mutating)
      typeRef.name = assignedName;

      // Collect this type
      this.collectedTypes.set(assignedName, {
        name: assignedName,
        typeRef,
        source,
      });

      // Process nested properties of this inline object
      for (const prop of typeRef.properties) {
        this.processProperty(prop, assignedName);
      }
      return;
    }

    // Handle records - process value type
    if (typeRef.kind === "record" && typeRef.valueType) {
      this.processTypeReference(
        typeRef.valueType,
        `${suggestedName}Value`,
        `${source}.record`,
      );
      return;
    }

    // Handle tuples - process each element type
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

    // Handle unions - process each variant type
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

    // Named objects - just recurse into properties to find nested inline types
    if (typeRef.kind === "object" && typeRef.properties && typeRef.name) {
      for (const prop of typeRef.properties) {
        this.processProperty(prop, toPascalCase(typeRef.name));
      }
    }
  }

  /**
   * Assign a unique name, adding numeric suffix if there's a collision
   */
  private assignUniqueName(baseName: string): string {
    let name = baseName;
    let counter = 1;

    while (this.usedNames.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }

    this.usedNames.add(name);
    return name;
  }

  /**
   * Get all collected nested types (not including the main contract types)
   */
  getCollectedTypes(): CollectedType[] {
    return Array.from(this.collectedTypes.values());
  }
}
