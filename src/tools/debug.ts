import * as vscode from 'vscode';
import { Tool } from './types';

export const debugTool: Tool = {
    name: 'debug',
    description: 'Control debugging sessions - start, stop, set breakpoints, step through code',
    inputSchema: {
        type: 'object',
        properties: {
            action: { 
                type: 'string', 
                enum: ['start', 'stop', 'setBreakpoint', 'removeBreakpoint', 'stepOver', 'stepInto', 'stepOut', 'continue', 'getVariables'],
                description: 'Debug action to perform' 
            },
            // For setBreakpoint/removeBreakpoint
            uri: { type: 'string', description: 'File URI for breakpoint operations' },
            line: { type: 'number', description: 'Line number for breakpoint (0-based)' },
            // For start action
            config: { type: 'object', description: 'Debug configuration to use' }
        },
        required: ['action']
    },
    handler: async (args) => {
        const { action, uri, line, config } = args;
        
        switch (action) {
            case 'start':
                if (config) {
                    await vscode.debug.startDebugging(undefined, config);
                } else {
                    // Use the first available configuration
                    const configs = vscode.workspace.getConfiguration('launch').configurations;
                    if (configs && configs.length > 0) {
                        await vscode.debug.startDebugging(undefined, configs[0]);
                    } else {
                        throw new Error('No debug configurations found');
                    }
                }
                return { status: 'Debug session started' };
                
            case 'stop':
                await vscode.debug.stopDebugging();
                return { status: 'Debug session stopped' };
                
            case 'setBreakpoint':
                if (!uri || line === undefined) {
                    throw new Error('URI and line required for setting breakpoint');
                }
                const fileUri = vscode.Uri.parse(uri);
                const location = new vscode.Location(fileUri, new vscode.Position(line, 0));
                const breakpoint = new vscode.SourceBreakpoint(location);
                vscode.debug.addBreakpoints([breakpoint]);
                return { status: 'Breakpoint added', line };
                
            case 'removeBreakpoint':
                if (!uri || line === undefined) {
                    throw new Error('URI and line required for removing breakpoint');
                }
                const bpUri = vscode.Uri.parse(uri);
                const allBreakpoints = vscode.debug.breakpoints;
                const toRemove = allBreakpoints.filter(bp => {
                    if (bp instanceof vscode.SourceBreakpoint) {
                        return bp.location.uri.toString() === bpUri.toString() && 
                               bp.location.range.start.line === line;
                    }
                    return false;
                });
                vscode.debug.removeBreakpoints(toRemove);
                return { status: 'Breakpoint removed', line };
                
            case 'stepOver':
                await vscode.commands.executeCommand('workbench.action.debug.stepOver');
                return { status: 'Stepped over' };
                
            case 'stepInto':
                await vscode.commands.executeCommand('workbench.action.debug.stepInto');
                return { status: 'Stepped into' };
                
            case 'stepOut':
                await vscode.commands.executeCommand('workbench.action.debug.stepOut');
                return { status: 'Stepped out' };
                
            case 'continue':
                await vscode.commands.executeCommand('workbench.action.debug.continue');
                return { status: 'Continued execution' };
                
            case 'getVariables':
                // This is more complex and would require access to the debug session
                // For now, return a placeholder
                return { 
                    status: 'Variable inspection not yet implemented',
                    note: 'This requires deeper integration with the debug adapter protocol'
                };
                
            default:
                throw new Error(`Unknown debug action: ${action}`);
        }
    }
};