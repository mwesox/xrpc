import { z } from 'zod';
import type { ZodType, ZodObject, ZodOptional, ZodString, ZodNumber, ZodBoolean, ZodArray, ZodUnion, ZodEnum, ZodLiteral, ZodRecord, ZodTuple, ZodDate } from 'zod';
import type { TypeDefinition, TypeReference, Property, ValidationRules } from './contract';

// Safe integer bounds for JavaScript (used when Zod .int() is applied)
const SAFE_INTEGER_MIN = Number.MIN_SAFE_INTEGER;
const SAFE_INTEGER_MAX = Number.MAX_SAFE_INTEGER;

export function extractValidationRules(schema: ZodType): ValidationRules | undefined {
  const rules: ValidationRules = {};
  let hasRules = false;

  // Unwrap optional/nullable to get to the base schema
  // Handle chained optional/nullable correctly
  let baseSchema: ZodType = schema;
  while (baseSchema instanceof z.ZodOptional || baseSchema instanceof z.ZodNullable) {
    if (baseSchema instanceof z.ZodOptional) {
      baseSchema = baseSchema.unwrap() as ZodType;
    } else if (baseSchema instanceof z.ZodNullable) {
      baseSchema = baseSchema.unwrap() as ZodType;
    }
  }

  // Use toJSONSchema() for reliable extraction of validation rules
  // This is the most reliable way to get validation constraints in Zod v4
  let jsonSchema: any;
  try {
    jsonSchema = baseSchema.toJSONSchema();
  } catch (e) {
    // If toJSONSchema fails, fall back to internal structure
    return undefined;
  }

  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return undefined;
  }

  // Extract string validations
  if (baseSchema instanceof z.ZodString) {
    if (typeof jsonSchema.minLength === 'number') {
      rules.minLength = jsonSchema.minLength;
      hasRules = true;
    }
    if (typeof jsonSchema.maxLength === 'number') {
      rules.maxLength = jsonSchema.maxLength;
      hasRules = true;
    }
    if (jsonSchema.format === 'email') {
      rules.email = true;
      hasRules = true;
    }
    if (jsonSchema.format === 'url' || jsonSchema.format === 'uri') {
      rules.url = true;
      hasRules = true;
    }
    if (jsonSchema.format === 'uuid') {
      rules.uuid = true;
      hasRules = true;
    }
    if (jsonSchema.pattern && typeof jsonSchema.pattern === 'string') {
      rules.regex = jsonSchema.pattern;
      hasRules = true;
    }
  } else if (baseSchema instanceof z.ZodNumber) {
    // Extract number validations from JSON schema
    // Note: When .int() is used, Zod v4 may reset min/max to safe integer bounds in JSON schema
    // We'll extract what we can, but custom min/max with .int() may not be fully extractable via JSON schema
    
    const isInteger = jsonSchema.type === 'integer';
    
    // Only extract min/max if they're not the default safe integer bounds (when int is used)
    if (typeof jsonSchema.minimum === 'number') {
      if (!isInteger || jsonSchema.minimum !== SAFE_INTEGER_MIN) {
        rules.min = jsonSchema.minimum;
        hasRules = true;
      }
    }
    
    if (typeof jsonSchema.maximum === 'number') {
      if (!isInteger || jsonSchema.maximum !== SAFE_INTEGER_MAX) {
        rules.max = jsonSchema.maximum;
        hasRules = true;
      }
    }
    
    // Check if it's an integer type
    if (isInteger) {
      rules.int = true;
      hasRules = true;
    }
    
    // Note: positive/negative might be in exclusiveMinimum/exclusiveMaximum
    if (jsonSchema.exclusiveMinimum === 0 || (typeof jsonSchema.minimum === 'number' && jsonSchema.minimum > 0 && (!isInteger || jsonSchema.minimum !== SAFE_INTEGER_MIN))) {
      rules.positive = true;
      hasRules = true;
    }
    if (jsonSchema.exclusiveMaximum === 0 || (typeof jsonSchema.maximum === 'number' && jsonSchema.maximum < 0 && (!isInteger || jsonSchema.maximum !== SAFE_INTEGER_MAX))) {
      rules.negative = true;
      hasRules = true;
    }
  } else if (baseSchema instanceof z.ZodArray) {
    // Extract array validations
    if (typeof jsonSchema.minItems === 'number') {
      rules.minItems = jsonSchema.minItems;
      hasRules = true;
    }
    if (typeof jsonSchema.maxItems === 'number') {
      rules.maxItems = jsonSchema.maxItems;
      hasRules = true;
    }
  }

  return hasRules ? rules : undefined;
}

export function extractTypeInfo(schema: ZodType): TypeReference {
  // Handle optional
  if (schema instanceof z.ZodOptional) {
    const unwrapped = schema.unwrap() as ZodType;
    return {
      kind: 'optional',
      baseType: extractTypeInfo(unwrapped),
    };
  }

  // Handle nullable
  if (schema instanceof z.ZodNullable) {
    const unwrapped = schema.unwrap() as ZodType;
    return {
      kind: 'nullable',
      baseType: extractTypeInfo(unwrapped),
    };
  }

  // Handle objects
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Property[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const valueType = extractTypeInfo(value as ZodType);
      const isOptional = value instanceof z.ZodOptional;
      const validation = extractValidationRules(value as ZodType);

      properties.push({
        name: key,
        type: valueType,
        required: !isOptional,
        validation,
      });
    }

    return {
      kind: 'object',
      properties,
    };
  }

  // Handle arrays
  if (schema instanceof z.ZodArray) {
    const elementType = extractTypeInfo(schema.element as ZodType);
    const validation = extractValidationRules(schema);
    
    return {
      kind: 'array',
      elementType,
      validation,
    };
  }

  // Handle primitives
  if (schema instanceof z.ZodString) {
    return {
      kind: 'primitive',
      baseType: 'string',
    };
  }

  if (schema instanceof z.ZodNumber) {
    return {
      kind: 'primitive',
      baseType: 'number',
    };
  }

  if (schema instanceof z.ZodBoolean) {
    return {
      kind: 'primitive',
      baseType: 'boolean',
    };
  }

  // Handle unions
  if (schema instanceof z.ZodUnion) {
    const options = (schema as any).options;
    return {
      kind: 'union',
      unionTypes: options.map((opt: ZodType) => extractTypeInfo(opt)),
    };
  }

  // Handle enums
  if (schema instanceof z.ZodEnum) {
    return {
      kind: 'enum',
      enumValues: (schema as any).options,
    };
  }

  // Handle literals
  if (schema instanceof z.ZodLiteral) {
    return {
      kind: 'literal',
      literalValue: (schema as any).value,
      baseType: typeof (schema as any).value as string,
    };
  }

  // Handle records
  if (schema instanceof z.ZodRecord) {
    return {
      kind: 'record',
      keyType: { kind: 'primitive', baseType: 'string' },
      valueType: extractTypeInfo((schema as any).valueSchema),
    };
  }

  // Handle tuples
  if (schema instanceof z.ZodTuple) {
    return {
      kind: 'tuple',
      tupleElements: (schema as any).items.map((item: ZodType) => extractTypeInfo(item)),
    };
  }

  // Handle dates
  if (schema instanceof z.ZodDate) {
    return {
      kind: 'date',
      baseType: 'date',
    };
  }

  // Fallback for unknown types
  return {
    kind: 'primitive',
    baseType: 'unknown',
  };
}

export function generateTypeName(prefix: string, suffix: string): string {
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return capitalize(prefix) + capitalize(suffix);
}
