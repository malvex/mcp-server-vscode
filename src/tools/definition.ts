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

    console.log(`[definition] Looking for definition at ${uri} line ${line}, char ${character}`);

    const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      document.uri,
      position
    );

    console.log(`[definition] Found ${definitions?.length || 0} definitions`);

    if (!definitions || definitions.length === 0) {
      return { definitions: [] };
    }

    return {
      definitions: definitions
        .filter((def) => def && def.uri && def.range) // Filter out malformed results
        .map((def) => ({
          uri: def.uri.toString(),
          range: {
            start: { line: def.range.start.line, character: def.range.start.character },
            end: { line: def.range.end.line, character: def.range.end.character },
          },
        })),
    };
  },
};
