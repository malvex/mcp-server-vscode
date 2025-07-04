import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Filtering Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should exclude external dependencies by default', async () => {
    const result = await callTool('workspaceSymbols', {
      filePattern: '**/*.ts',
      maxFiles: 100,
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Check that no files are from external sources
    const fileNames = Object.keys(result.files);
    for (const fileName of fileNames) {
      // Should not include VS Code extensions
      assert.ok(
        !fileName.includes('.vscode/extensions/'),
        `Should not include VS Code extensions: ${fileName}`
      );
      assert.ok(
        !fileName.includes('.vscode-server/extensions/'),
        `Should not include VS Code server extensions: ${fileName}`
      );

      // Should not include node_modules
      assert.ok(
        !fileName.includes('node_modules/'),
        `Should not include node_modules: ${fileName}`
      );

      // Should not include Python type stubs
      assert.ok(
        !fileName.includes('typeshed-fallback/'),
        `Should not include typeshed: ${fileName}`
      );
      assert.ok(
        !fileName.includes('site-packages/'),
        `Should not include site-packages: ${fileName}`
      );
    }

    console.log(`Found ${fileNames.length} files in workspace`);
  });

  test('should only include workspace files', async () => {
    const result = await callTool('workspaceSymbols', {
      filePattern: '**/*.ts',
      maxFiles: 50,
    });

    assert.ok(!result.error, 'Should not have error');

    // Get current workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    assert.ok(workspaceFolders && workspaceFolders.length > 0, 'Should have workspace folders');

    // All files should be within workspace folders
    const fileNames = Object.keys(result.files);
    for (const fileName of fileNames) {
      // File paths should be relative to workspace
      assert.ok(
        !fileName.startsWith('/'),
        `File path should be relative to workspace: ${fileName}`
      );
      assert.ok(
        !fileName.startsWith('\\'),
        `File path should be relative to workspace: ${fileName}`
      );

      // Should only include TypeScript files based on our filter
      assert.ok(fileName.endsWith('.ts'), `Should only include TypeScript files: ${fileName}`);
    }
  });

  test('should respect includeExternalSymbols option when true', async () => {
    // This test just verifies the option is accepted
    const result = await callTool('workspaceSymbols', {
      filePattern: '**/*.ts',
      maxFiles: 10,
      includeExternalSymbols: true,
    });

    assert.ok(!result.error, 'Should not have error when includeExternalSymbols is true');
    assert.ok(result.summary, 'Should have summary');

    // We don't test for external files here as it depends on VS Code's behavior
    // The important thing is that the option is accepted without error
  });

  test('should handle Python projects without including type stubs', async () => {
    const result = await callTool('workspaceSymbols', {
      filePattern: '**/*.py',
      maxFiles: 50,
    });

    assert.ok(!result.error, 'Should not have error');

    // Check that no Python stdlib or type stub files are included
    const fileNames = Object.keys(result.files);
    for (const fileName of fileNames) {
      assert.ok(
        !fileName.includes('builtins.pyi'),
        `Should not include Python builtins type stubs: ${fileName}`
      );
      assert.ok(
        !fileName.includes('/lib/python'),
        `Should not include Python standard library: ${fileName}`
      );
      assert.ok(
        !fileName.includes('\\lib\\python'),
        `Should not include Python standard library: ${fileName}`
      );
    }
  });

  test('should return reasonable token count for small projects', async () => {
    const result = await callTool('workspaceSymbols', {
      filePattern: '**/*.ts',
      maxFiles: 20,
      includeDetails: true,
    });

    assert.ok(!result.error, 'Should not have error');

    // Estimate token count (rough approximation)
    const resultString = JSON.stringify(result);
    const estimatedTokens = resultString.length / 4; // Rough estimate: 1 token ≈ 4 characters

    console.log(
      `Result size: ${resultString.length} characters, ~${Math.round(estimatedTokens)} tokens`
    );

    // For a small project, should be well under 25k tokens
    assert.ok(
      estimatedTokens < 25000,
      `Token count should be reasonable for small project: ~${Math.round(estimatedTokens)} tokens`
    );
  });
});
