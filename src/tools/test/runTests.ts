import * as vscode from 'vscode';
import { Tool } from '../types';

export const test_runTool: Tool = {
  name: 'test_run',
  description: 'Run tests in the workspace',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['all', 'file', 'cursor'],
        description: 'Scope of tests to run: all tests, current file, or at cursor position',
        default: 'all',
      },
      file: {
        type: 'string',
        description: 'File path for file scope (optional, uses active editor if not provided)',
      },
      debug: {
        type: 'boolean',
        description: 'Run tests in debug mode (default: false)',
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
    const { scope = 'all', file, debug = false, format = 'compact' } = args;

    try {
      let command: string;
      const commandArgs: any[] = [];

      // Determine which command to run based on scope
      switch (scope) {
        case 'all':
          command = debug ? 'testing.debugAll' : 'testing.runAll';
          break;

        case 'file':
          command = debug ? 'testing.debugCurrentFile' : 'testing.runCurrentFile';

          // If a specific file is provided, open it first
          if (file) {
            const uri = vscode.Uri.file(file);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
          } else if (!vscode.window.activeTextEditor) {
            return format === 'compact'
              ? { error: 'no_file', message: 'No active file for file scope' }
              : { error: 'No active file', details: 'Open a test file or specify file parameter' };
          }
          break;

        case 'cursor':
          command = debug ? 'testing.debugAtCursor' : 'testing.runAtCursor';

          if (!vscode.window.activeTextEditor) {
            return format === 'compact'
              ? { error: 'no_editor', message: 'No active editor for cursor scope' }
              : { error: 'No active editor', details: 'Open a test file to run tests at cursor' };
          }
          break;

        default:
          return format === 'compact'
            ? { error: 'invalid_scope' }
            : { error: 'Invalid scope', details: `Unknown scope: ${scope}` };
      }

      // Execute the test command
      await vscode.commands.executeCommand(command, ...commandArgs);

      // Note: VS Code doesn't provide a way to get test results programmatically
      // The results will appear in the Test Results view and Output panel

      if (format === 'compact') {
        return {
          started: true,
          command,
          scope,
          debug,
          note: 'Check Test Results view for output',
        };
      }

      return {
        status: 'Test run started',
        command,
        scope,
        debug,
        file:
          file ||
          (scope === 'file' ? vscode.window.activeTextEditor?.document.fileName : undefined),
        note: 'Test results will appear in the Test Results view. Use the Output panel to see detailed test output.',
        tip: 'Ensure test extensions (Jest, Mocha, pytest, etc.) are installed for test discovery.',
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'run_failed', message: error.message };
      }
      return {
        error: 'Failed to run tests',
        details: error.message,
        suggestion: 'Ensure test extensions are installed and tests are discovered',
      };
    }
  },
};
