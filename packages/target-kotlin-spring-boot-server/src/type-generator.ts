import type {
  ContractDefinition,
  Endpoint,
  Property,
  TypeReference,
  ValidationRules,
} from "@xrpckit/sdk";
import { KotlinBuilder } from "./kotlin-builder";
import { KotlinTypeCollector } from "./type-collector";
import { KotlinTypeMapper } from "./type-mapper";
import {
  endpointBaseName,
  escapeKotlinString,
  sanitizeKotlinIdentifier,
  toKotlinPascalCase,
  uniqueName,
} from "./utils";

export type EndpointTypeInfo = {
  inputType: string;
  outputType: string;
};

export type GeneratedKotlinTypes = {
  content: string;
  endpointTypes: Record<string, EndpointTypeInfo>;
};

export class KotlinTypeGenerator {
  private readonly w = new KotlinBuilder();
  private readonly collector = new KotlinTypeCollector();
  private readonly mapper = new KotlinTypeMapper((typeRef) =>
    this.collector.getTypeName(typeRef),
  );
  private readonly generated = new Set<string>();

  constructor(private readonly packageRoot = "xrpc.generated") {}

  generateTypes(contract: ContractDefinition): GeneratedKotlinTypes {
    const w = this.w.reset();
    this.generated.clear();

    const collectedTypes = this.collector.collectTypes(contract);
    const endpointTypes = this.collectEndpointTypes(contract);

    w.package(`${this.packageRoot}.rpc.types`);
    w.imports(
      "com.fasterxml.jackson.annotation.JsonCreator",
      "com.fasterxml.jackson.annotation.JsonProperty",
      "com.fasterxml.jackson.annotation.JsonValue",
      "jakarta.validation.Valid",
      "jakarta.validation.constraints.DecimalMax",
      "jakarta.validation.constraints.DecimalMin",
      "jakarta.validation.constraints.Email",
      "jakarta.validation.constraints.Negative",
      "jakarta.validation.constraints.NotNull",
      "jakarta.validation.constraints.Pattern",
      "jakarta.validation.constraints.Positive",
      "jakarta.validation.constraints.Size",
      "org.hibernate.validator.constraints.URL",
      "org.hibernate.validator.constraints.UUID",
      "java.time.OffsetDateTime",
    );

    const sorted = [...collectedTypes].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const collected of sorted) {
      this.generateType(collected.name, collected.typeRef);
      w.n();
    }

    return {
      content: w.toString(),
      endpointTypes,
    };
  }

  private collectEndpointTypes(
    contract: ContractDefinition,
  ): Record<string, EndpointTypeInfo> {
    const endpointTypes: Record<string, EndpointTypeInfo> = {};

    for (const endpoint of contract.endpoints) {
      endpointTypes[endpoint.fullName] = {
        inputType: this.resolveEndpointType(endpoint, "input"),
        outputType: this.resolveEndpointType(endpoint, "output"),
      };
    }

    return endpointTypes;
  }

  private resolveEndpointType(
    endpoint: Endpoint,
    mode: "input" | "output",
  ): string {
    const typeRef = mode === "input" ? endpoint.input : endpoint.output;
    const known = this.collector.getTypeName(typeRef);
    if (known) return known;

    if (typeRef.name) {
      return toKotlinPascalCase(typeRef.name);
    }

    const suffix = mode === "input" ? "Input" : "Output";
    const fallback = `${endpointBaseName(endpoint.fullName)}${suffix}`;
    if (typeRef.kind === "object") {
      return toKotlinPascalCase(fallback);
    }

    return this.mapper.mapTypeWith(typeRef);
  }

  private generateType(name: string, typeRef: TypeReference): void {
    if (this.generated.has(name)) return;
    this.generated.add(name);

    switch (typeRef.kind) {
      case "object":
        this.generateObjectType(name, typeRef.properties ?? []);
        return;
      case "enum":
        this.generateEnumType(name, typeRef.enumValues ?? []);
        return;
      case "union":
        this.w.comment(
          `Union type ${name} mapped to permissive representation`,
        );
        this.w.l(`typealias ${name} = Any?`);
        return;
      case "tuple":
        this.w.comment(`Tuple type ${name} mapped to positional list`);
        this.w.l(`typealias ${name} = List<Any?>`);
        return;
      default:
        this.w.l(`typealias ${name} = ${this.mapper.mapTypeWith(typeRef)}`);
    }
  }

  private generateObjectType(name: string, properties: Property[]): void {
    if (properties.length === 0) {
      this.w.l(`data class ${name}()`);
      return;
    }

    const usedNames = new Set<string>();
    const props = properties.map((property) => {
      const cleanName = sanitizeKotlinIdentifier(property.name);
      const uniquePropertyName = uniqueName(cleanName, usedNames);
      const rules = this.mergeValidationRules(property);
      const type = this.mapper.mapPropertyType(
        property.type,
        rules,
        property.required,
      );
      return {
        originalName: property.name,
        propertyName: uniquePropertyName,
        type,
        required: property.required,
        rules,
        typeRef: property.type,
      };
    });

    this.w.l(`data class ${name}(`).i();

    props.forEach((prop, index) => {
      const annotations = this.validationAnnotations(
        prop.typeRef,
        prop.rules,
        prop.required,
        prop.type,
      );
      for (const annotation of annotations) {
        this.w.l(annotation);
      }

      if (prop.propertyName !== prop.originalName) {
        this.w.l(
          `@field:JsonProperty("${escapeKotlinString(prop.originalName)}")`,
        );
      }

      if (this.requiresCascadeValidation(prop.typeRef)) {
        this.w.l("@field:Valid");
      }

      const defaultValue = prop.type.endsWith("?") ? " = null" : "";
      const suffix = index === props.length - 1 ? "" : ",";
      this.w.l(
        `val ${prop.propertyName}: ${prop.type}${defaultValue}${suffix}`,
      );

      if (index < props.length - 1) {
        this.w.n();
      }
    });

    this.w.u().l(")");
  }

  private generateEnumType(name: string, values: Array<string | number>): void {
    if (values.length === 0) {
      this.w.l(`typealias ${name} = String`);
      return;
    }

    if (!values.every((value) => typeof value === "string")) {
      if (values.every((value) => typeof value === "number")) {
        this.w.l(`typealias ${name} = Double`);
      } else {
        this.w.l(`typealias ${name} = Any?`);
      }
      return;
    }

    const used = new Set<string>();
    const entries = values.map((value, index) => {
      const sanitized = sanitizeKotlinIdentifier(
        String(value)
          .replace(/[^A-Za-z0-9]+/g, "_")
          .toUpperCase(),
      );
      const fallback = `VALUE_${index}`;
      const baseName =
        sanitized === "" || sanitized === "_" ? fallback : sanitized;
      const caseName = uniqueName(baseName, used);
      return {
        caseName,
        rawValue: String(value),
      };
    });

    this.w.l(`enum class ${name}(@get:JsonValue val value: String) {`).i();
    entries.forEach((entry, index) => {
      const suffix = index === entries.length - 1 ? ";" : ",";
      this.w.l(
        `${entry.caseName}("${escapeKotlinString(entry.rawValue)}")${suffix}`,
      );
    });

    this.w.n();
    this.w.l("companion object {").i();
    this.w.l("@JsonCreator");
    this.w.l("@JvmStatic");
    this.w.l(`fun fromValue(value: String): ${name} =`);
    this.w.i();
    this.w.l(
      `values().firstOrNull { it.value == value } ?: throw IllegalArgumentException("Invalid enum value '$value' for ${name}")`,
    );
    this.w.u();
    this.w.u().l("}");

    this.w.u().l("}");
  }

  private mergeValidationRules(property: Property): ValidationRules {
    return {
      ...(property.type.validation ?? {}),
      ...(property.validation ?? {}),
    };
  }

  private validationAnnotations(
    typeRef: TypeReference,
    rules: ValidationRules,
    required: boolean,
    mappedType: string,
  ): string[] {
    const annotations: string[] = [];

    if (
      required &&
      !this.isNullableType(typeRef) &&
      mappedType.endsWith("?") === false
    ) {
      annotations.push("@field:NotNull");
    }

    const baseType = this.resolveBaseType(typeRef);

    const hasLengthRules =
      rules.minLength !== undefined || rules.maxLength !== undefined;
    if (baseType === "string" && hasLengthRules) {
      const parts: string[] = [];
      if (rules.minLength !== undefined) parts.push(`min = ${rules.minLength}`);
      if (rules.maxLength !== undefined) parts.push(`max = ${rules.maxLength}`);
      annotations.push(`@field:Size(${parts.join(", ")})`);
    }

    if (
      baseType === "array" &&
      (rules.minItems !== undefined || rules.maxItems !== undefined)
    ) {
      const parts: string[] = [];
      if (rules.minItems !== undefined) parts.push(`min = ${rules.minItems}`);
      if (rules.maxItems !== undefined) parts.push(`max = ${rules.maxItems}`);
      annotations.push(`@field:Size(${parts.join(", ")})`);
    }

    if (rules.email) annotations.push("@field:Email");
    if (rules.url) annotations.push("@field:URL");
    if (rules.uuid) annotations.push("@field:UUID");
    if (rules.regex) {
      annotations.push(
        `@field:Pattern(regexp = "${escapeKotlinString(rules.regex)}")`,
      );
    }

    if (rules.min !== undefined) {
      annotations.push(`@field:DecimalMin("${rules.min}")`);
    }

    if (rules.max !== undefined) {
      annotations.push(`@field:DecimalMax("${rules.max}")`);
    }

    if (rules.positive) annotations.push("@field:Positive");
    if (rules.negative) annotations.push("@field:Negative");

    return annotations;
  }

  private resolveBaseType(typeRef: TypeReference): string {
    if (typeRef.kind === "optional" || typeRef.kind === "nullable") {
      if (typeof typeRef.baseType === "object") {
        return this.resolveBaseType(typeRef.baseType);
      }
      if (typeof typeRef.baseType === "string") {
        return typeRef.baseType;
      }
    }

    if (typeRef.kind === "primitive" && typeof typeRef.baseType === "string") {
      return typeRef.baseType;
    }

    if (typeRef.kind === "array") return "array";

    return typeRef.kind;
  }

  private isNullableType(typeRef: TypeReference): boolean {
    if (typeRef.kind === "nullable") return true;
    if (typeRef.kind === "optional") return true;

    if (typeRef.kind === "union" && typeRef.unionTypes) {
      return typeRef.unionTypes.some(
        (variant) =>
          variant.kind === "literal" && variant.literalValue === null,
      );
    }

    return false;
  }

  private requiresCascadeValidation(typeRef: TypeReference): boolean {
    const unwrapped = this.unwrapType(typeRef);
    if (unwrapped.kind === "object") return true;

    if (unwrapped.kind === "array" && unwrapped.elementType) {
      return this.requiresCascadeValidation(unwrapped.elementType);
    }

    if (unwrapped.kind === "record" && unwrapped.valueType) {
      return this.requiresCascadeValidation(unwrapped.valueType);
    }

    return false;
  }

  private unwrapType(typeRef: TypeReference): TypeReference {
    if (
      (typeRef.kind === "optional" || typeRef.kind === "nullable") &&
      typeof typeRef.baseType === "object"
    ) {
      return this.unwrapType(typeRef.baseType);
    }
    return typeRef;
  }
}
