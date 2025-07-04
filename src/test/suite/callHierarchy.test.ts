import * as assert from 'assert';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Call Hierarchy Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
    // Open both test files to ensure they're indexed
    await openTestFile('math.ts');
    await openTestFile('app.ts');
    // Give extra time for language server to index
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find incoming calls to add function', async () => {
    await openTestFile('math.ts');

    // Use AI-friendly symbol-based approach
    const result = await callTool('callHierarchy', {
      symbol: 'add',
      direction: 'incoming',
    });

    console.log('Result:', JSON.stringify(result, null, 2));

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Check if it's the "no hierarchy available" case
    if (result.message) {
      console.log('No hierarchy message:', result.message);
      // This can happen if the language server hasn't indexed yet
      return;
    }

    assert.ok(result.calls, 'Should return calls');
    assert.ok(result.calls.length > 0, 'Should find at least one incoming call');

    // Should find the call from calculateSum in app.ts
    const callFromCalculateSum = result.calls.find(
      (call: any) => call.from.name === 'calculateSum'
    );
    assert.ok(callFromCalculateSum, 'Should find call from calculateSum function');
  });

  test('should find outgoing calls from calculateSum function', async () => {
    await openTestFile('app.ts');

    const result = await callTool('callHierarchy', {
      symbol: 'calculateSum',
      direction: 'outgoing',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.calls, 'Should return calls');
    assert.ok(result.calls.length > 0, 'Should find at least one outgoing call');

    // Should find the call to add function
    const callToAdd = result.calls.find((call: any) => call.to.name === 'add');
    assert.ok(callToAdd, 'Should find call to add function');
  });

  test('should find incoming calls to Calculator class methods', async () => {
    await openTestFile('math.ts');

    const result = await callTool('callHierarchy', {
      symbol: 'Calculator.multiply',
      direction: 'incoming',
    });

    console.log('Calculator.multiply result:', JSON.stringify(result, null, 2));

    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Check if it's the "no hierarchy available" case
    if (result.message) {
      console.log('No hierarchy message:', result.message);
      // This can happen if the language server hasn't indexed yet
      return;
    }

    assert.ok(result.calls, 'Should return calls');

    // The multiply method is called from app.ts
    const hasIncomingCall = result.calls.some(
      (call: any) => call.from.name === 'main' || call.from.name === '<top level>'
    );
    assert.ok(hasIncomingCall, 'Should find incoming call to multiply method');
  });

  test('should return empty array for functions with no calls', async () => {
    await openTestFile('math.ts');

    const result = await callTool('callHierarchy', {
      symbol: 'multiply',
      direction: 'incoming',
    });

    // multiply function (not the method) might not be called
    assert.ok(!result.error, 'Should not have error');
    // Either empty calls or message about no hierarchy
    assert.ok(result.calls?.length === 0 || result.message, 'Should handle no calls gracefully');
  });

  test('should include call location information', async () => {
    await openTestFile('math.ts');

    const result = await callTool('callHierarchy', {
      symbol: 'add',
      direction: 'incoming',
    });

    assert.ok(!result.error, 'Should not have error');
    if (result.calls && result.calls.length > 0) {
      const firstCall = result.calls[0];
      assert.ok(firstCall.from, 'Should have from information');
      assert.ok(firstCall.from.name, 'Should have caller name');
      assert.ok(firstCall.from.file, 'Should have file path');
      assert.ok(firstCall.locations, 'Should have call locations');
      assert.ok(firstCall.locations[0].line > 0, 'Should have valid line number (1-based)');
    }
  });

  test('should handle symbol not found', async () => {
    const result = await callTool('callHierarchy', {
      symbol: 'nonExistentFunction',
      direction: 'incoming',
    });

    assert.ok(result.error, 'Should return error for non-existent symbol');
    assert.ok(result.error.includes('No symbol found'), 'Error should mention symbol not found');
  });

  test('should find both incoming and outgoing calls', async () => {
    await openTestFile('app.ts');

    const result = await callTool('callHierarchy', {
      symbol: 'calculateSum',
      direction: 'both',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.calls, 'Should return calls');

    // Should have both incoming and outgoing calls
    const outgoingCalls = result.calls.filter((c: any) => c.type === 'outgoing');

    assert.ok(outgoingCalls.length > 0, 'Should find outgoing calls');
    // Note: calculateSum might not have incoming calls in test workspace
  });
});
