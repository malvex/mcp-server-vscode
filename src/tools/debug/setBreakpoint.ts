import * as vscode from 'vscode';
import { Tool } from '../types';
import { findSymbolInWorkspace } from '../utils/symbolProvider';

export const debug_setBreakpointTool: Tool = {
  name: 'debug_setBreakpoint',
  description:
    'Set a breakpoint by symbol name or file/line with optional conditions. Debug smarter - set breakpoints instantly without clicking through files',
  inputSchema: {
    type: 'object',
    properties: {
      // Symbol-based approach (preferred)
      symbol: {
        type: 'string',
        description: 'Symbol name (e.g., "functionName", "ClassName.methodName")',
      },
      // File/line approach (alternative)
      file: {
        type: 'string',
        description: 'File name or path (e.g., "app.ts", "src/app.ts")',
      },
      line: {
        type: 'number',
        description: 'Line number (1-based)',
      },
      // Optional conditions
      condition: {
        type: 'string',
        description: 'Conditional expression (e.g., "x > 100")',
      },
      hitCondition: {
        type: 'string',
        description: 'Hit count expression (e.g., ">5", "==10")',
      },
      logMessage: {
        type: 'string',
        description: 'Log message to output instead of breaking',
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
    const { symbol, file, line, condition, hitCondition, logMessage, format = 'compact' } = args;

    // Validate input
    if (!symbol && (!file || line === undefined)) {
      return format === 'compact'
        ? { error: 'missing_params' }
        : { error: 'Provide either a symbol name or file with line number' };
    }

    let targetUri: vscode.Uri | undefined;
    let targetLine: number | undefined;
    let symbolInfo: any = null;

    // Find location by symbol
    if (symbol) {
      const symbols = await findSymbolInWorkspace(symbol);

      if (symbols.length === 0) {
        // Try to find similar symbols for suggestions
        const allSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          ''
        );
        const suggestions = allSymbols
          ?.filter((s) => s.name.toLowerCase().includes(symbol.toLowerCase()))
          .slice(0, 5)
          .map((s) => ({
            name: s.name,
            kind: vscode.SymbolKind[s.kind],
            file: vscode.workspace.asRelativePath(s.location.uri),
          }));

        if (format === 'compact') {
          return { error: 'not_found', suggestions: suggestions?.map((s) => s.name) };
        }
        return {
          error: `Symbol '${symbol}' not found`,
          suggestions,
        };
      }

      // Handle multiple matches
      if (symbols.length > 1) {
        const matches = symbols.map((s) => ({
          symbol: s.name,
          kind: vscode.SymbolKind[s.kind],
          file: vscode.workspace.asRelativePath(s.location.uri),
          line: s.location.range.start.line + 1,
          container: s.containerName || '',
        }));

        if (format === 'compact') {
          return {
            multipleMatches: true,
            matchFormat: '[symbol, kind, file, line]',
            matches: matches.map((m) => [m.symbol, m.kind, m.file, m.line + 1]),
          };
        }
        return { multipleMatches: true, matches };
      }

      const match = symbols[0];
      targetUri = match.location.uri;
      targetLine = match.location.range.start.line;
      symbolInfo = {
        name: match.name,
        kind: vscode.SymbolKind[match.kind],
        container: match.containerName,
      };
    }
    // Find location by file/line
    else if (file && line !== undefined) {
      // Convert from 1-based (user input) to 0-based (VS Code)
      targetLine = line - 1;

      // Find the file in workspace
      const files = await vscode.workspace.findFiles(`**/${file}`);
      if (files.length === 0) {
        return format === 'compact'
          ? { error: 'file_not_found' }
          : { error: `File '${file}' not found in workspace` };
      }
      targetUri = files[0];
      // targetLine already set above after conversion
    }

    // Create breakpoint
    const location = new vscode.Location(targetUri!, new vscode.Position(targetLine!, 0));
    const bp = new vscode.SourceBreakpoint(location, true, condition, hitCondition, logMessage);
    vscode.debug.addBreakpoints([bp]);

    const breakpointInfo = {
      file: vscode.workspace.asRelativePath(targetUri!),
      line: targetLine! + 1, // Convert to 1-based for output
      enabled: true,
      condition,
      hitCondition,
      logMessage,
      symbol: symbol || undefined,
      ...(symbolInfo && { kind: symbolInfo.kind, container: symbolInfo.container }),
    };

    if (format === 'compact') {
      return {
        bpFormat: '[file, line, enabled]',
        bp: [breakpointInfo.file, breakpointInfo.line + 1, breakpointInfo.enabled],
      };
    }
    return { breakpoint: breakpointInfo };
  },
};
