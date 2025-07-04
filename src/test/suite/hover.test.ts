import * as assert from 'assert';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Hover Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should return type information for function parameter', async () => {
    const document = await openTestFile('math.ts');

    // Hover over the 'a' parameter in add function (line 6, character 21)
    const result = await callTool('hover', {
      uri: document.uri.toString(),
      line: 6,
      character: 21,
    });

    assert.ok(result.hover, 'Should return hover information');
    assert.ok(result.hover.contents, 'Should have contents');

    const content = result.hover.contents.join(' ');
    assert.ok(content.includes('number'), 'Should show parameter type as number');
  });

  test('should return JSDoc documentation for function', async () => {
    const document = await openTestFile('math.ts');

    // Hover over the 'add' function name (line 6, character 17)
    const result = await callTool('hover', {
      uri: document.uri.toString(),
      line: 6,
      character: 17,
    });

    assert.ok(result.hover, 'Should return hover information');
    const content = result.hover.contents.join(' ');

    // Should include function signature
    assert.ok(
      content.includes('add(a: number, b: number): number'),
      'Should show function signature'
    );
    // Should include JSDoc
    assert.ok(content.includes('Adds two numbers together'), 'Should show JSDoc description');
  });

  test('should return class information', async () => {
    const document = await openTestFile('math.ts');

    // Hover over 'Calculator' class name (line 19, character 13)
    const result = await callTool('hover', {
      uri: document.uri.toString(),
      line: 19,
      character: 13,
    });

    assert.ok(result.hover, 'Should return hover information');
    const content = result.hover.contents.join(' ');
    assert.ok(content.includes('class Calculator'), 'Should show class information');
  });

  test('should return method information with JSDoc', async () => {
    const document = await openTestFile('math.ts');

    // Hover over 'getResult' method (line 34, character 4) - the method name
    const result = await callTool('hover', {
      uri: document.uri.toString(),
      line: 34,
      character: 4,
    });

    assert.ok(result.hover, 'Should return hover information');
    const content = result.hover.contents.join(' ');

    // Should show method signature
    assert.ok(content.includes('getResult(): number'), 'Should show method signature');
    // Should include JSDoc
    assert.ok(content.includes('Gets the current result'), 'Should show JSDoc description');
  });

  test('should return null for empty space', async () => {
    const document = await openTestFile('math.ts');

    // Hover over empty space
    const result = await callTool('hover', {
      uri: document.uri.toString(),
      line: 0,
      character: 0,
    });

    assert.strictEqual(result.hover, null, 'Should return null for empty space');
  });

  test.skip('should show imported type information', async () => {
    const document = await openTestFile('app.ts');

    // Hover over imported 'Calculator' (line 9, character 19) - in "new Calculator()"
    const result = await callTool('hover', {
      uri: document.uri.toString(),
      line: 9,
      character: 19,
    });

    assert.ok(result.hover, 'Should return hover information');
    const content = result.hover.contents.join(' ');
    assert.ok(content.includes('class Calculator'), 'Should show imported class information');
  });
});
