import * as vscode from 'vscode';

/**
 * Wait for language server to be ready for a document by checking if language features are available
 */
export async function waitForLanguageServer(
  document: vscode.TextDocument,
  maxAttempts: number = 20,
  delayMs: number = 200
): Promise<boolean> {
  // First ensure TypeScript extension is active
  const tsExt = vscode.extensions.getExtension('vscode.typescript-language-features');
  if (tsExt && !tsExt.isActive) {
    await tsExt.activate();
  }

  // Poll for language feature availability
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Try to get document symbols - this requires language server to be ready
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      // If we got symbols (even empty array), language server is ready
      if (symbols !== undefined && symbols !== null) {
        return true;
      }
    } catch {
      // Command might fail if language server isn't ready yet
    }

    // Wait before next attempt (except on last attempt)
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Wait for language server to be ready for a workspace by checking multiple files
 */
export async function waitForWorkspaceReady(
  fileUris: vscode.Uri[],
  maxAttempts: number = 20,
  delayMs: number = 200
): Promise<boolean> {
  // Ensure TypeScript extension is active
  const tsExt = vscode.extensions.getExtension('vscode.typescript-language-features');
  if (tsExt && !tsExt.isActive) {
    await tsExt.activate();
  }

  // Open all documents first
  const documents = await Promise.all(
    fileUris.map((uri) => vscode.workspace.openTextDocument(uri))
  );

  // Show at least one document to trigger language server
  if (documents.length > 0) {
    await vscode.window.showTextDocument(documents[0], { preview: false, preserveFocus: true });
  }

  // Wait for at least one document to have symbols available
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const doc of documents) {
      try {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider',
          doc.uri
        );

        if (symbols !== undefined && symbols !== null) {
          // Found at least one ready document - language server is working
          return true;
        }
      } catch {
        // Continue to next document
      }
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Open a test file and wait for language server to be ready
 */
export async function openTestFileWithLanguageServer(
  uri: vscode.Uri
): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);

  const ready = await waitForLanguageServer(document);
  if (!ready) {
    console.warn(`Language server not ready for ${uri.fsPath} after timeout`);
  }

  return document;
}
