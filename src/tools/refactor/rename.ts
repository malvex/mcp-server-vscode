import * as vscode from 'vscode';
import { Tool } from '../types';

export const refactor_renameTool: Tool = {
  name: 'refactor_rename',
  description:
    'Rename a symbol (variable, function, class, etc.) across all files in the workspace',
  inputSchema: {
    type: 'object',
    properties: {
      uri: {
        type: 'string',
        description: 'The file URI containing the symbol to rename',
      },
      line: {
        type: 'number',
        description: 'The 0-based line number of the symbol',
      },
      character: {
        type: 'number',
        description: 'The 0-based character position of the symbol',
      },
      newName: {
        type: 'string',
        description: 'The new name for the symbol',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['uri', 'line', 'character', 'newName'],
  },
  handler: async (args: any) => {
    const { uri, line, character, newName, format = 'compact' } = args;

    try {
      const fileUri = vscode.Uri.parse(uri);
      const position = new vscode.Position(line, character);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        return { error: `File not found: ${uri}` };
      }

      // Open the document to ensure it's loaded
      const document = await vscode.workspace.openTextDocument(fileUri);

      // Prepare rename edit using VS Code's rename provider
      const renameEdit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        'vscode.executeDocumentRenameProvider',
        fileUri,
        position,
        newName
      );

      if (!renameEdit) {
        return {
          error: 'No rename provider available or symbol cannot be renamed at this location',
        };
      }

      // Preview the changes
      const editEntries = Array.from(renameEdit.entries());
      const changes = editEntries.map(([uri, edits]) => ({
        file: vscode.workspace.asRelativePath(uri),
        edits: edits.map((edit) => ({
          startLine: edit.range.start.line,
          startChar: edit.range.start.character,
          endLine: edit.range.end.line,
          endChar: edit.range.end.character,
          newText: edit.newText,
        })),
      }));

      // Apply the rename
      const success = await vscode.workspace.applyEdit(renameEdit);

      if (!success) {
        return { error: 'Failed to apply rename operation' };
      }

      // Save all affected documents
      await vscode.workspace.saveAll(false);

      if (format === 'compact') {
        return {
          success: true,
          renamedSymbol: {
            oldName: document.getText(document.getWordRangeAtPosition(position)),
            newName,
          },
          filesChanged: changes.length,
          totalEdits: changes.reduce((sum, file) => sum + file.edits.length, 0),
        };
      }

      return {
        success: true,
        renamedSymbol: {
          oldName: document.getText(document.getWordRangeAtPosition(position)),
          newName,
          location: { uri, line, character },
        },
        changes,
      };
    } catch (error: any) {
      return { error: error.message || 'Unknown error during rename operation' };
    }
  },
};
