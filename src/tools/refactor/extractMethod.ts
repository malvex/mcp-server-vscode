import * as vscode from 'vscode';
import { Tool } from '../types';

export const refactor_extractMethodTool: Tool = {
  name: 'refactor_extractMethod',
  description: 'Extract selected code into a new method/function',
  inputSchema: {
    type: 'object',
    properties: {
      uri: {
        type: 'string',
        description: 'The file URI containing the code to extract',
      },
      startLine: {
        type: 'number',
        description: 'The 0-based start line of the selection',
      },
      startCharacter: {
        type: 'number',
        description: 'The 0-based start character of the selection',
      },
      endLine: {
        type: 'number',
        description: 'The 0-based end line of the selection',
      },
      endCharacter: {
        type: 'number',
        description: 'The 0-based end character of the selection',
      },
      methodName: {
        type: 'string',
        description: 'The name for the extracted method (optional - will prompt if not provided)',
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
      methodName,
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

      // Try to get code actions for extract method
      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        fileUri,
        selection,
        vscode.CodeActionKind.RefactorExtract.value
      );

      if (!codeActions || codeActions.length === 0) {
        return { error: 'No extract method refactoring available for the selected code' };
      }

      // Find the extract method/function action
      const extractAction = codeActions.find(
        (action) =>
          action.title.toLowerCase().includes('extract') &&
          (action.title.toLowerCase().includes('method') ||
            action.title.toLowerCase().includes('function'))
      );

      if (!extractAction) {
        return { error: 'Extract method refactoring not available for this selection' };
      }

      // Apply the code action
      if (extractAction.edit) {
        const success = await vscode.workspace.applyEdit(extractAction.edit);
        if (!success) {
          return { error: 'Failed to apply extract method refactoring' };
        }
      } else if (extractAction.command) {
        await vscode.commands.executeCommand(
          extractAction.command.command,
          ...(extractAction.command.arguments || [])
        );
      } else {
        return { error: 'Extract method action has no edit or command' };
      }

      // Save the document
      await document.save();

      const extractedCode = document.getText(selection);

      if (format === 'compact') {
        return {
          success: true,
          extracted: {
            linesExtracted: endLine - startLine + 1,
            methodNameSuggested: methodName || 'extractedMethod',
          },
          message:
            'Code extracted successfully. Note: Method name may need to be updated manually.',
        };
      }

      return {
        success: true,
        extracted: {
          code: extractedCode,
          range: {
            start: { line: startLine, character: startCharacter },
            end: { line: endLine, character: endCharacter },
          },
          methodNameSuggested: methodName || 'extractedMethod',
        },
        file: vscode.workspace.asRelativePath(fileUri),
        message:
          'Code extracted successfully. The exact method name and location depend on the language server implementation.',
      };
    } catch (error: any) {
      return { error: error.message || 'Unknown error during extract method operation' };
    }
  },
};
