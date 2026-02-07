export type InterceptionMode = 'lite' | 'full';

export interface GlobalState {
  enabled: boolean;
  mode: InterceptionMode;
}

export interface Rule {
  id: string;
  groupId: string;
  name: string;
  urlPattern: string;
  script: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export interface LogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  url: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export enum MessageType {
  GET_ACTIVE_RULES = 'GET_ACTIVE_RULES',
  GET_ALL_RULES = 'GET_ALL_RULES',
  GET_GROUPS = 'GET_GROUPS',
  RULES_UPDATED = 'RULES_UPDATED',
  LOG_MATCH = 'LOG_MATCH',
  GET_LOGS = 'GET_LOGS',
  CLEAR_LOGS = 'CLEAR_LOGS',
  TOGGLE_GLOBAL = 'TOGGLE_GLOBAL',
  GET_GLOBAL_STATE = 'GET_GLOBAL_STATE',
  SWITCH_MODE = 'SWITCH_MODE',
  DEBUGGER_STATUS = 'DEBUGGER_STATUS',
}

export interface ExportData {
  version: number;
  groups: Group[];
  rules: Rule[];
}

export interface GetActiveRulesRequest {
  type: MessageType.GET_ACTIVE_RULES;
}
export interface GetActiveRulesResponse {
  rules: Rule[];
}

export interface GetAllRulesRequest {
  type: MessageType.GET_ALL_RULES;
}
export interface GetAllRulesResponse {
  rules: Rule[];
}

export interface GetGroupsRequest {
  type: MessageType.GET_GROUPS;
}
export interface GetGroupsResponse {
  groups: Group[];
}

export interface RulesUpdatedMessage {
  type: MessageType.RULES_UPDATED;
}
export type RulesUpdatedResponse = { ok: true };

export interface LogMatchMessage {
  type: MessageType.LOG_MATCH;
  entry: LogEntry;
}
export type LogMatchResponse = { ok: true };

export interface GetLogsRequest {
  type: MessageType.GET_LOGS;
}
export interface GetLogsResponse {
  entries: LogEntry[];
}

export interface ClearLogsRequest {
  type: MessageType.CLEAR_LOGS;
}
export type ClearLogsResponse = { ok: true };

export interface ToggleGlobalRequest {
  type: MessageType.TOGGLE_GLOBAL;
  enabled: boolean;
}
export interface ToggleGlobalResponse {
  state: GlobalState;
}

export interface GetGlobalStateRequest {
  type: MessageType.GET_GLOBAL_STATE;
}
export interface GetGlobalStateResponse {
  state: GlobalState;
}

export interface SwitchModeRequest {
  type: MessageType.SWITCH_MODE;
  mode: InterceptionMode;
}
export interface SwitchModeResponse {
  state: GlobalState;
}

export interface DebuggerStatusRequest {
  type: MessageType.DEBUGGER_STATUS;
}
export interface DebuggerStatusResponse {
  attached: boolean;
}

export type AnyMessageRequest =
  | GetActiveRulesRequest
  | GetAllRulesRequest
  | GetGroupsRequest
  | RulesUpdatedMessage
  | LogMatchMessage
  | GetLogsRequest
  | ClearLogsRequest
  | ToggleGlobalRequest
  | GetGlobalStateRequest
  | SwitchModeRequest
  | DebuggerStatusRequest;

export type AnyMessageResponse =
  | GetActiveRulesResponse
  | GetAllRulesResponse
  | GetGroupsResponse
  | RulesUpdatedResponse
  | LogMatchResponse
  | GetLogsResponse
  | ClearLogsResponse
  | ToggleGlobalResponse
  | GetGlobalStateResponse
  | SwitchModeResponse
  | DebuggerStatusResponse;
