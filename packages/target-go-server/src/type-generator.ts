import {
  type ContractDefinition,
  type Property,
  type TypeDefinition,
  type TypeReference,
  toPascalCase,
} from "@xrpckit/sdk";
import { GoBuilder } from "./go-builder";
import type { CollectedType } from "./type-collector";
import { GoTypeMapper } from "./type-mapper";

// Helper to convert "greeting.greet" to "GreetingGreet"
function toMethodName(fullName: string): string {
  return fullName
    .split(".")
    .map((part) => toPascalCase(part))
    .join("");
}

export class GoTypeGenerator {
  private w: GoBuilder;
  private typeMapper: GoTypeMapper;
  private packageName: string;
  private generatedTypes: Set<string> = new Set();

  constructor(packageName = "server") {
    this.w = new GoBuilder();
    this.typeMapper = new GoTypeMapper();
    this.packageName = packageName;
  }

  /**
   * Generate Go types from a contract definition.
   * @param contract - The contract definition (should have names assigned to inline types)
   * @param collectedTypes - Optional pre-collected nested types from GoTypeCollector
   */
  generateTypes(
    contract: ContractDefinition,
    collectedTypes?: CollectedType[],
  ): string {
    const w = this.w.reset();
    this.typeMapper.reset();
    this.generatedTypes.clear();

    w.package(this.packageName).import("net/http");

    // Generate Context type for middleware support
    this.generateContextType();

    // Always generate middleware types (router uses them)
    this.generateMiddlewareTypes();

    // Generate input/output types from contract
    for (const type of contract.types) {
      this.generateType(type);
    }

    // Generate any additional types from collected nested types
    if (collectedTypes) {
      for (const collected of collectedTypes) {
        if (!this.generatedTypes.has(collected.name)) {
          this.generateTypeFromReference(collected.name, collected.typeRef);
        }
      }
    }

    // Generate tuple types if any were registered during type mapping
    this.generateTupleTypes();

    // Generate union wrapper types if any were registered during type mapping
    this.generateUnionTypes();

    // Generate typed handler types for each endpoint
    this.generateTypedHandlers(contract);

    return w.toString();
  }

  private generateContextType(): void {
    // Generate Context struct for middleware and handlers
    this.w
      .struct("Context", (b) => {
        b.l("Request        *http.Request")
          .l("ResponseWriter http.ResponseWriter")
          .l("Data           map[string]interface{}");
      })
      .n();
  }

  private generateMiddlewareTypes(): void {
    // Generate middleware function type
    this.w
      .comment(
        "MiddlewareFunc is a function that processes a request and extends context",
      )
      .n()
      .type("MiddlewareFunc", "func(ctx *Context) *MiddlewareResult")
      .n();

    // Generate middleware result type
    this.w
      .struct("MiddlewareResult", (b) => {
        b.l("Context  *Context")
          .l("Error    error")
          .l("Response *http.Response");
      })
      .n();

    this.w
      .comment("NewMiddlewareResult creates a successful middleware result")
      .n()
      .func("NewMiddlewareResult(ctx *Context) *MiddlewareResult", (b) => {
        b.return("&MiddlewareResult{Context: ctx}");
      })
      .n();

    this.w
      .comment("NewMiddlewareError creates a middleware result with an error")
      .n()
      .func("NewMiddlewareError(err error) *MiddlewareResult", (b) => {
        b.return("&MiddlewareResult{Error: err}");
      })
      .n();

    this.w
      .comment(
        "NewMiddlewareResponse creates a middleware result that short-circuits with a response",
      )
      .n()
      .func(
        "NewMiddlewareResponse(resp *http.Response) *MiddlewareResult",
        (b) => {
          b.return("&MiddlewareResult{Response: resp}");
        },
      )
      .n();
  }

  private generateType(type: TypeDefinition): void {
    const typeName = toPascalCase(type.name);

    // Skip if already generated
    if (this.generatedTypes.has(typeName)) {
      return;
    }

    // Handle array types - generate type alias instead of struct
    if (type.kind === "array" && type.elementType) {
      // For array types with object elements, generate element struct first
      if (type.elementType.kind === "object" && type.elementType.properties) {
        const elementTypeName = type.elementType.name
          ? toPascalCase(type.elementType.name)
          : `${typeName}Item`;

        if (!this.generatedTypes.has(elementTypeName)) {
          this.generateTypeFromReference(elementTypeName, type.elementType);
        }
        // Generate type alias for the slice
        this.generatedTypes.add(typeName);
        this.w.type(typeName, `[]${elementTypeName}`);
      } else {
        // For primitive element types, use the type mapper directly
        const elementGoType = this.typeMapper.mapType(type.elementType).type;
        this.generatedTypes.add(typeName);
        this.w.type(typeName, `[]${elementGoType}`);
      }
      return;
    }

    // Handle object types - generate struct
    if (type.kind === "object") {
      this.generatedTypes.add(typeName);
      this.w.struct(typeName, (b) => {
        if (type.properties) {
          for (const prop of type.properties) {
            const goType = this.typeMapper.mapType(prop.type).type;
            const jsonTag = this.generateJSONTag(prop);
            b.l(`${toPascalCase(prop.name)} ${goType} \`${jsonTag}\``);
          }
        }
      });
      return;
    }

    // Handle named unions/tuples via wrapper generation
    if (type.kind === "union" || type.kind === "tuple") {
      this.typeMapper.mapType(type);
      return;
    }

    // For all other kinds, generate a type alias
    const goType = this.typeMapper.mapType(type).type;
    this.generatedTypes.add(typeName);
    this.w.type(typeName, goType);
  }

  /**
   * Generate a type from a TypeReference (used for nested inline types)
   */
  private generateTypeFromReference(
    typeName: string,
    typeRef: TypeReference,
  ): void {
    // Skip if already generated
    if (this.generatedTypes.has(typeName)) {
      return;
    }

    // Handle object types - generate struct
    if (typeRef.kind === "object" && typeRef.properties) {
      this.generatedTypes.add(typeName);
      this.w.struct(typeName, (b) => {
        for (const prop of typeRef.properties!) {
          const goType = this.typeMapper.mapType(prop.type).type;
          const jsonTag = this.generateJSONTag(prop);
          b.l(`${toPascalCase(prop.name)} ${goType} \`${jsonTag}\``);
        }
      });
      return;
    }

    // Handle array types
    if (typeRef.kind === "array" && typeRef.elementType) {
      if (
        typeRef.elementType.kind === "object" &&
        typeRef.elementType.properties
      ) {
        const elementTypeName = typeRef.elementType.name
          ? toPascalCase(typeRef.elementType.name)
          : `${typeName}Item`;

        if (!this.generatedTypes.has(elementTypeName)) {
          this.generateTypeFromReference(elementTypeName, typeRef.elementType);
        }
        this.generatedTypes.add(typeName);
        this.w.type(typeName, `[]${elementTypeName}`);
      } else {
        const elementGoType = this.typeMapper.mapType(typeRef.elementType).type;
        this.generatedTypes.add(typeName);
        this.w.type(typeName, `[]${elementGoType}`);
      }
      return;
    }

    if (typeRef.kind === "union" || typeRef.kind === "tuple") {
      this.typeMapper.mapType(typeRef, { name: typeName });
      return;
    }

    // For other types, generate a type alias
    const goType = this.typeMapper.mapType(typeRef).type;
    this.generatedTypes.add(typeName);
    this.w.type(typeName, goType);
  }

  /**
   * Generate struct types for tuples
   */
  private generateTupleTypes(): void {
    const tupleTypes = this.typeMapper.getTupleTypes();
    for (const [name, typeRef] of tupleTypes) {
      if (this.generatedTypes.has(name)) continue;
      this.generatedTypes.add(name);

      if (typeRef.tupleElements && typeRef.tupleElements.length > 0) {
        this.w.struct(name, (b) => {
          typeRef.tupleElements?.forEach((elem, index) => {
            const goType = this.typeMapper.mapType(elem).type;
            b.l(`V${index} ${goType} \`json:"v${index}"\``);
          });
        });
      }
    }
  }

  /**
   * Generate wrapper struct types for unions
   */
  private generateUnionTypes(): void {
    const unionTypes = this.typeMapper.getUnionTypes();
    for (const [name, typeRef] of unionTypes) {
      if (this.generatedTypes.has(name)) continue;
      this.generatedTypes.add(name);

      if (typeRef.unionTypes && typeRef.unionTypes.length > 0) {
        // Generate a wrapper struct that can hold any of the union variants
        this.w.struct(name, (b) => {
          // Add a type discriminator field
          b.l('Type string `json:"type,omitempty"`');

          // Add a field for each unique type in the union
          const seenTypes = new Set<string>();
          typeRef.unionTypes?.forEach((variant, index) => {
            const goType = this.typeMapper.mapType(variant).type;
            // Skip if we've already added a field for this Go type
            if (seenTypes.has(goType)) return;
            seenTypes.add(goType);

            // Use pointer so only one field is set at a time
            const fieldName = this.getUnionFieldName(variant, index);
            b.l(
              `${fieldName} *${goType} \`json:"${fieldName.toLowerCase()},omitempty"\``,
            );
          });
        });
      }
    }
  }

  /**
   * Get a descriptive field name for a union variant
   */
  private getUnionFieldName(typeRef: TypeReference, index: number): string {
    if (typeRef.name) {
      return toPascalCase(typeRef.name);
    }
    if (typeRef.kind === "primitive" && typeof typeRef.baseType === "string") {
      return toPascalCase(typeRef.baseType);
    }
    if (typeRef.kind === "literal") {
      const val = typeRef.literalValue;
      if (typeof val === "string") return `String${index}`;
      if (typeof val === "number") return `Number${index}`;
      if (typeof val === "boolean") return `Bool${index}`;
    }
    return `Variant${index}`;
  }

  private generateJSONTag(prop: Property): string {
    if (prop.required) {
      return `json:"${prop.name}"`;
    }
    return `json:"${prop.name},omitempty"`;
  }

  private generateTypedHandlers(contract: ContractDefinition): void {
    this.w.comment("Typed handler types for each endpoint").n();

    for (const endpoint of contract.endpoints) {
      const handlerName = `${toMethodName(endpoint.fullName)}Handler`;
      const inputType = toPascalCase(endpoint.input.name!);
      const outputType = toPascalCase(endpoint.output.name!);

      this.w
        .comment(`Handler type for ${endpoint.fullName}`)
        .type(
          handlerName,
          `func(ctx *Context, input ${inputType}) (${outputType}, error)`,
        )
        .n();
    }
  }
}
