import { Tool } from './types';
import { hoverTool } from './hover';
import { definitionTool } from './definition';
import { diagnosticsTool } from './diagnostics';
import { referencesTool } from './references';
import { debugTool } from './debug';
import { callHierarchyTool } from './callHierarchy';
import { symbolSearchTool } from './symbolSearch';
import { executeCodeTool } from './executeCode';
import { workspaceSymbolsTool } from './workspaceSymbols';

export function getTools(): Tool[] {
  return [
    hoverTool,
    definitionTool,
    diagnosticsTool,
    referencesTool,
    debugTool,
    callHierarchyTool,
    symbolSearchTool,
    executeCodeTool,
    workspaceSymbolsTool,
  ];
}
