import { GoBuilder } from './go-builder';
import { toPascalCase } from '@xrpc/generator-core';
import type { ContractDefinition, TypeDefinition, Property, ValidationRules, TypeReference } from '@xrpc/parser';

export class GoValidationGenerator {
  private w: GoBuilder;
  private packageName: string;

  constructor(packageName: string = 'server') {
    this.w = new GoBuilder();
    this.packageName = packageName;
  }

  generateValidation(contract: ContractDefinition): string {
    const w = this.w.reset();
    
    // Determine which imports are needed based on validation rules in contract
    const imports = new Set<string>(['fmt', 'strings']);
    
    // Check if any validation rules require these imports
    // Note: email uses mail.ParseAddress, not regex, so we check separately
    const needsRegex = this.hasValidationRule(contract, (rules) => 
      rules.uuid || (rules.regex && !rules.email) // regex but not email (email uses mail)
    );
    const needsMail = this.hasValidationRule(contract, (rules) => 
      rules.email
    );
    const needsURL = this.hasValidationRule(contract, (rules) => 
      rules.url
    );
    
    if (needsRegex) imports.add('regexp');
    if (needsMail) imports.add('net/mail');
    if (needsURL) imports.add('net/url');
    
    w.package(this.packageName);
    if (imports.size > 0) {
      w.import(...Array.from(imports));
    }

    // Generate error types
    this.generateErrorTypes(w);

    // Generate validation functions for each type
    for (const type of contract.types) {
      if (type.kind === 'object' && type.properties) {
        this.generateTypeValidation(type, w);
      }
    }

    // Generate helper functions
    this.generateHelperFunctions(w);

    return w.toString();
  }

  private generateErrorTypes(w: GoBuilder): void {
    w.struct('ValidationError', (b) => {
      b.l('Field   string `json:"field"`')
        .l('Message string `json:"message"`');
    }).n();

    w.type('ValidationErrors', '[]*ValidationError').n();

    w.method('e *ValidationError', 'Error', '', 'string', (b) => {
      b.return('fmt.Sprintf("%s: %s", e.Field, e.Message)');
    }).n();

    w.method('e ValidationErrors', 'Error', '', 'string', (b) => {
      b.var('msgs', '[]string');
      b.l('for _, err := range e {').i()
        .l('msgs = append(msgs, err.Error())')
        .u().l('}');
      b.return('strings.Join(msgs, "; ")');
    }).n();
  }

  private generateTypeValidation(type: TypeDefinition, w: GoBuilder): void {
    const typeName = toPascalCase(type.name);
    const funcName = `Validate${typeName}`;

    w.func(`${funcName}(input ${typeName}) error`, (b) => {
      b.var('errs', 'ValidationErrors');

      if (type.properties) {
        for (const prop of type.properties) {
          this.generatePropertyValidation(prop, 'input', type, b);
        }
      }

      b.if('len(errs) > 0', (b) => {
        b.return('errs');
      });
      b.return('nil');
    }).n();
  }

  private generatePropertyValidation(prop: Property, prefix: string, parentType: TypeDefinition, w: GoBuilder): void {
    const fieldName = toPascalCase(prop.name);
    const fieldPath = `${prefix}.${fieldName}`;
    const fieldPathStr = prop.name;

    // Get the actual base type (unwrap optional/nullable)
    const actualType = this.getActualType(prop.type);
    const isString = actualType === 'string';
    const isNumber = actualType === 'number';
    const isArray = prop.type.kind === 'array';

    if (prop.required) {
      w.comment(`Validate ${prop.name}`);
      if (isString) {
        w.if(`${fieldPath} == ""`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "is required",`)
            .u().l(`})`);
        });
      } else if (isNumber) {
        // For numbers, we can't easily check if zero is valid, so we skip required check
        // The validation rules (min/max) will handle it
      } else if (isArray) {
        w.if(`${fieldPath} == nil`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "is required",`)
            .u().l(`})`);
        });
      }
    }

    // Check both prop.validation and prop.type.validation (for arrays, validation is on the type)
    const validationRules = prop.validation || prop.type.validation;
    
    if (validationRules) {
      // For optional fields, only validate if field is not empty/nil
      if (!prop.required) {
        if (isString) {
          w.if(`${fieldPath} != ""`, (b) => {
            // Create a type reference with the actual base type for validation
            const validationTypeRef: TypeReference = {
              kind: 'primitive',
              baseType: actualType,
            };
            this.generateValidationRules(validationRules, fieldPath, fieldPathStr, validationTypeRef, b, false);
          });
        } else if (isNumber) {
          // Numbers are always present (zero value), so validate directly
          const validationTypeRef: TypeReference = {
            kind: 'primitive',
            baseType: actualType,
          };
          this.generateValidationRules(validationRules, fieldPath, fieldPathStr, validationTypeRef, w, false);
        } else if (isArray) {
          w.if(`${fieldPath} != nil`, (b) => {
            this.generateValidationRules(validationRules, fieldPath, fieldPathStr, prop.type, b, false);
          });
        } else {
          this.generateValidationRules(validationRules, fieldPath, fieldPathStr, prop.type, w, false);
        }
      } else {
        // Required fields - validate directly, but skip length checks if empty
        if (isArray) {
          // For arrays, use the type reference directly
          this.generateValidationRules(validationRules, fieldPath, fieldPathStr, prop.type, w, prop.required);
        } else {
          const validationTypeRef: TypeReference = {
            kind: 'primitive',
            baseType: actualType,
          };
          this.generateValidationRules(validationRules, fieldPath, fieldPathStr, validationTypeRef, w, prop.required);
        }
      }
    }

    // Handle nested objects - call validation function if type has a name
    if (prop.type.kind === 'object' && prop.type.name) {
      const nestedTypeName = toPascalCase(prop.type.name);
      const nestedFuncName = `Validate${nestedTypeName}`;
      w.if(`${fieldPath} != nil`, (b) => {
        b.l(`if err := ${nestedFuncName}(${fieldPath}); err != nil {`).i()
          .l(`if nestedErrs, ok := err.(ValidationErrors); ok {`).i()
          .l(`errs = append(errs, nestedErrs...)`)
          .u().l(`} else {`).i()
          .l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: err.Error(),`)
            .u().l(`})`)
          .u().l(`}`)
          .u().l(`}`);
      });
    } else if (prop.type.kind === 'object' && prop.type.properties) {
      // Inline object - validate properties directly
      w.if(`${fieldPath} != nil`, (b) => {
        for (const nestedProp of prop.type.properties || []) {
          // Create a dummy type for inline objects
          const inlineType: TypeDefinition = {
            name: '',
            kind: 'object',
            properties: prop.type.properties,
          };
          this.generatePropertyValidation(nestedProp, fieldPath, inlineType, b);
        }
      });
    }

    // Handle arrays with element validation
    if (prop.type.kind === 'array' && prop.type.elementType) {
      if (prop.type.elementType.kind === 'object' && prop.type.elementType.name) {
        const elementTypeName = toPascalCase(prop.type.elementType.name);
        const elementFuncName = `Validate${elementTypeName}`;
        w.l(`for i, item := range ${fieldPath} {`).i()
          .l(`if err := ${elementFuncName}(item); err != nil {`).i()
          .l(`if nestedErrs, ok := err.(ValidationErrors); ok {`).i()
          .l(`for _, nestedErr := range nestedErrs {`).i()
          .l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   fmt.Sprintf("${fieldPathStr}[%%d].%%s", i, nestedErr.Field),`)
            .l(`Message: nestedErr.Message,`)
            .u().l(`})`)
          .u().l(`}`)
          .u().l(`}`)
          .u().l(`}`)
          .u().l(`}`);
      } else if (prop.type.elementType.kind === 'object' && prop.type.elementType.properties) {
        // Inline object in array
        w.l(`for i, item := range ${fieldPath} {`).i();
        const inlineType: TypeDefinition = {
          name: '',
          kind: 'object',
          properties: prop.type.elementType.properties,
        };
        for (const nestedProp of prop.type.elementType.properties || []) {
          this.generatePropertyValidation(nestedProp, 'item', inlineType, w);
        }
        w.u().l(`}`);
      }
    }
  }

  private generateValidationRules(
    rules: ValidationRules,
    fieldPath: string,
    fieldPathStr: string,
    typeRef: TypeReference,
    w: GoBuilder,
    isRequired: boolean = false
  ): void {
    if (typeRef.baseType === 'string') {
      // For required fields, skip length checks if empty (already handled by required check)
      // For optional fields, we only get here if field is not empty
      if (rules.minLength !== undefined) {
        // Only check length if string is not empty (for required fields)
        const minLengthCondition = isRequired 
          ? `${fieldPath} != "" && len(${fieldPath}) < ${rules.minLength}`
          : `len(${fieldPath}) < ${rules.minLength}`;
        w.if(minLengthCondition, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must be at least %d character(s)", ${rules.minLength}),`)
            .u().l(`})`);
        });
      }
      if (rules.maxLength !== undefined) {
        w.if(`len(${fieldPath}) > ${rules.maxLength}`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must be at most %d character(s)", ${rules.maxLength}),`)
            .u().l(`})`);
        });
      }
      // Email validation - use mail.ParseAddress (more reliable than regex)
      // Skip regex pattern if email is set (email() in Zod generates both format and regex)
      if (rules.email) {
        // For optional fields, we're already inside an "if fieldPath != "" block"
        // For required fields, we need to check if not empty
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            b.l(`if _, err := mail.ParseAddress(${fieldPath}); err != nil {`).i()
              .l(`errs = append(errs, &ValidationError{`).i()
                .l(`Field:   "${fieldPathStr}",`)
                .l(`Message: "must be a valid email address",`)
                .u().l(`})`)
              .u().l(`}`);
          });
        } else {
          // Already in "if fieldPath != "" block", so validate directly
          w.l(`if _, err := mail.ParseAddress(${fieldPath}); err != nil {`).i()
            .l(`errs = append(errs, &ValidationError{`).i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must be a valid email address",`)
              .u().l(`})`)
            .u().l(`}`);
        }
      }
      // URL validation
      if (rules.url) {
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            b.l(`if u, err := url.Parse(${fieldPath}); err != nil || u.Scheme == "" || u.Host == "" {`).i()
              .l(`errs = append(errs, &ValidationError{`).i()
                .l(`Field:   "${fieldPathStr}",`)
                .l(`Message: "must be a valid URL",`)
                .u().l(`})`)
              .u().l(`}`);
          });
        } else {
          w.l(`if u, err := url.Parse(${fieldPath}); err != nil || u.Scheme == "" || u.Host == "" {`).i()
            .l(`errs = append(errs, &ValidationError{`).i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must be a valid URL",`)
              .u().l(`})`)
            .u().l(`}`);
        }
      }
      // UUID validation
      if (rules.uuid) {
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            b.l(`matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", ${fieldPath})`).n()
              .l(`if !matched {`).i()
              .l(`errs = append(errs, &ValidationError{`).i()
                .l(`Field:   "${fieldPathStr}",`)
                .l(`Message: "must be a valid UUID",`)
                .u().l(`})`)
              .u().l(`}`);
          });
        } else {
          w.l(`matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", ${fieldPath})`).n()
            .l(`if !matched {`).i()
            .l(`errs = append(errs, &ValidationError{`).i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must be a valid UUID",`)
              .u().l(`})`)
            .u().l(`}`);
        }
      }
      // Custom regex validation (only if not email/url/uuid which have dedicated validators)
      if (rules.regex && !rules.email && !rules.url && !rules.uuid) {
        if (isRequired) {
          w.if(`${fieldPath} != ""`, (b) => {
            // Escape the regex pattern for Go
            const escapedRegex = rules.regex!.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            b.l(`matched, _ := regexp.MatchString("${escapedRegex}", ${fieldPath})`).n()
              .l(`if !matched {`).i()
              .l(`errs = append(errs, &ValidationError{`).i()
                .l(`Field:   "${fieldPathStr}",`)
                .l(`Message: "must match the required pattern",`)
                .u().l(`})`)
              .u().l(`}`);
          });
        } else {
          // Escape the regex pattern for Go
          const escapedRegex = rules.regex!.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          w.l(`matched, _ := regexp.MatchString("${escapedRegex}", ${fieldPath})`).n()
            .l(`if !matched {`).i()
            .l(`errs = append(errs, &ValidationError{`).i()
              .l(`Field:   "${fieldPathStr}",`)
              .l(`Message: "must match the required pattern",`)
              .u().l(`})`)
            .u().l(`}`);
        }
      }
    } else if (typeRef.baseType === 'number') {
      if (rules.min !== undefined) {
        w.if(`${fieldPath} < ${rules.min}`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must be at least %v", ${rules.min}),`)
            .u().l(`})`);
        });
      }
      if (rules.max !== undefined) {
        w.if(`${fieldPath} > ${rules.max}`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must be at most %v", ${rules.max}),`)
            .u().l(`})`);
        });
      }
      if (rules.int) {
        w.if(`float64(${fieldPath}) != float64(int64(${fieldPath}))`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be an integer",`)
            .u().l(`})`);
        });
      }
      if (rules.positive) {
        w.if(`${fieldPath} <= 0`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be positive",`)
            .u().l(`})`);
        });
      }
      if (rules.negative) {
        w.if(`${fieldPath} >= 0`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: "must be negative",`)
            .u().l(`})`);
        });
      }
    } else if (typeRef.kind === 'array') {
      // Only validate array length if array is not nil
      const arrayCheckCondition = isRequired ? `${fieldPath} != nil` : `${fieldPath} != nil`;
      if (rules.minItems !== undefined) {
        w.if(`${arrayCheckCondition} && len(${fieldPath}) < ${rules.minItems}`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must have at least %d item(s)", ${rules.minItems}),`)
            .u().l(`})`);
        });
      }
      if (rules.maxItems !== undefined) {
        w.if(`${arrayCheckCondition} && len(${fieldPath}) > ${rules.maxItems}`, (b) => {
          b.l(`errs = append(errs, &ValidationError{`).i()
            .l(`Field:   "${fieldPathStr}",`)
            .l(`Message: fmt.Sprintf("must have at most %d item(s)", ${rules.maxItems}),`)
            .u().l(`})`);
        });
      }
    }
  }

  private hasValidationRule(
    contract: ContractDefinition,
    check: (rules: ValidationRules) => boolean
  ): boolean {
    for (const type of contract.types) {
      if (type.properties) {
        for (const prop of type.properties) {
          if (prop.validation && check(prop.validation)) {
            return true;
          }
          // Check nested types
          if (prop.type.properties) {
            for (const nestedProp of prop.type.properties) {
              if (nestedProp.validation && check(nestedProp.validation)) {
                return true;
              }
            }
          }
          // Check array element types
          if (prop.type.elementType?.properties) {
            for (const elemProp of prop.type.elementType.properties) {
              if (elemProp.validation && check(elemProp.validation)) {
                return true;
              }
            }
          }
        }
      }
      // Check array validation
      if (type.elementType?.validation && check(type.elementType.validation)) {
        return true;
      }
    }
    return false;
  }

  private generateHelperFunctions(w: GoBuilder): void {
    // Helper functions can be added here if needed
    // For now, we use standard library functions directly
  }

  private getActualType(typeRef: TypeReference): string {
    // Unwrap optional/nullable to get actual base type
    if (typeRef.kind === 'optional' || typeRef.kind === 'nullable') {
      if (typeRef.baseType) {
        return this.getActualType(typeRef.baseType);
      }
    }
    return typeRef.baseType || 'unknown';
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
