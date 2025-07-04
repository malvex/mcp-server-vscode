import * as vscode from 'vscode';
import { Tool } from './types';

export const definitionTool: Tool = {
  name: 'definition',
  description: 'Find the definition of a symbol at a specific position',
  inputSchema: {
    type: 'object',
    properties: {
      uri: { type: 'string', description: 'File URI' },
      line: { type: 'number', description: 'Line number (0-based)' },
      character: { type: 'number', description: 'Character position (0-based)' },
    },
    required: ['uri', 'line', 'character'],
  },
  handler: async (args) => {
    const { uri, line, character } = args;

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
        return null;
      })
      .filter(Boolean);

    return { definitions: normalized };
  },
};
