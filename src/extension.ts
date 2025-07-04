import * as vscode from 'vscode';
import { MCPServer } from './mcp/server';

let mcpServer: MCPServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('VS Code MCP Server extension activated');

  const startServerCommand = vscode.commands.registerCommand('vscode-mcp.startServer', async () => {
    if (mcpServer) {
      vscode.window.showInformationMessage('MCP Server is already running');
      return;
    }

    const config = vscode.workspace.getConfiguration('vscode-mcp');
    const port = config.get<number>('port', 3000);

    try {
      mcpServer = new MCPServer(port);
      await mcpServer.start();
      vscode.window.showInformationMessage(`MCP Server started on port ${port}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start MCP Server: ${error}`);
    }
  });

  const stopServerCommand = vscode.commands.registerCommand('vscode-mcp.stopServer', async () => {
    if (!mcpServer) {
      vscode.window.showInformationMessage('MCP Server is not running');
      return;
    }

    try {
      await mcpServer.stop();
      mcpServer = undefined;
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
  if (mcpServer) {
    mcpServer.stop();
  }
}
