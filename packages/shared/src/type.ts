export const TUNNEL_EVENTS = {
  REQUEST_INCOMING: 'request-incoming',
  RESPONSE_OUTGOING: 'response-outgoing',
  NEW_LOG: 'new-log',
} as const;

export interface IncomingRequest {
  requestId: string;
  method: string;
  path: string;
  body: unknown;
  query: unknown;
  headers: Record<string, string>;
}

export interface OutgoingResponse {
  requestId: string;
  status: number; // statusCode ではなく status に統一
  statusCode: number;
  statusText: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
}