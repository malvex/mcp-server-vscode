import * as vscode from 'vscode';
import { Tool } from './types';

export const callHierarchyTool: Tool = {
  name: 'callHierarchy',
  description: 'Find what calls a function or what a function calls by using the function name',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description:
          'Name of the function/method to analyze (e.g., "calculateSum", "add", "Calculator.multiply")',
      },

      // Optional: limit search to specific file
      uri: {
        type: 'string',
        description: 'File URI to search in (optional - searches entire workspace if not provided)',
      },

      direction: {
        type: 'string',
        enum: ['incoming', 'outgoing', 'both'],
        description:
          'Get incoming calls (who calls this), outgoing calls (what this calls), or both',
        default: 'incoming',
      },
    },
    required: ['symbol', 'direction'],
  },
  handler: async (args) => {
    const { symbol, uri, direction = 'incoming' } = args;

    // Step 1: Find the symbol(s) with the given name
    const searchQuery = symbol.includes('.') ? symbol.split('.').pop()! : symbol;
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      searchQuery
    );

    if (!symbols || symbols.length === 0) {
      return {
        error: `No symbol found with name "${symbol}"`,
        suggestion: 'Try searching for the exact function name without parameters or class prefix',
      };
    }

    // Step 2: Filter symbols to find exact matches
    let matchingSymbols = symbols.filter((s) => {
      // Match exact name or name with parentheses
      const nameMatches =
        s.name === searchQuery ||
        s.name.startsWith(searchQuery + '(') ||
        (symbol.includes('.') && s.containerName === symbol.split('.')[0]);

      // Filter by URI if provided
      const uriMatches = !uri || s.location.uri.toString() === uri;

      return nameMatches && uriMatches;
    });

    if (matchingSymbols.length === 0) {
      return {
        error: `No exact match found for "${symbol}"`,
        suggestions: symbols.slice(0, 5).map((s) => ({
          name: s.name,
          kind: vscode.SymbolKind[s.kind],
          container: s.containerName,
          file: s.location.uri.fsPath.split('/').pop(),
        })),
        hint: 'Found these similar symbols. Try using one of these names exactly.',
      };
    }

    // Step 3: Get call hierarchy for each matching symbol
    const results: any[] = [];

    for (const sym of matchingSymbols) {
      const document = await vscode.workspace.openTextDocument(sym.location.uri);
      const position = sym.location.range.start;

      // Get call hierarchy item
      const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        document.uri,
        position
      );

      if (!items || items.length === 0) continue;

      const item = items[0];
      const result: any = {
        symbol: {
          name: sym.name,
          kind: vscode.SymbolKind[sym.kind],
          container: sym.containerName,
          file: sym.location.uri.fsPath,
          line: sym.location.range.start.line + 1, // Human-readable (1-based)
        },
        calls: [],
      };

      if (direction === 'incoming' || direction === 'both') {
        const incomingCalls = await vscode.commands.executeCommand<
          vscode.CallHierarchyIncomingCall[]
        >('vscode.provideIncomingCalls', item);

        if (incomingCalls && incomingCalls.length > 0) {
          result.calls.push(
            ...incomingCalls.map((call) => ({
              type: 'incoming',
              from: {
                name: call.from.name,
                kind: vscode.SymbolKind[call.from.kind],
                file: call.from.uri.fsPath,
                line: call.from.range.start.line + 1,
              },
              locations: call.fromRanges.map((range) => ({
                line: range.start.line + 1,
                character: range.start.character,
                preview: getLinePreview(document, range.start.line),
              })),
            }))
          );
        }
      }

      if (direction === 'outgoing' || direction === 'both') {
        const outgoingCalls = await vscode.commands.executeCommand<
          vscode.CallHierarchyOutgoingCall[]
        >('vscode.provideOutgoingCalls', item);

        if (outgoingCalls && outgoingCalls.length > 0) {
          result.calls.push(
            ...outgoingCalls.map((call) => ({
              type: 'outgoing',
              to: {
                name: call.to.name,
                kind: vscode.SymbolKind[call.to.kind],
                file: call.to.uri.fsPath,
                line: call.to.range.start.line + 1,
              },
              locations: call.fromRanges.map((range) => ({
                line: range.start.line + 1,
                character: range.start.character,
              })),
            }))
          );
        }
      }

      results.push(result);
    }

    // Return appropriate format based on number of matches
    if (results.length === 0) {
      return {
        symbol: symbol,
        message: 'Symbol found but no call hierarchy available',
        hint: 'This might be an unused function or the language server needs more time to index',
      };
    } else if (results.length === 1) {
      // For single match, return simplified format
      return results[0];
    } else {
      // For multiple matches, return all
      return {
        symbol: symbol,
        multipleMatches: true,
        matches: results,
        summary: {
          totalMatches: results.length,
          totalCalls: results.reduce((sum, r) => sum + r.calls.length, 0),
        },
      };
    }
  },
};

// Helper to get a preview of the line (for incoming calls)
function getLinePreview(document: vscode.TextDocument, line: number): string | undefined {
  try {
    return document.lineAt(line).text.trim();
  } catch {
    return undefined;
  }
}
