import * as vscode from 'vscode';

/**
 * Unified symbol provider with cold start handling
 *
 * This module provides a consistent way to search for symbols across the workspace
 * with automatic retry logic for language server cold starts.
 */

// Track which languages have been successfully queried within this session
const initializedLanguages = new Set<string>();

// Track if we've done initial language server check in this session
let hasCheckedLanguageServers = false;

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
  // Check if language servers are ready on first call
  if (!hasCheckedLanguageServers && maxRetries > 0) {
    await ensureLanguageServersReady();
    hasCheckedLanguageServers = true;
  }

  // Now search for the specific symbol
  let symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    query
  );

  // If no results and we haven't retried yet, the language server might still be initializing
  if ((!symbols || symbols.length === 0) && maxRetries > 0) {
    const retryDelays = [1000, 3000, 10000]; // Progressive delays

    for (let retry = 0; retry < Math.min(maxRetries, retryDelays.length); retry++) {
      await new Promise((resolve) => setTimeout(resolve, retryDelays[retry]));

      symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        query
      );

      if (symbols && symbols.length > 0) {
        break;
      }
    }
  }

  // If we get results, mark languages as initialized
  if (symbols && symbols.length > 0) {
    for (const symbol of symbols) {
      try {
        const document = await vscode.workspace.openTextDocument(symbol.location.uri);
        initializedLanguages.add(document.languageId);
      } catch {
        // Skip if can't open document
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
  hasCheckedLanguageServers = false;
}

/**
 * Check if a language has been successfully initialized
 */
export function isLanguageInitialized(languageId: string): boolean {
  return initializedLanguages.has(languageId);
}

/**
 * Ensure language servers are ready by searching for common symbols
 * This triggers language server initialization if needed
 */
async function ensureLanguageServersReady(): Promise<void> {
  // First, try to open some workspace files to trigger language server activation
  const workspaceFiles = await vscode.workspace.findFiles(
    '**/*.{ts,js,py,java,cs,go,rs,rb,php,cpp,c}',
    '**/node_modules/**',
    10
  );

  if (workspaceFiles.length > 0) {
    // Open a few files to trigger language servers
    for (let i = 0; i < Math.min(3, workspaceFiles.length); i++) {
      try {
        const document = await vscode.workspace.openTextDocument(workspaceFiles[i]);
        await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
        initializedLanguages.add(document.languageId);
      } catch {
        // Skip if can't open document
      }
    }

    // Give language servers a moment to activate
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Try to find any symbols to trigger language server initialization
  // Using empty string or common patterns to get some results
  const commonQueries = ['', 'constructor', 'main', 'init', 'test', 'class', 'function'];
  const retryDelays = [1000, 3000, 10000]; // Progressive delays

  for (const searchQuery of commonQueries) {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      searchQuery
    );

    // If we got any results, language servers are ready
    if (symbols && symbols.length > 0) {
      for (const symbol of symbols) {
        try {
          const document = await vscode.workspace.openTextDocument(symbol.location.uri);
          initializedLanguages.add(document.languageId);
        } catch {
          // Skip if can't open document
        }
      }
      return; // Language servers are ready
    }
  }

  // If no results from common queries, retry with delays
  for (let retry = 0; retry < retryDelays.length; retry++) {
    await new Promise((resolve) => setTimeout(resolve, retryDelays[retry]));

    // Try with empty string to get all symbols
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      ''
    );

    if (symbols && symbols.length > 0) {
      for (const symbol of symbols) {
        try {
          const document = await vscode.workspace.openTextDocument(symbol.location.uri);
          initializedLanguages.add(document.languageId);
        } catch {
          // Skip if can't open document
        }
      }
      return; // Language servers are ready
    }
  }
}
