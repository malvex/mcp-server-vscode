import * as vscode from 'vscode';
import { Tool } from '../types';
import { searchWorkspaceSymbols } from '../utils/symbolProvider';

/**
 * Find similar symbol names for suggestions (simple Levenshtein distance)
 */
function findSimilarNames(target: string, symbols: string[], maxDistance: number = 3): string[] {
  function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  return symbols
    .map((s) => ({ name: s, distance: levenshtein(target.toLowerCase(), s.toLowerCase()) }))
    .filter((s) => s.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map((s) => s.name)
    .slice(0, 5);
}

export const refactor_renameTool: Tool = {
  name: 'refactor_rename',
  description:
    'Rename a symbol across all files in the workspace. Refactor safely - automatically updates all references, imports, and type usages',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Symbol name to rename (e.g., "calculateTotal", "UserService.login")',
      },
      newName: {
        type: 'string',
        description: 'The new name for the symbol',
      },
      uri: {
        type: 'string',
        description: 'Optional: File URI to disambiguate if multiple symbols exist',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['symbol', 'newName'],
  },
  handler: async (args: any) => {
    const { symbol, newName, uri: providedUri, format = 'compact' } = args;

    try {
      // Search for the symbol across workspace
      const searchResult = await searchWorkspaceSymbols(symbol);

      if (!searchResult || searchResult.length === 0) {
        // Find similar symbols for suggestions
        const allSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          ''
        );

        const symbolNames = Array.from(new Set(allSymbols?.map((s) => s.name) || []));
        const suggestions = findSimilarNames(symbol, symbolNames);

        return {
          error: `No symbol found with name '${symbol}'`,
          suggestions: suggestions.map((name) => {
            const sym = allSymbols?.find((s) => s.name === name);
            return {
              name,
              kind: sym?.kind ? vscode.SymbolKind[sym.kind] : 'unknown',
            };
          }),
          hint:
            suggestions.length > 0
              ? `Did you mean '${suggestions[0]}'? Check the spelling.`
              : 'Check spelling or use qualified name like "ClassName.methodName"',
        };
      }

      // Filter by provided URI if specified
      let matches = searchResult;
      if (providedUri) {
        const targetUri = vscode.Uri.parse(providedUri);
        matches = searchResult.filter((s) => s.location.uri.toString() === targetUri.toString());

        if (matches.length === 0) {
          return {
            error: `Symbol '${symbol}' not found in file ${providedUri}`,
            availableFiles: searchResult.map((s) =>
              vscode.workspace.asRelativePath(s.location.uri)
            ),
            hint: 'Symbol exists in other files. Remove uri parameter to rename across all files.',
          };
        }
      }

      // Handle multiple matches
      if (matches.length > 1) {
        // Try to find exact match (not container prefix)
        const exactMatches = matches.filter((m) => {
          const parts = m.name.split('.');
          return parts[parts.length - 1] === symbol;
        });

        if (exactMatches.length === 1) {
          matches = exactMatches;
        } else {
          // Return disambiguation info
          return {
            multipleMatches: true,
            matchCount: matches.length,
            matches: matches.slice(0, 10).map((m, i) => ({
              symbol: {
                name: m.name,
                kind: vscode.SymbolKind[m.kind],
                container: m.containerName || null,
                file: vscode.workspace.asRelativePath(m.location.uri),
                line: m.location.range.start.line + 1,
              },
              match: i + 1,
              hint: m.containerName
                ? `Use '${m.containerName}.${symbol}' to target this specifically`
                : null,
            })),
            hint: 'Multiple symbols found. Use qualified name (e.g., "Class.method") or provide file URI.',
          };
        }
      }

      // We have a single match - perform rename
      const match = matches[0];
      const fileUri = match.location.uri;
      const position = match.location.range.start;

      // Open the document to ensure it's loaded
      await vscode.workspace.openTextDocument(fileUri);

      // Execute rename using VS Code's rename provider
      const renameEdit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        'vscode.executeDocumentRenameProvider',
        fileUri,
        position,
        newName
      );

      if (!renameEdit) {
        return {
          error: 'Rename failed - no rename provider available for this symbol',
          symbol: {
            name: match.name,
            kind: vscode.SymbolKind[match.kind],
            file: vscode.workspace.asRelativePath(fileUri),
          },
          hint: 'This symbol might not be renameable (e.g., external library symbol)',
        };
      }

      // Preview the changes
      const editEntries = Array.from(renameEdit.entries());
      const changes = editEntries.map(([uri, edits]) => ({
        file: vscode.workspace.asRelativePath(uri),
        edits: edits.map((edit) => ({
          startLine: edit.range.start.line + 1,
          startChar: edit.range.start.character,
          endLine: edit.range.end.line + 1,
          endChar: edit.range.end.character,
          newText: edit.newText,
        })),
      }));

      // Apply the rename
      const success = await vscode.workspace.applyEdit(renameEdit);

      if (!success) {
        return {
          error: 'Failed to apply rename operation',
          attemptedChanges: changes.length,
          hint: 'The workspace might have unsaved changes. Try saving all files first.',
        };
      }

      // Save all affected documents
      await vscode.workspace.saveAll(false);

      if (format === 'compact') {
        return {
          success: true,
          renamedSymbol: {
            oldName: match.name,
            newName,
          },
          filesChanged: changes.length,
          totalEdits: changes.reduce((sum, file) => sum + file.edits.length, 0),
        };
      }

      return {
        success: true,
        renamedSymbol: {
          oldName: match.name,
          newName,
          kind: vscode.SymbolKind[match.kind],
          location: {
            file: vscode.workspace.asRelativePath(fileUri),
            line: position.line + 1,
            character: position.character,
          },
        },
        changes,
      };
    } catch (error: any) {
      return {
        error: error.message || 'Unknown error during rename operation',
        hint: 'Check if the file is saved and the symbol name is correct.',
      };
    }
  },
};
