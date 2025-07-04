import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_inspectVariablesTool: Tool = {
  name: 'debug_inspectVariables',
  description:
    'Inspect variables in the current scope (locals, globals, etc.) during debugging. See all variable values instantly - no more hovering over each one',
  inputSchema: {
    type: 'object',
    properties: {
      threadId: {
        type: 'number',
        description: 'Thread ID (optional, uses current stopped thread)',
      },
      frameId: {
        type: 'number',
        description: 'Stack frame ID (optional, uses top frame)',
      },
      scope: {
        type: 'string',
        enum: ['all', 'locals', 'globals', 'closure'],
        description: 'Which scope to inspect (default: all)',
        default: 'all',
      },
      filter: {
        type: 'string',
        description: 'Filter variables by name pattern',
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
    const { threadId, frameId, scope = 'all', filter, format = 'compact' } = args;

    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return format === 'compact' ? { error: 'no_session' } : { error: 'No active debug session' };
    }

    try {
      let targetThreadId = threadId;
      let targetFrameId = frameId;

      // If no threadId specified, get the current thread
      if (targetThreadId === undefined) {
        const threadsResponse = await session.customRequest('threads');
        const threads = threadsResponse.threads || [];

        if (threads.length > 0) {
          targetThreadId = threads[0].id;
        } else {
          return format === 'compact' ? { error: 'no_threads' } : { error: 'No threads available' };
        }
      }

      // If no frameId specified, get the top frame
      if (targetFrameId === undefined) {
        const stackResponse = await session.customRequest('stackTrace', {
          threadId: targetThreadId,
          startFrame: 0,
          levels: 1,
        });

        if (stackResponse.stackFrames && stackResponse.stackFrames.length > 0) {
          targetFrameId = stackResponse.stackFrames[0].id;
        } else {
          return format === 'compact'
            ? { error: 'no_frames' }
            : { error: 'No stack frames available' };
        }
      }

      // Get scopes for the frame
      const scopesResponse = await session.customRequest('scopes', { frameId: targetFrameId });
      const scopes = scopesResponse.scopes || [];

      // Filter scopes based on requested scope
      const filteredScopes =
        scope === 'all'
          ? scopes
          : scopes.filter((s: any) => {
              const scopeName = s.name.toLowerCase();
              if (scope === 'locals') return scopeName.includes('local');
              if (scope === 'globals') return scopeName.includes('global');
              if (scope === 'closure') return scopeName.includes('closure');
              return false;
            });

      // Get variables for each scope
      const variablesByScope: any[] = [];

      for (const scopeInfo of filteredScopes) {
        const variablesResponse = await session.customRequest('variables', {
          variablesReference: scopeInfo.variablesReference,
        });

        let variables = variablesResponse.variables || [];

        // Apply filter if provided
        if (filter) {
          const filterLower = filter.toLowerCase();
          variables = variables.filter((v: any) => v.name.toLowerCase().includes(filterLower));
        }

        variablesByScope.push({
          scope: scopeInfo.name,
          variables,
        });
      }

      if (format === 'compact') {
        // Return compact format: { scopeName: [[name, value, type], ...] }
        const result: any = {
          varFormat: '[name, value, type]',
        };

        for (const scopeData of variablesByScope) {
          result[scopeData.scope] = scopeData.variables.map((v: any) => [
            v.name,
            v.value,
            v.type || 'unknown',
          ]);
        }

        return result;
      }

      // Detailed format
      return {
        variables: variablesByScope.map((scopeData) => ({
          scope: scopeData.scope,
          variables: scopeData.variables.map((v: any) => ({
            name: v.name,
            value: v.value,
            type: v.type,
            evaluateName: v.evaluateName,
            variablesReference: v.variablesReference,
            namedVariables: v.namedVariables,
            indexedVariables: v.indexedVariables,
          })),
        })),
        frameId: targetFrameId,
        threadId: targetThreadId,
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'inspect_failed', message: error.message };
      }
      return {
        error: 'Failed to inspect variables',
        details: error.message,
        hint: 'Ensure the debugger is paused at a breakpoint',
      };
    }
  },
};
