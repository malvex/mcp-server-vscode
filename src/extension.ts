import * as vscode from 'vscode';
import { HTTPBridge } from './mcp/http-bridge';
import { debugOutputTracker } from './services/debugOutputTracker';

let httpBridge: HTTPBridge | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('VS Code MCP Server extension activated');

  // Initialize debug output tracker
  debugOutputTracker.initialize();

  // Show activation message
  vscode.window.showInformationMessage('VS Code MCP Server extension is now active!');

  const startServerCommand = vscode.commands.registerCommand('vscode-mcp.startServer', async () => {
    if (httpBridge) {
      vscode.window.showInformationMessage('MCP Server is already running');
      return;
    }

    const config = vscode.workspace.getConfiguration('vscode-mcp');
    const port = config.get<number>('port', 8991);

    try {
      // Start HTTP bridge for VS Code API access
      httpBridge = new HTTPBridge(port);
      await httpBridge.start();
      vscode.window.showInformationMessage(`MCP Server started on port ${port}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start MCP Server: ${error}`);
    }
  });

  const stopServerCommand = vscode.commands.registerCommand('vscode-mcp.stopServer', async () => {
    if (!httpBridge) {
      vscode.window.showInformationMessage('MCP Server is not running');
      return;
    }

    try {
      await httpBridge.stop();
      httpBridge = undefined;
      vscode.window.showInformationMessage('MCP Server stopped');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop MCP Server: ${error}`);
    }
  });

  context.subscriptions.push(startServerCommand, stopServerCommand);

  // Auto-start server on activation
  vscode.commands.executeCommand('vscode-mcp.startServer');
}

export function deactivate() {
  // Dispose debug output tracker
  debugOutputTracker.dispose();

  if (httpBridge) {
    httpBridge.stop();
  }
}
