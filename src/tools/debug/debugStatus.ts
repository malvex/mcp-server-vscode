import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_statusTool: Tool = {
  name: 'debug_status',
  description: 'Get current debug session status and configuration information',
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
    const breakpoints = vscode.debug.breakpoints;
    const configs = vscode.workspace.getConfiguration('launch').get<any[]>('configurations') || [];

    const status = {
      isActive: !!session,
      sessionName: session?.name,
      sessionType: session?.type,
      breakpointCount: breakpoints.length,
      configurations: configs.map((c) => c.name),
    };

    if (format === 'compact') {
      return {
        active: status.isActive,
        bps: status.breakpointCount,
        configs: status.configurations.length,
      };
    }
    return { status };
  },
};
