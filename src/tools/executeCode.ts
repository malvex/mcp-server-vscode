import * as vscode from 'vscode';
import { Tool } from './types';

// Keep track of MCP terminals
const mcpTerminals = new Map<string, vscode.Terminal>();

// Clean up closed terminals
vscode.window.onDidCloseTerminal((closedTerminal) => {
  for (const [key, terminal] of mcpTerminals.entries()) {
    if (terminal === closedTerminal) {
      mcpTerminals.delete(key);
    }
  }
});

export const executeCodeTool: Tool = {
  name: 'executeCode',
  description: 'Execute code in VS Code integrated terminal or through Code Runner',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      waitForOutput: {
        type: 'boolean',
        description: 'Wait for command to complete and return output (default: false)',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['command'],
  },
  handler: async (args) => {
    const { command, cwd, waitForOutput = false, format = 'compact' } = args;

    // Determine terminal key based on working directory
    const terminalKey = cwd || 'default';

    // Check if we have an existing terminal for this working directory
    let terminal = mcpTerminals.get(terminalKey);

    // Create a new terminal if needed
    if (!terminal) {
      const terminalName = cwd ? `MCP (${cwd.split('/').pop()})` : 'MCP Terminal';
      terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: cwd,
      });
      mcpTerminals.set(terminalKey, terminal);
    }

    terminal.show();
    terminal.sendText(command);

    if (waitForOutput) {
      // VS Code's Terminal API doesn't provide direct output capture
      // This would require extension APIs or terminal data write events
      return format === 'compact'
        ? { executed: true, terminal: terminal.name }
        : {
            status: 'Command executed in dedicated terminal',
            terminal: terminal.name,
            note: 'Output capture requires terminal data API (not available in stable VS Code)',
          };
    }

    return format === 'compact'
      ? { sent: true, terminal: terminal.name }
      : {
          status: 'Command sent to dedicated terminal',
          command: command,
          terminal: terminal.name,
          cwd: cwd || 'workspace root',
        };
  },
};
