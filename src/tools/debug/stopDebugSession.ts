import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_stopSessionTool: Tool = {
  name: 'debug_stopSession',
  description: 'Stop the current debug session',
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

    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return format === 'compact' ? { error: 'no_session' } : { error: 'No active debug session' };
    }

    await vscode.debug.stopDebugging();

    if (format === 'compact') {
      return { stopped: true };
    }
    return { status: 'Debug session stopped', sessionName: session.name };
  },
};
