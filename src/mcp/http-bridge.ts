import * as vscode from 'vscode';
import * as http from 'http';
import { getTools } from '../tools';

export class HTTPBridge {
  private httpServer: http.Server | undefined;
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  async start() {
    this.httpServer = http.createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/tool') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const { tool, args } = JSON.parse(body);
            const tools = getTools();
            const toolImpl = tools.find((t) => t.name === tool);

            if (!toolImpl) {
              res.writeHead(404);
              res.end(JSON.stringify({ error: `Unknown tool: ${tool}` }));
              return;
            }

            const result = await toolImpl.handler(args);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ result }));
          } catch (error) {
            res.writeHead(500);
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      } else if (req.method === 'GET' && req.url === '/tools') {
        const tools = getTools();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          })
        );
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', port: this.port }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    return new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.port, () => {
        console.log(`VS Code HTTP Bridge running on port ${this.port}`);
        vscode.window.showInformationMessage(`VS Code HTTP Bridge started on port ${this.port}`);
        resolve();
      });
      this.httpServer!.on('error', reject);
    });
  }

  async stop() {
    if (this.httpServer) {
      return new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }
  }
}
