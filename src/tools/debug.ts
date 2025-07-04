import * as vscode from 'vscode';
import { Tool } from './types';

export const debugTool: Tool = {
  name: 'debug',
  description: 'Control debugging sessions - start, stop, set breakpoints, step through code',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'start',
          'stop',
          'setBreakpoint',
          'removeBreakpoint',
          'stepOver',
          'stepInto',
          'stepOut',
          'continue',
          'getVariables',
        ],
        description: 'Debug action to perform',
      },
      // Symbol-based approach (AI-friendly)
      symbol: {
        type: 'string',
        description: 'Symbol name for breakpoint (e.g., "functionName", "ClassName.methodName")',
      },
      // Position-based approach (kept for backward compatibility)
      uri: { type: 'string', description: 'File URI for breakpoint operations' },
      line: { type: 'number', description: 'Line number for breakpoint (0-based)' },
      // For start action
      config: { type: 'object', description: 'Debug configuration to use' },
      // Output format
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['action'],
  },
  handler: async (args) => {
    const { action, symbol, uri, line, config, format = 'compact' } = args;

    switch (action) {
      case 'start':
        if (config) {
          await vscode.debug.startDebugging(undefined, config);
        } else {
          // Use the first available configuration
          const configs = vscode.workspace.getConfiguration('launch').configurations;
          if (configs && configs.length > 0) {
            await vscode.debug.startDebugging(undefined, configs[0]);
          } else {
            throw new Error('No debug configurations found');
          }
        }
        return format === 'compact' ? { action: 'started' } : { status: 'Debug session started' };

      case 'stop':
        await vscode.debug.stopDebugging();
        return format === 'compact' ? { action: 'stopped' } : { status: 'Debug session stopped' };

      case 'setBreakpoint':
        if (symbol) {
          // AI-friendly symbol-based approach
          const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            symbol.split('.').pop()!
          );

          if (!symbols || symbols.length === 0) {
            return format === 'compact'
              ? { error: 'not_found', symbol }
              : { error: `Symbol '${symbol}' not found` };
          }

          // Find exact match
          const match = symbols.find(
            (s) => s.name === symbol || s.name === symbol.split('.').pop()
          );
          if (match) {
            const breakpoint = new vscode.SourceBreakpoint(
              new vscode.Location(match.location.uri, match.location.range.start)
            );
            vscode.debug.addBreakpoints([breakpoint]);
            return format === 'compact'
              ? {
                  action: 'added',
                  location: [match.location.uri.toString(), match.location.range.start.line],
                }
              : { status: 'Breakpoint added', symbol, line: match.location.range.start.line };
          } else {
            return format === 'compact'
              ? { error: 'not_found', symbol }
              : { error: `Symbol '${symbol}' not found in available matches` };
          }
        } else if (uri && line !== undefined) {
          // Position-based approach (backward compatibility)
          const fileUri = vscode.Uri.parse(uri);
          const location = new vscode.Location(fileUri, new vscode.Position(line, 0));
          const breakpoint = new vscode.SourceBreakpoint(location);
          vscode.debug.addBreakpoints([breakpoint]);
          return format === 'compact'
            ? { action: 'added', location: [uri, line] }
            : { status: 'Breakpoint added', line };
        } else {
          throw new Error('Either provide a symbol name OR uri with line');
        }
        break;

      case 'removeBreakpoint':
        if (!uri || line === undefined) {
          return format === 'compact'
            ? { error: 'missing_params' }
            : { error: 'URI and line required for removing breakpoint' };
        }
        const bpUri = vscode.Uri.parse(uri);
        const allBreakpoints = vscode.debug.breakpoints;
        const toRemove = allBreakpoints.filter((bp) => {
          if (bp instanceof vscode.SourceBreakpoint) {
            return (
              bp.location.uri.toString() === bpUri.toString() &&
              bp.location.range.start.line === line
            );
          }
          return false;
        });
        vscode.debug.removeBreakpoints(toRemove);
        return format === 'compact'
          ? { action: 'removed', location: [uri, line] }
          : { status: 'Breakpoint removed', line };

      case 'stepOver':
        await vscode.commands.executeCommand('workbench.action.debug.stepOver');
        return format === 'compact' ? { action: 'step_over' } : { status: 'Stepped over' };

      case 'stepInto':
        await vscode.commands.executeCommand('workbench.action.debug.stepInto');
        return format === 'compact' ? { action: 'step_into' } : { status: 'Stepped into' };

      case 'stepOut':
        await vscode.commands.executeCommand('workbench.action.debug.stepOut');
        return format === 'compact' ? { action: 'step_out' } : { status: 'Stepped out' };

      case 'continue':
        await vscode.commands.executeCommand('workbench.action.debug.continue');
        return format === 'compact' ? { action: 'continue' } : { status: 'Continued execution' };

      case 'getVariables':
        // This is more complex and would require access to the debug session
        // For now, return a placeholder
        return format === 'compact'
          ? { error: 'not_implemented' }
          : {
              status: 'Variable inspection not yet implemented',
              note: 'This requires deeper integration with the debug adapter protocol',
            };

      default:
        return format === 'compact'
          ? { error: 'unknown_action', action }
          : { error: `Unknown debug action: ${action}` };
    }
  },
};
