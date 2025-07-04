import * as vscode from 'vscode';
import { HTTPBridge } from './mcp/http-bridge';
import { debugOutputTracker } from './services/debugOutputTracker';

let httpBridge: HTTPBridge | undefined;
let mcpServerStatusBar: vscode.StatusBarItem | undefined;

function updateMcpServerStatusBar() {
  if (!mcpServerStatusBar) {
    return;
  }

  const config = vscode.workspace.getConfiguration('vscode-mcp');
  const port = config.get<number>('port', 8991);

  if (httpBridge) {
    mcpServerStatusBar.text = `$(server) VS Code MCP: ${port}`;
    mcpServerStatusBar.tooltip = `VS Code MCP Server is running on port ${port}\nClick to stop`;
    mcpServerStatusBar.backgroundColor = undefined;
  } else {
    mcpServerStatusBar.text = '$(server) VS Code MCP: Stopped';
    mcpServerStatusBar.tooltip = 'VS Code MCP Server is stopped\nClick to start';
    mcpServerStatusBar.backgroundColor = undefined;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('VS Code MCP Server extension activated');

  // Initialize debug output tracker
  debugOutputTracker.initialize();

  const startServerCommand = vscode.commands.registerCommand('vscode-mcp.startServer', async () => {
    if (httpBridge) {
      return;
    }

    const config = vscode.workspace.getConfiguration('vscode-mcp');
    const port = config.get<number>('port', 8991);

    try {
      // Start HTTP bridge for VS Code API access
      httpBridge = new HTTPBridge(port);
      await httpBridge.start();
      updateMcpServerStatusBar();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start MCP Server: ${error}`);
    }
  });

  const stopServerCommand = vscode.commands.registerCommand('vscode-mcp.stopServer', async () => {
    if (!httpBridge) {
      return;
    }

    try {
      await httpBridge.stop();
      httpBridge = undefined;
      updateMcpServerStatusBar();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop MCP Server: ${error}`);
    }
  });

  const toggleServerCommand = vscode.commands.registerCommand(
    'vscode-mcp.toggleServer',
    async () => {
      if (httpBridge) {
        await vscode.commands.executeCommand('vscode-mcp.stopServer');
      } else {
        await vscode.commands.executeCommand('vscode-mcp.startServer');
      }
    }
  );

  // Create MCP server status bar item
  mcpServerStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  mcpServerStatusBar.command = 'vscode-mcp.toggleServer';
  updateMcpServerStatusBar();
  mcpServerStatusBar.show();

  context.subscriptions.push(
    startServerCommand,
    stopServerCommand,
    toggleServerCommand,
    mcpServerStatusBar
  );

  // Auto-start server on activation
  // vscode.commands.executeCommand('vscode-mcp.startServer');
}

export function deactivate() {
  // Dispose debug output tracker
  debugOutputTracker.dispose();

  if (httpBridge) {
    httpBridge.stop();
  }
}
