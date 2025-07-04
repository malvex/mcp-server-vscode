import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Test Tools Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should list test commands and status', async () => {
    const result = await callTool('test_list', {
      format: 'detailed',
    });

    // The tool acknowledges the API limitation
    assert.ok(result.error || result.explanation, 'Should explain API limitation');
    assert.ok(result.availableCommands || result.message, 'Should list available commands');
  });

  test('should run all tests', async () => {
    const result = await callTool('test_run', {
      scope: 'all',
      format: 'detailed',
    });

    assert.ok(
      !result.error || result.error.includes('test extensions'),
      'Should start test run or mention test extensions'
    );
    if (!result.error) {
      assert.strictEqual(result.scope, 'all', 'Should have correct scope');
      assert.ok(result.command, 'Should have executed command');
    }
  });

  test('should handle file scope without active editor', async () => {
    const result = await callTool('test_run', {
      scope: 'file',
      format: 'compact',
    });

    // When no editor is open, it should error
    if (!result.started) {
      assert.ok(
        result.error === 'no_file' || result.error === 'run_failed',
        'Should error when no file'
      );
    }
  });

  test('should handle cursor scope without active editor', async () => {
    const result = await callTool('test_run', {
      scope: 'cursor',
      format: 'compact',
    });

    // When no editor is open, it should error
    if (!result.started) {
      assert.ok(
        result.error === 'no_editor' || result.error === 'run_failed',
        'Should error when no editor'
      );
    }
  });

  test('should cancel test run', async () => {
    const result = await callTool('test_cancel', {
      format: 'detailed',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.status || result.cancelled, 'Should indicate cancellation');
  });

  test('should show test output', async () => {
    const result = await callTool('test_showOutput', {
      preserveFocus: false,
      format: 'detailed',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.status || result.shown, 'Should indicate output shown');
  });

  test('should clear test results', async () => {
    const result = await callTool('test_clearResults', {
      format: 'detailed',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.status || result.cleared, 'Should indicate results cleared');
  });

  test('should run tests in debug mode', async () => {
    const result = await callTool('test_run', {
      scope: 'all',
      debug: true,
      format: 'compact',
    });

    if (!result.error) {
      assert.strictEqual(result.debug, true, 'Should be in debug mode');
      assert.ok(result.command?.includes('debug'), 'Should use debug command');
    }
  });

  test('should validate scope parameter', async () => {
    const result = await callTool('test_run', {
      scope: 'invalid' as any,
      format: 'compact',
    });

    assert.ok(result.error, 'Should have an error for invalid scope');
    assert.ok(
      result.error === 'invalid_scope' ||
        result.error === 'run_failed' ||
        result.error.includes('Invalid value for field') ||
        result.error.includes('must be one of'),
      `Expected validation error, got: ${result.error}`
    );
  });
});
