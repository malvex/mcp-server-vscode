import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('References Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find all references to add function', async () => {
    const document = await openTestFile('math.ts');

    // Find references to 'add' function (line 6, character 17)
    const result = await callTool('references', {
      uri: document.uri.toString(),
      line: 6,
      character: 17,
      includeDeclaration: true,
    });

    assert.ok(result.references, 'Should return references');
    assert.ok(
      result.references.length >= 2,
      'Should find at least 2 references (declaration + usage)'
    );

    // Should include the declaration
    const declaration = result.references.find(
      (ref: any) => ref.uri.endsWith('math.ts') && ref.range.start.line === 6
    );
    assert.ok(declaration, 'Should include the declaration');

    // Should include usage in app.ts
    const usage = result.references.find((ref: any) => ref.uri.endsWith('app.ts'));
    assert.ok(usage, 'Should include usage in app.ts');
  });

  test('should exclude declaration when requested', async () => {
    const document = await openTestFile('math.ts');

    // Find references to 'add' function without declaration
    const result = await callTool('references', {
      uri: document.uri.toString(),
      line: 6,
      character: 17,
      includeDeclaration: false,
    });

    assert.ok(result.references, 'Should return references');

    // Should NOT include the declaration
    const declaration = result.references.find(
      (ref: any) => ref.uri.endsWith('math.ts') && ref.range.start.line === 6
    );
    assert.ok(!declaration, 'Should NOT include the declaration');

    // Should still include usage
    const usage = result.references.find((ref: any) => ref.uri.endsWith('app.ts'));
    assert.ok(usage, 'Should include usage in app.ts');
  });

  test('should find all references to Calculator class', async () => {
    const document = await openTestFile('math.ts');

    // Find references to 'Calculator' class (line 19, character 13)
    const result = await callTool('references', {
      uri: document.uri.toString(),
      line: 19,
      character: 13,
      includeDeclaration: true,
    });

    assert.ok(result.references, 'Should return references');
    assert.ok(result.references.length >= 3, 'Should find multiple references');

    // Check for import, usage, and type annotation
    const importRef = result.references.find(
      (ref: any) => ref.uri.endsWith('app.ts') && ref.range.start.line === 0
    );
    assert.ok(importRef, 'Should find import reference');

    const usageRef = result.references.find(
      (ref: any) => ref.uri.endsWith('app.ts') && ref.range.start.line === 9
    );
    assert.ok(usageRef, 'Should find instantiation reference');
  });

  test('should find references to class methods', async () => {
    const document = await openTestFile('math.ts');

    // Find references to 'getResult' method (line 35, character 2)
    const result = await callTool('references', {
      uri: document.uri.toString(),
      line: 35,
      character: 2,
      includeDeclaration: true,
    });

    assert.ok(result.references, 'Should return references');
    assert.ok(result.references.length >= 2, 'Should find at least 2 references');

    // Should find usage in app.ts
    const usage = result.references.find(
      (ref: any) => ref.uri.endsWith('app.ts') && ref.range.start.line === 15
    );
    assert.ok(usage, 'Should find method call in app.ts');
  });

  test('should return empty array for unused symbol', async () => {
    const document = await openTestFile('math.ts');

    // Find references to 'multiply' function which is not used
    const result = await callTool('references', {
      uri: document.uri.toString(),
      line: 14,
      character: 17,
      includeDeclaration: false,
    });

    assert.ok(Array.isArray(result.references), 'Should return array');
    assert.strictEqual(
      result.references.length,
      0,
      'Should return empty array for unused function'
    );
  });

  test('should find local variable references', async () => {
    const document = await openTestFile('app.ts');

    // Find references to 'calc' variable (line 9, character 8)
    const result = await callTool('references', {
      uri: document.uri.toString(),
      line: 9,
      character: 8,
      includeDeclaration: true,
    });

    assert.ok(result.references, 'Should return references');
    assert.ok(result.references.length >= 3, 'Should find multiple references to calc variable');

    // All references should be in the same file
    result.references.forEach((ref: any) => {
      assert.ok(ref.uri.endsWith('app.ts'), 'All references should be in app.ts');
    });
  });
});
