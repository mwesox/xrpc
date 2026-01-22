import { ReactBuilder } from './react-builder';
import type { NormalizedContract, Endpoint } from '@xrpc/parser';

export class ReactClientGenerator {
  private w: ReactBuilder;

  constructor() {
    this.w = new ReactBuilder();
  }

  generateClient(contract: NormalizedContract): string {
    const w = this.w.reset();

    // Import React hooks
    w.import('react', ['useState', 'useEffect', 'useRef']);
    
    // Import types - collect all unique imports
    const schemaImports = new Set<string>();
    const typeImports = new Set<string>();
    
    for (const ep of contract.endpoints) {
      schemaImports.add(this.getSchemaName(ep, 'input'));
      schemaImports.add(this.getSchemaName(ep, 'output'));
      typeImports.add(this.getTypeName(ep, 'Input'));
      typeImports.add(this.getTypeName(ep, 'Output'));
    }
    
    // Import schemas and types
    const allImports = [
      ...Array.from(schemaImports),
      ...Array.from(typeImports).map(t => `type ${t}`),
    ];
    w.import('./types', allImports);
    w.import('zod', ['z']);
    w.n();

    // Generate base client configuration interface
    this.generateClientConfig(w);
    w.n();

    // Generate base RPC call function
    this.generateCallRpcFunction(w);

    // Generate type-safe wrapper functions for each endpoint
    for (const endpoint of contract.endpoints) {
      w.n();
      this.generateEndpointFunction(endpoint, w);
    }

    // Generate React hooks
    w.n();
    w.comment('React Hooks');
    w.n();

    for (const endpoint of contract.endpoints) {
      if (endpoint.type === 'query') {
        this.generateQueryHook(endpoint, w);
      } else {
        this.generateMutationHook(endpoint, w);
      }
    }

    return w.toString();
  }

  private generateClientConfig(w: ReactBuilder): void {
    w.interface('XRpcClientConfig', (b) => {
      b.l('baseUrl: string;')
        .l('validateInputs?: boolean;')
        .l('validateOutputs?: boolean;')
        .l('headers?: Record<string, string>;');
    });
  }

  private generateCallRpcFunction(w: ReactBuilder): void {
    w.comment('Base RPC call function (pure, no React dependencies)');
    w.n();
    w.asyncFunction(
      'callRpc<T>(config: XRpcClientConfig, method: string, params: unknown, options?: { inputSchema?: z.ZodType; outputSchema?: z.ZodType; signal?: AbortSignal })',
      (b) => {
        b.comment('Validate input if enabled');
        b.l('let validatedParams = params;');
        b.l('if (config.validateInputs && options?.inputSchema) {');
        b.i().l('validatedParams = options.inputSchema.parse(params);');
        b.u().l('}').n();

        b.comment('Make HTTP request');
        b.l('const response = await fetch(config.baseUrl, {');
        b.i()
          .l("method: 'POST',")
          .l('headers: {');
        b.i()
          .l("'Content-Type': 'application/json',")
          .l('...config.headers,');
        b.u()
          .l('},')
          .l('body: JSON.stringify({ method, params: validatedParams }),')
          .l('signal: options?.signal,');
        b.u()
          .l('});')
          .n();

        b.comment('Handle errors');
        b.l('if (!response.ok) {');
        b.i()
          .l("const error = await response.json().catch(() => ({ error: { message: response.statusText } }));")
          .l('throw new Error(error.error?.message || `RPC call failed: ${response.statusText}`);');
        b.u()
          .l('}')
          .n();

        b.comment('Parse response');
        b.l('const result = await response.json();');
        b.l('const data = result.result;').n();

        b.comment('Validate output if enabled');
        b.l('if (config.validateOutputs && options?.outputSchema) {');
        b.i().l('return options.outputSchema.parse(data);');
        b.u().l('}').n();

        b.l('return data;');
      }
    );
  }

  private generateEndpointFunction(endpoint: Endpoint, w: ReactBuilder): void {
    const functionName = this.getFunctionName(endpoint);
    const inputType = this.getTypeName(endpoint, 'Input');
    const outputType = this.getTypeName(endpoint, 'Output');
    const inputSchema = this.getSchemaName(endpoint, 'input');
    const outputSchema = this.getSchemaName(endpoint, 'output');

    w.comment(`Type-safe wrapper for ${endpoint.fullName}`);
    w.n();
    w.asyncFunction(
      `${functionName}(config: XRpcClientConfig, input: ${inputType}, options?: { signal?: AbortSignal })`,
      (b) => {
        b.l(`return callRpc<${outputType}>(`);
        b.i()
          .l('config,')
          .l(`'${endpoint.fullName}',`)
          .l('input,')
          .l('{')
          .i()
            .l(`inputSchema: ${inputSchema},`)
            .l(`outputSchema: ${outputSchema},`)
            .l('signal: options?.signal,')
          .u()
          .l('}')
        .u()
        .l(');');
      }
    );
  }

  private generateQueryHook(endpoint: Endpoint, w: ReactBuilder): void {
    // Generate hook name: useGreetingGreet (not useGreetinggreet)
    const parts = endpoint.fullName.split('.');
    const groupName = this.toPascalCase(parts[0]);
    const endpointName = this.toPascalCase(parts[1]);
    const hookName = `use${groupName}${endpointName}`;
    const inputType = this.getTypeName(endpoint, 'Input');
    const outputType = this.getTypeName(endpoint, 'Output');
    const functionName = this.getFunctionName(endpoint);

    w.comment(`React hook for ${endpoint.fullName} query`);
    w.n();
    w.hook(
      `${hookName}(config: XRpcClientConfig, input: ${inputType}, options?: { enabled?: boolean })`,
      (b) => {
        b.l(`const [data, setData] = useState<${outputType} | null>(null);`);
        b.l('const [loading, setLoading] = useState(false);');
        b.l('const [error, setError] = useState<Error | null>(null);');
        b.l('const abortControllerRef = useRef<AbortController | null>(null);').n();

        b.l('useEffect(() => {');
        b.i();
        b.comment('Skip if disabled');
        b.l("if (options?.enabled === false) return;").n();

        b.comment('Cancel previous request');
        b.l('if (abortControllerRef.current) {');
        b.i().l('abortControllerRef.current.abort();');
        b.u().l('}').n();

        b.comment('Create new AbortController');
        b.l('const abortController = new AbortController();');
        b.l('abortControllerRef.current = abortController;').n();

        b.l('setLoading(true);');
        b.l('setError(null);').n();

        b.l(`${functionName}(config, input, { signal: abortController.signal })`);
        b.i()
          .l('.then(setData)')
          .l('.catch((err) => {');
        b.i().l("if (err.name !== 'AbortError') {");
        b.i().l('setError(err);');
        b.u().l('}');
        b.u().l('})')
          .l('.finally(() => {');
        b.i().l('if (!abortController.signal.aborted) {');
        b.i().l('setLoading(false);');
        b.u().l('}');
        b.u().l('});').n();

        b.comment('Cleanup on unmount or input change');
        b.l('return () => {');
        b.i().l('abortController.abort();');
        b.u().l('};');
        b.u();
        b.l('}, [config.baseUrl, input, options?.enabled]);').n();

        b.l('return { data, loading, error };');
      }
    );
  }

  private generateMutationHook(endpoint: Endpoint, w: ReactBuilder): void {
    // Generate hook name for mutation
    const parts = endpoint.fullName.split('.');
    const groupName = this.toPascalCase(parts[0]);
    const endpointName = this.toPascalCase(parts[1]);
    const hookName = `use${groupName}${endpointName}`;
    const inputType = this.getTypeName(endpoint, 'Input');
    const outputType = this.getTypeName(endpoint, 'Output');
    const functionName = this.getFunctionName(endpoint);
    
    w.comment(`React hook for ${endpoint.fullName} mutation`);
    w.n();
    w.hook(`${hookName}(config: XRpcClientConfig)`, (b) => {
      b.l('const [loading, setLoading] = useState(false);');
      b.l('const [error, setError] = useState<Error | null>(null);').n();

      b.l(`const mutate = async (input: ${inputType}): Promise<${outputType}> => {`);
      b.i()
        .l('setLoading(true);')
        .l('setError(null);')
        .n()
        .l('try {')
        .i()
        .l(`const result = await ${functionName}(config, input);`)
        .l('return result;')
        .u()
        .l('} catch (err) {')
        .i()
        .l('setError(err as Error);')
        .l('throw err;')
        .u()
        .l('} finally {')
        .i()
        .l('setLoading(false);')
        .u()
        .l('}');
      b.u().l('};').n();

      b.l('return { mutate, loading, error };');
    });
  }

  private getFunctionName(endpoint: Endpoint): string {
    const parts = endpoint.fullName.split('.');
    const groupName = this.toCamelCase(parts[0]);
    const endpointName = this.toCamelCase(parts[1]);
    return `${groupName}${this.toPascalCase(endpointName)}`;
  }

  private getSchemaName(endpoint: Endpoint, suffix: 'input' | 'output'): string {
    const parts = endpoint.fullName.split('.');
    const groupName = this.toCamelCase(parts[0]);
    const endpointName = this.toCamelCase(parts[1]);
    return `${groupName}${this.toPascalCase(endpointName)}${this.toPascalCase(suffix)}Schema`;
  }

  private getTypeName(endpoint: Endpoint, suffix: 'Input' | 'Output'): string {
    const parts = endpoint.fullName.split('.');
    const groupName = this.toPascalCase(parts[0]);
    const endpointName = this.toPascalCase(parts[1]);
    return `${groupName}${endpointName}${suffix}`;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}
