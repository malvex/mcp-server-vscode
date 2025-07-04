import * as vscode from 'vscode';
import { Tool } from '../types';

export const test_clearResultsTool: Tool = {
  name: 'test_clearResults',
  description: 'Clear all test results from the Test Results view',
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
      // Clear test results
      await vscode.commands.executeCommand('testing.clearTestResults');

      if (format === 'compact') {
        return {
          cleared: true,
          message: 'Test results cleared',
        };
      }

      return {
        status: 'Test results cleared',
        message: 'All test results have been cleared from the Test Results view',
        note: 'Run tests again to see new results',
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'clear_failed', message: error.message };
      }
      return {
        error: 'Failed to clear test results',
        details: error.message,
      };
    }
  },
};
