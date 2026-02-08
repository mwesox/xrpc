import { KotlinBuilder } from "./kotlin-builder";

export class KotlinValidationGenerator {
  private readonly w = new KotlinBuilder();

  constructor(private readonly packageRoot = "xrpc.generated") {}

  generateValidationSupport(): string {
    const w = this.w.reset();

    w.package(`${this.packageRoot}.rpc.validation`);
    w.n();
    w.comment(
      "Reserved for target-specific validators that are not expressible as bean annotations.",
    );
    w.l("object ValidationSupport");

    return w.toString();
  }
}
