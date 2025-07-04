import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_stepIntoTool: Tool = {
  name: 'debug_stepInto',
  description: 'Step into function calls on the current line',
  inputSchema: {
    type: 'object',
    properties: {
      threadId: {
        type: 'number',
        description: 'Thread ID to step (optional, uses current stopped thread)',
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
    const { threadId, format = 'compact' } = args;

    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return format === 'compact' ? { error: 'no_session' } : { error: 'No active debug session' };
    }

    try {
      let targetThreadId = threadId;

      // If no threadId specified, try to find the stopped thread
      if (targetThreadId === undefined) {
        const threadsResponse = await session.customRequest('threads');
        const threads = threadsResponse.threads || [];

        if (threads.length > 0) {
          targetThreadId = threads[0].id;
        } else {
          return format === 'compact' ? { error: 'no_threads' } : { error: 'No threads available' };
        }
      }

      // Execute step into
      await session.customRequest('stepIn', { threadId: targetThreadId });

      if (format === 'compact') {
        return { stepped: true, thread: targetThreadId };
      }
      return {
        status: 'Stepped into',
        threadId: targetThreadId,
        action: 'stepIn',
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'step_failed', message: error.message };
      }
      return {
        error: 'Failed to step into',
        details: error.message,
        hint: 'Ensure the debugger is paused at a breakpoint or step location',
      };
    }
  },
};
