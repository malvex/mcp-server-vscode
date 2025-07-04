import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
  getTestFileUri,
} from '../helpers/testHelpers';

suite('Diagnostics Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
    // Open files to trigger diagnostics
    await openTestFile('app.ts');
    await openTestFile('math.ts');
    // Wait for diagnostics to be computed
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should detect type error in app.ts', async () => {
    const uri = getTestFileUri('app.ts');

    const result = await callTool('diagnostics', {
      format: 'detailed',
      uri: uri.toString(),
    });

    assert.ok(result.diagnostics, 'Should return diagnostics');
    assert.ok(Array.isArray(result.diagnostics), 'Should return array of diagnostics');

    // Find the type error we intentionally added
    const typeError = result.diagnostics.find(
      (d: any) =>
        d.message.includes('Type') &&
        d.message.includes('string') &&
        d.message.includes('number') &&
        d.range.start.line === 23 // hasTypeError function line with type error (1-based)
    );

    assert.ok(typeError, 'Should detect type mismatch error');
    assert.strictEqual(typeError.severity, 'Error', 'Should be an error severity');
  });

  test('should detect unused variable warning', async () => {
    const uri = getTestFileUri('app.ts');

    const result = await callTool('diagnostics', {
      format: 'detailed',
      uri: uri.toString(),
    });

    assert.ok(result.diagnostics, 'Should return diagnostics');

    // TypeScript might report unused variable
    const unusedVar = result.diagnostics.find(
      (d: any) =>
        d.message.includes('unused') ||
        (d.message.includes('declared') && d.message.includes('never'))
    );

    // Check that we found the unused variable diagnostic
    assert.ok(unusedVar, 'Should find unused variable diagnostic');

    // Find the specific unusedVariable diagnostic
    const unusedVariableDiag = result.diagnostics.find((d: any) =>
      d.message.includes("'unusedVariable'")
    );
    assert.ok(unusedVariableDiag, 'Should find unusedVariable diagnostic specifically');
  });

  test('should return empty array for file with no issues', async () => {
    const uri = getTestFileUri('math.ts');

    const result = await callTool('diagnostics', {
      format: 'detailed',
      uri: uri.toString(),
    });

    assert.ok(result.diagnostics, 'Should return diagnostics');
    assert.ok(Array.isArray(result.diagnostics), 'Should return array');

    // math.ts should have no errors
    const errors = result.diagnostics.filter((d: any) => d.severity === 'Error');
    assert.strictEqual(errors.length, 0, 'math.ts should have no errors');
  });

  test('should get all workspace diagnostics', async () => {
    // Get diagnostics for entire workspace (no uri)
    const result = await callTool('diagnostics', {
      format: 'detailed',
    });

    assert.ok(result.diagnostics, 'Should return diagnostics');
    assert.ok(
      typeof result.diagnostics === 'object',
      'Should return object with file URIs as keys'
    );

    // Should have diagnostics for app.ts
    // const appTsUri = getTestFileUri('app.ts').toString();
    const hasDiagnosticsForApp = Object.keys(result.diagnostics).some((uri) =>
      uri.endsWith('app.ts')
    );

    assert.ok(hasDiagnosticsForApp, 'Should include diagnostics for app.ts');
  });

  test('should include diagnostic source', async () => {
    const uri = getTestFileUri('app.ts');

    const result = await callTool('diagnostics', {
      format: 'detailed',
      uri: uri.toString(),
    });

    assert.ok(result.diagnostics, 'Should return diagnostics');

    const diagnostic = result.diagnostics.find((d: any) => d.severity === 'Error');
    if (diagnostic) {
      assert.ok(diagnostic.source, 'Diagnostic should have source');
      assert.ok(
        diagnostic.source === 'ts' || diagnostic.source === 'typescript',
        'Source should be TypeScript'
      );
    }
  });

  test('should include diagnostic code', async () => {
    const uri = getTestFileUri('app.ts');

    const result = await callTool('diagnostics', {
      format: 'detailed',
      uri: uri.toString(),
    });

    const typeError = result.diagnostics.find(
      (d: any) => d.message.includes('Type') && d.severity === 'Error'
    );

    if (typeError) {
      assert.ok(typeError.code, 'Type error should have error code');
      assert.ok(
        typeof typeError.code === 'number' || typeof typeError.code === 'string',
        'Error code should be number or string'
      );
    }
  });

  test('should handle non-existent file', async () => {
    const uri = vscode.Uri.file('/non/existent/file.ts');

    const result = await callTool('diagnostics', {
      format: 'detailed',
      uri: uri.toString(),
    });

    assert.ok(result.diagnostics, 'Should return diagnostics');
    assert.ok(Array.isArray(result.diagnostics), 'Should return array');
    assert.strictEqual(
      result.diagnostics.length,
      0,
      'Should return empty array for non-existent file'
    );
  });
});
