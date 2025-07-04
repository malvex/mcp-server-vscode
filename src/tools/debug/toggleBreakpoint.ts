import * as vscode from 'vscode';
import { Tool } from '../types';
import { findSymbolInWorkspace } from '../utils/symbolProvider';

export const debug_toggleBreakpointTool: Tool = {
  name: 'debug_toggleBreakpoint',
  description: 'Toggle a breakpoint on/off at a symbol or file/line location',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Symbol name (e.g., "functionName", "ClassName.methodName")',
      },
      file: {
        type: 'string',
        description: 'File name or path (e.g., "app.ts", "src/app.ts")',
      },
      line: {
        type: 'number',
        description: 'Line number (1-based)',
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
    const { symbol, file, line, format = 'compact' } = args;

    // Validate input
    if (!symbol && (!file || line === undefined)) {
      return format === 'compact'
        ? { error: 'missing_params' }
        : { error: 'Provide either a symbol name or file with line number' };
    }

    let targetUri: vscode.Uri | undefined;
    let targetLine: number | undefined;

    // Find location by symbol
    if (symbol) {
      const symbols = await findSymbolInWorkspace(symbol);

      if (symbols.length === 0) {
        if (format === 'compact') {
          return { error: 'not_found' };
        }
        return { error: `Symbol '${symbol}' not found` };
      }

      // For toggle, just use the first match
      const match = symbols[0];
      targetUri = match.location.uri;
      targetLine = match.location.range.start.line;
    }
    // Find location by file/line
    else if (file && line !== undefined) {
      // Convert from 1-based (user input) to 0-based (VS Code)
      targetLine = line - 1;

      const files = await vscode.workspace.findFiles(`**/${file}`);
      if (files.length === 0) {
        return format === 'compact'
          ? { error: 'file_not_found' }
          : { error: `File '${file}' not found in workspace` };
      }
      targetUri = files[0];
    }

    // Check if breakpoint exists
    const existingBp = vscode.debug.breakpoints.find((bp) => {
      if (bp instanceof vscode.SourceBreakpoint) {
        return (
          bp.location.uri.toString() === targetUri!.toString() &&
          bp.location.range.start.line === targetLine
        );
      }
      return false;
    });

    if (existingBp) {
      // Remove existing breakpoint
      vscode.debug.removeBreakpoints([existingBp]);
      if (format === 'compact') {
        return {
          action: 'removed',
          bpFormat: '[file, line, enabled]',
          bp: [vscode.workspace.asRelativePath(targetUri!), targetLine! + 1, false],
        };
      }
      return {
        action: 'removed',
        breakpoint: {
          file: vscode.workspace.asRelativePath(targetUri!),
          line: targetLine! + 1,
          symbol: symbol || undefined,
        },
      };
    } else {
      // Add new breakpoint
      const location = new vscode.Location(targetUri!, new vscode.Position(targetLine!, 0));
      const bp = new vscode.SourceBreakpoint(location, true);
      vscode.debug.addBreakpoints([bp]);

      if (format === 'compact') {
        return {
          action: 'added',
          bpFormat: '[file, line, enabled]',
          bp: [vscode.workspace.asRelativePath(targetUri!), targetLine! + 1, true],
        };
      }
      return {
        action: 'added',
        breakpoint: {
          file: vscode.workspace.asRelativePath(targetUri!),
          line: targetLine! + 1,
          enabled: true,
          symbol: symbol || undefined,
        },
      };
    }
  },
};
