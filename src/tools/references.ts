import * as vscode from 'vscode';
import { Tool } from './types';

export const referencesTool: Tool = {
  name: 'references',
  description: 'Find all references to a symbol at a specific position',
  inputSchema: {
    type: 'object',
    properties: {
      uri: { type: 'string', description: 'File URI' },
      line: { type: 'number', description: 'Line number (0-based)' },
      character: { type: 'number', description: 'Character position (0-based)' },
      includeDeclaration: {
        type: 'boolean',
        description: 'Include the declaration in results (default: true)',
      },
    },
    required: ['uri', 'line', 'character'],
  },
  handler: async (args) => {
    const { uri, line, character, includeDeclaration = true } = args;

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
      references: filteredRefs
        .filter((ref) => ref && ref.uri && ref.range) // Filter out malformed results
        .map((ref) => ({
          uri: ref.uri.toString(),
          range: {
            start: { line: ref.range.start.line, character: ref.range.start.character },
            end: { line: ref.range.end.line, character: ref.range.end.character },
          },
        })),
    };
  },
};
