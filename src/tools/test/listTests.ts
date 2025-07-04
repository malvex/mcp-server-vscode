import { Tool } from '../types';

export const test_listTool: Tool = {
  name: 'test_list',
  description: 'List available test commands and current testing status',
  inputSchema: {
    type: 'object',
    properties: {
      includeDisabled: {
        type: 'boolean',
        description: 'Include disabled/skipped tests (default: false)',
        default: false,
      },
      pattern: {
        type: 'string',
        description: 'Filter tests by name pattern',
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
    const { format = 'compact' } = args;

    try {
      // Note: VS Code doesn't provide a direct API to list all test controllers
      // Test controllers are created by test extensions (Jest, Mocha, etc.)
      // We need to work with the test explorer tree instead

      // Access the test items through the Test Explorer
      // This requires the vscode.proposed.d.ts API which is not available in stable

      // For now, we'll document this limitation
      if (format === 'compact') {
        return {
          error: 'api_limitation',
          message: 'Test listing requires test provider extensions',
          help: 'Ensure test extensions (Jest, Mocha, etc.) are installed',
        };
      }

      return {
        error: 'API Limitation',
        message: 'Direct test discovery is not available in the stable VS Code API.',
        explanation:
          'Tests are discovered by test provider extensions (Jest, Mocha, pytest, etc.). The VS Code API does not provide a way to list tests discovered by these extensions.',
        suggestion:
          'To work with tests:\n1. Ensure test extensions are installed\n2. Use test_run to execute tests by pattern\n3. Use the Testing view in VS Code to see discovered tests',
        availableCommands: [
          'testing.runAll - Run all tests',
          'testing.debugAll - Debug all tests',
          'testing.runCurrentFile - Run tests in current file',
          'testing.debugCurrentFile - Debug tests in current file',
        ],
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'list_failed', message: error.message };
      }
      return {
        error: 'Failed to list tests',
        details: error.message,
      };
    }
  },
};
