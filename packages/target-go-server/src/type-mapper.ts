import { toPascalCase, type TypeReference } from '@xrpckit/sdk';

export class GoTypeMapper {
  mapType(typeRef: TypeReference): string {
    // Handle optional (in Go, we just use the base type, validation handles required)
    if (typeRef.kind === 'optional') {
      if (typeof typeRef.baseType === 'object') {
        return this.mapType(typeRef.baseType);
      }
      return 'interface{}';
    }

    // Handle nullable (use pointer)
    if (typeRef.kind === 'nullable') {
      if (typeof typeRef.baseType === 'object') {
        return `*${this.mapType(typeRef.baseType)}`;
      }
      return '*interface{}';
    }

    // Handle arrays
    if (typeRef.kind === 'array') {
      return `[]${this.mapType(typeRef.elementType!)}`;
    }

    // Handle objects (use the name)
    if (typeRef.kind === 'object') {
      if (typeRef.name) {
        return toPascalCase(typeRef.name);
      }
      // Inline object - generate struct inline (for POC, we'll create named types)
      return 'interface{}'; // Fallback for complex inline objects
    }

    // Handle records
    if (typeRef.kind === 'record') {
      const valueType = typeRef.valueType ? this.mapType(typeRef.valueType) : 'interface{}';
      return `map[string]${valueType}`;
    }

    // Handle tuples (Go doesn't have tuples, use slice)
    if (typeRef.kind === 'tuple') {
      return '[]interface{}';
    }

    // Handle unions (Go doesn't have unions, use interface{})
    if (typeRef.kind === 'union') {
      return 'interface{}';
    }

    // Handle enums (use string)
    if (typeRef.kind === 'enum') {
      return 'string';
    }

    // Handle literals
    if (typeRef.kind === 'literal') {
      if (typeof typeRef.literalValue === 'string') {
        return 'string';
      } else if (typeof typeRef.literalValue === 'number') {
        return 'float64';
      } else if (typeof typeRef.literalValue === 'boolean') {
        return 'bool';
      }
      return 'interface{}';
    }

    // Handle date
    if (typeRef.kind === 'date') {
      return 'time.Time';
    }

    // Handle primitives
    if (typeRef.kind === 'primitive') {
      const baseType = typeof typeRef.baseType === 'string' ? typeRef.baseType : 'unknown';
      return this.mapPrimitive(baseType);
    }

    // Fallback
    return 'interface{}';
  }

  mapPrimitive(type: string): string {
    const mapping: Record<string, string> = {
      string: 'string',
      number: 'float64',
      integer: 'int',
      boolean: 'bool',
      date: 'time.Time',
      uuid: 'string',
      email: 'string',
    };

    return mapping[type] || 'interface{}';
  }

}
