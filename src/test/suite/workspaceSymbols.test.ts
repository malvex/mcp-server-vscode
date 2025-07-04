import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should get all symbols from workspace', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.ts',
      maxFiles: 10, // Limit for testing
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.summary, 'Should have summary');
    assert.ok(result.files, 'Should have files');

    // Should find at least our test files
    assert.ok(result.summary.totalFiles > 0, 'Should find some files');
    assert.ok(result.summary.totalSymbols > 0, 'Should find some symbols');

    // Should have symbol count by kind
    assert.ok(result.summary.byKind, 'Should have symbols by kind');
    assert.ok(typeof result.summary.byKind === 'object', 'byKind should be an object');

    // Check that we found some common symbol types
    const kinds = Object.keys(result.summary.byKind);
    assert.ok(
      kinds.includes('Function') || kinds.includes('Class') || kinds.includes('Variable'),
      'Should find common symbol types'
    );

    console.log('Workspace summary:', result.summary);
  });

  test('should respect file pattern filter', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/math.ts',
      includeDetails: true,
    });

    assert.ok(!result.error, 'Should not have error');

    const fileNames = Object.keys(result.files);
    assert.ok(fileNames.length > 0, 'Should find math.ts');
    assert.ok(
      fileNames.some((f) => f.includes('math.ts')),
      'Should only include math.ts files'
    );

    // Check structure of a file's symbols
    const mathFile = fileNames.find((f) => f.includes('math.ts'));
    if (mathFile) {
      const symbols = result.files[mathFile];
      assert.ok(Array.isArray(symbols), 'File symbols should be an array');

      // Should find our add function and Calculator class
      const hasAddFunction = symbols.some((s: any) => s.name === 'add' && s.kind === 'Function');
      const hasCalculatorClass = symbols.some(
        (s: any) => s.name === 'Calculator' && s.kind === 'Class'
      );

      assert.ok(hasAddFunction, 'Should find add function');
      assert.ok(hasCalculatorClass, 'Should find Calculator class');

      // Check that Calculator has children (methods)
      const calculator = symbols.find((s: any) => s.name === 'Calculator');
      if (calculator) {
        assert.ok(calculator.children, 'Calculator should have children');
        assert.ok(calculator.children.length > 0, 'Calculator should have methods');

        // Check for nested method
        const hasAddMethod = calculator.children.some(
          (m: any) => m.name === 'add' && m.kind === 'Method'
        );
        assert.ok(hasAddMethod, 'Calculator should have add method');
      }
    }
  });

  test('should work without details', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      includeDetails: false,
      filePattern: '**/math.ts',
    });

    assert.ok(!result.error, 'Should not have error');

    // Get first file's symbols
    const symbols = Object.values(result.files)[0] as any[];
    if (symbols && symbols.length > 0) {
      const firstSymbol = symbols[0];

      // Should have basic info but not details
      assert.ok(firstSymbol.name, 'Should have name');
      assert.ok(firstSymbol.kind, 'Should have kind');
      assert.ok(firstSymbol.fullName, 'Should have fullName');
      assert.ok(!firstSymbol.range, 'Should not have range when details=false');
    }
  });

  test('should handle empty workspace gracefully', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.nonexistent',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.strictEqual(result.summary.totalFiles, 0, 'Should find no files');
    assert.strictEqual(result.summary.totalSymbols, 0, 'Should find no symbols');
    assert.deepStrictEqual(result.files, {}, 'Files should be empty object');
  });
});
