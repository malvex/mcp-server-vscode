import * as vscode from 'vscode';

interface DebugOutput {
  timestamp: number;
  category: 'console' | 'stdout' | 'stderr' | 'telemetry' | string;
  output: string;
  sessionId: string;
  sessionName: string;
}

class DebugOutputTracker {
  private outputs: Map<string, DebugOutput[]> = new Map();
  private maxOutputsPerSession = 1000;
  private disposable: vscode.Disposable | undefined;

  public initialize(): void {
    // Register debug adapter tracker for all debug types
    this.disposable = vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker: (session: vscode.DebugSession) => {
        // Initialize storage for this session
        this.outputs.set(session.id, []);

        return {
          onDidSendMessage: (message: any) => {
            // Capture output events from the debug adapter
            if (message.type === 'event' && message.event === 'output' && message.body) {
              const output: DebugOutput = {
                timestamp: Date.now(),
                category: message.body.category || 'console',
                output: message.body.output || '',
                sessionId: session.id,
                sessionName: session.name,
              };

              this.addOutput(session.id, output);
            }
          },
          onWillStopSession: () => {
            // Clean up after a delay to allow final output retrieval
            setTimeout(() => {
              this.outputs.delete(session.id);
            }, 5000);
          },
        };
      },
    });

    // Clean up when debug sessions end
    vscode.debug.onDidTerminateDebugSession((session) => {
      setTimeout(() => {
        this.outputs.delete(session.id);
      }, 5000);
    });
  }

  private addOutput(sessionId: string, output: DebugOutput): void {
    const sessionOutputs = this.outputs.get(sessionId) || [];
    sessionOutputs.push(output);

    // Limit the number of stored outputs
    if (sessionOutputs.length > this.maxOutputsPerSession) {
      sessionOutputs.shift(); // Remove oldest
    }

    this.outputs.set(sessionId, sessionOutputs);
  }

  public getOutputs(
    sessionId: string,
    options: {
      category?: string;
      limit?: number;
      filter?: string;
    } = {}
  ): DebugOutput[] {
    const sessionOutputs = this.outputs.get(sessionId) || [];
    let filtered = sessionOutputs;

    // Filter by category
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter((o) => o.category === options.category);
    }

    // Filter by text content
    if (options.filter) {
      const filterLower = options.filter.toLowerCase();
      filtered = filtered.filter((o) => o.output.toLowerCase().includes(filterLower));
    }

    // Limit results (return most recent)
    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  public dispose(): void {
    this.disposable?.dispose();
    this.outputs.clear();
  }
}

// Singleton instance
export const debugOutputTracker = new DebugOutputTracker();
