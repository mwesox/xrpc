import { z } from 'zod';
import type { ZodType } from 'zod';

export interface EndpointDefinition {
  type: 'query' | 'mutation';
  input: ZodType;
  output: ZodType;
}

export function query(config: {
  input: ZodType;
  output: ZodType;
}): EndpointDefinition {
  return {
    type: 'query',
    input: config.input,
    output: config.output,
  };
}

export function mutation(config: {
  input: ZodType;
  output: ZodType;
}): EndpointDefinition {
  return {
    type: 'mutation',
    input: config.input,
    output: config.output,
  };
}
