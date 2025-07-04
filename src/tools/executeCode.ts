import * as vscode from 'vscode';
import { Tool } from './types';

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
    },
    required: ['command'],
  },
  handler: async (args) => {
    const { command, cwd, waitForOutput = false } = args;

    // Get or create terminal
    let terminal = vscode.window.activeTerminal;
    if (!terminal) {
      terminal = vscode.window.createTerminal({
        name: 'MCP Execution',
        cwd: cwd,
      });
    }

    terminal.show();
    terminal.sendText(command);

    if (waitForOutput) {
      // This is a simplified version - in reality, capturing terminal output
      // requires more complex integration with the terminal API
      return {
        status: 'Command executed',
        note: 'Output capture not fully implemented in MVP',
      };
    }

    return {
      status: 'Command sent to terminal',
      command: command,
    };
  },
};
