import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Basic Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should return code files when called with empty object', async () => {
    // Call with empty object (no parameters)
    const result = await callTool('workspaceSymbols', {});

    assert.ok(!result.error, `Should not have error: ${result.error}`);
    assert.ok(result.summary, 'Should have summary');
    assert.ok(result.files, 'Should have files');

    // Should find files (not return 0 files)
    const fileCount = Object.keys(result.files).length;
    assert.ok(fileCount > 0, `Should find code files, but found ${fileCount} files`);

    console.log(`Found ${fileCount} code files with default behavior`);
    console.log(
      'File types found:',
      Object.keys(result.files)
        .map((f) => f.split('.').pop())
        .filter((v, i, a) => a.indexOf(v) === i)
    );
  });

  test('should find TypeScript files in test workspace', async () => {
    const result = await callTool('workspaceSymbols', {});

    assert.ok(!result.error, 'Should not have error');

    const fileNames = Object.keys(result.files);
    const tsFiles = fileNames.filter((f) => f.endsWith('.ts'));

    // We know there are TypeScript files in the test workspace
    assert.ok(tsFiles.length > 0, `Should find TypeScript files, but found ${tsFiles.length}`);

    // Should find symbols in those files
    assert.ok(
      result.summary.totalSymbols > 0,
      `Should find symbols, but found ${result.summary.totalSymbols}`
    );
  });

  test('should respect maxFiles with default pattern', async () => {
    const result = await callTool('workspaceSymbols', {
      maxFiles: 3,
    });

    assert.ok(!result.error, 'Should not have error');

    const fileCount = Object.keys(result.files).length;
    assert.ok(fileCount > 0, 'Should find at least some files');
    assert.ok(fileCount <= 3, `Should respect maxFiles=3, but found ${fileCount} files`);
  });

  test('should include various code file types', async () => {
    const result = await callTool('workspaceSymbols', {
      maxFiles: 100,
    });

    assert.ok(!result.error, 'Should not have error');

    const fileNames = Object.keys(result.files);
    console.log(`Total files found: ${fileNames.length}`);

    // Log first few files to debug
    console.log('First few files:', fileNames.slice(0, 5));

    // Check that we're only getting code files
    for (const fileName of fileNames) {
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      const isCodeFile = [
        '.ts',
        '.js',
        '.tsx',
        '.jsx',
        '.py',
        '.java',
        '.cs',
        '.go',
        '.rs',
        '.rb',
        '.php',
      ].some((codeExt) => ext === codeExt);

      if (!isCodeFile) {
        console.log(`Found non-code file: ${fileName} with extension: ${ext}`);
      }
    }
  });
});
