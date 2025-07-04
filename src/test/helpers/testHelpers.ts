import * as vscode from 'vscode';
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

  // Wait for TypeScript extension to be ready
  await new Promise((resolve) => setTimeout(resolve, 3000));

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

  // Wait for language server to process the file
  await new Promise((resolve) => setTimeout(resolve, 2000));

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
          if (!responseData) {
            reject(new Error('Empty response from HTTP bridge'));
            return;
          }

          // Check HTTP status code first
          if (res.statusCode !== 200) {
            try {
              const errorData = JSON.parse(responseData);
              reject(new Error(errorData?.error || `HTTP ${res.statusCode}: ${responseData}`));
            } catch {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
            return;
          }

          const result = JSON.parse(responseData);
          if (result && result.error) {
            reject(new Error(result.error));
          } else if (result && result.result !== undefined) {
            resolve(result.result);
          } else {
            // If the response doesn't have the expected structure
            reject(new Error(`Unexpected response structure: ${responseData}`));
          }
        } catch (e) {
          console.error('Failed to parse response:', responseData);
          console.error('Error details:', e);
          reject(new Error(`Failed to parse response: ${e}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
