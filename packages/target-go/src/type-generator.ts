import { GoBuilder } from './go-builder';
import { GoTypeMapper } from './type-mapper';
import { toPascalCase } from '@xrpckit/generator-core';
import type { TypeDefinition, Property, ContractDefinition } from '@xrpckit/parser';

// Helper to convert "greeting.greet" to "GreetingGreet"
function toMethodName(fullName: string): string {
  return fullName.split('.').map(part => toPascalCase(part)).join('');
}

export class GoTypeGenerator {
  private w: GoBuilder;
  private typeMapper: GoTypeMapper;
  private packageName: string;

  constructor(packageName: string = 'server') {
    this.w = new GoBuilder();
    this.typeMapper = new GoTypeMapper();
    this.packageName = packageName;
  }

  generateTypes(contract: ContractDefinition): string {
    const w = this.w.reset();
    w.package(this.packageName)
      .import('net/http');

    // Generate Context type for middleware support
    this.generateContextType();

    // Always generate middleware types (router uses them)
    this.generateMiddlewareTypes();

    // Generate input/output types
    for (const type of contract.types) {
      this.generateType(type);
    }

    // Generate typed handler types for each endpoint
    this.generateTypedHandlers(contract);

    return w.toString();
  }

  private generateContextType(): void {
    // Generate Context struct for middleware and handlers
    this.w.struct('Context', (b) => {
      b.l('Request        *http.Request')
        .l('ResponseWriter http.ResponseWriter')
        .l('Data           map[string]interface{}');
    }).n();

    // Generate helper functions for type-safe context access
    // These can be extended by users for their specific middleware data
    this.w.comment('GetUserId retrieves userId from context if set by middleware').n()
      .func('GetUserId(ctx *Context) (string, bool)', (b) => {
        b.if('val, ok := ctx.Data["userId"].(string); ok', (b) => {
          b.return('val, true');
        });
        b.return('"", false');
      }).n();

    this.w.comment('GetSessionId retrieves sessionId from context if set by middleware').n()
      .func('GetSessionId(ctx *Context) (string, bool)', (b) => {
        b.if('val, ok := ctx.Data["sessionId"].(string); ok', (b) => {
          b.return('val, true');
        });
        b.return('"", false');
      }).n();
  }

  private generateMiddlewareTypes(): void {
    // Generate middleware function type
    this.w.comment('MiddlewareFunc is a function that processes a request and extends context').n()
      .type('MiddlewareFunc', 'func(ctx *Context) *MiddlewareResult').n();

    // Generate middleware result type
    this.w.struct('MiddlewareResult', (b) => {
      b.l('Context  *Context')
        .l('Error    error')
        .l('Response *http.Response');
    }).n();

    this.w.comment('NewMiddlewareResult creates a successful middleware result').n()
      .func('NewMiddlewareResult(ctx *Context) *MiddlewareResult', (b) => {
        b.return('&MiddlewareResult{Context: ctx}');
      }).n();

    this.w.comment('NewMiddlewareError creates a middleware result with an error').n()
      .func('NewMiddlewareError(err error) *MiddlewareResult', (b) => {
        b.return('&MiddlewareResult{Error: err}');
      }).n();

    this.w.comment('NewMiddlewareResponse creates a middleware result that short-circuits with a response').n()
      .func('NewMiddlewareResponse(resp *http.Response) *MiddlewareResult', (b) => {
        b.return('&MiddlewareResult{Response: resp}');
      }).n();
  }

  private generateType(type: TypeDefinition): void {
    this.w.struct(toPascalCase(type.name), (b) => {
      if (type.properties) {
        for (const prop of type.properties) {
          const goType = this.typeMapper.mapType(prop.type);
          const jsonTag = this.generateJSONTag(prop);
          b.l(`${toPascalCase(prop.name)} ${goType} \`${jsonTag}\``);
        }
      }
    });
  }

  private generateJSONTag(prop: Property): string {
    if (prop.required) {
      return `json:"${prop.name}"`;
    }
    return `json:"${prop.name},omitempty"`;
  }

  private generateTypedHandlers(contract: ContractDefinition): void {
    this.w.comment('Typed handler types for each endpoint').n();

    for (const endpoint of contract.endpoints) {
      const handlerName = toMethodName(endpoint.fullName) + 'Handler';
      const inputType = toPascalCase(endpoint.input.name!);
      const outputType = toPascalCase(endpoint.output.name!);

      this.w.comment(`Handler type for ${endpoint.fullName}`)
        .type(handlerName, `func(ctx *Context, input ${inputType}) (${outputType}, error)`)
        .n();
    }
  }
}
