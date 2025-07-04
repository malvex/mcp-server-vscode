import * as vscode from 'vscode';
import { HTTPBridge } from '../../mcp/http-bridge';
import { setRetryDelays } from '../../tools/utils/symbolProvider';
import { waitForWorkspaceReady } from './languageServerReady';

let sharedHttpBridge: HTTPBridge | undefined;
let sharedPort: number | undefined;
let isInitialized = false;
let initializationPromise: Promise<void> | undefined;

export async function getSharedTestContext() {
  if (!isInitialized && !initializationPromise) {
    initializationPromise = initializeSharedContext();
  }

  if (initializationPromise) {
    await initializationPromise;
  }

  return {
    httpBridge: sharedHttpBridge!,
    port: sharedPort!,
    workspaceUri: vscode.workspace.workspaceFolders![0].uri,
  };
}

async function initializeSharedContext() {
  // Use much faster retry delays for tests
  setRetryDelays([100, 200, 500]);

  // Start a single HTTP bridge for all tests
  const testPort = 3001 + Math.floor(Math.random() * 1000);
  sharedHttpBridge = new HTTPBridge(testPort);

  let retries = 3;
  while (retries > 0) {
    try {
      await sharedHttpBridge.start();
      sharedPort = testPort;
      break;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE' && retries > 1) {
        const newPort = 3001 + Math.floor(Math.random() * 1000);
        (sharedHttpBridge as any).port = newPort;
        retries--;
      } else {
        throw error;
      }
    }
  }

  // Ensure workspace is ready
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder found');
  }

  // Pre-open common test files and wait for language server
  try {
    const mathUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'src', 'math.ts');
    const appUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'src', 'app.ts');

    // Wait for language server to be ready for these files
    const ready = await waitForWorkspaceReady([mathUri, appUri]);

    if (ready) {
      console.log('Shared setup: Language server is ready');
    } else {
      console.warn('Shared setup: Language server may not be fully ready');
    }
  } catch (e) {
    console.error('Failed to pre-open files:', e);
  }

  isInitialized = true;
  initializationPromise = undefined;
}

export async function cleanupSharedContext() {
  if (sharedHttpBridge) {
    try {
      await sharedHttpBridge.stop();
    } catch (error) {
      console.error('Error stopping shared HTTP bridge:', error);
    }
    sharedHttpBridge = undefined;
    sharedPort = undefined;
    isInitialized = false;
  }
}

export function getSharedPort(): number | undefined {
  return sharedPort;
}
