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
      includeExternalSymbols: {
        type: 'boolean',
        description: 'Include symbols from external dependencies and libraries (default: false)',
      },
    },
    required: [],
  },
  handler: async (args) => {
    const {
      includeDetails = true,
      filePattern = '**/*',
      maxFiles = 1000,
      includeExternalSymbols = false,
    } = args;

    try {
      // Get workspace folders to filter out external files
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return {
          error: 'No workspace folder open',
        };
      }

      // Common exclude patterns for external dependencies
      const excludePattern =
        '{**/node_modules/**,**/.vscode/**,**/venv/**,**/.env/**,**/site-packages/**,**/__pycache__/**,**/.git/**}';

      // Find all files matching the pattern
      const files = await vscode.workspace.findFiles(filePattern, excludePattern, maxFiles);

      const symbolsByFile: Record<string, any[]> = {};
      let totalSymbols = 0;

      // Process each file
      for (const fileUri of files) {
        try {
          // CRITICAL: Only process files that are within the workspace folders
          if (!includeExternalSymbols) {
            const isInWorkspace = workspaceFolders.some((folder) =>
              fileUri.fsPath.startsWith(folder.uri.fsPath)
            );

            if (!isInWorkspace) {
              // Skip files outside workspace (e.g., from extensions or libraries)
              continue;
            }

            // Additional check: Skip files from VS Code extensions or Python type stubs
            if (
              fileUri.fsPath.includes('.vscode/extensions/') ||
              fileUri.fsPath.includes('.vscode-server/extensions/') ||
              fileUri.fsPath.includes('typeshed-fallback/') ||
              fileUri.fsPath.includes('site-packages/') ||
              fileUri.fsPath.includes('/lib/python') ||
              fileUri.fsPath.includes('\\lib\\python')
            ) {
              continue;
            }
          }

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
