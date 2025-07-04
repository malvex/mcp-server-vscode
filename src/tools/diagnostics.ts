import * as vscode from 'vscode';
import { Tool } from './types';

export const diagnosticsTool: Tool = {
  name: 'diagnostics',
  description: 'Get diagnostics (errors, warnings, info) for a file or entire workspace',
  inputSchema: {
    type: 'object',
    properties: {
      uri: {
        type: 'string',
        description: 'File URI (optional - if not provided, returns all workspace diagnostics)',
      },
    },
    required: [],
  },
  handler: async (args) => {
    const { uri } = args;

    if (uri) {
      // Get diagnostics for specific file
      const fileUri = vscode.Uri.parse(uri);
      const diagnostics = vscode.languages.getDiagnostics(fileUri);

      return {
        diagnostics: diagnostics.map((diag) => ({
          severity: vscode.DiagnosticSeverity[diag.severity],
          message: diag.message,
          range: {
            start: { line: diag.range.start.line, character: diag.range.start.character },
            end: { line: diag.range.end.line, character: diag.range.end.character },
          },
          source: diag.source,
          code: diag.code,
        })),
      };
    } else {
      // Get all workspace diagnostics
      const allDiagnostics = vscode.languages.getDiagnostics();
      const result: any = {};

      for (const [uri, diagnostics] of allDiagnostics) {
        if (diagnostics.length > 0) {
          result[uri.toString()] = diagnostics.map((diag) => ({
            severity: vscode.DiagnosticSeverity[diag.severity],
            message: diag.message,
            range: {
              start: { line: diag.range.start.line, character: diag.range.start.character },
              end: { line: diag.range.end.line, character: diag.range.end.character },
            },
            source: diag.source,
            code: diag.code,
          }));
        }
      }

      return { diagnostics: result };
    }
  },
};
