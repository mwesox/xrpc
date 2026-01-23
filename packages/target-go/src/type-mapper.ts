import { toPascalCase } from '@xrpc/generator-core';
import type { TypeReference } from '@xrpc/parser';

export class GoTypeMapper {
  mapType(typeRef: TypeReference): string {
    // Handle optional (in Go, we just use the base type, validation handles required)
    if (typeRef.kind === 'optional') {
      return this.mapType(typeRef.baseType!);
    }

    // Handle nullable (use pointer)
    if (typeRef.kind === 'nullable') {
      return `*${this.mapType(typeRef.baseType!)}`;
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

    // Handle primitives
    if (typeRef.kind === 'primitive') {
      return this.mapPrimitive(typeRef.baseType || 'unknown');
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
