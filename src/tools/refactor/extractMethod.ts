import * as vscode from 'vscode';
import { Tool } from '../types';
import { searchWorkspaceSymbols } from '../utils/symbolProvider';

export const refactor_extractMethodTool: Tool = {
  name: 'refactor_extractMethod',
  description: 'Extract code into a new method/function',
  inputSchema: {
    type: 'object',
    properties: {
      containingFunction: {
        type: 'string',
        description: 'Name of the function/method containing the code to extract',
      },
      codePattern: {
        type: 'string',
        description:
          'Unique code snippet or pattern to identify what to extract (first few tokens)',
      },
      methodName: {
        type: 'string',
        description: 'Name for the extracted method',
      },
      uri: {
        type: 'string',
        description: 'Optional: File URI to disambiguate if function exists in multiple files',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['containingFunction', 'codePattern', 'methodName'],
  },
  handler: async (args: any) => {
    const {
      containingFunction,
      codePattern,
      methodName,
      uri: providedUri,
      format = 'compact',
    } = args;

    try {
      // Find the containing function
      const searchResult = await searchWorkspaceSymbols(containingFunction);

      if (!searchResult || searchResult.length === 0) {
        return {
          error: `No function found with name '${containingFunction}'`,
          hint: 'Check the function name spelling or provide the full qualified name.',
        };
      }

      // Filter by URI if provided
      let matches = searchResult;
      if (providedUri) {
        const targetUri = vscode.Uri.parse(providedUri);
        matches = searchResult.filter((s) => s.location.uri.toString() === targetUri.toString());
      }

      // Handle multiple matches
      if (matches.length > 1) {
        return {
          multipleMatches: true,
          matchCount: matches.length,
          matches: matches.slice(0, 5).map((m, i) => ({
            function: {
              name: m.name,
              kind: vscode.SymbolKind[m.kind],
              file: vscode.workspace.asRelativePath(m.location.uri),
              line: m.location.range.start.line,
            },
            match: i + 1,
          })),
          hint: 'Multiple functions found. Provide file URI to disambiguate.',
        };
      }

      const functionSymbol = matches[0];
      const document = await vscode.workspace.openTextDocument(functionSymbol.location.uri);
      const editor = await vscode.window.showTextDocument(document);

      // Find the code pattern within the function
      const functionStart = functionSymbol.location.range.start.line;
      const functionEnd = functionSymbol.location.range.end.line;

      let patternStart: vscode.Position | null = null;
      let patternEnd: vscode.Position | null = null;

      // Search for the code pattern
      const normalizedPattern = codePattern.trim().toLowerCase();

      for (let line = functionStart; line <= functionEnd; line++) {
        const lineText = document.lineAt(line).text;
        const normalizedLine = lineText.trim().toLowerCase();

        if (normalizedLine.includes(normalizedPattern)) {
          patternStart = new vscode.Position(line, lineText.indexOf(lineText.trim()));

          // Try to find a reasonable end (look for complete statements)
          let endLine = line;
          let braceCount = 0;
          let inString = false;

          for (let searchLine = line; searchLine <= functionEnd; searchLine++) {
            const searchText = document.lineAt(searchLine).text;

            for (const char of searchText) {
              if (char === '"' || char === "'") inString = !inString;
              if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
              }
            }

            // End at semicolon or closing brace when balanced
            if (braceCount === 0 && (searchText.includes(';') || searchText.includes('}'))) {
              endLine = searchLine;
              patternEnd = new vscode.Position(endLine, searchText.length);
              break;
            }
          }

          if (!patternEnd) {
            patternEnd = new vscode.Position(endLine, document.lineAt(endLine).text.length);
          }

          break;
        }
      }

      if (!patternStart || !patternEnd) {
        return {
          error: `Code pattern '${codePattern}' not found in function '${containingFunction}'`,
          functionLocation: {
            file: vscode.workspace.asRelativePath(functionSymbol.location.uri),
            startLine: functionStart,
            endLine: functionEnd,
          },
          hint: 'Provide a unique code snippet from the beginning of the code you want to extract.',
        };
      }

      // Set selection
      const selection = new vscode.Selection(patternStart, patternEnd);
      editor.selection = selection;

      // Try to get code actions for extract method
      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        functionSymbol.location.uri,
        selection,
        vscode.CodeActionKind.RefactorExtract.value
      );

      if (!codeActions || codeActions.length === 0) {
        return {
          error: 'No extract method refactoring available for the selected code',
          selectedCode: {
            startLine: patternStart.line,
            endLine: patternEnd.line,
            preview: document.getText(selection).substring(0, 100) + '...',
          },
          hint: 'The selected code might not be extractable (e.g., incomplete statement).',
        };
      }

      // Find the extract method/function action
      const extractAction = codeActions.find(
        (action) =>
          action.title.toLowerCase().includes('extract') &&
          (action.title.toLowerCase().includes('method') ||
            action.title.toLowerCase().includes('function'))
      );

      if (!extractAction) {
        return {
          error: 'Extract method refactoring not available for this selection',
          availableActions: codeActions.map((a) => a.title),
        };
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
      const linesExtracted = patternEnd.line - patternStart.line + 1;

      if (format === 'compact') {
        return {
          success: true,
          extracted: {
            fromFunction: containingFunction,
            linesExtracted,
            methodNameSuggested: methodName,
          },
          message:
            'Code extracted successfully. Note: Exact method name depends on language server.',
        };
      }

      return {
        success: true,
        extracted: {
          fromFunction: {
            name: containingFunction,
            file: vscode.workspace.asRelativePath(functionSymbol.location.uri),
            line: functionStart,
          },
          code: extractedCode.substring(0, 200) + (extractedCode.length > 200 ? '...' : ''),
          range: {
            start: { line: patternStart.line, character: patternStart.character },
            end: { line: patternEnd.line, character: patternEnd.character },
          },
          linesExtracted,
          methodNameSuggested: methodName,
        },
        message:
          'Code extracted successfully. The exact method name and location depend on the language server.',
      };
    } catch (error: any) {
      return {
        error: error.message || 'Unknown error during extract method operation',
        hint: 'Ensure the function name and code pattern are correct.',
      };
    }
  },
};
