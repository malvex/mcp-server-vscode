import * as vscode from 'vscode';
import { MCPServer } from './mcp/server';
import { HTTPBridge } from './mcp/http-bridge';
import { debugOutputTracker } from './services/debugOutputTracker';

let mcpServer: MCPServer | undefined;
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

  // Test command to verify tools are working
  const testToolCommand = vscode.commands.registerCommand('vscode-mcp.testTool', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const position = activeEditor.selection.active;

    try {
      // Test hover tool
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        activeEditor.document.uri,
        position
      );

      if (hovers && hovers.length > 0) {
        vscode.window.showInformationMessage('Hover info available at cursor position!');
      } else {
        vscode.window.showInformationMessage('No hover info at cursor position');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Test failed: ${error}`);
    }
  });

  context.subscriptions.push(startServerCommand, stopServerCommand, testToolCommand);

  // Auto-start server on activation
  vscode.commands.executeCommand('vscode-mcp.startServer');
}

export function deactivate() {
  // Dispose debug output tracker
  debugOutputTracker.dispose();

  if (httpBridge) {
    httpBridge.stop();
  }
  if (mcpServer) {
    mcpServer.stop();
  }
}
