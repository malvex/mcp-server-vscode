import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Compact Format Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should return compact format by default', async () => {
    const result = await callTool('workspaceSymbols', {});

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.symbols, 'Should have symbols property in compact format');
    assert.ok(typeof result.totalSymbols === 'number', 'Should have totalSymbols count');

    // Should NOT have the detailed format properties
    assert.ok(!result.summary, 'Should not have summary in compact format');
    assert.ok(!result.files, 'Should not have files property in compact format');

    // Check compact format structure
    const files = Object.keys(result.symbols);
    assert.ok(files.length > 0, 'Should have files');

    // Check a file's symbols are in compact array format
    const firstFile = files[0];
    const symbols = result.symbols[firstFile];
    assert.ok(Array.isArray(symbols), 'Symbols should be an array');

    if (symbols.length > 0) {
      const firstSymbol = symbols[0];
      assert.ok(Array.isArray(firstSymbol), 'Each symbol should be an array');
      assert.strictEqual(firstSymbol.length, 3, 'Each symbol array should have exactly 3 elements');

      // Check format: [name, kind, line]
      assert.ok(typeof firstSymbol[0] === 'string', 'First element should be symbol name');
      assert.ok(typeof firstSymbol[1] === 'string', 'Second element should be symbol kind');
      assert.ok(typeof firstSymbol[2] === 'number', 'Third element should be line number');

      console.log('Compact symbol example:', firstSymbol);
    }
  });

  test('should return detailed format when requested', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.summary, 'Should have summary in detailed format');
    assert.ok(result.files, 'Should have files in detailed format');

    // Should NOT have compact format properties
    assert.ok(!result.symbols, 'Should not have symbols property in detailed format');
    assert.ok(
      result.totalSymbols === undefined,
      'Should not have bare totalSymbols in detailed format'
    );

    // Check detailed format structure
    assert.ok(result.summary.totalFiles >= 0, 'Should have totalFiles in summary');
    assert.ok(result.summary.totalSymbols >= 0, 'Should have totalSymbols in summary');
    assert.ok(result.summary.byKind, 'Should have byKind breakdown');
  });

  test('should significantly reduce token count in compact format', async () => {
    // Get both formats for the same file
    const filePattern = '**/math.ts';

    const compactResult = await callTool('workspaceSymbols', {
      format: 'compact',
      filePattern,
    });

    const detailedResult = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern,
    });

    // Serialize to estimate token count
    const compactJson = JSON.stringify(compactResult);
    const detailedJson = JSON.stringify(detailedResult);

    // Rough token estimation (1 token ≈ 4 characters)
    const compactTokens = Math.ceil(compactJson.length / 4);
    const detailedTokens = Math.ceil(detailedJson.length / 4);

    console.log(`Compact format: ${compactJson.length} chars ≈ ${compactTokens} tokens`);
    console.log(`Detailed format: ${detailedJson.length} chars ≈ ${detailedTokens} tokens`);
    console.log(`Token reduction: ${Math.round((1 - compactTokens / detailedTokens) * 100)}%`);

    // Compact should be significantly smaller
    assert.ok(
      compactTokens < detailedTokens * 0.5,
      'Compact format should use less than 50% of detailed tokens'
    );
  });

  test('should handle nested symbols in compact format', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'compact',
      filePattern: '**/math.ts',
    });

    assert.ok(!result.error, 'Should not have error');

    const mathFile = Object.keys(result.symbols).find((f) => f.includes('math.ts'));
    assert.ok(mathFile, 'Should find math.ts');

    const symbols = result.symbols[mathFile];

    // Find nested symbols (e.g., Calculator.add)
    const nestedSymbols = symbols.filter((s: any[]) => s[0].includes('.'));
    assert.ok(nestedSymbols.length > 0, 'Should have nested symbols with dot notation');

    // Verify nested symbol format
    const methodSymbol = symbols.find((s: any[]) => s[0] === 'Calculator.add');
    if (methodSymbol) {
      assert.strictEqual(methodSymbol[1], 'method', 'Should identify as method');
      assert.ok(typeof methodSymbol[2] === 'number', 'Should have line number');
    }
  });

  test('should preserve all essential information in compact format', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'compact',
      filePattern: '**/math.ts',
    });

    const mathFile = Object.keys(result.symbols).find((f) => f.includes('math.ts'));
    const symbols = result.symbols[mathFile!];

    // Check we have various symbol types
    const symbolsByKind = symbols.reduce((acc: any, [_, kind]: any[]) => {
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});

    console.log('Symbol kinds found:', symbolsByKind);

    // Should have different kinds of symbols
    assert.ok(Object.keys(symbolsByKind).length > 1, 'Should have multiple symbol kinds');

    // Check specific symbols exist
    const symbolNames = symbols.map((s: any[]) => s[0]);
    assert.ok(symbolNames.includes('Calculator'), 'Should find Calculator class');
    assert.ok(
      symbolNames.includes('add') || symbolNames.includes('add()'),
      'Should find add function'
    );
  });
});
