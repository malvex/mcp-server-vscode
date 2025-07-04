import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_listBreakpointsTool: Tool = {
  name: 'debug_listBreakpoints',
  description:
    'List all current breakpoints in the workspace. See all breakpoints at once - perfect for debugging complex flows',
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

    const breakpoints = vscode.debug.breakpoints
      .filter((bp): bp is vscode.SourceBreakpoint => bp instanceof vscode.SourceBreakpoint)
      .map((bp) => {
        const location = bp.location;
        return {
          file: vscode.workspace.asRelativePath(location.uri),
          line: location.range.start.line + 1,
          enabled: bp.enabled,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
        };
      });

    if (format === 'compact') {
      // Return minimal info with 0-based line numbers for AI
      return {
        bpFormat: '[file, line, enabled, condition?]',
        bps: breakpoints.map((bp) => {
          const result: any[] = [bp.file, bp.line, bp.enabled];
          // Only add condition info if it exists
          if (bp.condition || bp.hitCondition || bp.logMessage) {
            result.push({
              condition: bp.condition,
              hitCondition: bp.hitCondition,
              logMessage: bp.logMessage,
            });
          }
          return result;
        }),
      };
    }
    return { breakpoints };
  },
};
