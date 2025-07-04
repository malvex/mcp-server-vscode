import * as vscode from 'vscode';
import { Tool } from '../types';
import { debugOutputTracker } from '../../services/debugOutputTracker';

export const debug_getOutputTool: Tool = {
  name: 'debug_getOutput',
  description:
    'Get debug console output from the active debug session (Note: Only works with "console": "internalConsole" in launch.json, not with "integratedTerminal")',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['console', 'stdout', 'stderr', 'telemetry', 'all'],
        description: 'Type of output to retrieve (default: all)',
        default: 'all',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of recent messages to return (default: 100)',
        default: 100,
      },
      filter: {
        type: 'string',
        description: 'Filter messages containing this text',
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
    const { category = 'all', limit = 100, filter, format = 'compact' } = args;

    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return format === 'compact' ? { error: 'no_session' } : { error: 'No active debug session' };
    }

    try {
      // Check if using integratedTerminal console
      const config = session.configuration;
      const consoleType = config?.console || 'internalConsole';

      // Get outputs from the tracker
      const outputs = debugOutputTracker.getOutputs(session.id, {
        category: category === 'all' ? undefined : category,
        limit,
        filter,
      });

      // Check if integratedTerminal is being used and no output captured
      if (consoleType === 'integratedTerminal' && outputs.length === 0) {
        if (format === 'compact') {
          return {
            warning: 'integrated_terminal',
            console: consoleType,
            outputs: [],
            total: 0,
            help: 'Set "console": "internalConsole" in launch.json',
          };
        }
        return {
          warning: 'Output capture not available for integratedTerminal',
          explanation:
            'The debug session is using integratedTerminal which outputs to a separate terminal window. Output capture only works with internalConsole.',
          suggestion:
            'To capture output, modify your launch.json configuration:\n"console": "internalConsole"',
          currentConfig: {
            console: consoleType,
            sessionName: session.name,
            sessionType: session.type,
          },
          outputs: [],
          total: 0,
        };
      }

      if (format === 'compact') {
        // Return compact format: [[category, text], ...]
        return {
          outputFormat: '[category, text]',
          outputs: outputs.map((o) => [o.category, o.output.trim()]),
          total: outputs.length,
          session: session.name,
          console: consoleType,
        };
      }

      // Detailed format
      return {
        outputs: outputs.map((o) => ({
          timestamp: new Date(o.timestamp).toISOString(),
          category: o.category,
          text: o.output,
        })),
        total: outputs.length,
        session: {
          id: session.id,
          name: session.name,
          type: session.type,
          console: consoleType,
        },
        filter: {
          category,
          limit,
          textFilter: filter,
        },
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'output_failed', message: error.message };
      }
      return {
        error: 'Failed to get debug output',
        details: error.message,
      };
    }
  },
};
