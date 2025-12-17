import { io } from "socket.io-client";
import { Command } from "commander";
import { TUNNEL_EVENTS } from "../../packages/shared/src/type.ts";
import type {
  IncomingRequest,
  OutgoingResponse,
} from "../../packages/shared/src/type.ts";

const program = new Command();

program
  .name("tunnelhub")
  .description("Expose your local server to the internet")
  .option("-p, --port <number>", "Local server port to forward to", "8080")
  .option("-s, --server <url>", "TunnelHub Server URL", "http://localhost:3000")
  .parse(process.argv);

const options = program.opts();
const SERVER_URL = options.server;
const LOCAL_PORT = options.port;
const LOCAL_HOST = `http://localhost:${LOCAL_PORT}`;

console.log(`Target: ${LOCAL_HOST}`);
console.log(`Server: ${SERVER_URL}`);

// CLI側も少し大きめのパケットを受け取れるようにしておく
const socket = io(SERVER_URL, {
  maxHttpBufferSize: 50 * 1024 * 1024,
});

socket.on("connect", () => {
  console.log("✅ Connected to Server!");
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected");
});

socket.on(TUNNEL_EVENTS.REQUEST_INCOMING, async (data: IncomingRequest) => {
  console.log(
    `📨 Request: ${data.method} ${data.path} (ID: ${data.requestId})`
  );

  try {
    const url = new URL(data.path, LOCAL_HOST);

    if (data.query && typeof data.query === "object") {
      Object.entries(data.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // ヘッダー処理
    const forwardHeaders: Record<string, string> = {};
    const excludeHeaders = ["host", "connection", "content-length", "upgrade"];

    if (data.headers) {
      Object.entries(data.headers).forEach(([key, value]) => {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          forwardHeaders[key] = value;
        }
      });
    }

    forwardHeaders["accept-encoding"] = "identity";

    if (
      !forwardHeaders["content-type"] &&
      data.body &&
      typeof data.body === "object"
    ) {
      forwardHeaders["content-type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method: data.method,
      headers: forwardHeaders,
    };

    if (data.body) {
      fetchOptions.body =
        typeof data.body === "string" ? data.body : JSON.stringify(data.body);
    }

    // フェッチ実行
    const response = await fetch(url.toString(), fetchOptions);

    // レスポンスヘッダー処理
    const responseHeaders: Record<string, string> = {};
    const excludeResHeaders = [
      "content-encoding",
      "content-length",
      "connection",
      "transfer-encoding",
    ];

    response.headers.forEach((value, key) => {
      if (!excludeResHeaders.includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const responseData: OutgoingResponse = {
      requestId: data.requestId,
      status: response.status,
      headers: responseHeaders,
      body: buffer,
    };

    console.log(
      `✅ Response: ${response.status} (Size: ${buffer.length} bytes)`
    );
    socket.emit(TUNNEL_EVENTS.RESPONSE_OUTGOING, responseData);
  } catch (error) {
    console.error(`❌ Error:`, error);
    socket.emit(TUNNEL_EVENTS.RESPONSE_OUTGOING, {
      requestId: data.requestId,
      status: 502,
      headers: { "content-type": "application/json" },
      body: { error: "Gateway Error", details: String(error) },
    });
  }
});
