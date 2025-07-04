import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Debug Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
    // Ensure debugging is stopped after tests
    try {
      await vscode.debug.stopDebugging();
    } catch {
      // Ignore errors if no debug session
    }
  });

  test.skip('should set a breakpoint by symbol name', async () => {
    // Open a file to ensure symbols are available
    await openTestFile('app.ts');

    // Clear all breakpoints first
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);

    // Set breakpoint using symbol name (AI-friendly approach)
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'setBreakpoint',
      symbol: 'calculateSum',
    });

    assert.ok(!result.error, 'Should not have error');
    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Breakpoint added', 'Should confirm breakpoint added');
    assert.ok(result.symbol, 'Should include symbol name');
    assert.ok(typeof result.line === 'number', 'Should return line number');

    // Verify breakpoint was actually added
    const breakpoints = vscode.debug.breakpoints;
    assert.ok(breakpoints.length > 0, 'Should have at least one breakpoint');
  });

  test.skip('should set a breakpoint by position', async () => {
    const document = await openTestFile('app.ts');

    // Set breakpoint on line 5 (calculateSum function)
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'setBreakpoint',
      uri: document.uri.toString(),
      line: 4, // 0-based line number
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Breakpoint added', 'Should confirm breakpoint added');
    assert.strictEqual(result.line, 4, 'Should return line number');

    // Verify breakpoint was actually added
    const breakpoints = vscode.debug.breakpoints;
    const hasBreakpoint = breakpoints.some((bp) => {
      if (bp instanceof vscode.SourceBreakpoint) {
        return (
          bp.location.uri.toString() === document.uri.toString() &&
          bp.location.range.start.line === 4
        );
      }
      return false;
    });
    assert.ok(hasBreakpoint, 'Breakpoint should exist in VS Code');
  });

  test.skip('should remove a breakpoint', async () => {
    const document = await openTestFile('app.ts');

    // Clear all breakpoints first
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);

    // First set a breakpoint
    await callTool('debug', {
      format: 'detailed',
      action: 'setBreakpoint',
      uri: document.uri.toString(),
      line: 10,
    });

    // Then remove it
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'removeBreakpoint',
      uri: document.uri.toString(),
      line: 10,
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Breakpoint removed', 'Should confirm breakpoint removed');
    assert.strictEqual(result.line, 10, 'Should return line number');

    // Verify breakpoint was actually removed
    const breakpoints = vscode.debug.breakpoints;
    const hasBreakpoint = breakpoints.some((bp) => {
      if (bp instanceof vscode.SourceBreakpoint) {
        return (
          bp.location.uri.toString() === document.uri.toString() &&
          bp.location.range.start.line === 10
        );
      }
      return false;
    });
    assert.ok(!hasBreakpoint, 'Breakpoint should not exist in VS Code');
  });

  test.skip('should handle setBreakpoint without required parameters', async () => {
    try {
      await callTool('debug', {
        format: 'detailed',
        action: 'setBreakpoint',
        // Missing uri and line
      });
      assert.fail('Should throw error for missing parameters');
    } catch (error: any) {
      assert.ok(
        error.message.includes('Either provide a symbol name OR uri with line'),
        'Should mention missing parameters'
      );
    }
  });

  test.skip('should handle removeBreakpoint without required parameters', async () => {
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'removeBreakpoint',
      // Missing uri and line
    });

    assert.ok(result.error, 'Should return error');
    assert.ok(result.error.includes('URI and line required'), 'Should mention missing parameters');
  });

  test.skip('should start debug session with default config', async () => {
    // This test is skipped because it requires launch.json configuration
    // and actually starts a debug session which may interfere with tests
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'start',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Debug session started', 'Should confirm session started');
  });

  test.skip('should stop debug session', async () => {
    // This test is skipped because it requires an active debug session
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'stop',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Debug session stopped', 'Should confirm session stopped');
  });

  test.skip('should handle unknown debug action', async () => {
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'unknownAction',
    });

    assert.ok(result.error, 'Should return error');
    assert.ok(result.error.includes('Unknown debug action'), 'Should mention unknown action');
  });

  test.skip('should indicate getVariables is not implemented', async () => {
    const result = await callTool('debug', {
      format: 'detailed',
      action: 'getVariables',
    });

    assert.ok(result.status, 'Should return status');
    assert.ok(result.status.includes('not yet implemented'), 'Should indicate not implemented');
    assert.ok(result.note, 'Should include implementation note');
  });

  // Cleanup after each test to remove any breakpoints
  teardown(async () => {
    const allBreakpoints = vscode.debug.breakpoints;
    if (allBreakpoints.length > 0) {
      vscode.debug.removeBreakpoints(allBreakpoints);
    }
  });
});
