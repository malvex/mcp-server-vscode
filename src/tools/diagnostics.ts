import * as vscode from 'vscode';
import { Tool } from './types';

export const diagnosticsTool: Tool = {
  name: 'diagnostics',
  description:
    'Get diagnostics (errors, warnings, info) for a file or entire workspace. Instantly see all problems without running builds - includes type errors, linting issues, and more',
  inputSchema: {
    type: 'object',
    properties: {
      uri: {
        type: 'string',
        description: 'File URI (optional - if not provided, returns all workspace diagnostics)',
      },
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: [],
  },
  handler: async (args) => {
    const { uri, format = 'compact' } = args;

    if (uri) {
      // Get diagnostics for specific file
      const fileUri = vscode.Uri.parse(uri);
      const diagnostics = vscode.languages.getDiagnostics(fileUri);

      return {
        diagnostics:
          format === 'compact'
            ? diagnostics.map((diag) => [
                vscode.DiagnosticSeverity[diag.severity].toLowerCase(),
                diag.message,
                diag.range.start.line + 1,
                diag.range.start.character,
                diag.range.end.line + 1,
                diag.range.end.character,
                diag.source || '',
                diag.code || '',
              ])
            : diagnostics.map((diag) => ({
                severity: vscode.DiagnosticSeverity[diag.severity],
                message: diag.message,
                range: {
                  start: { line: diag.range.start.line + 1, character: diag.range.start.character },
                  end: { line: diag.range.end.line + 1, character: diag.range.end.character },
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
          result[uri.toString()] =
            format === 'compact'
              ? diagnostics.map((diag) => [
                  vscode.DiagnosticSeverity[diag.severity].toLowerCase(),
                  diag.message,
                  diag.range.start.line + 1,
                  diag.range.start.character,
                  diag.range.end.line + 1,
                  diag.range.end.character,
                  diag.source || '',
                  diag.code || '',
                ])
              : diagnostics.map((diag) => ({
                  severity: vscode.DiagnosticSeverity[diag.severity],
                  message: diag.message,
                  range: {
                    start: {
                      line: diag.range.start.line + 1,
                      character: diag.range.start.character,
                    },
                    end: { line: diag.range.end.line + 1, character: diag.range.end.character },
                  },
                  source: diag.source,
                  code: diag.code,
                }));
        }
      }

      if (format === 'compact' && Object.keys(result).length > 0) {
        return {
          diagnosticFormat:
            '[severity, message, startLine, startColumn, endLine, endColumn, source, code]',
          diagnostics: result,
        };
      }
      return { diagnostics: result };
    }
  },
};
