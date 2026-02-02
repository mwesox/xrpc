import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import { parseContract } from '../../packages/sdk/src/parser/index.js';
import { GoTypeGenerator } from '../../packages/target-go-server/src/type-generator.js';

describe('Go Type Generator', () => {
  test('generates named union, tuple, and enum types', async () => {
    const inputPath = join(
      process.cwd(),
      'tests',
      'fixtures',
      'api-with-named-non-object-types.ts',
    );
    const contract = await parseContract(inputPath);
    const generator = new GoTypeGenerator('server');
    const typesGo = generator.generateTypes(contract);

    expect(typesGo).toContain('type DemoUnionInputInput struct');
    expect(typesGo).toContain('Type string');
    expect(typesGo).toContain('String *string');
    expect(typesGo).toContain('Number *float64');

    expect(typesGo).toContain('type DemoTupleOutputOutput struct');
    expect(typesGo).toContain('V0 string');
    expect(typesGo).toContain('V1 float64');

    expect(typesGo).toContain('type DemoEnumOutputOutput string');
  });
});
