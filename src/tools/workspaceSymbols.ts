import * as vscode from 'vscode';
import { Tool } from './types';

// Default code file extensions that support symbol extraction
// Note: These must be individual patterns - VS Code glob doesn't support nested braces
const DEFAULT_CODE_PATTERNS = [
  // JavaScript
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',
  // TypeScript
  '**/*.ts',
  '**/*.tsx',
  '**/*.mts',
  '**/*.cts',
  // Python
  '**/*.py',
  '**/*.pyw',
  // Java
  '**/*.java',
  // C/C++
  '**/*.c',
  '**/*.cpp',
  '**/*.cc',
  '**/*.cxx',
  '**/*.h',
  '**/*.hpp',
  // .NET
  '**/*.cs',
  '**/*.vb',
  // Go
  '**/*.go',
  // Rust
  '**/*.rs',
  // Ruby
  '**/*.rb',
  // PHP
  '**/*.php',
  // Swift/Objective-C
  '**/*.swift',
  '**/*.m',
  '**/*.mm',
  // Kotlin
  '**/*.kt',
  '**/*.kts',
  // Scala
  '**/*.scala',
  // R
  '**/*.r',
  '**/*.R',
  // Lua
  '**/*.lua',
  // Dart
  '**/*.dart',
  // Elixir
  '**/*.ex',
  '**/*.exs',
  // Clojure
  '**/*.clj',
  '**/*.cljs',
  // Julia
  '**/*.jl',
];

// Language IDs that should be skipped even if file matches pattern
const NON_CODE_LANGUAGE_IDS = [
  'html',
  'xml',
  'markdown',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'ini',
  'plaintext',
  'csv',
  'log',
  'dockerfile',
  'makefile',
  'ignore',
  'properties',
  'shellscript',
  'bat',
  'powershell',
];

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
      includeNonCodeFiles: {
        type: 'boolean',
        description: 'Include non-code files like HTML, JSON, Markdown (default: false)',
      },
    },
    required: [],
  },
  handler: async (args) => {
    const {
      includeDetails = true,
      filePattern,
      maxFiles = 1000,
      includeExternalSymbols = false,
      includeNonCodeFiles = false,
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

      let files: vscode.Uri[] = [];

      if (filePattern) {
        // Use user-provided pattern
        files = await vscode.workspace.findFiles(filePattern, excludePattern, maxFiles);
      } else {
        // Use default code patterns - need to search each pattern separately
        // since VS Code glob doesn't support nested braces
        const allFiles: vscode.Uri[] = [];

        for (const pattern of DEFAULT_CODE_PATTERNS) {
          if (allFiles.length >= maxFiles) break;

          const remainingSlots = maxFiles - allFiles.length;
          const patternFiles = await vscode.workspace.findFiles(
            pattern,
            excludePattern,
            remainingSlots
          );

          // Add files up to the remaining slots
          const filesToAdd = patternFiles.slice(0, remainingSlots);
          allFiles.push(...filesToAdd);
        }
        files = allFiles;
      }

      const symbolsByFile: Record<string, any[]> = {};
      let totalSymbols = 0;
      let skippedFiles = 0;

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

          // Skip non-code files unless explicitly requested
          if (!includeNonCodeFiles && NON_CODE_LANGUAGE_IDS.includes(document.languageId)) {
            continue;
          }

          // Get all symbols in this document
          const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
          );

          const filePath = vscode.workspace.asRelativePath(fileUri);

          if (symbols && symbols.length > 0) {
            symbolsByFile[filePath] = processDocumentSymbols(symbols, includeDetails);
            totalSymbols += countSymbols(symbols);
          } else if (symbols === undefined || symbols === null) {
            // No language server available - try basic parsing for common languages
            const basicSymbols = await tryBasicSymbolExtraction(document);
            if (basicSymbols && basicSymbols.length > 0) {
              symbolsByFile[filePath] = basicSymbols;
              totalSymbols += basicSymbols.length;
            } else {
              skippedFiles++;
            }
          } else {
            // Empty array means file was parsed but has no symbols - skip it
            skippedFiles++;
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
        skippedFiles: skippedFiles,
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

// Basic symbol extraction for files without language server support
async function tryBasicSymbolExtraction(document: vscode.TextDocument): Promise<any[] | null> {
  const languageId = document.languageId;
  const text = document.getText();
  const symbols: any[] = [];

  if (languageId === 'python') {
    // Basic Python symbol extraction
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Calculate indentation level
      const indent = line.length - trimmedLine.length;
      const isTopLevel = indent === 0;

      // Match class definitions (any indentation level)
      const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\(.*?\))?:/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: 'Class',
          fullName: classMatch[1],
          range: {
            start: { line: i, character: indent },
            end: { line: i, character: line.length },
          },
        });
      }

      // Match function definitions (any indentation level)
      const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\(/);
      if (funcMatch) {
        // Only include top-level functions and class methods (indent <= 4)
        if (isTopLevel || indent <= 4) {
          symbols.push({
            name: funcMatch[1],
            kind: isTopLevel ? 'Function' : 'Method',
            fullName: funcMatch[1],
            range: {
              start: { line: i, character: indent },
              end: { line: i, character: line.length },
            },
          });
        }
      }

      // Match top-level variables (simple assignment)
      if (isTopLevel) {
        const varMatch = trimmedLine.match(/^(\w+)\s*=\s*(.+)$/);
        if (varMatch) {
          const varName = varMatch[1];
          // Include constants (UPPER_CASE) and early module variables
          if (varName === varName.toUpperCase() && varName.length > 1) {
            symbols.push({
              name: varName,
              kind: 'Variable',
              fullName: varName,
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length },
              },
            });
          }
        }
      }
    }

    return symbols.length > 0 ? symbols : null;
  }

  // Add more basic parsers for other languages as needed

  return null;
}
