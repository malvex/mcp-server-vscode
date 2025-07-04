import * as vscode from 'vscode';
import { Tool } from './types';

export const definitionTool: Tool = {
  name: 'definition',
  description: 'Find the definition of a symbol by name or at a specific position',
  inputSchema: {
    type: 'object',
    properties: {
      // Symbol-based approach (AI-friendly)
      symbol: {
        type: 'string',
        description:
          'Symbol name to find definition for (e.g., "functionName", "ClassName", "ClassName.methodName")',
      },

      // Position-based approach (kept for backward compatibility)
      uri: { type: 'string', description: 'File URI (required for position-based lookup)' },
      line: { type: 'number', description: 'Line number (0-based, required with uri)' },
      character: { type: 'number', description: 'Character position (0-based, required with uri)' },
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
    const { symbol, uri, line, character, format = 'compact' } = args;

    // Decide which approach to use
    if (symbol) {
      // AI-friendly symbol-based approach
      return await findDefinitionBySymbol(symbol, format);
    } else if (uri !== undefined && line !== undefined && character !== undefined) {
      // Position-based approach
      return await findDefinitionByPosition(uri, line, character, format);
    } else {
      return {
        error: 'Either provide a symbol name OR uri with line and character position',
      };
    }
  },
};

// Helper function for position-based lookup
async function findDefinitionByPosition(
  uri: string,
  line: number,
  character: number,
  format: 'compact' | 'detailed'
): Promise<any> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
  const position = new vscode.Position(line, character);

  const definitions = await vscode.commands.executeCommand<
    (vscode.Location | vscode.LocationLink)[]
  >('vscode.executeDefinitionProvider', document.uri, position);

  if (!definitions || definitions.length === 0) {
    return { definitions: [] };
  }

  // Handle both Location and LocationLink formats
  const normalized = definitions
    .map((def) => {
      if (format === 'compact') {
        if ('targetUri' in def) {
          // It's a LocationLink
          return [
            def.targetUri.toString(),
            def.targetRange.start.line,
            def.targetRange.start.character,
            def.targetRange.end.line,
            def.targetRange.end.character,
          ];
        } else if ('uri' in def) {
          // It's a Location
          return [
            def.uri.toString(),
            def.range.start.line,
            def.range.start.character,
            def.range.end.line,
            def.range.end.character,
          ];
        }
      } else {
        if ('targetUri' in def) {
          // It's a LocationLink
          return {
            uri: def.targetUri.toString(),
            range: {
              start: {
                line: def.targetRange.start.line,
                character: def.targetRange.start.character,
              },
              end: {
                line: def.targetRange.end.line,
                character: def.targetRange.end.character,
              },
            },
          };
        } else if ('uri' in def) {
          // It's a Location
          return {
            uri: def.uri.toString(),
            range: {
              start: {
                line: def.range.start.line,
                character: def.range.start.character,
              },
              end: {
                line: def.range.end.line,
                character: def.range.end.character,
              },
            },
          };
        }
      }
      return null;
    })
    .filter(Boolean);

  return { definitions: normalized };
}

// Helper function for symbol-based lookup (AI-friendly)
async function findDefinitionBySymbol(
  symbolName: string,
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
      definitions: [],
    };
  }

  // Filter to find exact matches (not partial)
  // Note: VS Code may append () to function names, so we need to handle that
  const exactMatches = symbols.filter((sym) => {
    const baseName = sym.name.replace(/\(\)$/, ''); // Remove trailing ()
    return baseName === primarySymbol;
  });
  const matchesToUse = exactMatches.length > 0 ? exactMatches : symbols;

  const allDefinitions: any[] = [];

  for (const sym of matchesToUse) {
    try {
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
              if (format === 'compact') {
                allDefinitions.push({
                  symbol: [
                    member.name,
                    vscode.SymbolKind[member.kind].toLowerCase(),
                    sym.location.uri.fsPath,
                    member.range.start.line,
                  ],
                  uri: sym.location.uri.toString(),
                  range: [
                    member.range.start.line,
                    member.range.start.character,
                    member.range.end.line,
                    member.range.end.character,
                  ],
                });
              } else {
                allDefinitions.push({
                  symbol: {
                    name: member.name,
                    kind: vscode.SymbolKind[member.kind],
                    container: container.name,
                    file: sym.location.uri.fsPath,
                    line: member.range.start.line,
                  },
                  uri: sym.location.uri.toString(),
                  range: {
                    start: {
                      line: member.range.start.line,
                      character: member.range.start.character,
                    },
                    end: {
                      line: member.range.end.line,
                      character: member.range.end.character,
                    },
                  },
                });
              }
            }
          }
        }
      } else {
        // For standalone symbols, use the symbol location directly
        if (format === 'compact') {
          allDefinitions.push({
            symbol: [
              sym.name,
              vscode.SymbolKind[sym.kind].toLowerCase(),
              sym.location.uri.fsPath,
              sym.location.range.start.line,
            ],
            uri: sym.location.uri.toString(),
            range: [
              sym.location.range.start.line,
              sym.location.range.start.character,
              sym.location.range.end.line,
              sym.location.range.end.character,
            ],
          });
        } else {
          allDefinitions.push({
            symbol: {
              name: sym.name,
              kind: vscode.SymbolKind[sym.kind],
              container: sym.containerName,
              file: sym.location.uri.fsPath,
              line: sym.location.range.start.line,
            },
            uri: sym.location.uri.toString(),
            range: {
              start: {
                line: sym.location.range.start.line,
                character: sym.location.range.start.character,
              },
              end: {
                line: sym.location.range.end.line,
                character: sym.location.range.end.character,
              },
            },
          });
        }
      }
    } catch (error) {
      // Skip symbols that can't be processed
      console.error(`Error processing symbol ${sym.name}:`, error);
    }
  }

  if (allDefinitions.length === 0) {
    return {
      symbol: symbolName,
      message: memberSymbol
        ? `Member '${memberSymbol}' not found in '${primarySymbol}'`
        : `No definition found for symbol '${symbolName}'`,
      definitions: [],
    };
  }

  // Return appropriate format based on number of matches
  if (allDefinitions.length === 1) {
    if (format === 'compact') {
      return {
        symbol: symbolName,
        ...allDefinitions[0],
        // Definition format - symbol: [name, kind, filePath, line], range: [startLine, startColumn, endLine, endColumn]
        definitions: [allDefinitions[0]],
      };
    } else {
      return {
        symbol: symbolName,
        ...allDefinitions[0],
        definitions: [allDefinitions[0]],
      };
    }
  } else {
    if (format === 'compact') {
      return {
        symbol: symbolName,
        multipleDefinitions: true,
        // Definition format - symbol: [name, kind, filePath, line], range: [startLine, startColumn, endLine, endColumn]
        definitions: allDefinitions,
      };
    } else {
      return {
        symbol: symbolName,
        multipleDefinitions: true,
        definitions: allDefinitions,
      };
    }
  }
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
