import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_continueExecutionTool: Tool = {
  name: 'debug_continueExecution',
  description: 'Continue execution from the current breakpoint or paused state',
  inputSchema: {
    type: 'object',
    properties: {
      threadId: {
        type: 'number',
        description: 'Thread ID to continue (optional, defaults to all threads)',
      },
      allThreads: {
        type: 'boolean',
        description: 'Continue all threads simultaneously (default: true)',
        default: true,
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
    const { threadId, allThreads = true, format = 'compact' } = args;

    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return format === 'compact' ? { error: 'no_session' } : { error: 'No active debug session' };
    }

    try {
      if (threadId !== undefined) {
        // Continue specific thread
        await session.customRequest('continue', {
          threadId,
          allThreadsContinued: allThreads,
        });

        if (format === 'compact') {
          return { continued: true, thread: threadId };
        }
        return {
          status: 'Continued execution',
          threadId,
          allThreadsContinued: allThreads,
        };
      } else {
        // Get all threads and continue them
        const threadsResponse = await session.customRequest('threads');
        const threads = threadsResponse.threads || [];

        if (threads.length > 0) {
          // Continue from first thread with allThreadsContinued flag
          await session.customRequest('continue', {
            threadId: threads[0].id,
            allThreadsContinued: true,
          });
        }

        if (format === 'compact') {
          return { continued: true, threads: threads.length };
        }
        return {
          status: 'Continued execution',
          continuedThreads: threads.map((t: any) => ({ id: t.id, name: t.name })),
        };
      }
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'continue_failed', message: error.message };
      }
      return {
        error: 'Failed to continue execution',
        details: error.message,
      };
    }
  },
};
