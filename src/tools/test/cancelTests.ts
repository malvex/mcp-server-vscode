import * as vscode from 'vscode';
import { Tool } from '../types';

export const test_cancelTool: Tool = {
  name: 'test_cancel',
  description: 'Cancel currently running tests',
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
  },
  handler: async (args) => {
    const { format = 'compact' } = args;

    try {
      // Cancel all running tests
      await vscode.commands.executeCommand('testing.cancelRun');

      if (format === 'compact') {
        return {
          cancelled: true,
          message: 'Test run cancelled',
        };
      }

      return {
        status: 'Test run cancelled',
        message: 'All running tests have been cancelled',
        note: 'Any partial results may still be visible in the Test Results view',
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'cancel_failed', message: error.message };
      }
      return {
        error: 'Failed to cancel tests',
        details: error.message,
      };
    }
  },
};
