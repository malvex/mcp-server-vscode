import * as vscode from 'vscode';
import { Tool } from './types';

export const workspaceSymbolsTool: Tool = {
  name: 'workspaceSymbols',
  description: 'Get a complete map of all symbols in the workspace (classes, functions, etc)',
  inputSchema: {
    type: 'object',
    properties: {
      includeDetails: {
        type: 'boolean',
        description: 'Include full details like line numbers and file paths (default: true)',
      },
      filePattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "**/*.ts" for TypeScript files only)',
      },
      maxFiles: {
        type: 'number',
        description: 'Maximum number of files to process (default: 1000)',
      },
    },
    required: [],
  },
  handler: async (args) => {
    const { includeDetails = true, filePattern = '**/*', maxFiles = 1000 } = args;

    try {
      // Find all files matching the pattern
      const files = await vscode.workspace.findFiles(
        filePattern,
        '**/node_modules/**', // Exclude node_modules
        maxFiles
      );

      const symbolsByFile: Record<string, any[]> = {};
      let totalSymbols = 0;

      // Process each file
      for (const fileUri of files) {
        try {
          const document = await vscode.workspace.openTextDocument(fileUri);

          // Skip binary files
          if (document.languageId === 'binary' || document.languageId === 'image') {
            continue;
          }

          // Get all symbols in this document
          const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
          );

          if (symbols && symbols.length > 0) {
            const filePath = vscode.workspace.asRelativePath(fileUri);
            symbolsByFile[filePath] = processDocumentSymbols(symbols, includeDetails);
            totalSymbols += countSymbols(symbols);
          }
        } catch (error) {
          // Skip files that can't be processed
          console.error(`Error processing ${fileUri.fsPath}:`, error);
        }
      }

      // Create a summary
      const summary = {
        totalFiles: Object.keys(symbolsByFile).length,
        totalSymbols: totalSymbols,
        byKind: countSymbolsByKind(symbolsByFile),
      };

      return {
        summary,
        files: symbolsByFile,
      };
    } catch (error) {
      return {
        error: `Failed to get workspace symbols: ${error}`,
      };
    }
  },
};

// Helper function to process document symbols recursively
function processDocumentSymbols(
  symbols: vscode.DocumentSymbol[],
  includeDetails: boolean,
  parentPath: string = ''
): any[] {
  return symbols.map((symbol) => {
    const fullName = parentPath ? `${parentPath}.${symbol.name}` : symbol.name;

    const processedSymbol: any = {
      name: symbol.name,
      kind: vscode.SymbolKind[symbol.kind],
      fullName: fullName,
    };

    if (includeDetails) {
      processedSymbol.range = {
        start: {
          line: symbol.range.start.line, // Keep 0-based for AI
          character: symbol.range.start.character,
        },
        end: {
          line: symbol.range.end.line,
          character: symbol.range.end.character,
        },
      };

      if (symbol.detail) {
        processedSymbol.detail = symbol.detail;
      }
    }

    // Process children (nested symbols like methods in a class)
    if (symbol.children && symbol.children.length > 0) {
      processedSymbol.children = processDocumentSymbols(symbol.children, includeDetails, fullName);
    }

    return processedSymbol;
  });
}

// Count total symbols including nested ones
function countSymbols(symbols: vscode.DocumentSymbol[]): number {
  let count = symbols.length;
  for (const symbol of symbols) {
    if (symbol.children) {
      count += countSymbols(symbol.children);
    }
  }
  return count;
}

// Count symbols by kind across all files
function countSymbolsByKind(symbolsByFile: Record<string, any[]>): Record<string, number> {
  const counts: Record<string, number> = {};

  function countInArray(symbols: any[]) {
    for (const symbol of symbols) {
      counts[symbol.kind] = (counts[symbol.kind] || 0) + 1;
      if (symbol.children) {
        countInArray(symbol.children);
      }
    }
  }

  for (const symbols of Object.values(symbolsByFile)) {
    countInArray(symbols);
  }

  return counts;
}
