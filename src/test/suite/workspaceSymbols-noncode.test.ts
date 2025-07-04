import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Non-Code Files Tests', () => {
  let context: TestContext;
  let testFilesDir: string;

  suiteSetup(async () => {
    context = await setupTest();

    // Create temporary test files
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      testFilesDir = path.join(workspaceFolders[0].uri.fsPath, 'test-noncode-files');

      // Create directory if it doesn't exist
      if (!fs.existsSync(testFilesDir)) {
        fs.mkdirSync(testFilesDir, { recursive: true });
      }

      // Create test files (we now use permanent Python files in test-workspace/src/)

      // HTML file (should not be parsed for symbols by default)
      fs.writeFileSync(
        path.join(testFilesDir, 'test.html'),
        `<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <h1>Hello World</h1>
    <div class="container">
        <p>This is a test paragraph.</p>
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
        </ul>
    </div>
    <script>
        console.log('Hello from script');
    </script>
</body>
</html>`
      );

      // Markdown file (should not be parsed for symbols by default)
      fs.writeFileSync(
        path.join(testFilesDir, 'README.md'),
        `# Test Project

This is a test project.

## Features
- Feature 1
- Feature 2

## Usage
\`\`\`python
hello()
\`\`\`
`
      );

      // JSON file (should not be parsed for symbols by default)
      fs.writeFileSync(
        path.join(testFilesDir, 'config.json'),
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            settings: {
              debug: true,
              port: 3000,
            },
          },
          null,
          2
        )
      );
    }
  });

  suiteTeardown(async () => {
    // Clean up test files
    if (testFilesDir && fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }

    await teardownTest(context);
  });

  test('should not parse HTML files by default', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/test-noncode-files/*.html',
      maxFiles: 10,
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // HTML files should not produce symbols
    const fileNames = Object.keys(result.files);
    const htmlFiles = fileNames.filter((f) => f.endsWith('.html'));

    if (htmlFiles.length > 0) {
      // If HTML files are included, they should have no symbols
      for (const htmlFile of htmlFiles) {
        const symbols = result.files[htmlFile];
        assert.strictEqual(
          symbols.length,
          0,
          `HTML file should not have symbols, but found ${symbols.length}`
        );
      }
    }

    // Total symbols should be 0 for HTML files
    assert.strictEqual(
      result.summary.totalSymbols,
      0,
      `Should have 0 symbols for HTML files, but found ${result.summary.totalSymbols}`
    );
  });

  test('should not parse non-code files by default when no pattern specified', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/test-noncode-files/*',
      maxFiles: 20,
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Should only include code files
    const fileNames = Object.keys(result.files);
    const codeFiles = fileNames.filter((f) => f.includes('test-noncode-files'));

    console.log('Files found:', codeFiles);

    // Should not include non-code files
    const nonCodeFiles = codeFiles.filter(
      (f) => f.endsWith('.html') || f.endsWith('.md') || f.endsWith('.json')
    );

    if (nonCodeFiles.length > 0) {
      // If non-code files are included, they should have no symbols
      for (const file of nonCodeFiles) {
        const symbols = result.files[file];
        assert.strictEqual(
          symbols.length,
          0,
          `Non-code file ${file} should not have symbols, but found ${symbols.length}`
        );
      }
    }
  });

  test('should parse only code files with reasonable token count', async () => {
    // Use permanent Python files from test-workspace/src/
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/src/*.py',
      includeDetails: true,
    });

    assert.ok(!result.error, 'Should not have error');

    // Check if Python was skipped (no language server)
    if (result.summary.skippedFiles > 0) {
      console.log('Python files were skipped - no language server available');
      assert.strictEqual(
        result.summary.totalSymbols,
        0,
        'Should have no symbols when Python is skipped'
      );
      assert.ok(result.summary.skippedFiles >= 2, 'Should have skipped at least 2 Python files');
      return; // Skip the rest of the test
    }

    // Should find Python symbols (only if language server is available)
    assert.ok(result.summary.totalSymbols > 0, 'Should find symbols in Python files');

    // Check token count is reasonable
    const resultString = JSON.stringify(result);
    const estimatedTokens = resultString.length / 4;

    console.log(
      `Python files result: ${resultString.length} chars, ~${Math.round(estimatedTokens)} tokens`
    );

    assert.ok(
      estimatedTokens < 2000,
      `Token count should be < 2000 for Python files, but got ~${Math.round(estimatedTokens)}`
    );
  });

  test('should not generate massive tokens for HTML files', async () => {
    // Even if we explicitly request HTML files, they shouldn't generate thousands of symbols
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/test-noncode-files/*.html',
      includeDetails: false, // Even without details
      maxFiles: 1,
    });

    assert.ok(!result.error, 'Should not have error');

    const resultString = JSON.stringify(result);
    const estimatedTokens = resultString.length / 4;

    console.log(
      `HTML file result: ${resultString.length} chars, ~${Math.round(estimatedTokens)} tokens`
    );

    // Should be minimal tokens since HTML shouldn't produce symbols
    assert.ok(
      estimatedTokens < 500,
      `HTML file should not generate many tokens, but got ~${Math.round(estimatedTokens)}`
    );
  });

  test('should handle mixed file types correctly', async () => {
    // Test with both code and non-code files
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*',
      maxFiles: 50,
    });

    assert.ok(!result.error, 'Should not have error');

    // Count symbols by file type
    let pythonSymbols = 0;
    let typeScriptSymbols = 0;
    let nonCodeSymbols = 0;

    for (const [fileName, symbols] of Object.entries(result.files)) {
      if (fileName.endsWith('.py')) {
        pythonSymbols += (symbols as any[]).length;
      } else if (fileName.endsWith('.ts')) {
        typeScriptSymbols += (symbols as any[]).length;
      } else if (
        fileName.endsWith('.html') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.json')
      ) {
        nonCodeSymbols += (symbols as any[]).length;
      }
    }

    console.log(
      `TypeScript symbols: ${typeScriptSymbols}, Python symbols: ${pythonSymbols}, Non-code symbols: ${nonCodeSymbols}`
    );

    // TypeScript files should have symbols (built-in language server)
    assert.ok(typeScriptSymbols > 0, 'Should find symbols in TypeScript files');

    // Check if Python was skipped
    if (result.summary.skippedFiles > 0) {
      console.log('Python files were skipped - no language server available');
      assert.strictEqual(pythonSymbols, 0, 'Should have no Python symbols when skipped');
    }

    // Non-code files should have no symbols
    assert.strictEqual(
      nonCodeSymbols,
      0,
      `Non-code files should have 0 symbols, but found ${nonCodeSymbols}`
    );
  });
});
