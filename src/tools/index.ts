import { Tool } from './types';
import { hoverTool } from './hover';
import { definitionTool } from './definition';
import { diagnosticsTool } from './diagnostics';
import { referencesTool } from './references';
import {
  // Breakpoint management
  setBreakpointTool,
  toggleBreakpointTool,
  listBreakpointsTool,
  clearBreakpointsTool,
  // Session management
  debugStatusTool,
  listDebugConfigurationsTool,
  startDebugSessionTool,
  stopDebugSessionTool,
  // Runtime debugging
  pauseExecutionTool,
  continueExecutionTool,
  stepOverTool,
  stepIntoTool,
  stepOutTool,
  getCallStackTool,
  inspectVariablesTool,
  evaluateExpressionTool,
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
    // Debug tools - Breakpoint management
    setBreakpointTool,
    toggleBreakpointTool,
    listBreakpointsTool,
    clearBreakpointsTool,
    // Debug tools - Session management
    debugStatusTool,
    listDebugConfigurationsTool,
    startDebugSessionTool,
    stopDebugSessionTool,
    // Debug tools - Runtime debugging
    pauseExecutionTool,
    continueExecutionTool,
    stepOverTool,
    stepIntoTool,
    stepOutTool,
    getCallStackTool,
    inspectVariablesTool,
    evaluateExpressionTool,
    // Other tools
    callHierarchyTool,
    symbolSearchTool,
    // executeCodeTool,  // Commented out - redundant tool
    workspaceSymbolsTool,
  ];
}
