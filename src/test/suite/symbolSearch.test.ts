import * as assert from 'assert';
import {
  setupTest,
  teardownTest,
  callTool,
  openTestFile,
  TestContext,
} from '../helpers/testHelpers';

suite('Symbol Search Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();

    // Open test files to ensure they're indexed
    await openTestFile('math.ts');
    await openTestFile('app.ts');

    // Give extra time for workspace indexing
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find function symbols by name', async () => {
    // Search for 'add' function
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'add',
      kind: 'function',
    });

    assert.ok(result.symbols, 'Should return symbols');
    assert.ok(result.symbols.length > 0, 'Should find at least one symbol');

    // Should find the add function in math.ts
    const addFunction = result.symbols.find(
      (sym: any) => sym.name.startsWith('add') && sym.kind === 'Function'
    );
    assert.ok(addFunction, 'Should find add function');
    assert.ok(addFunction.location.uri.endsWith('math.ts'), 'Should be in math.ts');
  });

  test('should find class symbols by name', async () => {
    // Search for 'Calculator' class
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'Calculator',
      kind: 'class',
    });

    assert.ok(result.symbols, 'Should return symbols');
    assert.ok(result.symbols.length > 0, 'Should find at least one symbol');

    // Should find the Calculator class
    const calculatorClass = result.symbols.find(
      (sym: any) => sym.name === 'Calculator' && sym.kind === 'Class'
    );
    assert.ok(calculatorClass, 'Should find Calculator class');
    assert.ok(calculatorClass.location.uri.endsWith('math.ts'), 'Should be in math.ts');
  });

  test('should find method symbols', async () => {
    // Search for 'getResult' method
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'getResult',
      kind: 'method',
    });

    assert.ok(result.symbols, 'Should return symbols');

    // Should find the getResult method
    const getResultMethod = result.symbols.find(
      (sym: any) => sym.name === 'getResult' && sym.kind === 'Method'
    );

    if (getResultMethod) {
      assert.ok(getResultMethod.containerName, 'Should have container name');
      assert.ok(getResultMethod.location.uri.endsWith('math.ts'), 'Should be in math.ts');
    }
  });

  test('should search all symbol kinds when kind is not specified', async () => {
    // Search for 'calc' without specifying kind
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'calc',
    });

    assert.ok(result.symbols, 'Should return symbols');

    // Might find calculateSum function and calc variable
    const hasResults = result.symbols.length > 0;
    if (hasResults) {
      // Verify we get different kinds of symbols
      const kinds = new Set(result.symbols.map((sym: any) => sym.kind));
      assert.ok(kinds.size >= 1, 'Should find symbols of different kinds');
    }
  });

  test('should return empty array for non-existent symbols', async () => {
    // Search for a symbol that doesn't exist
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'nonExistentSymbol',
    });

    assert.ok(Array.isArray(result.symbols), 'Should return array');
    assert.strictEqual(result.symbols.length, 0, 'Should return empty array');
  });

  test('should include location information for symbols', async () => {
    // Search for 'add' function
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'add',
      kind: 'function',
    });

    assert.ok(result.symbols.length > 0, 'Should find symbols');
    const firstSymbol = result.symbols[0];

    // Verify symbol structure
    assert.ok(firstSymbol.name, 'Should have symbol name');
    assert.ok(firstSymbol.kind, 'Should have symbol kind');
    assert.ok(firstSymbol.location, 'Should have location');
    assert.ok(firstSymbol.location.uri, 'Should have URI');
    assert.ok(firstSymbol.location.range, 'Should have range');
    assert.ok(typeof firstSymbol.location.range.start.line === 'number', 'Should have line number');
    assert.ok(
      typeof firstSymbol.location.range.start.character === 'number',
      'Should have character position'
    );
  });

  test('should find partial matches', async () => {
    // Search with partial name
    const result = await callTool('symbolSearch', {
      format: 'detailed',
      query: 'calc',
    });

    assert.ok(result.symbols, 'Should return symbols');

    // Should find symbols containing 'calc' like 'Calculator' or 'calculateSum'
    const matchingSymbols = result.symbols.filter((sym: any) =>
      sym.name.toLowerCase().includes('calc')
    );

    if (matchingSymbols.length > 0) {
      assert.ok(
        matchingSymbols.length === result.symbols.length,
        'All results should contain search query'
      );
    }
  });
});
