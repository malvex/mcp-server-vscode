import { Tool } from './types';
import { hoverTool } from './hover';
import { definitionTool } from './definition';
import { diagnosticsTool } from './diagnostics';
import { referencesTool } from './references';
import {
  setBreakpointTool,
  toggleBreakpointTool,
  listBreakpointsTool,
  clearBreakpointsTool,
  debugStatusTool,
  listDebugConfigurationsTool,
  startDebugSessionTool,
  stopDebugSessionTool,
} from './debug';
import { callHierarchyTool } from './callHierarchy';
import { symbolSearchTool } from './symbolSearch';
// import { executeCodeTool } from './executeCode';  // Commented out - redundant tool
import { workspaceSymbolsTool } from './workspaceSymbols';

export function getTools(): Tool[] {
  return [
    hoverTool,
    definitionTool,
    diagnosticsTool,
    referencesTool,
    // Debug tools
    setBreakpointTool,
    toggleBreakpointTool,
    listBreakpointsTool,
    clearBreakpointsTool,
    debugStatusTool,
    listDebugConfigurationsTool,
    startDebugSessionTool,
    stopDebugSessionTool,
    // Other tools
    callHierarchyTool,
    symbolSearchTool,
    // executeCodeTool,  // Commented out - redundant tool
    workspaceSymbolsTool,
  ];
}
