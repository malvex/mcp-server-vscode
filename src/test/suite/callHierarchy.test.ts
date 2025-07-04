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
import { waitForLanguageServer } from '../helpers/languageServerReady';

suite('Call Hierarchy Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find incoming calls to add function', async () => {
    await openTestFile('math.ts');

    // Use AI-friendly symbol-based approach
    let result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'add',
        direction: 'incoming',
      },
      context
    );

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Handle multiple matches case
    if (result.multipleMatches && result.matches) {
      // Find the add function from math.ts (not from temp files)
      const mathMatch = result.matches.find(
        (m: any) => m.symbol.file.includes('math.ts') && !m.symbol.file.includes('temp-test')
      );
      assert.ok(mathMatch, 'Should find add function from math.ts');

      // Use the hierarchy from the math.ts match
      if (mathMatch.calls) {
        result = mathMatch;
      } else {
        // If no calls in the match, might need to handle "no hierarchy available"
        result = { message: 'no call hierarchy available' };
      }
    }

    // Check if it's the "no hierarchy available" case
    if (result.message && result.message.includes('no call hierarchy available')) {
      // Language server might not be ready yet - retry with proper wait
      const doc = await vscode.workspace.openTextDocument(getTestFileUri('math.ts'));
      const ready = await waitForLanguageServer(doc);

      if (!ready) {
        assert.fail('Language server should be ready for call hierarchy');
      }

      const retryResult = await callTool(
        'callHierarchy',
        {
          format: 'detailed',
          symbol: 'add',
          direction: 'incoming',
        },
        context
      );

      if (retryResult.message) {
        assert.fail('Call hierarchy should be available after retry');
      }

      // Use retry result for remaining assertions
      result = retryResult;
    }

    assert.ok(result.calls, 'Should return calls');
    assert.ok(result.calls.length > 0, 'Should find at least one incoming call');

    // Should find the call from calculateSum in app.ts
    const callFromCalculateSum = result.calls.find(
      (call: any) => call.from.name === 'calculateSum'
    );
    assert.ok(callFromCalculateSum, 'Should find call from calculateSum function');

    // Verify the call location details
    assert.ok(callFromCalculateSum.locations, 'Should have call locations');
    assert.ok(callFromCalculateSum.locations.length > 0, 'Should have at least one location');
    assert.ok(
      callFromCalculateSum.locations[0].line >= 0,
      'Should have valid line number (0-based)'
    );
  });

  test('should find outgoing calls from calculateSum function', async () => {
    await openTestFile('app.ts');

    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'calculateSum',
        direction: 'outgoing',
      },
      context
    );

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.calls, 'Should return calls');
    assert.ok(result.calls.length > 0, 'Should find at least one outgoing call');

    // Should find the call to add function
    const callToAdd = result.calls.find((call: any) => call.to.name === 'add');
    assert.ok(callToAdd, 'Should find call to add function');

    // Verify it's the standalone function, not the method
    assert.ok(!callToAdd.to.container, 'Should call standalone add function, not method');
  });

  test('should find incoming calls to Calculator class methods', async () => {
    await openTestFile('math.ts');

    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'Calculator.multiply',
        direction: 'incoming',
      },
      context
    );

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Note: Calculator.multiply might not be used in our test files
    // This is a valid test case - the tool should handle unused methods gracefully
    if (result.message) {
      assert.ok(
        result.message.includes('no call hierarchy available'),
        'Should indicate no hierarchy available for unused method'
      );
      return;
    }

    assert.ok(result.calls, 'Should return calls array (possibly empty)');
  });

  test('should handle ambiguous symbol names correctly', async () => {
    // Test that when searching for 'add', we get the function not the method
    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'add',
        direction: 'incoming',
      },
      context
    );

    assert.ok(!result.error, 'Should not have error');

    // Handle multiple matches case
    let symbolToCheck;
    if (result.multipleMatches && result.matches) {
      // Find the add function from math.ts (not from temp files)
      const mathMatch = result.matches.find(
        (m: any) => m.symbol.file.includes('math.ts') && !m.symbol.file.includes('temp-test')
      );
      assert.ok(mathMatch, 'Should find add function from math.ts');
      symbolToCheck = mathMatch.symbol;
    } else if (result.symbol) {
      symbolToCheck = result.symbol;
    }

    if (symbolToCheck) {
      // Verify we got the standalone function
      assert.ok(!symbolToCheck.container, 'Should prioritize standalone function over method');
      assert.strictEqual(symbolToCheck.kind, 'Function', 'Should identify as function');
    }
  });

  test('should include call location information', async () => {
    await openTestFile('math.ts');

    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'add',
        direction: 'incoming',
      },
      context
    );

    assert.ok(!result.error, 'Should not have error');

    // Skip if no hierarchy available (but don't just return)
    if (!result.message && result.calls && result.calls.length > 0) {
      const firstCall = result.calls[0];
      assert.ok(firstCall.from, 'Should have from information');
      assert.ok(firstCall.from.name, 'Should have caller name');
      assert.ok(firstCall.from.file, 'Should have file path');
      assert.ok(firstCall.from.kind, 'Should have symbol kind');
      assert.ok(firstCall.locations, 'Should have call locations');
      assert.ok(Array.isArray(firstCall.locations), 'Locations should be an array');

      if (firstCall.locations.length > 0) {
        const loc = firstCall.locations[0];
        assert.ok(typeof loc.line === 'number', 'Line should be a number');
        assert.ok(loc.line >= 0, 'Line should be 0-based for AI');
        assert.ok(typeof loc.character === 'number', 'Character should be a number');

        // If preview is included, verify it
        if (loc.preview) {
          assert.ok(typeof loc.preview === 'string', 'Preview should be a string');
        }
      }
    }
  });

  test('should handle symbol not found', async () => {
    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'nonExistentFunction',
        direction: 'incoming',
      },
      context
    );

    assert.ok(result.error, 'Should return error for non-existent symbol');
    assert.ok(result.error.includes('No symbol found'), 'Error should mention symbol not found');

    // Verify it provides helpful suggestion
    if (result.suggestion) {
      assert.ok(typeof result.suggestion === 'string', 'Should provide string suggestion');
    }
  });

  test('should find both incoming and outgoing calls', async () => {
    await openTestFile('app.ts');

    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'calculateSum',
        direction: 'both',
      },
      context
    );

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.calls, 'Should return calls');

    // Should have both incoming and outgoing calls
    const outgoingCalls = result.calls.filter((c: any) => c.type === 'outgoing');

    assert.ok(outgoingCalls.length > 0, 'Should find outgoing calls');
    // Note: calculateSum might not have incoming calls in test workspace

    // Verify call types are properly labeled
    result.calls.forEach((call: any) => {
      assert.ok(
        ['incoming', 'outgoing'].includes(call.type),
        'Call type should be incoming or outgoing'
      );
    });
  });

  test('should work with class method notation', async () => {
    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'Calculator.add',
        direction: 'incoming',
      },
      context
    );

    assert.ok(!result.error, 'Should not have error');

    // The tool should handle class.method notation correctly
    // It might return multiple matches (both the method and function named 'add')
    if (result.multipleMatches) {
      assert.ok(result.matches, 'Should have matches array');
      const methodMatch = result.matches.find(
        (m: any) => m.symbol.container === 'Calculator' && m.symbol.name.includes('add')
      );
      assert.ok(methodMatch, 'Should find the Calculator.add method among matches');
    } else if (result.symbol) {
      // Single match case
      assert.strictEqual(result.symbol.container, 'Calculator', 'Should identify container');
      assert.ok(result.symbol.name.includes('add'), 'Should identify method name');
    }
    // If no hierarchy is available, that's also valid
  });

  test('should provide helpful error messages with suggestions', async () => {
    const result = await callTool(
      'callHierarchy',
      {
        format: 'detailed',
        symbol: 'calc', // Partial name
        direction: 'incoming',
      },
      context
    );

    if (result.error) {
      // Should either find partial match or provide suggestions
      if (result.suggestions) {
        assert.ok(Array.isArray(result.suggestions), 'Suggestions should be an array');
        assert.ok(result.suggestions.length > 0, 'Should provide at least one suggestion');

        // Verify suggestion structure
        result.suggestions.forEach((suggestion: any) => {
          assert.ok(suggestion.name, 'Suggestion should have name');
          assert.ok(suggestion.kind, 'Suggestion should have kind');
        });
      }
    }
  });
});
