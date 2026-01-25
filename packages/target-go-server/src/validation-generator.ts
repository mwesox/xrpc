import {
  type ContractDefinition,
  type Property,
  type TypeDefinition,
  type TypeReference,
  type ValidationRules,
  toPascalCase,
} from "@xrpckit/sdk";
import { GoBuilder } from "./go-builder";
import type { CollectedType } from "./type-collector";

export class GoValidationGenerator {
  private w: GoBuilder;
  private packageName: string;
  private generatedValidations: Set<string> = new Set();

  constructor(packageName = "server") {
    this.w = new GoBuilder();
    this.packageName = packageName;
  }

  /**
   * Generate Go validation functions from a contract definition.
   * @param contract - The contract definition (should have names assigned to inline types)
   * @param collectedTypes - Optional pre-collected nested types from GoTypeCollector
   */
  generateValidation(
    contract: ContractDefinition,
    collectedTypes?: CollectedType[],
  ): string {
    const w = this.w.reset();
    this.generatedValidations.clear();

    // Determine which imports are needed based on validation rules in contract
    const imports = new Set<string>(["fmt", "strings"]);

    // Check if any validation rules require these imports
    // Note: email uses mail.ParseAddress, not regex, so we check separately
    const needsRegex = this.hasValidationRule(
      contract,
      collectedTypes,
      (rules) => !!(rules.uuid || (rules.regex && !rules.email)), // regex but not email (email uses mail)
    );
    const needsMail = this.hasValidationRule(
      contract,
      collectedTypes,
      (rules) => !!rules.email,
    );
    const needsURL = this.hasValidationRule(
      contract,
      collectedTypes,
      (rules) => !!rules.url,
    );

    if (needsRegex) imports.add("regexp");
    if (needsMail) imports.add("net/mail");
    if (needsURL) imports.add("net/url");

    w.package(this.packageName);
    if (imports.size > 0) {
      w.import(...Array.from(imports));
    }

    // Generate error types
    this.generateErrorTypes(w);

    // Generate validation functions for each type from contract
    for (const type of contract.types) {
      if (type.kind === "object" && type.properties) {
        this.generateTypeValidation(type, w);
      } else if (
        type.kind === "array" &&
        type.elementType?.kind === "object" &&
        type.elementType.properties
      ) {
        // Generate validation function for the array element type
        const elementTypeName = type.elementType.name
          ? toPascalCase(type.elementType.name)
          : `${toPascalCase(type.name)}Item`;
        const elementType: TypeDefinition = {
          name: elementTypeName,
          kind: "object",
          properties: type.elementType.properties,
        };
        this.generateTypeValidation(elementType, w);
      }
    }

    // Generate validation functions for collected nested types
    if (collectedTypes) {
      for (const collected of collectedTypes) {
        if (
          collected.typeRef.kind === "object" &&
          collected.typeRef.properties
        ) {
          const typeDefinition: TypeDefinition = {
            name: collected.name,
            kind: "object",
            properties: collected.typeRef.properties,
          };
          this.generateTypeValidation(typeDefinition, w);
        }
      }
    }

    // Generate helper functions
    this.generateHelperFunctions(w);

    return w.toString();
  }

  private generateErrorTypes(w: GoBuilder): void {
    w.struct("ValidationError", (b) => {
      b.l('Field   string `json:"field"`').l('Message string `json:"message"`');
    }).n();

    w.type("ValidationErrors", "[]*ValidationError").n();

    w.method("e *ValidationError", "Error", "", "string", (b) => {
      b.return('fmt.Sprintf("%s: %s", e.Field, e.Message)');
    }).n();

    w.method("e ValidationErrors", "Error", "", "string", (b) => {
      b.var("msgs", "[]string");
      b.l("for _, err := range e {")
        .i()
        .l("msgs = append(msgs, err.Error())")
        .u()
        .l("}");
      b.return('strings.Join(msgs, "; ")');
    }).n();
  }

  private generateTypeValidation(type: TypeDefinition, w: GoBuilder): void {
    const typeName = toPascalCase(type.name);
    const funcName = `Validate${typeName}`;

    // Skip if already generated
    if (this.generatedValidations.has(funcName)) {
      return;
    }
    this.generatedValidations.add(funcName);

    w.func(`${funcName}(input ${typeName}) error`, (b) => {
      b.var("errs", "ValidationErrors");

      if (type.properties) {
        for (const prop of type.properties) {
          this.generatePropertyValidation(prop, "input", b);
        }
      }

      b.if("len(errs) > 0", (b) => {
        b.return("errs");
      });
      b.return("nil");
    }).n();
  }

  private generatePropertyValidation(
    prop: Property,
    prefix: string,
    w: GoBuilder,
  ): void {
    const fieldName = toPascalCase(prop.name);
    const fieldPath = `${prefix}.${fieldName}`;
    const fieldPathStr = prop.name;
    const unwrappedType = this.unwrapOptionalNullable(prop.type);
    const isPointerType = this.isPointerType(prop.type);

    if (isPointerType) {
      w.comment(`Validate ${prop.name} when present`);
      w.if(`${fieldPath} != nil`, (b) => {
        this.generatePropertyValidationForValue(
          prop,
          `*${fieldPath}`,
          fieldPathStr,
          unwrappedType,
          b,
          false,
        );
      });
      return;
    }

    this.generatePropertyValidationForValue(
      prop,
      fieldPath,
      fieldPathStr,
      unwrappedType,
      w,
      prop.required,
    );
  }

  private generatePropertyValidationForValue(
    prop: Property,
    valuePath: string,
    fieldPathStr: string,
    typeRef: TypeReference,
    w: GoBuilder,
    isRequired: boolean,
  ): void {
    const actualType = this.getActualType(typeRef);
    const isString = actualType === "string";
    const isNumber = actualType === "number";
    const isArray = typeRef.kind === "array";

    const enumValues = this.getEnumValues(typeRef);
    const isEnum = enumValues !== null;

    if (isRequired) {
      w.comment(`Validate ${prop.name}`);
      if (isEnum || isString) {
        w.if(`${valuePath} == ""`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "is required",`)
            .u()
            .l("})");
        });
      } else if (isNumber) {
        // For numbers, we can't easily check if zero is valid, so we skip required check
        // The validation rules (min/max) will handle it
      } else if (isArray) {
        w.if(`${valuePath} == nil`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "is required",`)
            .u()
            .l("})");
        });
      }
    }

    if (isEnum && enumValues) {
      const enumValuesStr = enumValues.join(", ");
      const enumConditions = enumValues
        .map((v) => `${valuePath} != "${v}"`)
        .join(" && ");
      w.if(`${valuePath} != "" && ${enumConditions}`, (b) => {
        b.l("errs = append(errs, &ValidationError{")
          .i()
          .l(`Field:   "${fieldPathStr}",`)
          .l(`Message: "must be one of: ${enumValuesStr}",`)
          .u()
          .l("})");
      });
    }

    const validationRules = prop.validation || prop.type.validation;

    if (validationRules) {
      if (!isRequired) {
        if (isString) {
          w.if(`${valuePath} != ""`, (b) => {
            const validationTypeRef: TypeReference = {
              kind: "primitive",
              baseType: actualType,
            };
            this.generateValidationRules(
              validationRules,
              valuePath,
              fieldPathStr,
              validationTypeRef,
              b,
              false,
            );
          });
        } else if (isNumber) {
          const validationTypeRef: TypeReference = {
            kind: "primitive",
            baseType: actualType,
          };
          this.generateValidationRules(
            validationRules,
            valuePath,
            fieldPathStr,
            validationTypeRef,
            w,
            false,
          );
        } else if (isArray) {
          w.if(`${valuePath} != nil`, (b) => {
            this.generateValidationRules(
              validationRules,
              valuePath,
              fieldPathStr,
              typeRef,
              b,
              false,
            );
          });
        } else {
          this.generateValidationRules(
            validationRules,
            valuePath,
            fieldPathStr,
            typeRef,
            w,
            false,
          );
        }
      } else if (isArray) {
        this.generateValidationRules(
          validationRules,
          valuePath,
          fieldPathStr,
          typeRef,
          w,
          true,
        );
      } else {
        const validationTypeRef: TypeReference = {
          kind: "primitive",
          baseType: actualType,
        };
        this.generateValidationRules(
          validationRules,
          valuePath,
          fieldPathStr,
          validationTypeRef,
          w,
          true,
        );
      }
    }

    if (typeRef.kind === "object" && typeRef.name) {
      const nestedTypeName = toPascalCase(typeRef.name);
      const nestedFuncName = `Validate${nestedTypeName}`;
      w.l(`if err := ${nestedFuncName}(${valuePath}); err != nil {`)
        .i()
        .l("if nestedErrs, ok := err.(ValidationErrors); ok {")
        .i()
        .l("errs = append(errs, nestedErrs...)")
        .u()
        .l("} else {")
        .i()
        .l("errs = append(errs, &ValidationError{")
        .i()
        .l(`Field:   "${fieldPathStr}",`)
        .l("Message: err.Error(),")
        .u()
        .l("})")
        .u()
        .l("}")
        .u()
        .l("}");
    }

    if (typeRef.kind === "array" && typeRef.elementType) {
      const elementTypeRef = this.unwrapOptionalNullable(typeRef.elementType);
      if (elementTypeRef.kind === "object" && elementTypeRef.name) {
        const elementTypeName = toPascalCase(elementTypeRef.name);
        const elementFuncName = `Validate${elementTypeName}`;
        const isElementPointer = this.isPointerType(typeRef.elementType);

        w.l(`for i, item := range ${valuePath} {`).i();
        if (isElementPointer) {
          w.l("if item == nil { continue }");
          w.l(`if err := ${elementFuncName}(*item); err != nil {`);
        } else {
          w.l(`if err := ${elementFuncName}(item); err != nil {`);
        }
        w.i()
          .l("if nestedErrs, ok := err.(ValidationErrors); ok {")
          .i()
          .l("for _, nestedErr := range nestedErrs {")
          .i()
          .l("errs = append(errs, &ValidationError{")
          .i()
          .l(
            `Field:   fmt.Sprintf("${fieldPathStr}[%%d].%%s", i, nestedErr.Field),`,
          )
          .l("Message: nestedErr.Message,")
          .u()
          .l("})")
          .u()
          .l("}")
          .u()
          .l("}")
          .u()
          .l("}")
          .u()
          .l("}");
        w.u().l("}");
      }
    }
  }

  private generateValidationRules(
    rules: ValidationRules,
    fieldPath: string,
    fieldPathStr: string,
    typeRef: TypeReference,
    w: GoBuilder,
    isRequired = false,
  ): void {
    if (typeRef.baseType === "string") {
      // For required fields, skip length checks if empty (already handled by required check)
      // For optional fields, we only get here if field is not empty
      if (rules.minLength !== undefined) {
        // Only check length if string is not empty (for required fields)
        const minLengthCondition = isRequired
          ? `${fieldPath} != "" && len(${fieldPath}) < ${rules.minLength}`
          : `len(${fieldPath}) < ${rules.minLength}`;
        w.if(minLengthCondition, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(
              `Message: fmt.Sprintf("must be at least %d character(s)", ${rules.minLength}),`,
            )
            .u()
            .l("})");
        });
      }
      if (rules.maxLength !== undefined) {
        w.if(`len(${fieldPath}) > ${rules.maxLength}`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(
              `Message: fmt.Sprintf("must be at most %d character(s)", ${rules.maxLength}),`,
            )
            .u()
            .l("})");
        });
      }
      // Email validation - use mail.ParseAddress (more reliable than regex)
      // Skip regex pattern if email is set (email() in Zod generates both format and regex)
      if (rules.email) {
        // For optional fields, we're already inside an "if fieldPath != "" block"
        // For required fields, we need to check if not empty
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            b.l(`if _, err := mail.ParseAddress(${fieldPath}); err != nil {`)
              .i()
              .l("errs = append(errs, &ValidationError{")
              .i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must be a valid email address",`)
              .u()
              .l("})")
              .u()
              .l("}");
          });
        } else {
          // Already in "if fieldPath != "" block", so validate directly
          w.l(`if _, err := mail.ParseAddress(${fieldPath}); err != nil {`)
            .i()
            .l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be a valid email address",`)
            .u()
            .l("})")
            .u()
            .l("}");
        }
      }
      // URL validation
      if (rules.url) {
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            b.l(
              `if u, err := url.Parse(${fieldPath}); err != nil || u.Scheme == "" || u.Host == "" {`,
            )
              .i()
              .l("errs = append(errs, &ValidationError{")
              .i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must be a valid URL",`)
              .u()
              .l("})")
              .u()
              .l("}");
          });
        } else {
          w.l(
            `if u, err := url.Parse(${fieldPath}); err != nil || u.Scheme == "" || u.Host == "" {`,
          )
            .i()
            .l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be a valid URL",`)
            .u()
            .l("})")
            .u()
            .l("}");
        }
      }
      // UUID validation
      if (rules.uuid) {
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            b.l(
              `matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", ${fieldPath})`,
            )
              .n()
              .l("if !matched {")
              .i()
              .l("errs = append(errs, &ValidationError{")
              .i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must be a valid UUID",`)
              .u()
              .l("})")
              .u()
              .l("}");
          });
        } else {
          w.l(
            `matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", ${fieldPath})`,
          )
            .n()
            .l("if !matched {")
            .i()
            .l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be a valid UUID",`)
            .u()
            .l("})")
            .u()
            .l("}");
        }
      }
      // Custom regex validation (only if not email/url/uuid which have dedicated validators)
      if (rules.regex && !rules.email && !rules.url && !rules.uuid) {
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            // Escape the regex pattern for Go
            const escapedRegex = rules.regex
              ?.replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"');
            b.l(
              `matched, _ := regexp.MatchString("${escapedRegex}", ${fieldPath})`,
            )
              .n()
              .l("if !matched {")
              .i()
              .l("errs = append(errs, &ValidationError{")
              .i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must match the required pattern",`)
              .u()
              .l("})")
              .u()
              .l("}");
          });
        } else {
          // Escape the regex pattern for Go
          const escapedRegex = rules.regex
            ?.replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');
          w.l(
            `matched, _ := regexp.MatchString("${escapedRegex}", ${fieldPath})`,
          )
            .n()
            .l("if !matched {")
            .i()
            .l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must match the required pattern",`)
            .u()
            .l("})")
            .u()
            .l("}");
        }
      }
    } else if (typeRef.baseType === "number") {
      if (rules.min !== undefined) {
        w.if(`${fieldPath} < ${rules.min}`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must be at least %v", ${rules.min}),`)
            .u()
            .l("})");
        });
      }
      if (rules.max !== undefined) {
        w.if(`${fieldPath} > ${rules.max}`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must be at most %v", ${rules.max}),`)
            .u()
            .l("})");
        });
      }
      if (rules.int) {
        w.if(`float64(${fieldPath}) != float64(int64(${fieldPath}))`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be an integer",`)
            .u()
            .l("})");
        });
      }
      if (rules.positive) {
        w.if(`${fieldPath} <= 0`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be positive",`)
            .u()
            .l("})");
        });
      }
      if (rules.negative) {
        w.if(`${fieldPath} >= 0`, (b) => {
          b.l("errs = append(errs, &ValidationError{")
            .i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be negative",`)
            .u()
            .l("})");
        });
      }
    } else if (typeRef.kind === "array") {
      // Only validate array length if array is not nil
      const arrayCheckCondition = isRequired
        ? `${fieldPath} != nil`
        : `${fieldPath} != nil`;
      if (rules.minItems !== undefined) {
        w.if(
          `${arrayCheckCondition} && len(${fieldPath}) < ${rules.minItems}`,
          (b) => {
            b.l("errs = append(errs, &ValidationError{")
              .i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(
                `Message: fmt.Sprintf("must have at least %d item(s)", ${rules.minItems}),`,
              )
              .u()
              .l("})");
          },
        );
      }
      if (rules.maxItems !== undefined) {
        w.if(
          `${arrayCheckCondition} && len(${fieldPath}) > ${rules.maxItems}`,
          (b) => {
            b.l("errs = append(errs, &ValidationError{")
              .i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(
                `Message: fmt.Sprintf("must have at most %d item(s)", ${rules.maxItems}),`,
              )
              .u()
              .l("})");
          },
        );
      }
    }
  }

  private hasValidationRule(
    contract: ContractDefinition,
    collectedTypes: CollectedType[] | undefined,
    check: (rules: ValidationRules) => boolean,
  ): boolean {
    // Check contract types
    for (const type of contract.types) {
      if (this.checkTypeForValidationRule(type.properties, check)) {
        return true;
      }
      // Check array validation
      if (type.elementType?.validation && check(type.elementType.validation)) {
        return true;
      }
      if (
        type.elementType?.properties &&
        this.checkTypeForValidationRule(type.elementType.properties, check)
      ) {
        return true;
      }
    }

    // Check collected nested types
    if (collectedTypes) {
      for (const collected of collectedTypes) {
        if (
          collected.typeRef.properties &&
          this.checkTypeForValidationRule(collected.typeRef.properties, check)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private checkTypeForValidationRule(
    properties: Property[] | undefined,
    check: (rules: ValidationRules) => boolean,
  ): boolean {
    if (!properties) return false;

    for (const prop of properties) {
      if (prop.validation && check(prop.validation)) {
        return true;
      }
      // Check nested types recursively
      if (this.checkTypeRefForValidationRule(prop.type, check)) {
        return true;
      }
    }
    return false;
  }

  private checkTypeRefForValidationRule(
    typeRef: TypeReference,
    check: (rules: ValidationRules) => boolean,
  ): boolean {
    // Check direct validation on type reference
    if (typeRef.validation && check(typeRef.validation)) {
      return true;
    }

    // Check nested properties
    if (
      typeRef.properties &&
      this.checkTypeForValidationRule(typeRef.properties, check)
    ) {
      return true;
    }

    // Check array element types
    if (typeRef.elementType) {
      if (
        typeRef.elementType.validation &&
        check(typeRef.elementType.validation)
      ) {
        return true;
      }
      if (
        typeRef.elementType.properties &&
        this.checkTypeForValidationRule(typeRef.elementType.properties, check)
      ) {
        return true;
      }
    }

    // Unwrap optional/nullable
    if (
      (typeRef.kind === "optional" || typeRef.kind === "nullable") &&
      typeof typeRef.baseType === "object"
    ) {
      if (this.checkTypeRefForValidationRule(typeRef.baseType, check)) {
        return true;
      }
    }

    return false;
  }

  private generateHelperFunctions(w: GoBuilder): void {
    // Helper functions can be added here if needed
    // For now, we use standard library functions directly
  }

  private unwrapOptionalNullable(typeRef: TypeReference): TypeReference {
    if (typeRef.kind === "optional" || typeRef.kind === "nullable") {
      if (typeRef.baseType) {
        if (typeof typeRef.baseType === "string") {
          return { kind: "primitive", baseType: typeRef.baseType };
        }
        return this.unwrapOptionalNullable(typeRef.baseType);
      }
    }

    if (typeRef.kind === "union" && typeRef.unionTypes) {
      const nonNullVariants = typeRef.unionTypes.filter(
        (variant) =>
          !(variant.kind === "literal" && variant.literalValue === null),
      );
      if (nonNullVariants.length === 1) {
        return this.unwrapOptionalNullable(nonNullVariants[0]);
      }
    }

    return typeRef;
  }

  private getActualType(typeRef: TypeReference): string {
    const unwrapped = this.unwrapOptionalNullable(typeRef);
    if (
      unwrapped.kind === "primitive" &&
      typeof unwrapped.baseType === "string"
    ) {
      return unwrapped.baseType;
    }
    if (typeof unwrapped.baseType === "string") {
      return unwrapped.baseType;
    }
    if (unwrapped.baseType) {
      return this.getActualType(unwrapped.baseType);
    }
    return "unknown";
  }

  private getEnumValues(typeRef: TypeReference): string[] | null {
    const unwrapped = this.unwrapOptionalNullable(typeRef);
    if (unwrapped.kind === "enum" && unwrapped.enumValues) {
      return unwrapped.enumValues.filter(
        (v): v is string => typeof v === "string",
      );
    }

    return null;
  }

  private isPointerType(typeRef: TypeReference): boolean {
    // A type becomes a pointer in Go when it's:
    // - nullable (wrapping any type)
    // - optional wrapping nullable
    // - nullable wrapping optional

    if (typeRef.kind === "nullable") {
      return true;
    }

    if (typeRef.kind === "optional") {
      if (typeRef.baseType && typeof typeRef.baseType !== "string") {
        return this.isPointerType(typeRef.baseType);
      }
    }

    if (typeRef.kind === "union" && typeRef.unionTypes) {
      const nonNullVariants = typeRef.unionTypes.filter(
        (variant) =>
          !(variant.kind === "literal" && variant.literalValue === null),
      );
      if (nonNullVariants.length === 1) {
        return true;
      }
    }

    return false;
  }
}
