import * as vscode from 'vscode';
import { Tool } from './types';
import {
  searchWorkspaceSymbols,
  getDocumentSymbols,
  findSymbolByName,
} from './utils/symbolProvider';

export const referencesTool: Tool = {
  name: 'references',
  description:
    'Find all references to a symbol by name. Superior to grep - finds semantic references including imports, type usage, and renamed variables',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description:
          'Symbol name to find references for (e.g., "functionName", "ClassName", "ClassName.methodName")',
      },
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
    required: ['symbol'],
  },
  handler: async (args) => {
    const { symbol, includeDeclaration = true, format = 'compact' } = args;
    return await findReferencesBySymbol(symbol, includeDeclaration, format);
  },
};

// Helper function for symbol-based lookup
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
  const symbols = await searchWorkspaceSymbols(primarySymbol);

  if (!symbols || symbols.length === 0) {
    return {
      symbol: symbolName,
      message: `Symbol '${symbolName}' not found in workspace`,
      references: [],
      totalReferences: 0,
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
        const docSymbols = await getDocumentSymbols(document);

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
                ref.range.start.line + 1,
                ref.range.start.character,
                ref.range.end.line + 1,
                ref.range.end.character,
              ]);
            } else {
              allReferences.push({
                uri: ref.uri.toString(),
                file: relativePath,
                line: ref.range.start.line + 1,
                range: {
                  start: { line: ref.range.start.line + 1, character: ref.range.start.character },
                  end: { line: ref.range.end.line + 1, character: ref.range.end.character },
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

  // Add format description for compact mode
  if (format === 'compact' && allReferences.length > 0) {
    return {
      symbol: symbolName,
      totalReferences: allReferences.length,
      referenceFormat: '[filePath, startLine, startColumn, endLine, endColumn]',
      references: allReferences,
    };
  }

  return {
    symbol: symbolName,
    totalReferences: allReferences.length,
    references: allReferences,
  };
}
