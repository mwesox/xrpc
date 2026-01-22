import { CodeWriter } from '@xrpc/generator-core';

/**
 * TypeScript/React-specific code builder with fluent DSL for common patterns
 */
export class ReactBuilder extends CodeWriter {
  // Short aliases
  l(text: string): this {
    return this.writeLine(text);
  }

  n(): this {
    return this.newLine();
  }

  i(): this {
    return this.indent();
  }

  u(): this {
    return this.unindent();
  }

  // TypeScript/React-specific patterns
  import(module: string, imports?: string[]): this {
    if (!imports || imports.length === 0) {
      return this.l(`import '${module}';`).n();
    }
    // Separate type imports from value imports
    const valueImports: string[] = [];
    const typeImports: string[] = [];
    
    for (const imp of imports) {
      if (imp.startsWith('type ')) {
        typeImports.push(imp.replace('type ', ''));
      } else {
        valueImports.push(imp);
      }
    }
    
    if (valueImports.length > 0 && typeImports.length > 0) {
      // Mixed imports: values and types
      this.l(`import { ${valueImports.join(', ')}, type ${typeImports.join(', type ')} } from '${module}';`).n();
    } else if (valueImports.length > 0) {
      // Only value imports - always use named imports
      this.l(`import { ${valueImports.join(', ')} } from '${module}';`).n();
    } else if (typeImports.length > 0) {
      // Only type imports
      this.l(`import type { ${typeImports.join(', ')} } from '${module}';`).n();
    }
    
    return this;
  }

  type(name: string, definition: string): this {
    return this.l(`export type ${name} = ${definition};`).n();
  }

  const(name: string, value: string, exported = true): this {
    const exportKeyword = exported ? 'export ' : '';
    return this.l(`${exportKeyword}const ${name} = ${value};`).n();
  }

  interface(name: string, fn: (b: this) => void): this {
    this.l(`export interface ${name} {`).i();
    fn(this);
    return this.u().l('}').n();
  }

  function(signature: string, fn?: (b: this) => void): this {
    if (fn) {
      this.write(`export function ${signature} {`);
      this.indent();
      fn(this);
      this.unindent();
      this.writeLine('}');
      this.newLine();
    } else {
      this.l(`export function ${signature};`);
      this.n();
    }
    return this;
  }

  asyncFunction(signature: string, fn: (b: this) => void): this {
    this.write(`export async function ${signature} {`);
    this.indent();
    fn(this);
    this.unindent();
    this.writeLine('}');
    this.newLine();
    return this;
  }

  hook(signature: string, fn: (b: this) => void): this {
    return this.function(signature, fn);
  }

  return(value?: string): this {
    return value ? this.l(`return ${value};`) : this.l('return;');
  }

  comment(text: string): this {
    return this.l(`// ${text}`);
  }

  blockComment(lines: string[]): this {
    this.l('/*');
    for (const line of lines) {
      this.l(` * ${line}`);
    }
    return this.l(' */');
  }

  // React-specific patterns
  useState<T>(name: string, initialValue: string, type?: string): this {
    const typeParam = type ? `<${type}>` : '';
    return this.l(`const [${name}, set${this.toPascalCase(name)}] = useState${typeParam}(${initialValue});`);
  }

  useEffect(fn: (b: this) => void, deps?: string[]): this {
    this.l('useEffect(() => {').i();
    fn(this);
    this.u();
    if (deps && deps.length > 0) {
      return this.l(`}, [${deps.join(', ')}]);`).n();
    }
    return this.l('}, []);').n();
  }

  useRef<T>(name: string, initialValue: string, type?: string): this {
    const typeParam = type ? `<${type}>` : '';
    return this.l(`const ${name}Ref = useRef${typeParam}(${initialValue});`);
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
