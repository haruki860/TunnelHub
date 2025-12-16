export const TUNNEL_EVENTS = {
  REQUEST_INCOMING: "request-incoming",
  RESPONSE_OUTGOING: "response-outgoing",
} as const;

export interface IncomingRequest {
  requestId: string;
  method: string;
  path: string;
  body: any;
  query: any;
  headers?: Record<string, string>;
}

export interface OutgoingResponse {
  requestId: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
}
