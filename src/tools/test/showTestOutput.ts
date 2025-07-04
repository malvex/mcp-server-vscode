import * as vscode from 'vscode';
import { Tool } from '../types';

export const test_showOutputTool: Tool = {
  name: 'test_showOutput',
  description: 'Show test output panel to view test results',
  inputSchema: {
    type: 'object',
    properties: {
      preserveFocus: {
        type: 'boolean',
        description: 'Keep focus on current editor (default: false)',
        default: false,
      },
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
    const { preserveFocus = false, format = 'compact' } = args;

    try {
      // Show the test output
      await vscode.commands.executeCommand('testing.showMostRecentOutput', { preserveFocus });

      // Also try to focus on test results view
      await vscode.commands.executeCommand('workbench.view.testing.focus');

      if (format === 'compact') {
        return {
          shown: true,
          views: ['output', 'results'],
        };
      }

      return {
        status: 'Test output displayed',
        message: 'Test output panel and results view are now visible',
        views: {
          output: 'Test output panel shows detailed test execution logs',
          results: 'Test Results view shows pass/fail status for each test',
        },
        preserveFocus,
        note: 'Test output from the most recent test run is displayed',
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'show_failed', message: error.message };
      }
      return {
        error: 'Failed to show test output',
        details: error.message,
      };
    }
  },
};
