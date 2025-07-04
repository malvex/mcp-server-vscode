import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Execute Code Tool Tests', () => {
  let context: TestContext;
  const terminalDisposables: vscode.Disposable[] = [];

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
    // Clean up any terminals created during tests
    terminalDisposables.forEach((d) => d.dispose());
    // Only dispose terminals that still exist
    vscode.window.terminals.forEach((t) => {
      try {
        t.dispose();
      } catch {
        // Ignore if already disposed
      }
    });
  });

  test('should send command to terminal', async () => {
    const result = await callTool('executeCode', {
      command: 'echo "Hello from test"',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Command sent to terminal', 'Should confirm command sent');
    assert.strictEqual(result.command, 'echo "Hello from test"', 'Should return the command');

    // Verify a terminal was created
    assert.ok(vscode.window.terminals.length > 0, 'Should have created a terminal');
  });

  test('should use existing terminal if available', async () => {
    // Create a terminal first
    const existingTerminal = vscode.window.createTerminal('Test Terminal');
    terminalDisposables.push(existingTerminal);
    await vscode.window.showTextDocument(vscode.window.activeTextEditor!.document); // Ensure terminal is active

    const initialTerminalCount = vscode.window.terminals.length;

    const result = await callTool('executeCode', {
      command: 'pwd',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.command, 'pwd', 'Should return the command');

    // Verify no new terminal was created
    assert.strictEqual(
      vscode.window.terminals.length,
      initialTerminalCount,
      'Should not create new terminal'
    );
  });

  test('should handle command with working directory', async () => {
    // Wait for any previous terminal operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await callTool('executeCode', {
      command: 'ls -la',
      cwd: '/tmp',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Command sent to terminal', 'Should confirm command sent');
  });

  test('should handle waitForOutput flag', async () => {
    const result = await callTool('executeCode', {
      command: 'echo "test output"',
      waitForOutput: true,
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.status, 'Command executed', 'Should indicate command executed');
    assert.ok(result.note, 'Should include note about output capture');
    assert.ok(
      result.note.includes('not fully implemented'),
      'Should mention output capture limitation'
    );
  });

  test('should handle empty command', async () => {
    const result = await callTool('executeCode', {
      command: '',
    });

    // Even empty commands are sent to terminal
    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.command, '', 'Should return empty command');
  });

  test('should handle complex commands', async () => {
    const complexCommand = 'npm test -- --grep "test pattern" && echo "Done"';

    const result = await callTool('executeCode', {
      command: complexCommand,
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.command, complexCommand, 'Should return the exact command');
  });

  test.skip('should create terminal with specific name', async () => {
    // Skip because terminal disposal issues in test environment
    await callTool('executeCode', {
      command: 'echo "MCP test"',
    });

    const mcpTerminal = vscode.window.terminals.find((t) => t.name === 'MCP Execution');
    assert.ok(mcpTerminal, 'Should create terminal with MCP Execution name');
  });

  // Clean up terminals after each test
  teardown(async () => {
    // Give VS Code a moment to process terminal operations
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
});
