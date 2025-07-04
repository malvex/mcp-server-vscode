import * as vscode from 'vscode';
import { Tool } from './types';

export const referencesTool: Tool = {
  name: 'references',
  description: 'Find all references to a symbol by name or at a specific position',
  inputSchema: {
    type: 'object',
    properties: {
      // Symbol-based approach (AI-friendly)
      symbol: {
        type: 'string',
        description:
          'Symbol name to find references for (e.g., "functionName", "ClassName", "ClassName.methodName")',
      },

      // Position-based approach (kept for backward compatibility)
      uri: { type: 'string', description: 'File URI (required for position-based lookup)' },
      line: { type: 'number', description: 'Line number (0-based, required with uri)' },
      character: { type: 'number', description: 'Character position (0-based, required with uri)' },

      includeDeclaration: {
        type: 'boolean',
        description: 'Include the declaration in results (default: true)',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: [], // Make all optional, but validate in handler
  },
  handler: async (args) => {
    const { symbol, uri, line, character, includeDeclaration = true, format = 'compact' } = args;

    // Decide which approach to use
    if (symbol) {
      // AI-friendly symbol-based approach
      return await findReferencesBySymbol(symbol, includeDeclaration, format);
    } else if (uri !== undefined && line !== undefined && character !== undefined) {
      // Position-based approach
      return await findReferencesByPosition(uri, line, character, includeDeclaration, format);
    } else {
      return {
        error: 'Either provide a symbol name OR uri with line and character position',
      };
    }
  },
};

// Helper function for position-based lookup
async function findReferencesByPosition(
  uri: string,
  line: number,
  character: number,
  includeDeclaration: boolean,
  format: 'compact' | 'detailed'
): Promise<any> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
  const position = new vscode.Position(line, character);

  const references = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    document.uri,
    position
  );

  if (!references || references.length === 0) {
    return { references: [] };
  }

  // Filter out declaration if requested
  let filteredRefs = references;
  if (!includeDeclaration) {
    // Try to find and remove the declaration
    const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      document.uri,
      position
    );

    if (definitions && definitions.length > 0) {
      filteredRefs = references.filter((ref) => {
        if (!ref || !ref.uri || !ref.range) return true; // Keep malformed references
        return !definitions.some((def) => {
          if (!def || !def.uri || !def.range) return false;
          return def.uri.toString() === ref.uri.toString() && def.range.isEqual(ref.range);
        });
      });
    }
  }

  return {
    references:
      format === 'compact'
        ? filteredRefs
            .filter((ref) => ref && ref.uri && ref.range)
            .map((ref) => [
              ref.uri.toString(),
              ref.range.start.line,
              ref.range.start.character,
              ref.range.end.line,
              ref.range.end.character,
            ])
        : filteredRefs
            .filter((ref) => ref && ref.uri && ref.range)
            .map((ref) => ({
              uri: ref.uri.toString(),
              range: {
                start: { line: ref.range.start.line, character: ref.range.start.character },
                end: { line: ref.range.end.line, character: ref.range.end.character },
              },
            })),
  };
}

// Helper function for symbol-based lookup (AI-friendly)
async function findReferencesBySymbol(
  symbolName: string,
  includeDeclaration: boolean,
  format: 'compact' | 'detailed'
): Promise<any> {
  // Parse symbol name (e.g., "ClassName.methodName" or just "functionName")
  const parts = symbolName.split('.');
  const primarySymbol = parts[0];
  const memberSymbol = parts[1];

  // Search for the symbol in the workspace
  const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    primarySymbol
  );

  if (!symbols || symbols.length === 0) {
    return {
      symbol: symbolName,
      message: `Symbol '${symbolName}' not found in workspace`,
      references: [],
    };
  }

  // Filter to find exact matches (not partial)
  // Note: VS Code may append () to function names, so we need to handle that
  const exactMatches = symbols.filter((sym) => {
    const baseName = sym.name.replace(/\(\)$/, ''); // Remove trailing ()
    return baseName === primarySymbol;
  });
  const matchesToUse = exactMatches.length > 0 ? exactMatches : symbols;

  const allReferences: any[] = [];
  const processedLocations = new Set<string>();

  for (const sym of matchesToUse) {
    try {
      let targetPosition: vscode.Position;
      let targetUri: vscode.Uri;

      // If looking for a member (e.g., ClassName.methodName)
      if (memberSymbol) {
        // For class members, we need to find the member within the class
        const document = await vscode.workspace.openTextDocument(sym.location.uri);

        // Get document symbols to find the member
        const docSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider',
          document.uri
        );

        if (docSymbols) {
          // Find the class/container
          const container = findSymbolByName(docSymbols, primarySymbol);
          if (container && container.children) {
            // Find the member within the container
            const member = findSymbolByName(container.children, memberSymbol);
            if (member) {
              targetPosition = member.range.start;
              targetUri = sym.location.uri;
            } else {
              continue; // Member not found in this container
            }
          } else {
            continue; // Container not found
          }
        } else {
          continue; // No document symbols
        }
      } else {
        // For standalone symbols, use the symbol location directly
        targetPosition = sym.location.range.start;
        targetUri = sym.location.uri;
      }

      // Find references from this position
      const references = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        targetUri,
        targetPosition
      );

      if (references && references.length > 0) {
        // Filter out declaration if requested
        let filteredRefs = references;
        if (!includeDeclaration) {
          const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            targetUri,
            targetPosition
          );

          if (definitions && definitions.length > 0) {
            filteredRefs = references.filter((ref) => {
              if (!ref || !ref.uri || !ref.range) return true;
              return !definitions.some((def) => {
                if (!def || !def.uri || !def.range) return false;
                return def.uri.toString() === ref.uri.toString() && def.range.isEqual(ref.range);
              });
            });
          }
        }

        // Add references, avoiding duplicates
        for (const ref of filteredRefs) {
          if (!ref || !ref.uri || !ref.range) continue;

          const locationKey = `${ref.uri.toString()}:${ref.range.start.line}:${ref.range.start.character}`;
          if (!processedLocations.has(locationKey)) {
            processedLocations.add(locationKey);

            // Get the relative path for display
            const relativePath = vscode.workspace.asRelativePath(ref.uri);

            if (format === 'compact') {
              allReferences.push([
                relativePath,
                ref.range.start.line,
                ref.range.start.character,
                ref.range.end.line,
                ref.range.end.character,
              ]);
            } else {
              allReferences.push({
                uri: ref.uri.toString(),
                file: relativePath,
                line: ref.range.start.line,
                range: {
                  start: { line: ref.range.start.line, character: ref.range.start.character },
                  end: { line: ref.range.end.line, character: ref.range.end.character },
                },
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip symbols that can't be processed
      console.error(`Error processing symbol ${sym.name}:`, error);
    }
  }

  return {
    symbol: symbolName,
    totalReferences: allReferences.length,
    references: allReferences,
  };
}

// Helper function to find a symbol by name in document symbols
function findSymbolByName(
  symbols: vscode.DocumentSymbol[],
  name: string
): vscode.DocumentSymbol | undefined {
  for (const symbol of symbols) {
    if (symbol.name === name) {
      return symbol;
    }
    if (symbol.children) {
      const found = findSymbolByName(symbol.children, name);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}
