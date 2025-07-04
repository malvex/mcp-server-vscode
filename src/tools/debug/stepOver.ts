import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_stepOverTool: Tool = {
  name: 'debug_stepOver',
  description:
    'Step over the current line of code (execute current line without entering functions)',
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

        // Try to find a stopped thread (this is a simplification)
        // In practice, we might need to track which thread hit the breakpoint
        if (threads.length > 0) {
          targetThreadId = threads[0].id;
        } else {
          return format === 'compact' ? { error: 'no_threads' } : { error: 'No threads available' };
        }
      }

      // Execute step over (next)
      await session.customRequest('next', { threadId: targetThreadId });

      if (format === 'compact') {
        return { stepped: true, thread: targetThreadId };
      }
      return {
        status: 'Stepped over',
        threadId: targetThreadId,
        action: 'next',
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'step_failed', message: error.message };
      }
      return {
        error: 'Failed to step over',
        details: error.message,
        hint: 'Ensure the debugger is paused at a breakpoint or step location',
      };
    }
  },
};
