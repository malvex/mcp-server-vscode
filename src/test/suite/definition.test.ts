import * as assert from 'assert';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Definition Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find function definition from usage', async () => {
    const document = await openTestFile('app.ts');

    // Click on 'add' function call (line 4, character 38) - in the reduce callback
    const result = await callTool('definition', {
      uri: document.uri.toString(),
      line: 4,
      character: 38,
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.strictEqual(result.definitions.length, 1, 'Should find one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
    assert.strictEqual(def.range.start.line, 6, 'Should point to line 7 (add function)');
  });

  test('should find class definition from usage', async () => {
    const document = await openTestFile('app.ts');

    // Click on 'Calculator' in new Calculator() (line 9, character 20)
    const result = await callTool('definition', {
      uri: document.uri.toString(),
      line: 9,
      character: 20,
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.strictEqual(result.definitions.length, 1, 'Should find one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
    assert.strictEqual(def.range.start.line, 20, 'Should point to Calculator class definition');
  });

  test('should find method definition from usage', async () => {
    const document = await openTestFile('app.ts');

    // Click on 'getResult' method call (line 13, character 22)
    const result = await callTool('definition', {
      uri: document.uri.toString(),
      line: 13,
      character: 22,
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.strictEqual(result.definitions.length, 1, 'Should find one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('math.ts'), 'Should point to math.ts file');
    assert.strictEqual(def.range.start.line, 34, 'Should point to getResult method');
  });

  test('should find import source', async () => {
    const document = await openTestFile('app.ts');

    // Click on './math' import path (line 0, character 45)
    const result = await callTool('definition', {
      uri: document.uri.toString(),
      line: 0,
      character: 45,
    });

    assert.ok(result.definitions, 'Should return definitions');
    // TypeScript may return the module or the file itself
    assert.ok(result.definitions.length >= 1, 'Should find at least one definition');
    assert.ok(result.definitions[0].uri.endsWith('math.ts'), 'Should resolve to math.ts');
  });

  test('should return empty array for no definition', async () => {
    const document = await openTestFile('math.ts');

    // Click on a comment
    const result = await callTool('definition', {
      uri: document.uri.toString(),
      line: 1,
      character: 5,
    });

    assert.ok(Array.isArray(result.definitions), 'Should return array');
    assert.strictEqual(result.definitions.length, 0, 'Should return empty array for comment');
  });

  test('should find local variable definition', async () => {
    const document = await openTestFile('app.ts');

    // Click on 'calc' variable usage (line 11, character 3)
    const result = await callTool('definition', {
      uri: document.uri.toString(),
      line: 11,
      character: 3,
    });

    assert.ok(result.definitions, 'Should return definitions');
    assert.strictEqual(result.definitions.length, 1, 'Should find one definition');

    const def = result.definitions[0];
    assert.ok(def.uri.endsWith('app.ts'), 'Should point to same file');
    assert.strictEqual(def.range.start.line, 9, 'Should point to variable declaration');
  });
});
