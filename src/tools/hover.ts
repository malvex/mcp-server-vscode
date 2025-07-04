import * as vscode from 'vscode';
import { Tool } from './types';

export const hoverTool: Tool = {
    name: 'hover',
    description: 'Get hover information (type info, documentation) at a specific position in a file',
    inputSchema: {
        type: 'object',
        properties: {
            uri: { type: 'string', description: 'File URI' },
            line: { type: 'number', description: 'Line number (0-based)' },
            character: { type: 'number', description: 'Character position (0-based)' }
        },
        required: ['uri', 'line', 'character']
    },
    handler: async (args) => {
        const { uri, line, character } = args;
        
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
        const position = new vscode.Position(line, character);
        
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            document.uri,
            position
        );
        
        if (!hovers || hovers.length === 0) {
            return { hover: null };
        }
        
        // Combine all hover contents
        const contents = hovers.flatMap(hover => {
            return hover.contents.map(content => {
                if (typeof content === 'string') {
                    return content;
                } else if (content instanceof vscode.MarkdownString) {
                    return content.value;
                } else {
                    return content.value;
                }
            });
        });
        
        return {
            hover: {
                contents: contents,
                range: hovers[0].range ? {
                    start: { line: hovers[0].range.start.line, character: hovers[0].range.start.character },
                    end: { line: hovers[0].range.end.line, character: hovers[0].range.end.character }
                } : undefined
            }
        };
    }
};