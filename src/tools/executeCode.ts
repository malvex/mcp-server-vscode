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
      return format === 'compact'
        ? { executed: true, output: null }
        : {
            status: 'Command executed',
            note: 'Output capture not fully implemented in MVP',
          };
    }

    return format === 'compact'
      ? { sent: true }
      : {
          status: 'Command sent to terminal',
          command: command,
        };
  },
};
