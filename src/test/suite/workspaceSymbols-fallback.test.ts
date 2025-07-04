import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Language Server Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should handle Python files without language server', async () => {
    // Test with our permanent Python files
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.py',
    });

    console.log('Python files result:', JSON.stringify(result.summary, null, 2));

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Python files should be skipped (no language server)
    const pythonFiles = Object.keys(result.files).filter((f) => f.endsWith('.py'));
    assert.strictEqual(pythonFiles.length, 0, 'Should not find Python files with symbols');
    assert.ok(result.summary.skippedFiles >= 2, 'Should have skipped at least 2 Python files');

    console.log('Python files were skipped as expected (no language server)');
  });

  test('should handle TypeScript files with language server', async () => {
    // Test with our TypeScript files
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.ts',
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.files, 'Should have files');

    // TypeScript files should have symbols
    const tsFiles = Object.keys(result.files).filter((f) => f.endsWith('.ts'));
    assert.ok(tsFiles.length >= 2, 'Should find at least 2 TypeScript files');

    // Check that we found expected symbols
    let foundClasses = 0;
    let foundFunctions = 0;

    for (const [file, symbols] of Object.entries(result.files)) {
      if (file.endsWith('.ts')) {
        const symbolList = symbols as any[];
        for (const sym of symbolList) {
          if (sym.kind === 'Class') foundClasses++;
          if (sym.kind === 'Function') foundFunctions++;
        }
      }
    }

    assert.ok(foundClasses > 0, 'Should find at least one class');
    assert.ok(foundFunctions > 0, 'Should find at least one function');

    console.log(
      `Found ${tsFiles.length} TypeScript files with ${foundClasses} classes and ${foundFunctions} functions`
    );
  });
});
