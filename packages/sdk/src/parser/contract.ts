export interface ContractDefinition {
  routers: Router[];
  types: TypeDefinition[];
  endpoints: Endpoint[];
  middleware?: MiddlewareDefinition[];
}

export interface Router {
  name: string;
  endpointGroups: EndpointGroup[];
  middleware?: MiddlewareDefinition[];
}

/**
 * Middleware definition extracted from router
 * Middleware functions are stored as metadata and implemented by users in generated code
 */
export interface MiddlewareDefinition {
  name?: string; // Optional name for debugging/generation
  // The actual middleware function is not stored here - it's implemented by users
  // This definition is used to generate middleware hooks in target code
}

export interface EndpointGroup {
  name: string;
  endpoints: Endpoint[];
}

export interface Endpoint {
  name: string;
  type: 'query' | 'mutation';
  input: TypeReference;
  output: TypeReference;
  fullName: string; // e.g., "greeting.greet"
}

export interface TypeDefinition {
  name: string;
  kind: 'object' | 'array' | 'union' | 'primitive' | 'nullable' | 'optional' | 'enum' | 'literal' | 'record' | 'tuple' | 'date';
  properties?: Property[];
  elementType?: TypeReference;
  baseType?: string;
  unionTypes?: TypeReference[];      // For union types
  enumValues?: (string | number)[];  // For enum types
  literalValue?: string | number | boolean;  // For literal types
  keyType?: TypeReference;           // For record types
  valueType?: TypeReference;         // For record types
  tupleElements?: TypeReference[];   // For tuple types
}

export interface ValidationRules {
  // String validations
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  regex?: string;

  // Number validations
  min?: number;
  max?: number;
  int?: boolean;
  positive?: boolean;
  negative?: boolean;

  // Array validations
  minItems?: number;
  maxItems?: number;
}

export interface Property {
  name: string;
  type: TypeReference;
  required: boolean;
  validation?: ValidationRules;
}

export interface TypeReference {
  name?: string;
  kind: TypeDefinition['kind'];
  baseType?: string | TypeReference;
  elementType?: TypeReference;
  properties?: Property[];
  validation?: ValidationRules;
  unionTypes?: TypeReference[];      // For union types
  enumValues?: (string | number)[];  // For enum types
  literalValue?: string | number | boolean;  // For literal types
  keyType?: TypeReference;           // For record types
  valueType?: TypeReference;         // For record types
  tupleElements?: TypeReference[];   // For tuple types
}
