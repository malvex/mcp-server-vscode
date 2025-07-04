#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Since we're running standalone, we'll need to communicate with VS Code
// through a different mechanism (e.g., WebSocket or HTTP API)
// For MVP, we'll create a simplified version

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

// Tool definitions for standalone mode
const tools = [
  {
    name: 'hover',
    description: 'Get hover information at a specific position',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
      },
      required: ['uri', 'line', 'character'],
    },
  },
  {
    name: 'definition',
    description: 'Find symbol definition',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
      },
      required: ['uri', 'line', 'character'],
    },
  },
  {
    name: 'diagnostics',
    description: 'Get diagnostics for a file or workspace',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'references',
    description: 'Find all references to a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
      },
      required: ['uri', 'line', 'character'],
    },
  },
];

// Setup handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // In standalone mode, we need to communicate with VS Code
  // This would typically be done through:
  // 1. VS Code extension API server
  // 2. Language Server Protocol proxy
  // 3. VS Code Remote Extension Host

  // For MVP, return a message about the architecture
  return {
    content: [
      {
        type: 'text',
        text: `Tool '${name}' called with args: ${JSON.stringify(args, null, 2)}\n\nNote: This standalone server needs to be connected to a running VS Code instance with the extension active. Use the VS Code extension command 'Start MCP Server' to enable the connection.`,
      },
    ],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('VS Code MCP Server started (stdio transport)');
}

main().catch(console.error);
