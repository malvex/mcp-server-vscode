import * as assert from 'assert';
import {
  setupTest,
  teardownTest,
  callTool,
  TestContext,
  openTestFile,
} from '../helpers/testHelpers';

suite('Workspace Symbols Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  // ========== Core Functionality Tests ==========

  test('should return symbols for workspace files', async () => {
    // Open a file to ensure language server is active
    await openTestFile('app.ts');

    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      maxFiles: 100,
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.summary, 'Should have summary');
    assert.ok(result.summary.totalFiles > 0, 'Should find files');
    assert.ok(result.summary.totalSymbols > 0, 'Should find symbols');
    assert.ok(result.files, 'Should have files object');
    assert.ok(Object.keys(result.files).length > 0, 'Should have file entries');

    // Verify symbol structure
    const files = Object.keys(result.files);
    const firstFile = files[0];
    const symbols = result.files[firstFile];
    assert.ok(Array.isArray(symbols), 'File symbols should be an array');
    if (symbols.length > 0) {
      const symbol = symbols[0];
      assert.ok(symbol.name, 'Symbol should have name');
      assert.ok(symbol.kind, 'Symbol should have kind');
      assert.ok(symbol.fullName, 'Symbol should have fullName');
    }
  });

  test('should handle empty workspace', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.nonexistent',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.summary, 'Should have summary');
    assert.strictEqual(result.summary.totalFiles, 0, 'Should find no files');
    assert.strictEqual(result.summary.totalSymbols, 0, 'Should find no symbols');
    assert.deepStrictEqual(result.files, {}, 'Should have empty files object');
  });

  test('should support symbol kind counting', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      maxFiles: 100,
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.summary.byKind, 'Should have byKind counts');
    assert.ok(typeof result.summary.byKind === 'object', 'byKind should be an object');

    // Should have some common symbol kinds
    const kinds = Object.keys(result.summary.byKind);
    assert.ok(kinds.length > 0, 'Should have symbol kinds');
  });

  test('should handle maxFiles limit', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      maxFiles: 1,
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.summary.totalFiles <= 1, 'Should respect maxFiles limit');
  });

  // ========== Format Tests ==========

  test('should return compact format', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'compact',
      maxFiles: 10,
    });

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.totalSymbols >= 0, 'Should have totalSymbols');
    assert.ok(result.symbolFormat, 'Should have symbolFormat description');
    assert.strictEqual(
      result.symbolFormat,
      '[fullName, kind, line]',
      'Should match expected format'
    );
    assert.ok(result.symbols, 'Should have symbols object');

    // Verify compact format structure
    const files = Object.keys(result.symbols);
    if (files.length > 0) {
      const firstFile = files[0];
      const symbols = result.symbols[firstFile];
      assert.ok(Array.isArray(symbols), 'File symbols should be an array');

      if (symbols.length > 0) {
        const symbol = symbols[0];
        assert.ok(Array.isArray(symbol), 'Symbol should be an array in compact format');
        assert.strictEqual(symbol.length, 3, 'Symbol array should have 3 elements');
        assert.ok(typeof symbol[0] === 'string', 'First element should be fullName string');
        assert.ok(typeof symbol[1] === 'string', 'Second element should be kind string');
        assert.ok(typeof symbol[2] === 'number', 'Third element should be line number');
      }
    }
  });

  test('should include nested symbols in compact format', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'compact',
      filePattern: '**/math.ts',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.symbols, 'Should have symbols');

    // Find Calculator class methods
    const mathFile = Object.keys(result.symbols).find((f) => f.endsWith('math.ts'));
    if (mathFile) {
      const symbols = result.symbols[mathFile];
      const classMethod = symbols.find((s: any[]) => s[0].includes('Calculator.'));
      assert.ok(classMethod, 'Should include nested class methods with full path');
    }
  });

  // ========== File Pattern Tests ==========

  test('should filter by file pattern', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.ts',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.files, 'Should have files');

    // All files should be TypeScript files
    const files = Object.keys(result.files);
    files.forEach((file) => {
      assert.ok(file.endsWith('.ts') || file.endsWith('.tsx'), `File ${file} should be TypeScript`);
    });
  });

  test('should handle specific file patterns', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/math.ts',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.files, 'Should have files');

    const files = Object.keys(result.files);
    assert.ok(files.length <= 1, 'Should find at most one math.ts file');
    if (files.length > 0) {
      assert.ok(files[0].endsWith('math.ts'), 'Should only include math.ts');
    }
  });

  // ========== Language Support Tests ==========

  test('should extract symbols from TypeScript files', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.ts',
      maxFiles: 10,
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.summary.totalSymbols > 0, 'Should find TypeScript symbols');

    // Look for TypeScript-specific symbols
    let foundFunction = false;

    for (const symbols of Object.values(result.files)) {
      for (const symbol of symbols as any[]) {
        if (symbol.kind === 'Function') foundFunction = true;
      }
    }

    assert.ok(foundFunction, 'Should find at least one function');
    // Class and Interface might not always be present depending on test files
  });

  test('should work with Python files if present', async () => {
    // First check if we have any Python files
    const checkResult = await callTool('workspaceSymbols', {
      format: 'detailed',
      filePattern: '**/*.py',
      maxFiles: 10,
    });

    if (checkResult.summary && checkResult.summary.totalFiles > 0) {
      // We have Python files, verify they have symbols
      assert.ok(checkResult.summary.totalSymbols > 0, 'Should extract symbols from Python files');

      // Verify Python-specific symbol structure
      const pyFiles = Object.keys(checkResult.files).filter((f) => f.endsWith('.py'));
      assert.ok(pyFiles.length > 0, 'Should have Python files');
    } else {
      // No Python files in test workspace, skip
      console.log('No Python files in test workspace, skipping Python test (this is expected)');
    }
  });

  // ========== Edge Cases and Options Tests ==========

  test('should handle includeDetails option', async () => {
    const detailedResult = await callTool('workspaceSymbols', {
      format: 'detailed',
      includeDetails: true,
      maxFiles: 5,
    });

    const minimalResult = await callTool('workspaceSymbols', {
      format: 'detailed',
      includeDetails: false,
      maxFiles: 5,
    });

    assert.ok(!detailedResult.error, 'Detailed result should not have error');
    assert.ok(!minimalResult.error, 'Minimal result should not have error');

    // Both should have the same files
    const detailedFiles = Object.keys(detailedResult.files);
    const minimalFiles = Object.keys(minimalResult.files);
    assert.deepStrictEqual(detailedFiles.sort(), minimalFiles.sort(), 'Should have same files');

    // Detailed should have range info, minimal should not
    if (detailedFiles.length > 0 && detailedResult.files[detailedFiles[0]].length > 0) {
      const detailedSymbol = detailedResult.files[detailedFiles[0]][0];
      const minimalSymbol = minimalResult.files[minimalFiles[0]][0];

      assert.ok(detailedSymbol.range, 'Detailed should have range');
      assert.ok(!minimalSymbol.range, 'Minimal should not have range');
    }
  });

  test('should exclude non-code files by default', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      includeNonCodeFiles: false,
    });

    assert.ok(!result.error, 'Should not have error');

    // Should not include files like HTML, JSON, etc.
    const files = Object.keys(result.files);
    files.forEach((file) => {
      assert.ok(
        !file.endsWith('.html') &&
          !file.endsWith('.json') &&
          !file.endsWith('.xml') &&
          !file.endsWith('.md'),
        `Should not include non-code file: ${file}`
      );
    });
  });

  test('should include non-code files when requested', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      includeNonCodeFiles: true,
      filePattern: '**/*.json',
    });

    assert.ok(!result.error, 'Should not have error');
    // If there are JSON files, they should be included
    // (They might have 0 symbols, but files should be processed)
  });

  test('should exclude external dependencies', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      includeExternalSymbols: false,
    });

    assert.ok(!result.error, 'Should not have error');

    // Should not include node_modules or other external paths
    const files = Object.keys(result.files);
    files.forEach((file) => {
      assert.ok(!file.includes('node_modules'), 'Should not include node_modules');
      assert.ok(!file.includes('venv'), 'Should not include Python venv');
      assert.ok(!file.includes('.vscode/extensions'), 'Should not include VS Code extensions');
    });
  });

  test('should use default code patterns when no pattern specified', async () => {
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      maxFiles: 50,
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.summary.totalFiles > 0, 'Should find files using default patterns');

    // Should include common code file extensions
    const files = Object.keys(result.files);
    const hasCodeFiles = files.some(
      (f) =>
        f.endsWith('.ts') ||
        f.endsWith('.js') ||
        f.endsWith('.py') ||
        f.endsWith('.java') ||
        f.endsWith('.cs') ||
        f.endsWith('.cpp')
    );
    assert.ok(hasCodeFiles, 'Should include code files with default patterns');
  });

  test('should handle language server not ready gracefully', async () => {
    // Don't open any files first to simulate cold start
    const result = await callTool('workspaceSymbols', {
      format: 'detailed',
      maxFiles: 5,
    });

    // Should either succeed or fail gracefully
    if (result.error) {
      assert.ok(
        result.error.includes('language') || result.error.includes('workspace'),
        'Error should mention language server or workspace'
      );
    } else {
      assert.ok(result.summary, 'Should have summary even in cold start');
    }
  });
});
