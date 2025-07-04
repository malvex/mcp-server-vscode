import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Refactor Tools Tests (Fixed)', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  // Helper to reset test files after each test
  async function resetTestFiles() {
    // Use git to reset the test workspace files
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('git checkout test-workspace/src/*.ts', {
        cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
      });
    } catch (error) {
      console.warn('Failed to reset test files:', error);
    }
  }

  suite('Rename Tool Tests', () => {
    teardown(async () => {
      await resetTestFiles();
    });

    test('should rename a function across files', async () => {
      const document = await openTestFile('math.ts');

      // First, verify the initial state
      const initialContent = document.getText();
      assert.ok(
        initialContent.includes('export function add'),
        'Should have add function initially'
      );

      // Test renaming the 'add' function
      const result = await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 6, // Line where 'add' function is defined
        character: 17, // Position of 'add' in 'export function add'
        newName: 'addNumbers',
        format: 'detailed',
      });

      // Verify the rename succeeded
      assert.strictEqual(result.success, true, 'Rename should succeed');
      assert.ok(result.renamedSymbol, 'Should have renamed symbol info');
      assert.strictEqual(result.renamedSymbol.oldName, 'add');
      assert.strictEqual(result.renamedSymbol.newName, 'addNumbers');
      assert.ok(result.filesChanged > 0, 'Should have changed at least one file');
      assert.ok(result.changes, 'Should have detailed changes in detailed format');

      // Verify the file was actually changed
      const updatedDoc = await vscode.workspace.openTextDocument(document.uri);
      const updatedContent = updatedDoc.getText();
      assert.ok(
        updatedContent.includes('export function addNumbers'),
        'Function should be renamed in file'
      );
      assert.ok(
        !updatedContent.includes('export function add'),
        'Old function name should not exist'
      );
    });

    test('should handle rename at invalid location', async () => {
      const document = await openTestFile('math.ts');

      // Try to rename at a comment line
      const result = await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 0, // Comment line
        character: 5,
        newName: 'newName',
      });

      assert.ok(result.error, 'Should return an error');
      assert.ok(
        result.error.includes('No rename provider') || result.error.includes('cannot be renamed'),
        'Error should indicate rename not available'
      );
    });
  });

  suite('Alternative: Using Temporary Files', () => {
    test('should work with temporary test files', async () => {
      // Create a temporary file for testing
      const tempUri = vscode.Uri.joinPath(
        context.workspaceUri,
        'src',
        `test-rename-${Date.now()}.ts`
      );

      const testContent = `export function testFunc() {
  return 42;
}

export function useTestFunc() {
  return testFunc() * 2;
}`;

      await vscode.workspace.fs.writeFile(tempUri, Buffer.from(testContent));

      try {
        // Open the temporary file
        const document = await vscode.workspace.openTextDocument(tempUri);
        await vscode.window.showTextDocument(document);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for language server

        // Test renaming
        const result = await callTool('refactor_rename', {
          uri: tempUri.toString(),
          line: 0,
          character: 17, // Position of 'testFunc'
          newName: 'renamedFunc',
        });

        assert.strictEqual(result.success, true, 'Rename should succeed');

        // Verify the content was changed
        const updatedDoc = await vscode.workspace.openTextDocument(tempUri);
        const updatedContent = updatedDoc.getText();
        assert.ok(
          updatedContent.includes('export function renamedFunc'),
          'Function should be renamed'
        );
        assert.ok(
          updatedContent.includes('return renamedFunc()'),
          'Function call should be renamed'
        );
      } finally {
        // Clean up temporary file
        await vscode.workspace.fs.delete(tempUri);
      }
    });
  });
});
