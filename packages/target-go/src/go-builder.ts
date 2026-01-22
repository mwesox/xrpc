import { CodeWriter } from '@xrpc/generator-core';

/**
 * Go-specific code builder with fluent DSL for common Go patterns
 */
export class GoBuilder extends CodeWriter {
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

  // Go-specific patterns
  package(name: string): this {
    return this.l(`package ${name}`).n();
  }

  import(...packages: string[]): this {
    if (packages.length === 0) return this;
    if (packages.length === 1) {
      return this.l(`import "${packages[0]}"`).n();
    }
    this.l('import (').i();
    for (const pkg of packages) {
      this.l(`"${pkg}"`);
    }
    return this.u().l(')').n();
  }

  type(name: string, typeDef: string): this {
    return this.l(`type ${name} ${typeDef}`).n();
  }

  struct(name: string, fn: (b: this) => void): this {
    this.l(`type ${name} struct {`).i();
    fn(this);
    return this.u().l('}').n();
  }

  // Anonymous struct
  anonStruct(fn: (b: this) => void): this {
    this.l('struct {').i();
    fn(this);
    return this.u().l('}');
  }

  func(signature: string, fn?: (b: this) => void): this {
    if (fn) {
      this.write(`func ${signature} {`);
      this.indent();
      fn(this);
      this.unindent();
      this.writeLine('}');
      this.newLine();
    } else {
      this.l(`func ${signature}`);
      this.n();
    }
    return this;
  }

  method(receiver: string, name: string, params: string, returns: string, fn: (b: this) => void): this {
    const sig = returns ? `${name}(${params}) ${returns}` : `${name}(${params})`;
    return this.func(`(${receiver}) ${sig}`, fn);
  }

  if(condition: string, fn: (b: this) => void): this {
    this.l(`if ${condition} {`).i();
    fn(this);
    return this.u().l('}');
  }

  ifErr(fn: (b: this) => void): this {
    return this.if('err != nil', fn);
  }

  return(value?: string): this {
    return value ? this.l(`return ${value}`) : this.l('return');
  }

  var(name: string, type?: string, value?: string): this {
    if (type && value) {
      return this.l(`var ${name} ${type} = ${value}`);
    } else if (type) {
      return this.l(`var ${name} ${type}`);
    } else if (value) {
      return this.l(`${name} := ${value}`);
    }
    return this.l(`var ${name}`);
  }

  // Declare variable with type inference
  decl(name: string, value: string): this {
    return this.l(`${name} := ${value}`);
  }

  switch(value: string, cases: Array<{ value: string; fn: (b: this) => void }>, defaultCase?: (b: this) => void): this {
    this.l(`switch ${value} {`).i();
    for (const c of cases) {
      this.l(`case ${c.value}:`).i();
      c.fn(this);
      this.u();
    }
    if (defaultCase) {
      this.l('default:').i();
      defaultCase(this);
      this.u();
    }
    return this.u().l('}');
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
}
