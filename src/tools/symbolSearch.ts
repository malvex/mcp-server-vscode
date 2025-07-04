import * as vscode from 'vscode';
import { Tool } from './types';

export const symbolSearchTool: Tool = {
    name: 'symbolSearch',
    description: 'Search for symbols (classes, functions, variables) across the workspace',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Symbol name to search for' },
            kind: { 
                type: 'string', 
                enum: ['all', 'class', 'function', 'variable', 'interface', 'namespace', 'property', 'method'],
                description: 'Type of symbol to search for (default: all)' 
            }
        },
        required: ['query']
    },
    handler: async (args) => {
        const { query, kind = 'all' } = args;
        
        // Search for symbols
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            query
        );
        
        if (!symbols || symbols.length === 0) {
            return { symbols: [] };
        }
        
        // Filter by kind if specified
        let filteredSymbols = symbols;
        if (kind !== 'all') {
            const kindMap: Record<string, vscode.SymbolKind> = {
                'class': vscode.SymbolKind.Class,
                'function': vscode.SymbolKind.Function,
                'variable': vscode.SymbolKind.Variable,
                'interface': vscode.SymbolKind.Interface,
                'namespace': vscode.SymbolKind.Namespace,
                'property': vscode.SymbolKind.Property,
                'method': vscode.SymbolKind.Method
            };
            
            const targetKind = kindMap[kind];
            if (targetKind !== undefined) {
                filteredSymbols = symbols.filter(sym => sym.kind === targetKind);
            }
        }
        
        return {
            symbols: filteredSymbols.map(sym => ({
                name: sym.name,
                kind: vscode.SymbolKind[sym.kind],
                containerName: sym.containerName,
                location: {
                    uri: sym.location.uri.toString(),
                    range: {
                        start: { line: sym.location.range.start.line, character: sym.location.range.start.character },
                        end: { line: sym.location.range.end.line, character: sym.location.range.end.character }
                    }
                }
            }))
        };
    }
};