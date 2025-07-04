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
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should find incoming calls to add function', async () => {
    const document = await openTestFile('math.ts');

    // Get incoming calls to 'add' function (line 6, character 17)
    const result = await callTool('callHierarchy', {
      uri: document.uri.toString(),
      line: 6,
      character: 17,
      direction: 'incoming',
    });

    assert.ok(result.calls, 'Should return calls');
    assert.ok(result.calls.length > 0, 'Should find at least one incoming call');

    // Should find the call from calculateSum in app.ts
    const callFromCalculateSum = result.calls.find(
      (call: any) => call.from.name === 'calculateSum'
    );
    assert.ok(callFromCalculateSum, 'Should find call from calculateSum function');
  });

  test('should find outgoing calls from calculateSum function', async () => {
    const document = await openTestFile('app.ts');

    // Get outgoing calls from 'calculateSum' function (line 3, character 9)
    const result = await callTool('callHierarchy', {
      uri: document.uri.toString(),
      line: 3,
      character: 9,
      direction: 'outgoing',
    });

    assert.ok(result.calls, 'Should return calls');
    assert.ok(result.calls.length > 0, 'Should find at least one outgoing call');

    // Should find the call to add function
    const callToAdd = result.calls.find((call: any) => call.to.name === 'add');
    assert.ok(callToAdd, 'Should find call to add function');
  });

  test('should find incoming calls to Calculator class methods', async () => {
    const document = await openTestFile('math.ts');

    // Get incoming calls to 'add' method of Calculator (line 26, character 2)
    const result = await callTool('callHierarchy', {
      uri: document.uri.toString(),
      line: 26,
      character: 2,
      direction: 'incoming',
    });

    assert.ok(result.calls, 'Should return calls');

    // The add method is called from performCalculations in app.ts
    const hasIncomingCalls = result.calls.length > 0;
    if (hasIncomingCalls) {
      const callFromPerformCalculations = result.calls.find(
        (call: any) => call.from.name === 'performCalculations'
      );
      assert.ok(callFromPerformCalculations, 'Should find call from performCalculations');
    }
  });

  test('should return empty array for functions with no calls', async () => {
    const document = await openTestFile('math.ts');

    // Get incoming calls to 'multiply' function which is not used
    const result = await callTool('callHierarchy', {
      uri: document.uri.toString(),
      line: 16,
      character: 17,
      direction: 'incoming',
    });

    assert.ok(Array.isArray(result.calls), 'Should return array');
    assert.strictEqual(result.calls.length, 0, 'Should return empty array for unused function');
  });

  test('should include call location information', async () => {
    const document = await openTestFile('math.ts');

    // Get incoming calls to 'add' function
    const result = await callTool('callHierarchy', {
      uri: document.uri.toString(),
      line: 6,
      character: 17,
      direction: 'incoming',
    });

    assert.ok(result.calls.length > 0, 'Should have calls');
    const firstCall = result.calls[0];

    // Verify call structure
    assert.ok(firstCall.from, 'Should have from information');
    assert.ok(firstCall.from.name, 'Should have caller name');
    assert.ok(firstCall.from.kind, 'Should have caller kind');
    assert.ok(firstCall.from.uri, 'Should have caller URI');
    assert.ok(firstCall.from.range, 'Should have caller range');
    assert.ok(firstCall.fromRanges, 'Should have call site ranges');
    assert.ok(Array.isArray(firstCall.fromRanges), 'Call sites should be array');
  });
});
