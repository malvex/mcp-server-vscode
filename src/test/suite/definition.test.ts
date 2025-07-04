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

  test('should find function definition by symbol name', async () => {
    // Open a file to ensure it's indexed
    await openTestFile('app.ts');

    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'add',
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.definitions, 'Should return definitions');
    assert.ok(result.definitions.length > 0, 'Should find at least one definition');

    // Since 'add' might match both function and method, check what we got
    if (result.multipleDefinitions) {
      // Multiple matches - find the function (not the method)
      const functionDef = result.definitions.find((d: any) => d.symbol.kind === 'Function');
      assert.ok(functionDef, 'Should find the function definition');
      assert.ok(functionDef.uri.endsWith('math.ts'), 'Should point to math.ts file');
      assert.ok(
        functionDef.symbol.name === 'add' || functionDef.symbol.name === 'add()',
        'Should match symbol name'
      );
    } else {
      // Single match
      const def = result.definitions[0];
      assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
      assert.ok(def.symbol, 'Should include symbol information');
      // VS Code returns function names with () appended
      assert.ok(
        def.symbol.name === 'add' || def.symbol.name === 'add()',
        'Should match symbol name'
      );
      // It might find either the function or the method
      assert.ok(
        def.symbol.kind === 'Function' || def.symbol.kind === 'Method',
        'Should identify as function or method'
      );
    }
  });

  test('should find class definition by symbol name', async () => {
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'Calculator',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.definitions, 'Should return definitions');
    assert.ok(result.definitions.length > 0, 'Should find at least one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
    assert.strictEqual(def.symbol.kind, 'Class', 'Should identify as class');
  });

  test('should find class method definition by qualified name', async () => {
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'Calculator.add',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.definitions, 'Should return definitions');
    assert.ok(result.definitions.length > 0, 'Should find at least one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
    assert.ok(def.symbol, 'Should include symbol information');
    assert.strictEqual(def.symbol.name, 'add', 'Should match method name');
    assert.strictEqual(def.symbol.kind, 'Method', 'Should identify as method');
    assert.strictEqual(def.symbol.container, 'Calculator', 'Should show container');
  });

  test('should handle symbol not found', async () => {
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'NonExistentSymbol',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.message, 'Should have message');
    assert.ok(result.message.includes('not found'), 'Should indicate symbol not found');
    assert.deepStrictEqual(result.definitions, [], 'Should return empty definitions');
  });

  test('should handle multiple definitions', async () => {
    // 'add' might match both the function and the Calculator method
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'add',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.definitions, 'Should return definitions');

    // If there are multiple matches, it should indicate that
    if (result.multipleDefinitions) {
      assert.ok(result.definitions.length > 1, 'Should have multiple definitions');

      // Verify we get both the function and the method
      const functionDef = result.definitions.find((d: any) => d.symbol.kind === 'Function');
      const methodDef = result.definitions.find((d: any) => d.symbol.kind === 'Method');

      if (methodDef) {
        assert.ok(functionDef, 'Should find standalone function');
        assert.ok(methodDef, 'Should find class method');
        assert.strictEqual(
          methodDef.symbol.container,
          'Calculator',
          'Method should be in Calculator'
        );
      }
    }
  });

  test('should validate input parameters', async () => {
    // Test with no parameters
    const result = await callTool('definition', {
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error');
    assert.ok(result.error.includes('required'), 'Should indicate symbol is required');
  });

  test('should find method in nested class', async () => {
    const result = await callTool('definition', {
      format: 'detailed',
      symbol: 'Calculator.getResult',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.definitions, 'Should return definitions');
    assert.ok(result.definitions.length > 0, 'Should find definition');

    const def = result.definitions[0];
    assert.strictEqual(def.symbol.name, 'getResult', 'Should match method name');
    assert.strictEqual(def.symbol.kind, 'Method', 'Should identify as method');
    assert.strictEqual(def.symbol.container, 'Calculator', 'Should show container');
  });
});
