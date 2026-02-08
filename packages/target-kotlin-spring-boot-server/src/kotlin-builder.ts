import { CodeWriter } from "@xrpckit/sdk";

export class KotlinBuilder extends CodeWriter {
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

  package(name: string): this {
    return this.l(`package ${name}`).n();
  }

  imports(...values: string[]): this {
    for (const value of values) {
      this.l(`import ${value}`);
    }
    return values.length > 0 ? this.n() : this;
  }

  comment(text: string): this {
    return this.l(`// ${text}`);
  }
}
