#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/dist/cjs/server/index.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/dist/cjs/server/transports/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/dist/cjs/types.js');
const http = require('http');

const VSCODE_BRIDGE_PORT = process.env.VSCODE_BRIDGE_PORT || '8991';

const server = new Server(
  {
    name: 'vscode-mcp-server',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to make HTTP requests to VS Code bridge
async function callVSCodeBridge(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: parseInt(VSCODE_BRIDGE_PORT),
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', (error: any) => {
      reject(
        new Error(
          `VS Code bridge not available. Make sure VS Code is running with the MCP extension and the server is started. Error: ${error.message}`
        )
      );
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Setup handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const response = await callVSCodeBridge('/tools');
    return response;
  } catch (error) {
    console.error('Failed to get tools from VS Code:', error);
    return {
      tools: [],
      error: error instanceof Error ? error.message : 'Failed to connect to VS Code',
    };
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    const response = await callVSCodeBridge('/tool', 'POST', {
      tool: name,
      args: args,
    });

    if (response.error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  // First check if VS Code bridge is available
  try {
    const health = await callVSCodeBridge('/health');
    console.error(`Connected to VS Code bridge on port ${health.port}`);
  } catch {
    console.error('Warning: VS Code bridge not available. Make sure to:');
    console.error('1. Open VS Code with the MCP extension project');
    console.error('2. Press F5 to launch the extension');
    console.error('3. Run "Start MCP Server" command in the new VS Code window');
    console.error('');
    console.error(
      "The MCP server will start anyway but tools won't work until VS Code is connected."
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('VS Code MCP Server started (stdio transport)');
}

main().catch(console.error);
