import { CodeWriter } from "@xrpckit/sdk";

export class SwiftBuilder extends CodeWriter {
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

  import(module: string): this {
    return this.l(`import ${module}`);
  }

  mark(text: string): this {
    return this.l(`// MARK: - ${text}`);
  }

  comment(text: string): this {
    return this.l(`// ${text}`);
  }

  struct(name: string, conforms: string[] = [], fn?: (b: this) => void): this {
    const conformances = conforms.length > 0 ? `: ${conforms.join(", ")}` : "";
    this.l(`public struct ${name}${conformances} {`);
    this.i();
    if (fn) fn(this);
    this.u();
    this.l("}");
    return this;
  }

  enum(name: string, conforms: string[] = [], fn?: (b: this) => void): this {
    const conformances = conforms.length > 0 ? `: ${conforms.join(", ")}` : "";
    this.l(`public enum ${name}${conformances} {`);
    this.i();
    if (fn) fn(this);
    this.u();
    this.l("}");
    return this;
  }

  typealias(name: string, definition: string): this {
    return this.l(`public typealias ${name} = ${definition}`);
  }
}
