import * as vscode from 'vscode';
import { Tool } from './types';
import { searchWorkspaceSymbols } from './utils/symbolProvider';

export const hoverTool: Tool = {
  name: 'hover',
  description:
    'Get hover information (type info, documentation) for a symbol by name. MUCH FASTER than reading entire files when you just need to understand a function signature or type',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description:
          'Name of the symbol to get hover info for (e.g., "calculateSum", "Calculator.multiply")',
      },
      uri: {
        type: 'string',
        description: 'File URI to search in (optional - searches entire workspace if not provided)',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['symbol'],
  },
  handler: async (args) => {
    const { symbol, uri, format = 'compact' } = args;

    // Step 1: Find the symbol(s) with the given name
    const searchQuery = symbol.includes('.') ? symbol.split('.').pop()! : symbol;
    const symbols = await searchWorkspaceSymbols(searchQuery);

    if (!symbols || symbols.length === 0) {
      return {
        error: `No symbol found with name "${symbol}"`,
        suggestion: 'Try searching for the exact function/variable name',
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

    // Prioritize non-method symbols when no container is specified
    if (!symbol.includes('.') && matchingSymbols.length > 1) {
      const standaloneSymbols = matchingSymbols.filter((s) => !s.containerName);
      if (standaloneSymbols.length > 0) {
        matchingSymbols = standaloneSymbols;
      }
    }

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

    // Step 3: Get hover information for each matching symbol
    const results: any[] = [];

    for (const sym of matchingSymbols) {
      const document = await vscode.workspace.openTextDocument(sym.location.uri);

      // For better hover results, position cursor in the middle of the symbol name
      const line = document.lineAt(sym.location.range.start.line);
      const lineText = line.text;
      const symbolStartChar = lineText.indexOf(searchQuery, sym.location.range.start.character);

      let hoverPosition: vscode.Position;
      if (symbolStartChar !== -1) {
        // Position cursor in the middle of the symbol name for better results
        hoverPosition = new vscode.Position(
          sym.location.range.start.line,
          symbolStartChar + Math.floor(searchQuery.length / 2)
        );
      } else {
        // Fallback to start position
        hoverPosition = sym.location.range.start;
      }

      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        hoverPosition
      );

      if (!hovers || hovers.length === 0) continue;

      // Combine all hover contents
      const contents = hovers.flatMap((hover) => {
        return hover.contents.map((content) => {
          if (typeof content === 'string') {
            return content;
          } else if (content instanceof vscode.MarkdownString) {
            return content.value;
          } else {
            return content.value;
          }
        });
      });

      if (format === 'compact') {
        results.push({
          symbol: [
            sym.name,
            vscode.SymbolKind[sym.kind].toLowerCase(),
            sym.location.uri.fsPath,
            sym.location.range.start.line + 1,
          ],
          hover: contents,
        });
      } else {
        results.push({
          symbol: {
            name: sym.name,
            kind: vscode.SymbolKind[sym.kind],
            container: sym.containerName,
            file: sym.location.uri.fsPath,
            line: sym.location.range.start.line + 1,
          },
          hover: {
            contents: contents,
            // Include code snippet for context (line is already 0-based)
            codeSnippet: getCodeSnippet(document, sym.location.range.start.line),
          },
        });
      }
    }

    // Return appropriate format based on number of matches
    if (results.length === 0) {
      return {
        symbol: symbol,
        message: 'Symbol found but no hover information available',
      };
    } else if (results.length === 1) {
      // For single match, return simplified format
      if (format === 'compact') {
        return {
          ...results[0],
          symbolFormat: '[name, kind, filePath, line]',
        };
      }
      return results[0];
    } else {
      // For multiple matches, return all
      if (format === 'compact') {
        return {
          symbol: symbol,
          multipleMatches: true,
          symbolFormat: '[name, kind, filePath, line]',
          matches: results,
        };
      } else {
        return {
          symbol: symbol,
          multipleMatches: true,
          matches: results,
        };
      }
    }
  },
};

// Helper to get a code snippet around the symbol
function getCodeSnippet(
  document: vscode.TextDocument,
  line: number,
  contextLines: number = 2
): string {
  const lines: string[] = [];
  const startLine = Math.max(0, line - contextLines);
  const endLine = Math.min(document.lineCount - 1, line + contextLines);

  for (let i = startLine; i <= endLine; i++) {
    const lineText = document.lineAt(i).text;
    const prefix = i === line ? '>' : ' ';
    lines.push(`${prefix} ${i}: ${lineText}`);
  }

  return lines.join('\n');
}
