import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_getCallStackTool: Tool = {
  name: 'debug_getCallStack',
  description:
    'Get the current call stack/stack trace from the paused debug session. Understand execution flow instantly - see the complete call chain at a glance',
  inputSchema: {
    type: 'object',
    properties: {
      threadId: {
        type: 'number',
        description: 'Thread ID to get stack for (optional, uses current stopped thread)',
      },
      startFrame: {
        type: 'number',
        description: 'Starting frame index (0-based, default: 0)',
        default: 0,
      },
      levels: {
        type: 'number',
        description: 'Number of frames to retrieve (default: 20, use 0 for all)',
        default: 20,
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
    const { threadId, startFrame = 0, levels = 20, format = 'compact' } = args;

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

      // Get stack trace
      const stackResponse = await session.customRequest('stackTrace', {
        threadId: targetThreadId,
        startFrame,
        levels: levels === 0 ? undefined : levels,
      });

      const frames = stackResponse.stackFrames || [];

      if (format === 'compact') {
        // Return compact format: [[name, file, line, column], ...]
        return {
          stackFormat: '[name, file, line, column]',
          stack: frames.map((frame: any) => [
            frame.name,
            frame.source?.path ? vscode.workspace.asRelativePath(frame.source.path) : 'unknown',
            frame.line, // DAP is already 1-based
            frame.column, // DAP is already 1-based
          ]),
          totalFrames: stackResponse.totalFrames || frames.length,
        };
      }

      // Detailed format
      return {
        callStack: frames.map((frame: any) => ({
          id: frame.id,
          name: frame.name,
          source: frame.source
            ? {
                path: vscode.workspace.asRelativePath(frame.source.path),
                name: frame.source.name,
                line: frame.line, // DAP is already 1-based
                column: frame.column, // DAP is already 1-based
              }
            : null,
          presentationHint: frame.presentationHint,
        })),
        totalFrames: stackResponse.totalFrames || frames.length,
        threadId: targetThreadId,
      };
    } catch (error: any) {
      if (format === 'compact') {
        return { error: 'stack_failed', message: error.message };
      }
      return {
        error: 'Failed to get call stack',
        details: error.message,
        hint: 'Ensure the debugger is paused at a breakpoint',
      };
    }
  },
};
