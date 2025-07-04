import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Default Pattern Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should work without any parameters', async () => {
    // This is the main test - calling workspaceSymbols() with no params
    const result = await callTool('workspaceSymbols', {});

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.summary, 'Should have summary');
    assert.ok(result.files, 'Should have files');

    // Should find some TypeScript files in the test workspace
    const fileNames = Object.keys(result.files);
    console.log(`Found ${fileNames.length} code files without specifying pattern`);

    // Should only include code files
    for (const fileName of fileNames) {
      // Check that files have code extensions
      const hasCodeExtension = DEFAULT_CODE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
      assert.ok(hasCodeExtension, `File should have a code extension: ${fileName}`);
    }
  });

  test('should not error with glob pattern syntax', async () => {
    // Ensure no nested brace expansion errors
    const result = await callTool('workspaceSymbols', {
      maxFiles: 10,
    });

    // Should not have glob parsing errors
    assert.ok(
      !result.error || !result.error.includes('nested alternate groups'),
      `Should not have glob syntax error: ${result.error}`
    );
    assert.ok(
      !result.error || !result.error.includes('parsing glob'),
      `Should not have glob parsing error: ${result.error}`
    );
  });

  test('should find TypeScript files by default', async () => {
    const result = await callTool('workspaceSymbols', {
      maxFiles: 50,
    });

    assert.ok(!result.error, 'Should not have error');

    // In our test workspace, we should find TypeScript files
    const fileNames = Object.keys(result.files);
    const tsFiles = fileNames.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

    assert.ok(tsFiles.length > 0, 'Should find TypeScript files in test workspace');
    console.log(`Found ${tsFiles.length} TypeScript files`);
  });

  test('should limit files correctly with default pattern', async () => {
    const maxFiles = 5;
    const result = await callTool('workspaceSymbols', {
      maxFiles: maxFiles,
    });

    assert.ok(!result.error, 'Should not have error');

    const fileCount = Object.keys(result.files).length;
    assert.ok(
      fileCount <= maxFiles,
      `Should respect maxFiles limit: found ${fileCount}, max ${maxFiles}`
    );
  });

  test('should find symbols in multiple language files', async () => {
    const result = await callTool('workspaceSymbols', {
      maxFiles: 100,
    });

    assert.ok(!result.error, 'Should not have error');

    // Check that we're finding symbols
    assert.ok(result.summary.totalSymbols > 0, 'Should find some symbols');

    // Log what types of files we found
    const filesByExtension: Record<string, number> = {};
    for (const fileName of Object.keys(result.files)) {
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
    }

    console.log('Files by extension:', filesByExtension);
  });
});

// List of code file extensions for validation
const DEFAULT_CODE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.py',
  '.pyw',
  '.java',
  '.c',
  '.cpp',
  '.cc',
  '.cxx',
  '.h',
  '.hpp',
  '.cs',
  '.vb',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.swift',
  '.m',
  '.mm',
  '.kt',
  '.kts',
  '.scala',
  '.r',
  '.R',
  '.lua',
  '.dart',
  '.ex',
  '.exs',
  '.clj',
  '.cljs',
  '.jl',
];
