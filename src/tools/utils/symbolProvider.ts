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

// Configurable retry delays - can be overridden for testing
export let retryDelays = [1000, 3000, 10000]; // Default: progressive delays

/**
 * Set custom retry delays (useful for testing)
 */
export function setRetryDelays(delays: number[]): void {
  retryDelays = delays;
}

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
    // Instead of blind retries, check if language server is actually processing
    for (let retry = 0; retry < Math.min(maxRetries, retryDelays.length); retry++) {
      // Check if we can get any symbols at all (empty query returns all symbols)
      const allSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        ''
      );

      // If we can't get any symbols, language server isn't ready yet
      if (!allSymbols || allSymbols.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[retry]));
        continue;
      }

      // Language server is ready, try our specific query again
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

/**
 * Find a symbol by name in a document's symbol tree
 * Handles both simple names and qualified names (e.g., "ClassName.methodName")
 */
export function findSymbolByName(
  symbols: vscode.DocumentSymbol[],
  targetName: string
): vscode.DocumentSymbol | undefined {
  for (const symbol of symbols) {
    // Direct match
    if (symbol.name === targetName) {
      return symbol;
    }

    // Check children recursively
    if (symbol.children && symbol.children.length > 0) {
      const found = findSymbolByName(symbol.children, targetName);
      if (found) return found;
    }
  }
  return undefined;
}

export async function findSymbolInWorkspace(
  symbolName: string
): Promise<vscode.SymbolInformation[]> {
  // Use searchWorkspaceSymbols for cold start handling
  let symbols = await searchWorkspaceSymbols(symbolName);

  // Filter for exact matches
  symbols = symbols.filter((s) => {
    // For method notation like "ClassName.methodName"
    if (symbolName.includes('.')) {
      const [className, methodName] = symbolName.split('.');
      // Handle both "methodName" and "methodName()"
      const nameMatch =
        s.name === methodName ||
        s.name === methodName + '()' ||
        s.name === methodName.replace('()', '');
      return nameMatch && s.containerName === className;
    }
    // For simple names - handle both with and without parentheses
    return (
      s.name === symbolName ||
      s.name === symbolName + '()' ||
      s.name === symbolName.replace('()', '')
    );
  });

  // If no exact match and contains dot, try just the method name
  if (symbols.length === 0 && symbolName.includes('.')) {
    const methodName = symbolName.split('.').pop()!;
    const className = symbolName.split('.')[0];
    symbols = await searchWorkspaceSymbols(methodName);
    symbols = symbols.filter((s) => s.name === methodName && s.containerName === className);
  }

  return symbols;
}
