export const TUNNEL_EVENTS = {
  REQUEST_INCOMING: "request-incoming",
} as const;

export interface IncomingRequest {
  method: string;
  path: string;
  body: any;
  query: any;
}
