import { Tool } from './types';
import { hoverTool } from './hover';
import { definitionTool } from './definition';
import { diagnosticsTool } from './diagnostics';
import { referencesTool } from './references';
import {
  // Breakpoint management
  debug_setBreakpointTool,
  debug_toggleBreakpointTool,
  debug_listBreakpointsTool,
  debug_clearBreakpointsTool,
  // Session management
  debug_statusTool,
  debug_listConfigurationsTool,
  debug_startSessionTool,
  debug_stopSessionTool,
  // Runtime debugging
  debug_pauseExecutionTool,
  debug_continueExecutionTool,
  debug_stepOverTool,
  debug_stepIntoTool,
  debug_stepOutTool,
  debug_getCallStackTool,
  debug_inspectVariablesTool,
  debug_evaluateExpressionTool,
  debug_getOutputTool,
} from './debug';
import { refactor_renameTool } from './refactor';
import { callHierarchyTool } from './callHierarchy';
import { symbolSearchTool } from './symbolSearch';
import { workspaceSymbolsTool } from './workspaceSymbols';

export function getTools(): Tool[] {
  return [
    hoverTool,
    definitionTool,
    diagnosticsTool,
    referencesTool,
    // Debug tools - Breakpoint management
    debug_setBreakpointTool,
    debug_toggleBreakpointTool,
    debug_listBreakpointsTool,
    debug_clearBreakpointsTool,
    // Debug tools - Session management
    debug_statusTool,
    debug_listConfigurationsTool,
    debug_startSessionTool,
    debug_stopSessionTool,
    // Debug tools - Runtime debugging
    debug_pauseExecutionTool,
    debug_continueExecutionTool,
    debug_stepOverTool,
    debug_stepIntoTool,
    debug_stepOutTool,
    debug_getCallStackTool,
    debug_inspectVariablesTool,
    debug_evaluateExpressionTool,
    debug_getOutputTool,
    // Refactoring tools
    refactor_renameTool,
    // Other tools
    callHierarchyTool,
    symbolSearchTool,
    workspaceSymbolsTool,
  ];
}
