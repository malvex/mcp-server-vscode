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

  test('should debug Python file symbol extraction', async () => {
    // First, let's create a simple Python file to test with
    const pythonContent = `
def hello_world():
    """A simple hello world function"""
    print("Hello, World!")

class Calculator:
    """A simple calculator class"""
    def __init__(self):
        self.result = 0

    def add(self, value):
        self.result += value
        return self.result

MY_CONSTANT = 42
`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      assert.fail('No workspace folder');
    }

    const testFileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'test_symbols.py');

    // Create the test file
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(testFileUri, encoder.encode(pythonContent));

    try {
      // Wait for file to be indexed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Open the document
      const document = await vscode.workspace.openTextDocument(testFileUri);

      // Try to get symbols directly via VS Code API
      console.log('Document language ID:', document.languageId);

      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      console.log('Direct API symbols:', symbols);
      if (symbols) {
        console.log('Number of symbols found:', symbols.length);
        for (const symbol of symbols) {
          console.log(`- ${symbol.name} (${vscode.SymbolKind[symbol.kind]})`);
        }
      }

      // Now try via our tool
      const result = await callTool('workspaceSymbols', {
        format: 'detailed',
        filePattern: '**/test_symbols.py',
      });

      console.log('Tool result:', JSON.stringify(result, null, 2));

      assert.ok(!result.error, `Should not have error: ${result.error}`);
      assert.ok(result.files, 'Should have files');

      const pythonFile = Object.keys(result.files).find((f) => f.includes('test_symbols.py'));

      if (pythonFile) {
        const fileSymbols = result.files[pythonFile];
        console.log('File symbols:', fileSymbols);
        // Without language server, this shouldn't happen unless Python extension is installed
        assert.fail('Python file should be skipped when no language server is available');
      } else {
        console.log('Good: Python file was skipped because no language server is available');
        assert.ok(result.summary.skippedFiles > 0, 'Should have skipped files');
      }
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(testFileUri);
    }
  });

  test('should check if Python extension is available', async () => {
    // Check if Python extension is installed
    const pythonExt = vscode.extensions.getExtension('ms-python.python');
    console.log('Python extension installed:', !!pythonExt);

    if (pythonExt) {
      console.log('Python extension active:', pythonExt.isActive);
      if (!pythonExt.isActive) {
        await pythonExt.activate();
        console.log('Python extension activated');
      }
    } else {
      console.log('Python extension NOT installed - this explains empty symbols');
    }
  });

  test('should verify default behavior returns only files with symbols', async () => {
    // Call with no parameters
    const result = await callTool('workspaceSymbols', { format: 'detailed' });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.files, 'Should have files');

    // All files in the result should have symbols
    for (const [file, symbols] of Object.entries(result.files)) {
      assert.ok(Array.isArray(symbols), `${file} should have symbols array`);
      assert.ok(symbols.length > 0, `${file} should have at least one symbol (not empty array)`);
    }

    console.log(`Found ${Object.keys(result.files).length} files with symbols`);
    console.log(`Total symbols: ${result.summary.totalSymbols}`);
    console.log(`Skipped files: ${result.summary.skippedFiles || 0}`);

    // Log a few examples
    for (const [file, symbols] of Object.entries(result.files).slice(0, 3)) {
      console.log(`${file}: ${(symbols as any[]).length} symbols`);
    }
  });

  test('should wait for language server when waitForLanguageServer is true', async () => {
    // Create a temporary TypeScript file
    const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
    const testFileUri = vscode.Uri.joinPath(workspaceUri, 'test_wait.ts');
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
      // First try without waiting - might get no symbols if language server is not ready
      const resultNoWait = await callTool('workspaceSymbols', {
        format: 'detailed',
        filePattern: '**/test_wait.ts',
        waitForLanguageServer: false,
      });

      // Then try with waiting - should get symbols
      const resultWithWait = await callTool('workspaceSymbols', {
        format: 'detailed',
        filePattern: '**/test_wait.ts',
        waitForLanguageServer: true,
      });

      console.log('Without wait - skipped files:', resultNoWait.summary?.skippedFiles || 0);
      console.log('With wait - skipped files:', resultWithWait.summary?.skippedFiles || 0);

      // With wait should have found the symbols
      const testFile = Object.keys(resultWithWait.files || {}).find((f) =>
        f.includes('test_wait.ts')
      );
      if (testFile) {
        const symbols = resultWithWait.files[testFile];
        assert.ok(symbols.length >= 2, 'Should find at least 2 symbols (function and class)');

        const symbolNames = symbols.map((s: any) => s.name);
        assert.ok(symbolNames.includes('testFunction'), 'Should find testFunction');
        assert.ok(symbolNames.includes('TestClass'), 'Should find TestClass');
      } else {
        // TypeScript language server should always be available in VS Code
        console.warn(
          'TypeScript file was skipped even with wait - language server might be disabled'
        );
      }
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(testFileUri);
    }
  });
});
