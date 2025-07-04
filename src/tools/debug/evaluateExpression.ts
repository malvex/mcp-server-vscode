import * as vscode from 'vscode';
import { Tool } from '../types';

export const debug_evaluateExpressionTool: Tool = {
  name: 'debug_evaluateExpression',
  description:
    'Evaluate an expression in the current debug context (REPL/watch functionality). Test hypotheses instantly - execute any expression without modifying code',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Expression to evaluate (e.g., "myVariable", "array.length", "func()")',
      },
      threadId: {
        type: 'number',
        description: 'Thread ID (optional, uses current stopped thread)',
      },
      frameId: {
        type: 'number',
        description: 'Stack frame ID for context (optional, uses top frame)',
      },
      context: {
        type: 'string',
        enum: ['watch', 'repl', 'hover', 'clipboard'],
        description: 'Evaluation context (default: repl)',
        default: 'repl',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['expression'],
  },
  handler: async (args) => {
    const { expression, threadId, frameId, context = 'repl', format = 'compact' } = args;

    if (!expression) {
      return format === 'compact'
        ? { error: 'missing_expression' }
        : { error: 'Expression is required' };
    }

    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return format === 'compact' ? { error: 'no_session' } : { error: 'No active debug session' };
    }

    try {
      let targetFrameId = frameId;

      // If no frameId specified, we need to get it from the current thread
      if (targetFrameId === undefined) {
        let targetThreadId = threadId;

        // If no threadId specified, get the current thread
        if (targetThreadId === undefined) {
          const threadsResponse = await session.customRequest('threads');
          const threads = threadsResponse.threads || [];

          if (threads.length > 0) {
            targetThreadId = threads[0].id;
          } else {
            return format === 'compact'
              ? { error: 'no_threads' }
              : { error: 'No threads available' };
          }
        }

        // Get the top frame
        const stackResponse = await session.customRequest('stackTrace', {
          threadId: targetThreadId,
          startFrame: 0,
          levels: 1,
        });

        if (stackResponse.stackFrames && stackResponse.stackFrames.length > 0) {
          targetFrameId = stackResponse.stackFrames[0].id;
        }
      }

      // Evaluate the expression
      const evalResponse = await session.customRequest('evaluate', {
        expression,
        frameId: targetFrameId,
        context,
      });

      if (format === 'compact') {
        return {
          result: evalResponse.result,
          type: evalResponse.type || 'unknown',
          variablesReference: evalResponse.variablesReference || 0,
        };
      }

      // Detailed format
      return {
        expression,
        result: evalResponse.result,
        type: evalResponse.type,
        presentationHint: evalResponse.presentationHint,
        variablesReference: evalResponse.variablesReference,
        namedVariables: evalResponse.namedVariables,
        indexedVariables: evalResponse.indexedVariables,
        memoryReference: evalResponse.memoryReference,
        context,
        frameId: targetFrameId,
      };
    } catch (error: any) {
      // Check if it's an evaluation error (e.g., undefined variable)
      if (error.message && error.message.includes('evaluate')) {
        if (format === 'compact') {
          return {
            error: 'eval_error',
            result: error.message,
            expression,
          };
        }
        return {
          error: 'Evaluation failed',
          expression,
          details: error.message,
        };
      }

      if (format === 'compact') {
        return { error: 'eval_failed', message: error.message };
      }
      return {
        error: 'Failed to evaluate expression',
        expression,
        details: error.message,
        hint: 'Ensure the debugger is paused and the expression is valid',
      };
    }
  },
};
