import * as vscode from 'vscode';
import { Tool } from './types';

export const callHierarchyTool: Tool = {
  name: 'callHierarchy',
  description: 'Get call hierarchy - see what calls a function and what it calls',
  inputSchema: {
    type: 'object',
    properties: {
      uri: { type: 'string', description: 'File URI' },
      line: { type: 'number', description: 'Line number (0-based)' },
      character: { type: 'number', description: 'Character position (0-based)' },
      direction: {
        type: 'string',
        enum: ['incoming', 'outgoing'],
        description: 'Get incoming calls (callers) or outgoing calls',
      },
    },
    required: ['uri', 'line', 'character', 'direction'],
  },
  handler: async (args) => {
    const { uri, line, character, direction } = args;

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
    const position = new vscode.Position(line, character);

    // Get call hierarchy items at position
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      document.uri,
      position
    );

    if (!items || items.length === 0) {
      return { calls: [] };
    }

    const item = items[0]; // Usually there's only one item at a position

    if (direction === 'incoming') {
      // Get incoming calls (who calls this function)
      const incomingCalls = await vscode.commands.executeCommand<
        vscode.CallHierarchyIncomingCall[]
      >('vscode.provideIncomingCalls', item);

      return {
        calls:
          incomingCalls?.map((call) => ({
            from: {
              name: call.from.name,
              kind: vscode.SymbolKind[call.from.kind],
              uri: call.from.uri.toString(),
              range: {
                start: {
                  line: call.from.range.start.line,
                  character: call.from.range.start.character,
                },
                end: { line: call.from.range.end.line, character: call.from.range.end.character },
              },
            },
            fromRanges: call.fromRanges.map((range) => ({
              start: { line: range.start.line, character: range.start.character },
              end: { line: range.end.line, character: range.end.character },
            })),
          })) || [],
      };
    } else {
      // Get outgoing calls (what this function calls)
      const outgoingCalls = await vscode.commands.executeCommand<
        vscode.CallHierarchyOutgoingCall[]
      >('vscode.provideOutgoingCalls', item);

      return {
        calls:
          outgoingCalls?.map((call) => ({
            to: {
              name: call.to.name,
              kind: vscode.SymbolKind[call.to.kind],
              uri: call.to.uri.toString(),
              range: {
                start: { line: call.to.range.start.line, character: call.to.range.start.character },
                end: { line: call.to.range.end.line, character: call.to.range.end.character },
              },
            },
            fromRanges: call.fromRanges.map((range) => ({
              start: { line: range.start.line, character: range.start.character },
              end: { line: range.end.line, character: range.end.character },
            })),
          })) || [],
      };
    }
  },
};
