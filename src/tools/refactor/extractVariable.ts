import * as vscode from 'vscode';
import { Tool } from '../types';

export const refactor_extractVariableTool: Tool = {
  name: 'refactor_extractVariable',
  description: 'Extract selected expression into a new variable',
  inputSchema: {
    type: 'object',
    properties: {
      uri: {
        type: 'string',
        description: 'The file URI containing the expression to extract',
      },
      startLine: {
        type: 'number',
        description: 'The 0-based start line of the expression',
      },
      startCharacter: {
        type: 'number',
        description: 'The 0-based start character of the expression',
      },
      endLine: {
        type: 'number',
        description: 'The 0-based end line of the expression',
      },
      endCharacter: {
        type: 'number',
        description: 'The 0-based end character of the expression',
      },
      variableName: {
        type: 'string',
        description:
          'The name for the extracted variable (optional - will use default if not provided)',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['uri', 'startLine', 'startCharacter', 'endLine', 'endCharacter'],
  },
  handler: async (args: any) => {
    const {
      uri,
      startLine,
      startCharacter,
      endLine,
      endCharacter,
      variableName,
      format = 'compact',
    } = args;

    try {
      const fileUri = vscode.Uri.parse(uri);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        return { error: `File not found: ${uri}` };
      }

      // Open the document
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document);

      // Set selection
      const startPos = new vscode.Position(startLine, startCharacter);
      const endPos = new vscode.Position(endLine, endCharacter);
      const selection = new vscode.Selection(startPos, endPos);
      editor.selection = selection;

      // Try to get code actions for extract variable
      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        fileUri,
        selection,
        vscode.CodeActionKind.RefactorExtract
      );

      if (!codeActions || codeActions.length === 0) {
        return { error: 'No extract variable refactoring available for the selected expression' };
      }

      // Find the extract variable/constant action
      const extractAction = codeActions.find(
        (action) =>
          action.title.toLowerCase().includes('extract') &&
          (action.title.toLowerCase().includes('variable') ||
            action.title.toLowerCase().includes('constant') ||
            action.title.toLowerCase().includes('local'))
      );

      if (!extractAction) {
        return { error: 'Extract variable refactoring not available for this selection' };
      }

      // Apply the code action
      if (extractAction.edit) {
        const success = await vscode.workspace.applyEdit(extractAction.edit);
        if (!success) {
          return { error: 'Failed to apply extract variable refactoring' };
        }
      } else if (extractAction.command) {
        await vscode.commands.executeCommand(
          extractAction.command.command,
          ...(extractAction.command.arguments || [])
        );
      } else {
        return { error: 'Extract variable action has no edit or command' };
      }

      // Save the document
      await document.save();

      const extractedExpression = document.getText(selection);

      if (format === 'compact') {
        return {
          success: true,
          extracted: {
            expression:
              extractedExpression.length > 50
                ? extractedExpression.substring(0, 50) + '...'
                : extractedExpression,
            variableNameSuggested: variableName || 'extractedVar',
          },
          message: 'Expression extracted to variable successfully.',
        };
      }

      return {
        success: true,
        extracted: {
          expression: extractedExpression,
          range: {
            start: { line: startLine, character: startCharacter },
            end: { line: endLine, character: endCharacter },
          },
          variableNameSuggested: variableName || 'extractedVar',
        },
        file: vscode.workspace.asRelativePath(fileUri),
        message:
          'Expression extracted to variable successfully. The exact variable name and type depend on the language server implementation.',
      };
    } catch (error: any) {
      return { error: error.message || 'Unknown error during extract variable operation' };
    }
  },
};
