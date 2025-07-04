import * as vscode from 'vscode';
import { HTTPBridge } from '../../mcp/http-bridge';
import { getSharedTestContext, getSharedPort } from './sharedSetup';
import { openTestFileWithLanguageServer } from './languageServerReady';

// Global to track the current test port
let globalTestPort: number | undefined;

export interface TestContext {
  httpBridge: HTTPBridge;
  workspaceUri: vscode.Uri;
  port: number;
}

/**
 * Sets up the test environment with HTTP bridge
 */
export async function setupTest(): Promise<TestContext> {
  const context = await getSharedTestContext();
  globalTestPort = context.port;
  return context;
}

/**
 * Tears down the test environment
 */
export async function teardownTest(_context: TestContext): Promise<void> {
  // Shared context cleanup is handled globally
  globalTestPort = undefined;
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
  return openTestFileWithLanguageServer(uri);
}

/**
 * Makes an HTTP request to the bridge to call a tool
 */
export async function callTool(toolName: string, args: any, context?: TestContext): Promise<any> {
  const port = context?.port || globalTestPort || getSharedPort() || 3001;
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
              // For 400/404 errors, return the error as a result
              if (res.statusCode === 400 || res.statusCode === 404) {
                resolve({ error: errorData.error });
                return;
              }
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
