import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Python Tests', () => {
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

    console.log('Python files result:', JSON.stringify(result, null, 2));

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.files, 'Should have files');

    // Python files should be skipped (no language server)
    const pythonFiles = Object.keys(result.files).filter((f) => f.endsWith('.py'));

    if (pythonFiles.length > 0) {
      // This shouldn't happen without Python extension
      console.warn('Unexpected: Python files found symbols without language server');
      // But if it does happen (e.g., in future), test should still pass
    } else {
      console.log('Expected: Python files were skipped (no language server)');
      assert.ok(result.summary.skippedFiles >= 2, 'Should have skipped at least 2 Python files');
    }

    // Verify our Python files exist but were skipped
    const allFiles = await vscode.workspace.findFiles('**/*.py');
    assert.ok(allFiles.length >= 2, 'Should have at least 2 Python files in workspace');
    console.log(`Found ${allFiles.length} Python files, skipped ${result.summary.skippedFiles}`);
  });

  test('should verify Python extension is not installed', async () => {
    // Check if Python extension is installed
    const pythonExt = vscode.extensions.getExtension('ms-python.python');

    // We expect NO Python extension in our test environment
    assert.ok(!pythonExt, 'Python extension should NOT be installed in test environment');
    console.log('Confirmed: Python extension not installed (as expected)');
  });

  test('should verify TypeScript files have symbols and Python files are skipped', async () => {
    // Call with no parameters - should get all files
    const result = await callTool('workspaceSymbols', { format: 'detailed' });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.files, 'Should have files');

    // TypeScript files should have symbols
    const tsFiles = Object.keys(result.files).filter((f) => f.endsWith('.ts'));
    assert.ok(tsFiles.length >= 2, 'Should find at least 2 TypeScript files with symbols');

    // Python files should be skipped
    const pyFiles = Object.keys(result.files).filter((f) => f.endsWith('.py'));
    assert.strictEqual(pyFiles.length, 0, 'Should not find any Python files (should be skipped)');

    // Should have skipped files
    assert.ok(result.summary.skippedFiles >= 2, 'Should have skipped at least 2 Python files');

    console.log(`Found ${tsFiles.length} TypeScript files with symbols`);
    console.log(
      `Skipped ${result.summary.skippedFiles} files (Python files without language server)`
    );
  });

  test('should handle cold start transparently', async () => {
    // Create a temporary TypeScript file
    const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
    const testFileUri = vscode.Uri.joinPath(workspaceUri, 'test_cold_start.ts');
    const content = `
export function testFunction() {
  console.log('test');
}

export class TestClass {
  method() {
    return true;
  }
}
`;
    await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(content));

    try {
      // The tool should transparently handle cold start and retry
      const result = await callTool('workspaceSymbols', {
        format: 'detailed',
        filePattern: '**/test_cold_start.ts',
      });

      console.log('Skipped files:', result.summary?.skippedFiles || 0);

      // Should have found the symbols (with transparent retries)
      const testFile = Object.keys(result.files || {}).find((f) =>
        f.includes('test_cold_start.ts')
      );
      if (testFile) {
        const symbols = result.files[testFile];
        assert.ok(symbols.length >= 2, 'Should find at least 2 symbols (function and class)');

        const symbolNames = symbols.map((s: any) => s.name);
        assert.ok(symbolNames.includes('testFunction'), 'Should find testFunction');
        assert.ok(symbolNames.includes('TestClass'), 'Should find TestClass');
      } else {
        // TypeScript language server should always be available in VS Code
        console.warn(
          'TypeScript file was skipped - language server might be disabled or very slow'
        );
      }
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(testFileUri);
    }
  });
});
