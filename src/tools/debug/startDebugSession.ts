import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_startSessionTool: Tool = {
  name: 'debug_startSession',
  description:
    'Start a debug session using a configuration from launch.json. Launch debugging instantly - no need to navigate to the debug panel',
  inputSchema: {
    type: 'object',
    properties: {
      configuration: {
        type: 'string',
        description: 'Name of debug configuration to use (optional, uses first if not specified)',
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
    const { configuration, format = 'compact' } = args;

    // Single-root only: a multi-root workspace can host per-folder launch
    // configs and tasks, which this does not resolve.
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    const configs =
      vscode.workspace
        .getConfiguration('launch', workspaceFolder?.uri)
        .get<any[]>('configurations') || [];

    if (configs.length === 0) {
      return format === 'compact'
        ? { error: 'no_configs' }
        : { error: 'No debug configurations found in launch.json' };
    }

    let configToUse = configs[0];
    if (configuration) {
      const found = configs.find((c) => c.name === configuration);
      if (!found) {
        return format === 'compact'
          ? { error: 'config_not_found', available: configs.map((c) => c.name) }
          : {
              error: `Configuration '${configuration}' not found`,
              available: configs.map((c) => c.name),
            };
      }
      configToUse = found;
    }

    // The workspace folder must be passed so VS Code can resolve a
    // preLaunchTask and folder-scoped variables like ${workspaceFolder}.
    const success = await vscode.debug.startDebugging(workspaceFolder, configToUse);

    if (format === 'compact') {
      return { started: success, config: configToUse.name };
    }
    return {
      success,
      session: {
        name: configToUse.name,
        type: configToUse.type,
      },
    };
  },
};
