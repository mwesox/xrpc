import { GoBuilder } from './go-builder';
import { toPascalCase } from '@xrpc/generator-core';
import type { ContractDefinition, Endpoint } from '@xrpc/parser';

// Helper to convert "greeting.greet" to "GreetingGreet"
function toMethodName(fullName: string): string {
  return fullName.split('.').map(part => toPascalCase(part)).join('');
}

// Helper to convert "greeting.greet" to "greetingGreet"
function toFieldName(fullName: string): string {
  return fullName.split('.').map((part, i) => i === 0 ? part : toPascalCase(part)).join('');
}

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

    // Generate Router struct with typed handler fields
    w.struct('Router', (b) => {
      b.l('middleware []MiddlewareFunc');

      // Generate typed handler field for each endpoint
      for (const endpoint of contract.endpoints) {
        const fieldName = toFieldName(endpoint.fullName);
        const handlerType = toMethodName(endpoint.fullName) + 'Handler';
        b.l(`${fieldName} ${handlerType}`);
      }
    });

    // Generate NewRouter
    w.func('NewRouter() *Router', (b) => {
      b.l('return &Router{').i()
        .l('middleware: make([]MiddlewareFunc, 0),')
        .u().l('}');
    });

    // Generate typed setter methods for each endpoint
    for (const endpoint of contract.endpoints) {
      const methodName = toMethodName(endpoint.fullName);
      const fieldName = toFieldName(endpoint.fullName);
      const handlerType = methodName + 'Handler';

      w.method('r *Router', methodName, `handler ${handlerType}`, '*Router', (b) => {
        b.l(`r.${fieldName} = handler`)
          .return('r');
      });
    }

    // Generate middleware registration method
    w.method('r *Router', 'Use', 'middleware MiddlewareFunc', '*Router', (b) => {
      b.l('r.middleware = append(r.middleware, middleware)')
        .return('r');
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
      const cases = endpoints.map((endpoint) => ({
        value: `"${endpoint.fullName}"`,
        fn: (b: GoBuilder) => {
          const fieldName = toFieldName(endpoint.fullName);

          // Check if handler is registered
          b.if(`r.${fieldName} == nil`, (b) => {
            b.l('http.Error(w, "Handler not registered", http.StatusNotFound)')
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

          // Call typed handler directly
          b.decl('result, err', `r.${fieldName}(ctx, input)`);

          b.ifErr((b) => {
            b.l('w.Header().Set("Content-Type", "application/json")')
              .l('json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})')
              .return();
          }).n();

          // Write response wrapped in JSON-RPC format
          b.l('w.Header().Set("Content-Type", "application/json")')
            .l('json.NewEncoder(w).Encode(map[string]interface{}{"result": result})')
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
