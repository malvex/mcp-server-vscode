import * as vscode from 'vscode';
import { Tool } from './types';
import { findSymbolInWorkspace } from './utils/symbolProvider';

export const debugTool: Tool = {
  name: 'debug',
  description: 'Control debugging sessions - set/manage breakpoints, view debug status',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'help',
          'setBreakpoint',
          'toggleBreakpoint',
          'clearBreakpoints',
          'listBreakpoints',
          'listConfigurations',
          'status',
          'start',
          'stop',
        ],
        description: 'Debug action to perform',
      },
      // For breakpoint operations
      symbol: {
        type: 'string',
        description: 'Symbol name for breakpoint (e.g., "functionName", "ClassName.methodName")',
      },
      file: {
        type: 'string',
        description: 'File name or path for breakpoint (e.g., "app.ts", "src/app.ts")',
      },
      line: {
        type: 'number',
        description: 'Line number for breakpoint (0-based)',
      },
      condition: {
        type: 'string',
        description: 'Conditional expression for breakpoint',
      },
      hitCondition: {
        type: 'string',
        description: 'Hit count expression (e.g., ">5", "==10")',
      },
      logMessage: {
        type: 'string',
        description: 'Log message to output instead of breaking',
      },
      // For start action
      configuration: {
        type: 'string',
        description: 'Name of debug configuration to use',
      },
      // Output format
      format: {
        type: 'string',
        enum: ['compact', 'detailed'],
        description:
          'Output format: "compact" for AI/token efficiency (default), "detailed" for full data',
        default: 'compact',
      },
    },
    required: ['action'],
  },
  handler: async (args) => {
    const {
      action,
      symbol,
      file,
      line,
      condition,
      hitCondition,
      logMessage,
      configuration,
      format = 'compact',
    } = args;

    // Validate required parameters
    if (!action) {
      throw new Error('Parameter "action" is required');
    }

    switch (action) {
      case 'help': {
        return {
          description: 'Debug tool for managing breakpoints and debug sessions',
          actions: {
            help: 'Show this help message',
            setBreakpoint: {
              description: 'Set a breakpoint by symbol name or file/line',
              params: {
                symbol: 'Symbol name (e.g., "functionName", "Class.method")',
                file: 'File name or path (alternative to symbol)',
                line: 'Line number (0-based, used with file)',
                condition: 'Optional conditional expression',
                hitCondition: 'Optional hit count (e.g., ">5")',
                logMessage: 'Optional log message instead of breaking',
              },
              examples: [
                { action: 'setBreakpoint', symbol: 'calculateSum' },
                { action: 'setBreakpoint', file: 'app.ts', line: 9 },
                { action: 'setBreakpoint', symbol: 'processData', condition: 'x > 100' },
              ],
            },
            toggleBreakpoint: {
              description: 'Toggle a breakpoint on/off',
              params: 'Same as setBreakpoint',
            },
            clearBreakpoints: {
              description: 'Remove all breakpoints',
              params: 'None',
            },
            listBreakpoints: {
              description: 'List all current breakpoints',
              params: 'None',
            },
            listConfigurations: {
              description: 'List available debug configurations from launch.json',
              params: 'None',
            },
            status: {
              description: 'Get current debug session status',
              params: 'None',
            },
            start: {
              description: 'Start a debug session',
              params: {
                configuration: 'Optional configuration name from launch.json',
              },
            },
            stop: {
              description: 'Stop the current debug session',
              params: 'None',
            },
          },
          formats: {
            compact: 'Minimal arrays for token efficiency (default)',
            detailed: 'Full objects with all properties',
          },
        };
      }

      case 'listBreakpoints': {
        const breakpoints = vscode.debug.breakpoints
          .filter((bp): bp is vscode.SourceBreakpoint => bp instanceof vscode.SourceBreakpoint)
          .map((bp) => {
            const location = bp.location;
            return {
              file: vscode.workspace.asRelativePath(location.uri),
              line: location.range.start.line, // Keep 0-based internally
              enabled: bp.enabled,
              condition: bp.condition,
              hitCondition: bp.hitCondition,
              logMessage: bp.logMessage,
            };
          });

        if (format === 'compact') {
          // Return minimal info with 0-based line numbers for AI
          return {
            bpFormat: '[file, line, enabled, condition?]',
            bps: breakpoints.map((bp) => {
              const result: any[] = [bp.file, bp.line, bp.enabled]; // line is already 0-based
              // Only add condition if it exists
              if (bp.condition || bp.hitCondition || bp.logMessage) {
                result.push({
                  condition: bp.condition,
                  hitCondition: bp.hitCondition,
                  logMessage: bp.logMessage,
                });
              }
              return result;
            }),
          };
        }
        // Return detailed format with 0-based line numbers
        return { breakpoints };
      }

      case 'clearBreakpoints': {
        const count = vscode.debug.breakpoints.length;
        vscode.debug.removeBreakpoints(vscode.debug.breakpoints);

        if (format === 'compact') {
          return { cleared: count };
        }
        return { status: 'All breakpoints cleared', count };
      }

      case 'setBreakpoint':
      case 'toggleBreakpoint': {
        let targetUri: vscode.Uri | undefined;
        let targetLine: number | undefined;
        let symbolInfo: any = null;

        // Find location by symbol
        if (symbol) {
          const symbols = await findSymbolInWorkspace(symbol);

          if (symbols.length === 0) {
            // Try to find similar symbols for suggestions
            const allSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
              'vscode.executeWorkspaceSymbolProvider',
              ''
            );
            const suggestions = allSymbols
              ?.filter((s) => s.name.toLowerCase().includes(symbol.toLowerCase()))
              .slice(0, 5)
              .map((s) => ({
                name: s.name,
                kind: vscode.SymbolKind[s.kind],
                file: vscode.workspace.asRelativePath(s.location.uri),
              }));

            if (format === 'compact') {
              return { error: 'not_found', suggestions: suggestions?.map((s) => s.name) };
            }
            return {
              error: `Symbol '${symbol}' not found`,
              suggestions,
            };
          }

          // Handle multiple matches
          if (symbols.length > 1) {
            const matches = symbols.map((s) => ({
              symbol: s.name,
              kind: vscode.SymbolKind[s.kind],
              file: vscode.workspace.asRelativePath(s.location.uri),
              line: s.location.range.start.line, // Keep 0-based
              container: s.containerName || '',
            }));

            if (action === 'setBreakpoint') {
              // For setBreakpoint with multiple matches, return them for user to choose
              if (format === 'compact') {
                return {
                  multipleMatches: true,
                  matchFormat: '[symbol, kind, file, line]',
                  matches: matches.map((m) => [m.symbol, m.kind, m.file, m.line]), // line already 1-based from above
                };
              }
              return { multipleMatches: true, matches };
            }
            // For toggle, just use the first match
          }

          const match = symbols[0];
          targetUri = match.location.uri;
          targetLine = match.location.range.start.line;
          symbolInfo = {
            name: match.name,
            kind: vscode.SymbolKind[match.kind],
            container: match.containerName,
          };
        }
        // Find location by file/line
        else if (file && line !== undefined) {
          // Find the file in workspace
          const files = await vscode.workspace.findFiles(`**/${file}`);
          if (files.length === 0) {
            return format === 'compact'
              ? { error: 'file_not_found' }
              : { error: `File '${file}' not found in workspace` };
          }
          targetUri = files[0];
          targetLine = line; // Expect 0-based input
        } else {
          return format === 'compact'
            ? { error: 'missing_location' }
            : { error: 'Provide either a symbol name or file with line number' };
        }

        // Handle toggle
        if (action === 'toggleBreakpoint') {
          const existingBp = vscode.debug.breakpoints.find((bp) => {
            if (bp instanceof vscode.SourceBreakpoint) {
              return (
                bp.location.uri.toString() === targetUri!.toString() &&
                bp.location.range.start.line === targetLine
              );
            }
            return false;
          });

          if (existingBp) {
            vscode.debug.removeBreakpoints([existingBp]);
            if (format === 'compact') {
              return {
                action: 'removed',
                bpFormat: '[file, line, enabled]',
                bp: [vscode.workspace.asRelativePath(targetUri!), targetLine!, false], // 0-based for compact
              };
            }
            return {
              action: 'removed',
              breakpoint: {
                file: vscode.workspace.asRelativePath(targetUri!),
                line: targetLine!, // 0-based
                symbol: symbol || undefined,
              },
            };
          }
        }

        // Create new breakpoint
        const location = new vscode.Location(targetUri!, new vscode.Position(targetLine!, 0));
        const bp = new vscode.SourceBreakpoint(location, true, condition, hitCondition, logMessage);
        vscode.debug.addBreakpoints([bp]);

        const breakpointInfo = {
          file: vscode.workspace.asRelativePath(targetUri!),
          line: targetLine!, // 0-based
          enabled: true,
          condition,
          hitCondition,
          logMessage,
          symbol: symbol || undefined,
          ...(symbolInfo && { kind: symbolInfo.kind, container: symbolInfo.container }),
        };

        if (format === 'compact') {
          return {
            action: action === 'toggleBreakpoint' ? 'added' : 'set',
            bpFormat: '[file, line, enabled]',
            bp: [breakpointInfo.file, breakpointInfo.line, breakpointInfo.enabled], // 0-based
          };
        }
        return {
          action: action === 'toggleBreakpoint' ? 'added' : 'set',
          breakpoint: breakpointInfo,
        };
      }

      case 'listConfigurations': {
        const configs =
          vscode.workspace.getConfiguration('launch').get<any[]>('configurations') || [];

        if (format === 'compact') {
          // Return just names and types
          return {
            configFormat: '[name, type]',
            configs: configs.map((c) => [c.name, c.type]),
          };
        }
        return {
          configurations: configs.map((c) => ({
            name: c.name,
            type: c.type,
            request: c.request,
            program: c.program,
          })),
        };
      }

      case 'status': {
        const session = vscode.debug.activeDebugSession;
        const breakpoints = vscode.debug.breakpoints;
        const configs =
          vscode.workspace.getConfiguration('launch').get<any[]>('configurations') || [];

        const status = {
          isActive: !!session,
          sessionName: session?.name,
          sessionType: session?.type,
          breakpointCount: breakpoints.length,
          configurations: configs.map((c) => c.name),
        };

        if (format === 'compact') {
          return {
            active: status.isActive,
            bps: status.breakpointCount,
            configs: status.configurations.length,
          };
        }
        return { status };
      }

      case 'start': {
        const configs =
          vscode.workspace.getConfiguration('launch').get<any[]>('configurations') || [];

        if (configs.length === 0) {
          return format === 'compact'
            ? { error: 'no_configs' }
            : { error: 'No debug configurations found in launch.json' };
        }

        let configToUse = configs[0];
        if (configuration) {
          const found = configs.find((c) => c.name === configuration);
          if (!found) {
            return format === 'compact'
              ? { error: 'config_not_found', available: configs.map((c) => c.name) }
              : {
                  error: `Configuration '${configuration}' not found`,
                  available: configs.map((c) => c.name),
                };
          }
          configToUse = found;
        }

        const success = await vscode.debug.startDebugging(undefined, configToUse);

        if (format === 'compact') {
          return { started: success, config: configToUse.name };
        }
        return {
          success,
          session: {
            name: configToUse.name,
            type: configToUse.type,
          },
        };
      }

      case 'stop': {
        const session = vscode.debug.activeDebugSession;
        if (!session) {
          return format === 'compact'
            ? { error: 'no_session' }
            : { error: 'No active debug session' };
        }

        await vscode.debug.stopDebugging();

        if (format === 'compact') {
          return { stopped: true };
        }
        return { status: 'Debug session stopped', sessionName: session.name };
      }

      default:
        return format === 'compact'
          ? { error: 'unknown_action', action }
          : { error: `Unknown debug action: ${action}` };
    }
  },
};
