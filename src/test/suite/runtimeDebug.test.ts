import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Runtime Debug Tools Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
    // Ensure debugging is stopped
    try {
      await vscode.debug.stopDebugging();
    } catch {
      // Ignore errors if no debug session
    }
  });

  // Clean up after each test
  teardown(async () => {
    if (vscode.debug.activeDebugSession) {
      await vscode.debug.stopDebugging();
    }
  });

  test('should handle pause/continue when no debug session', async () => {
    // Test pause
    const pauseResult = await callTool('debug_pauseExecution', {
      format: 'detailed',
    });

    assert.ok(pauseResult.error, 'Should have error when no session');
    assert.ok(pauseResult.error.includes('No active debug session'), 'Should mention no session');

    // Test continue
    const continueResult = await callTool('debug_continueExecution', {
      format: 'detailed',
    });

    assert.ok(continueResult.error, 'Should have error when no session');
    assert.ok(
      continueResult.error.includes('No active debug session'),
      'Should mention no session'
    );
  });

  test('should handle step controls when no debug session', async () => {
    // Test step over
    const stepOverResult = await callTool('debug_stepOver', {
      format: 'detailed',
    });

    assert.ok(stepOverResult.error, 'Should have error when no session');

    // Test step into
    const stepIntoResult = await callTool('debug_stepInto', {
      format: 'detailed',
    });

    assert.ok(stepIntoResult.error, 'Should have error when no session');

    // Test step out
    const stepOutResult = await callTool('debug_stepOut', {
      format: 'detailed',
    });

    assert.ok(stepOutResult.error, 'Should have error when no session');
  });

  test('should handle call stack when no debug session', async () => {
    const result = await callTool('debug_getCallStack', {
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error when no session');
    assert.ok(result.error.includes('No active debug session'), 'Should mention no session');
  });

  test('should handle variable inspection when no debug session', async () => {
    const result = await callTool('debug_inspectVariables', {
      scope: 'locals',
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error when no session');
    assert.ok(result.error.includes('No active debug session'), 'Should mention no session');
  });

  test('should handle expression evaluation when no debug session', async () => {
    const result = await callTool('debug_evaluateExpression', {
      expression: 'myVariable',
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error when no session');
    assert.ok(result.error.includes('No active debug session'), 'Should mention no session');
  });

  test('should validate expression parameter', async () => {
    const result = await callTool('debug_evaluateExpression', {
      format: 'detailed',
    } as any);

    assert.ok(result.error, 'Should have error for missing expression');
    assert.ok(
      result.error.toLowerCase().includes('expression') ||
        result.error.toLowerCase().includes('required'),
      'Should mention expression is required'
    );
  });

  test('should handle compact format for runtime tools', async () => {
    // Test compact error format
    const result = await callTool('debug_getCallStack', {
      format: 'compact',
    });

    assert.ok(result.error, 'Should have error');
    assert.strictEqual(result.error, 'no_session', 'Should use compact error format');
  });

  // Note: Full integration tests with actual debug sessions would require:
  // 1. Starting a debug session with a specific configuration
  // 2. Setting breakpoints
  // 3. Running code until breakpoint is hit
  // 4. Then testing the runtime tools
  // This is complex to set up in unit tests and would be better as integration tests

  test.skip('should get call stack during debug session', async () => {
    // This would require a full debug session setup
    // Including:
    // - Start debug session
    // - Hit a breakpoint
    // - Then test getCallStack
  });

  test.skip('should inspect variables during debug session', async () => {
    // This would require a full debug session setup
    // Including:
    // - Start debug session
    // - Hit a breakpoint
    // - Then test inspectVariables
  });

  test.skip('should evaluate expressions during debug session', async () => {
    // This would require a full debug session setup
    // Including:
    // - Start debug session
    // - Hit a breakpoint
    // - Then test evaluateExpression
  });
});
