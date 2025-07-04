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
      format: 'detailed',
      command: 'echo "Hello from test"',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(
      result.status,
      'Command sent to dedicated terminal',
      'Should confirm command sent'
    );
    assert.strictEqual(result.command, 'echo "Hello from test"', 'Should return the command');
    assert.ok(result.terminal, 'Should return terminal name');

    // Verify a terminal was created
    assert.ok(vscode.window.terminals.length > 0, 'Should have created a terminal');
  });

  test('should create dedicated MCP terminal', async () => {
    // Clean up any existing terminals first
    vscode.window.terminals.forEach((t) => {
      try {
        t.dispose();
      } catch {
        // Ignore disposal errors
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await callTool('executeCode', {
      format: 'detailed',
      command: 'pwd',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.command, 'pwd', 'Should return the command');
    assert.ok(result.terminal, 'Should return terminal name');
    assert.ok(result.terminal.includes('MCP'), 'Terminal name should include MCP');

    // Verify a terminal exists (reuse logic might apply)
    assert.ok(vscode.window.terminals.length > 0, 'Should have at least one terminal');
  });

  test('should handle command with working directory', async () => {
    // Wait for any previous terminal operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await callTool('executeCode', {
      format: 'detailed',
      command: 'ls -la',
      cwd: '/tmp',
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(
      result.status,
      'Command sent to dedicated terminal',
      'Should confirm command sent'
    );
    assert.strictEqual(result.cwd, '/tmp', 'Should show working directory');
  });

  test('should handle waitForOutput flag', async () => {
    const result = await callTool('executeCode', {
      format: 'detailed',
      command: 'echo "test output"',
      waitForOutput: true,
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(
      result.status,
      'Command executed in dedicated terminal',
      'Should indicate command executed'
    );
    assert.ok(result.terminal, 'Should return terminal name');
    assert.ok(result.note, 'Should include note about output capture');
    assert.ok(
      result.note.includes('terminal data API'),
      'Should mention output capture limitation'
    );
  });

  test('should handle empty command', async () => {
    const result = await callTool('executeCode', {
      format: 'detailed',
      command: '',
    });

    // Even empty commands are sent to terminal
    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.command, '', 'Should return empty command');
  });

  test('should handle complex commands', async () => {
    const complexCommand = 'npm test -- --grep "test pattern" && echo "Done"';

    const result = await callTool('executeCode', {
      format: 'detailed',
      command: complexCommand,
    });

    assert.ok(result.status, 'Should return status');
    assert.strictEqual(result.command, complexCommand, 'Should return the exact command');
  });

  test('should create terminal with specific name based on working directory', async () => {
    // Clean up any existing terminals first
    vscode.window.terminals.forEach((t) => {
      try {
        t.dispose();
      } catch {
        // Ignore disposal errors
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Execute with specific working directory
    await callTool('executeCode', {
      format: 'detailed',
      command: 'echo "MCP test"',
      cwd: '/tmp/testdir',
    });

    // Terminal should be named "MCP (testdir)"
    const mcpTerminal = vscode.window.terminals.find((t) => t.name === 'MCP (testdir)');
    assert.ok(mcpTerminal, 'Should create terminal with directory-based name');

    // Execute without working directory
    await callTool('executeCode', {
      format: 'detailed',
      command: 'echo "MCP test default"',
    });

    // Should create "MCP Terminal" for default
    const defaultTerminal = vscode.window.terminals.find((t) => t.name === 'MCP Terminal');
    assert.ok(defaultTerminal, 'Should create terminal with default name');
  });

  // Clean up terminals after each test
  teardown(async () => {
    // Give VS Code a moment to process terminal operations
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
});
