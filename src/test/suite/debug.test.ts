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

  test('should set a breakpoint', async () => {
    const document = await openTestFile('app.ts');

    // Set breakpoint on line 5 (calculateSum function)
    const result = await callTool('debug', {
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

  test('should remove a breakpoint', async () => {
    const document = await openTestFile('app.ts');

    // First set a breakpoint
    await callTool('debug', {
      action: 'setBreakpoint',
      uri: document.uri.toString(),
      line: 10,
    });

    // Then remove it
    const result = await callTool('debug', {
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

  test('should handle setBreakpoint without required parameters', async () => {
    try {
      await callTool('debug', {
        action: 'setBreakpoint',
        // Missing uri and line
      });
      assert.fail('Should throw error for missing parameters');
    } catch (error: any) {
      assert.ok(
        error.message.includes('URI and line required'),
        'Should mention missing parameters'
      );
    }
  });

  test('should handle removeBreakpoint without required parameters', async () => {
    try {
      await callTool('debug', {
        action: 'removeBreakpoint',
        // Missing uri and line
      });
      assert.fail('Should throw error for missing parameters');
    } catch (error: any) {
      assert.ok(
        error.message.includes('URI and line required'),
        'Should mention missing parameters'
      );
    }
  });

  test.skip('should start debug session with default config', async () => {
    // This test is skipped because it requires launch.json configuration
    // and actually starts a debug session which may interfere with tests
    const result = await callTool('debug', {
      action: 'start',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Debug session started', 'Should confirm session started');
  });

  test.skip('should stop debug session', async () => {
    // This test is skipped because it requires an active debug session
    const result = await callTool('debug', {
      action: 'stop',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Debug session stopped', 'Should confirm session stopped');
  });

  test('should handle unknown debug action', async () => {
    try {
      await callTool('debug', {
        action: 'unknownAction',
      });
      assert.fail('Should throw error for unknown action');
    } catch (error: any) {
      assert.ok(error.message.includes('Unknown debug action'), 'Should mention unknown action');
    }
  });

  test('should indicate getVariables is not implemented', async () => {
    const result = await callTool('debug', {
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
