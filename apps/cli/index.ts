import { io } from "socket.io-client";
import { TUNNEL_EVENTS } from "../../packages/shared/src/type.ts";
import type {
  IncomingRequest,
  OutgoingResponse,
} from "../../packages/shared/src/type.ts";

const SERVER_URL = "http://localhost:3000";
const LOCAL_PORT = process.env.LOCAL_PORT || "8080";
const LOCAL_HOST = `http://localhost:${LOCAL_PORT}`;

console.log("Connecting to Tunnel Server...");

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log("✅ Connected to Server!");
  console.log(`My ID: ${socket.id}`);
  console.log(`📍 Forwarding requests to: ${LOCAL_HOST}`);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from Server");
});

// サーバーからリクエストが転送されてきた時の処理
socket.on(TUNNEL_EVENTS.REQUEST_INCOMING, async (data: IncomingRequest) => {
  console.log("\n📨 Received Request from Server:");
  console.log("--------------------------------");
  console.log(`Request ID: ${data.requestId}`);
  console.log(`Method: ${data.method}`);
  console.log(`Path:   ${data.path}`);
  console.log("--------------------------------");

  try {
    // Step 1: ローカルサーバーに代理アクセス
    const url = new URL(data.path, LOCAL_HOST);

    // Queryパラメータを追加
    if (data.query) {
      Object.entries(data.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // プロキシに不要なヘッダーを除外
    const excludeHeaders = [
      "host",
      "connection",
      "content-length",
      "transfer-encoding",
      "upgrade",
    ];
    const forwardHeaders: Record<string, string> = {};
    if (data.headers) {
      Object.entries(data.headers).forEach(([key, value]) => {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          forwardHeaders[key] = value;
        }
      });
    }

    // Content-Typeが指定されていない場合のみデフォルトを設定
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

    // Bodyがある場合のみ追加
    if (data.body !== undefined && data.body !== null) {
      if (typeof data.body === "string") {
        fetchOptions.body = data.body;
      } else {
        fetchOptions.body = JSON.stringify(data.body);
      }
    }

    console.log(`🔄 Forwarding to: ${url.toString()}`);
    const response = await fetch(url.toString(), fetchOptions);

    // レスポンスヘッダーを取得
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // レスポンスボディを取得
    const contentType = response.headers.get("content-type");
    let body: any;
    if (contentType && contentType.includes("application/json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    // Step 2: レスポンスをServerに送り返す
    const responseData: OutgoingResponse = {
      requestId: data.requestId,
      statusCode: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: body,
    };

    console.log(
      `✅ Received response: ${response.status} ${response.statusText}`
    );
    console.log(
      `📤 Sending response back to Server (Request ID: ${data.requestId})`
    );

    socket.emit(TUNNEL_EVENTS.RESPONSE_OUTGOING, responseData);
  } catch (error) {
    console.error(`❌ Error forwarding request:`, error);

    // エラーレスポンスを送信
    const errorResponse: OutgoingResponse = {
      requestId: data.requestId,
      statusCode: 502,
      statusText: "Bad Gateway",
      headers: { "Content-Type": "application/json" },
      body: {
        error: "Failed to forward request to local server",
        message: error instanceof Error ? error.message : String(error),
      },
    };

    socket.emit(TUNNEL_EVENTS.RESPONSE_OUTGOING, errorResponse);
  }
});

socket.on("connect_error", (err) => {
  console.error("Connection Error:", err.message);
});
