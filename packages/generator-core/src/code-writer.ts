export class CodeWriter {
  private lines: string[] = [];
  private indentLevel = 0;
  private indentString = '    '; // 4 spaces

  // Main methods
  writeLine(text: string): this {
    const indent = this.indentString.repeat(this.indentLevel);
    this.lines.push(indent + text);
    return this;
  }

  write(text: string): this {
    if (this.lines.length === 0) {
      this.lines.push('');
    }
    const lastLine = this.lines[this.lines.length - 1];
    this.lines[this.lines.length - 1] = lastLine + text;
    return this;
  }

  indent(): this {
    this.indentLevel++;
    return this;
  }

  unindent(): this {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
    return this;
  }

  newLine(): this {
    this.lines.push('');
    return this;
  }

  block(fn: () => void): this {
    this.writeLine('{');
    this.indent();
    fn();
    this.unindent();
    this.writeLine('}');
    return this;
  }

  // Short aliases for more concise DSL
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

  // Common patterns
  brace(fn: () => void): this {
    return this.block(fn);
  }

  // Template literal support
  template(strings: TemplateStringsArray, ...values: unknown[]): this {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
      result += strings[i];
      if (i < values.length) {
        result += String(values[i]);
      }
    }
    return this.writeLine(result);
  }

  toString(): string {
    return this.lines.join('\n');
  }

  reset(): this {
    this.lines = [];
    this.indentLevel = 0;
    return this;
  }
}
