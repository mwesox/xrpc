import { GoBuilder } from './go-builder';
import { toPascalCase } from '@xrpc/generator-core';
import type { ContractDefinition, Endpoint } from '@xrpc/parser';

export class GoServerGenerator {
  private w: GoBuilder;
  private packageName: string;

  constructor(packageName: string = 'server') {
    this.w = new GoBuilder();
    this.packageName = packageName;
  }

  generateServer(contract: ContractDefinition): string {
    const w = this.w.reset();
    
    w.package(this.packageName)
      .import('encoding/json', 'net/http', 'fmt');

    // Generate handler types (now using Context instead of context.Context)
    w.type('QueryHandler', 'func(ctx *Context, input interface{}) (interface{}, error)')
      .type('MutationHandler', 'func(ctx *Context, input interface{}) (interface{}, error)');

    // Generate Router struct with middleware support
    w.struct('Router', (b) => {
      b.l('queryHandlers    map[string]QueryHandler')
        .l('mutationHandlers map[string]MutationHandler')
        .l('middleware       []MiddlewareFunc');
    });

    // Generate NewRouter
    w.func('NewRouter() *Router', (b) => {
      b.l('return &Router{').i()
        .l('queryHandlers:    make(map[string]QueryHandler),')
        .l('mutationHandlers: make(map[string]MutationHandler),')
        .l('middleware:       make([]MiddlewareFunc, 0),')
        .u().l('}');
    });

    // Generate Query and Mutation registration methods
    w.method('r *Router', 'Query', 'name string, handler QueryHandler', '', (b) => {
      b.l('r.queryHandlers[name] = handler');
    });

    w.method('r *Router', 'Mutation', 'name string, handler MutationHandler', '', (b) => {
      b.l('r.mutationHandlers[name] = handler');
    });

    // Generate middleware registration method
    w.method('r *Router', 'Use', 'middleware MiddlewareFunc', '', (b) => {
      b.l('r.middleware = append(r.middleware, middleware)');
    });

    // Generate ServeHTTP
    this.generateServeHTTP(contract.endpoints, w);

    return w.toString();
  }

  private generateServeHTTP(endpoints: Endpoint[], w: GoBuilder): void {
    w.method('r *Router', 'ServeHTTP', 'w http.ResponseWriter, req *http.Request', '', (b) => {
      // Only accept POST
      b.if('req.Method != http.MethodPost', (b) => {
        b.l('http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)')
          .return();
      }).n();

      // Parse JSON-RPC request
      b.var('request', 'struct {').i()
        .l('Method string          `json:"method"`')
        .l('Params json.RawMessage `json:"params"`')
        .u().l('}').n();

      b.if('err := json.NewDecoder(req.Body).Decode(&request); err != nil', (b) => {
        b.l('http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)')
          .return();
      }).n();

      // Initialize context for middleware and handlers
      b.decl('ctx', '&Context{').i()
        .l('Request:        req,')
        .l('ResponseWriter: w,')
        .l('Data:           make(map[string]interface{}),')
        .u().l('}').n();

      // Execute middleware chain
      b.comment('Execute middleware chain')
        .l('for _, middleware := range r.middleware {').i()
        .decl('result', 'middleware(ctx)')
        .if('result.Error != nil', (b) => {
          b.l('http.Error(w, fmt.Sprintf("Middleware error: %v", result.Error), http.StatusInternalServerError)')
            .return();
        })
        .if('result.Response != nil', (b) => {
          b.comment('Middleware short-circuited with response')
            .return();
        })
        .l('ctx = result.Context')
        .u().l('}').n();

      // Route to handler based on method name
      b.var('handler', 'interface{}')
        .var('ok', 'bool').n();

      const cases = endpoints.map((endpoint) => ({
        value: `"${endpoint.fullName}"`,
        fn: (b: GoBuilder) => {
          // Get handler
          const handlerMap = endpoint.type === 'query' 
            ? 'r.queryHandlers'
            : 'r.mutationHandlers';
          b.l(`handler, ok = ${handlerMap}["${endpoint.fullName}"]`);

          b.if('!ok', (b) => {
            b.l('http.Error(w, "Handler not found", http.StatusNotFound)')
              .return();
          }).n();

          // Parse input
          const inputTypeName = toPascalCase(endpoint.input.name!);
          b.var('input', inputTypeName);
          b.if('err := json.Unmarshal(request.Params, &input); err != nil', (b) => {
            b.l('http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)')
              .return();
          }).n();

          // Validate input
          const validationFuncName = `Validate${inputTypeName}`;
          b.if(`err := ${validationFuncName}(input); err != nil`, (b) => {
            b.l('w.Header().Set("Content-Type", "application/json")')
              .l('w.WriteHeader(http.StatusBadRequest)');
            b.l('if validationErrs, ok := err.(ValidationErrors); ok {').i()
              .l('json.NewEncoder(w).Encode(map[string]interface{}{').i()
                .l('"error": "Validation failed",')
                .l('"errors": validationErrs,')
                .u().l('})')
              .u().l('} else {').i()
              .l('json.NewEncoder(w).Encode(map[string]interface{}{').i()
                .l('"error": err.Error(),')
                .u().l('})')
              .u().l('}');
            b.return();
          }).n();

          // Call handler with Context (not context.Context)
          const handlerType = endpoint.type === 'query' ? 'QueryHandler' : 'MutationHandler';
          b.decl(`${endpoint.type}Handler`, `handler.(${handlerType})`)
            .decl('result, err', `${endpoint.type}Handler(ctx, input)`);

          b.ifErr((b) => {
            b.l('http.Error(w, fmt.Sprintf("Handler error: %v", err), http.StatusInternalServerError)')
              .return();
          }).n();

          // Write response
          b.l('w.Header().Set("Content-Type", "application/json")')
            .l('json.NewEncoder(w).Encode(result)')
            .return();
        },
      }));

      w.switch('request.Method', cases, (b) => {
        b.l('http.Error(w, "Method not found", http.StatusNotFound)')
          .return();
      });
    });
  }

}
