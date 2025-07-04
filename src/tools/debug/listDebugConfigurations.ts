import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_listConfigurationsTool: Tool = {
  name: 'debug_listConfigurations',
  description: 'List available debug configurations from launch.json',
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

    const configs = vscode.workspace.getConfiguration('launch').get<any[]>('configurations') || [];

    if (format === 'compact') {
      // Return just names and types
      return {
        configFormat: '[name, type]',
        configs: configs.map((c) => [c.name, c.type]),
      };
    }
    return {
      configurations: configs.map((c) => ({
        name: c.name,
        type: c.type,
        request: c.request,
        program: c.program,
      })),
    };
  },
};
