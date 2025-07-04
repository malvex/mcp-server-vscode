import * as vscode from 'vscode';

/**
 * Unified symbol provider with cold start handling
 *
 * This module provides a consistent way to search for symbols across the workspace
 * with automatic retry logic for language server cold starts.
 */

// Track which languages have been successfully queried
const initializedLanguages = new Set<string>();

/**
 * Search for workspace symbols with cold start handling
 *
 * @param query The symbol name to search for
 * @param maxRetries Maximum number of retries for cold start (default: 3)
 * @returns Array of symbol information or empty array if none found
 */
export async function searchWorkspaceSymbols(
  query: string,
  maxRetries: number = 3
): Promise<vscode.SymbolInformation[]> {
  // First attempt
  let symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    query
  );

  // If we get results, mark languages as initialized
  if (symbols && symbols.length > 0) {
    for (const symbol of symbols) {
      const document = await vscode.workspace.openTextDocument(symbol.location.uri);
      initializedLanguages.add(document.languageId);
    }
    return symbols;
  }

  // If no results and this is a common query pattern, try with cold start handling
  if (!symbols || symbols.length === 0) {
    // Only retry if we haven't initialized any language yet
    if (initializedLanguages.size === 0 && maxRetries > 0) {
      const retryDelays = [1000, 3000, 10000]; // Progressive delays

      for (let retry = 0; retry < Math.min(maxRetries, retryDelays.length); retry++) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[retry]));

        symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          query
        );

        if (symbols && symbols.length > 0) {
          // Mark languages as initialized
          for (const symbol of symbols) {
            const document = await vscode.workspace.openTextDocument(symbol.location.uri);
            initializedLanguages.add(document.languageId);
          }
          return symbols;
        }
      }
    }
  }

  return symbols || [];
}

/**
 * Get document symbols with cold start handling
 *
 * @param document The document to get symbols from
 * @returns Array of document symbols or null if language server not ready
 */
export async function getDocumentSymbols(
  document: vscode.TextDocument
): Promise<vscode.DocumentSymbol[] | null> {
  let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    document.uri
  );

  // Handle cold start for known languages
  if (
    (symbols === undefined || symbols === null) &&
    !initializedLanguages.has(document.languageId)
  ) {
    const knownLanguages = [
      'typescript',
      'javascript',
      'python',
      'java',
      'csharp',
      'go',
      'rust',
      'ruby',
      'php',
      'cpp',
      'c',
    ];

    if (knownLanguages.includes(document.languageId)) {
      // Progressive retry with increasing delays
      const retryDelays = [1000, 3000, 10000];

      for (let retry = 0; retry < retryDelays.length; retry++) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[retry]));

        symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider',
          document.uri
        );

        if (symbols !== undefined && symbols !== null) {
          initializedLanguages.add(document.languageId);
          break;
        }
      }
    }
  }

  // Mark language as initialized even if no symbols found (empty file)
  if (symbols !== undefined && symbols !== null) {
    initializedLanguages.add(document.languageId);
  }

  return symbols || null;
}

/**
 * Reset the initialized languages cache
 * (Useful for testing or when extensions are reloaded)
 */
export function resetInitializedLanguages(): void {
  initializedLanguages.clear();
}

/**
 * Check if a language has been successfully initialized
 */
export function isLanguageInitialized(languageId: string): boolean {
  return initializedLanguages.has(languageId);
}
