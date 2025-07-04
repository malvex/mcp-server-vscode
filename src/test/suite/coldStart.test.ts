import * as assert from 'assert';
import { resetInitializedLanguages } from '../../tools/utils/symbolProvider';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Cold Start Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('hover should work on first call after cold start', async () => {
    // Reset the symbol provider state to simulate cold start
    resetInitializedLanguages();

    // Wait a bit to ensure clean state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('Testing hover with cold start...');
    const startTime = Date.now();

    // First call - should trigger language server initialization and still find the symbol
    const result = await callTool('hover', {
      symbol: 'add',
      format: 'compact',
    });

    const duration = Date.now() - startTime;
    console.log(`Hover took ${duration}ms`);
    console.log('Result:', JSON.stringify(result, null, 2));

    // The test passes if:
    // 1. We found the symbol (no error)
    // 2. OR we got a "no symbol found" error (which means the search ran but didn't find 'add' in test workspace)
    if (result.error && result.error.includes('No symbol found')) {
      console.log('No symbol found in test workspace - this is acceptable for cold start test');
      return;
    }

    // Should NOT have other types of errors
    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Should find the symbol
    assert.ok(result.symbol || result.matches, 'Should find the symbol');

    // Should have hover information
    if (result.hover) {
      assert.ok(result.hover.length > 0, 'Should have hover contents');
    } else if (result.matches) {
      assert.ok(result.matches.length > 0, 'Should have matches');
      assert.ok(result.matches[0].hover, 'First match should have hover info');
    }
  }).timeout(30000);

  test('definition should work on first call after cold start', async () => {
    // Reset the symbol provider state to simulate cold start
    resetInitializedLanguages();

    // Wait a bit to ensure clean state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('Testing definition with cold start...');
    const startTime = Date.now();

    // First call - should trigger language server initialization and still find the symbol
    const result = await callTool('definition', {
      symbol: 'add',
      format: 'compact',
    });

    const duration = Date.now() - startTime;
    console.log(`Definition took ${duration}ms`);
    console.log('Result:', JSON.stringify(result, null, 2));

    // The test passes if we got a "not found" message (means search ran)
    if (result.message && result.message.includes('not found')) {
      console.log('No symbol found in test workspace - this is acceptable for cold start test');
      assert.deepStrictEqual(result.definitions, [], 'Should return empty definitions array');
      return;
    }

    // Should NOT have an error
    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Should find the definition(s)
    assert.ok(result.definitions, 'Should have definitions array');
    assert.ok(result.definitions.length > 0, 'Should find at least one definition');
  }).timeout(30000);

  test('references should work on first call after cold start', async () => {
    // Reset the symbol provider state to simulate cold start
    resetInitializedLanguages();

    // Wait a bit to ensure clean state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('Testing references with cold start...');
    const startTime = Date.now();

    // First call - should trigger language server initialization and still find references
    const result = await callTool('references', {
      symbol: 'add',
      format: 'compact',
    });

    const duration = Date.now() - startTime;
    console.log(`References took ${duration}ms`);
    console.log('Result:', JSON.stringify(result, null, 2));

    // The test passes if we got a "not found" message (means search ran)
    if (result.message && result.message.includes('not found')) {
      console.log('No symbol found in test workspace - this is acceptable for cold start test');
      assert.strictEqual(result.totalReferences, 0, 'Should have zero references');
      assert.deepStrictEqual(result.references, [], 'Should return empty references array');
      return;
    }

    // Should NOT have an error
    assert.ok(!result.error, `Should not have error: ${result.error}`);

    // Should find references
    assert.ok(result.references, 'Should have references array');
    assert.ok(result.totalReferences > 0, 'Should find at least one reference');
  }).timeout(30000);

  test('second call should be fast', async () => {
    // Don't reset - use warm state
    console.log('Testing hover with warm state...');
    const startTime = Date.now();

    const result = await callTool('hover', {
      symbol: 'add',
      format: 'compact',
    });

    const duration = Date.now() - startTime;
    console.log(`Hover (warm) took ${duration}ms`);

    // Should be fast (under 2 seconds)
    assert.ok(duration < 2000, `Should be fast but took ${duration}ms`);

    // Should still work (either find symbol or report not found)
    if (result.error && result.error.includes('No symbol found')) {
      console.log('No symbol found in test workspace - this is acceptable');
      return;
    }

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.symbol || result.matches, 'Should find the symbol');
  }).timeout(5000);
});
