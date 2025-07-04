import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_clearBreakpointsTool: Tool = {
  name: 'debug_clearBreakpoints',
  description: 'Remove all breakpoints from the workspace',
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

    const count = vscode.debug.breakpoints.length;
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);

    if (format === 'compact') {
      return { cleared: count };
    }
    return { status: 'All breakpoints cleared', count };
  },
};
