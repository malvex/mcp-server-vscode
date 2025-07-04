import * as vscode from 'vscode';
import * as path from 'path';
import { HTTPBridge } from '../../mcp/http-bridge';

export interface TestContext {
  httpBridge: HTTPBridge;
  workspaceUri: vscode.Uri;
}

/**
 * Sets up the test environment with HTTP bridge
 */
export async function setupTest(): Promise<TestContext> {
  // Start HTTP bridge on a test port
  const httpBridge = new HTTPBridge(3001); // Different port for tests
  await httpBridge.start();

  // Get workspace URI
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder found');
  }

  return {
    httpBridge,
    workspaceUri: workspaceFolders[0].uri,
  };
}

/**
 * Tears down the test environment
 */
export async function teardownTest(context: TestContext): Promise<void> {
  await context.httpBridge.stop();
}

/**
 * Gets the URI for a test file
 */
export function getTestFileUri(filename: string): vscode.Uri {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder found');
  }

  return vscode.Uri.joinPath(workspaceFolders[0].uri, 'src', filename);
}

/**
 * Opens a test file and waits for it to be ready
 */
export async function openTestFile(filename: string): Promise<vscode.TextDocument> {
  const uri = getTestFileUri(filename);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);

  // Wait a bit for language server to process
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return document;
}

/**
 * Makes an HTTP request to the bridge to call a tool
 */
export async function callTool(toolName: string, args: any, port: number = 3001): Promise<any> {
  const http = await import('http');

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ tool: toolName, args });

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/tool',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
