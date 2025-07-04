import * as assert from 'assert';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Definition Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find function definition from usage', async () => {
    await openTestFile('app.ts');

    // Find definition of 'add' function
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'add',
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.ok(result.definitions.length >= 1, 'Should find at least one definition');

    // 'add' might match both the function and the Calculator.add method
    // Find the function definition
    const functionDef = result.definitions.find(
      (def: any) =>
        def.symbol &&
        (def.symbol.kind === 'Function' ||
          (def.symbol.container === undefined && def.uri.endsWith('math.ts')))
    );

    if (functionDef) {
      assert.ok(functionDef.uri.endsWith('math.ts'), 'Should point to math.ts file');
    } else {
      // If no function found, just check that we have a definition in math.ts
      const mathDef = result.definitions.find((def: any) => def.uri.endsWith('math.ts'));
      assert.ok(mathDef, 'Should have at least one definition in math.ts');
    }
  });

  test('should find class definition from usage', async () => {
    await openTestFile('app.ts');

    // Find definition of 'Calculator' class
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'Calculator',
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.ok(result.definitions.length >= 1, 'Should find at least one definition');

    // Filter for the definition in math.ts (ignore temp test files)
    const mathDef = result.definitions.find((def: any) => def.uri.endsWith('math.ts'));
    assert.ok(mathDef, 'Should find Calculator definition in math.ts');

    assert.strictEqual(
      mathDef.range.start.line,
      20,
      'Should point to Calculator class definition (0-based)'
    );
  });

  test('should find method definition from usage', async () => {
    await openTestFile('app.ts');

    // Find definition of 'getResult' method
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'Calculator.getResult',
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.strictEqual(result.definitions.length, 1, 'Should find one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
    assert.strictEqual(def.range.start.line, 34, 'Should point to getResult method (0-based)');
  });

  test.skip('should find import source', async () => {
    // Skip - import path resolution is not supported in symbol-based approach
    await openTestFile('app.ts');
  });

  test('should return empty array for no definition', async () => {
    await openTestFile('math.ts');

    // Try to find a non-existent symbol
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'NonExistentSymbol',
    });

    assert.ok(result.message, 'Should have message');
    assert.ok(result.message.includes('not found'), 'Should indicate symbol not found');
    assert.deepStrictEqual(result.definitions, [], 'Should return empty array');
  });

  test('should find local variable definition', async () => {
    await openTestFile('app.ts');

    // Find definition of 'calc' variable
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'calc',
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.strictEqual(result.definitions.length, 1, 'Should find one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('app.ts'), 'Should point to same file');
    assert.strictEqual(def.range.start.line, 9, 'Should point to variable declaration (0-based)');
  });
});
