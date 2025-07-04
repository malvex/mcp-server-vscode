const { Server } = require('@modelcontextprotocol/sdk/dist/cjs/server/index.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/dist/cjs/server/transports/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/dist/cjs/types.js');
import { ChildProcess } from 'child_process';
import { getTools } from '../tools';

export class MCPServer {
  private server: any;
  private tcpServer: any;
  private childProcess?: ChildProcess;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.server = new Server(
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

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = getTools();
      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const tools = getTools();
      const tool = tools.find((t) => t.name === request.params.name);

      if (!tool) {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      try {
        const result = await tool.handler(request.params.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
  }

  async start() {
    // For now, we'll use stdio transport
    // In production, we might want to use WebSocket or TCP
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.log('MCP Server started');
  }

  async stop() {
    await this.server.close();
    if (this.childProcess) {
      this.childProcess.kill();
    }
    if (this.tcpServer) {
      this.tcpServer.close();
    }
  }
}
