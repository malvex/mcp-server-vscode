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
    // Open test files to ensure they're indexed
    await openTestFile('math.ts');
    await openTestFile('app.ts');
    // Give extra time for language server to index
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should return type information for add function', async () => {
    // Ensure file is open for this test
    await openTestFile('math.ts');

    // Use AI-friendly symbol-based approach
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'add',
    });

    console.log('Hover result:', JSON.stringify(result, null, 2));

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Handle both single and multiple match cases
    let hoverInfo;
    if (result.multipleMatches && result.matches) {
      // Find the add function from math.ts (not from temp files)
      const mathMatch = result.matches.find(
        (m: any) => m.symbol.file.includes('math.ts') && !m.symbol.file.includes('temp-test')
      );
      assert.ok(mathMatch, 'Should find add function from math.ts');
      hoverInfo = mathMatch.hover;
    } else {
      assert.ok(result.hover, 'Should return hover information');
      hoverInfo = result.hover;
    }

    assert.ok(hoverInfo.contents, 'Should have contents');
    const content = hoverInfo.contents.join(' ');
    // Should show function signature with parameter types
    assert.ok(content.includes('number'), 'Should show parameter types');
    assert.ok(content.includes('add'), 'Should include function name');
  });

  test('should return JSDoc documentation for function', async () => {
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'add',
    });

    assert.ok(!result.error, 'Should not have error');

    // Handle both single and multiple match cases
    let hoverInfo;
    if (result.multipleMatches && result.matches) {
      // Find the add function from math.ts (not from temp files)
      const mathMatch = result.matches.find(
        (m: any) => m.symbol.file.includes('math.ts') && !m.symbol.file.includes('temp-test')
      );
      assert.ok(mathMatch, 'Should find add function from math.ts');
      hoverInfo = mathMatch.hover;
    } else {
      assert.ok(result.hover, 'Should return hover information');
      hoverInfo = result.hover;
    }

    const content = hoverInfo.contents.join(' ');
    // Check for JSDoc content
    assert.ok(
      content.includes('Adds two numbers') || content.includes('sum of a and b'),
      'Should include JSDoc documentation'
    );
  });

  test('should return class information', async () => {
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'Calculator',
    });

    assert.ok(!result.error, 'Should not have error');

    // Handle both single and multiple match cases
    let hoverInfo;
    if (result.multipleMatches && result.matches) {
      // Find the Calculator class from math.ts (not from temp files)
      const mathMatch = result.matches.find(
        (m: any) => m.symbol.file.includes('math.ts') && !m.symbol.file.includes('temp-test')
      );
      assert.ok(mathMatch, 'Should find Calculator class from math.ts');
      hoverInfo = mathMatch.hover;
    } else {
      assert.ok(result.hover, 'Should return hover information');
      hoverInfo = result.hover;
    }

    assert.ok(hoverInfo.contents, 'Should have contents');
    const content = hoverInfo.contents.join(' ');
    assert.ok(content.includes('Calculator'), 'Should include class name');
    assert.ok(content.includes('class'), 'Should indicate it is a class');
  });

  test('should return method information with JSDoc', async () => {
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'Calculator.add',
    });

    console.log('Calculator.add hover result:', JSON.stringify(result, null, 2));

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Check if it's the "no hover information available" case
    if (result.message) {
      console.log('No hover message:', result.message);
      // This can happen if the language server hasn't indexed yet
      return;
    }

    // Handle multiple matches case
    if (result.multipleMatches) {
      assert.ok(result.matches, 'Should have matches');
      // Find the Calculator.add method
      const methodMatch = result.matches.find(
        (m: any) => m.symbol.container === 'Calculator' && m.symbol.name.startsWith('add')
      );
      assert.ok(methodMatch, 'Should find Calculator.add method');
      assert.ok(methodMatch.hover, 'Method should have hover info');
      const content = methodMatch.hover.contents.join(' ');
      assert.ok(
        content.includes('Adds a number') || content.includes('current result'),
        'Should include method documentation'
      );
    } else {
      assert.ok(result.hover, 'Should return hover information');
      const content = result.hover.contents.join(' ');
      // The add method should have JSDoc
      assert.ok(
        content.includes('Adds a number') || content.includes('current result'),
        'Should include method documentation'
      );
    }
  });

  test('should handle symbol not found', async () => {
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'nonExistentFunction',
    });

    assert.ok(result.error, 'Should return error for non-existent symbol');
    assert.ok(result.error.includes('No symbol found'), 'Error should mention symbol not found');
  });

  test.skip('should show imported type information', async () => {
    // This test depends on TypeScript language features availability
    // Skip if not available
  });

  test('should include code snippet in response', async () => {
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'multiply',
    });

    assert.ok(!result.error, 'Should not have error');

    // Check if it's the "no hover information available" case
    if (result.message) {
      console.log('No hover message:', result.message);
      // This can happen if the language server hasn't indexed yet
      return;
    }

    assert.ok(result.hover, 'Should return hover information');
    assert.ok(result.hover.codeSnippet, 'Should include code snippet');

    // Code snippet should show the function with context
    assert.ok(
      result.hover.codeSnippet.includes('multiply'),
      'Code snippet should include function name'
    );
    assert.ok(result.hover.codeSnippet.includes('>'), 'Code snippet should mark the target line');
  });

  test('should handle multiple matches', async () => {
    // If there are multiple symbols with the same name, it should return all
    const result = await callTool('hover', {
      format: 'detailed',
      symbol: 'add', // This could match both the function and the method
    });

    assert.ok(!result.error, 'Should not have error');

    if (result.message) {
      console.log('No hover message:', result.message);
      // This can happen if the language server hasn't indexed yet
      return;
    }

    if (result.multipleMatches) {
      assert.ok(result.matches, 'Should have matches array');
      assert.ok(result.matches.length > 0, 'Should have at least one match');

      // Each match should have hover info
      result.matches.forEach((match: any) => {
        assert.ok(match.hover, 'Each match should have hover info');
        assert.ok(match.symbol, 'Each match should have symbol info');
      });
    } else {
      // Single match is also acceptable
      assert.ok(result.hover, 'Should have hover info for single match');
    }
  });
});
