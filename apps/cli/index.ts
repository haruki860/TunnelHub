import { io } from "socket.io-client";
import { TUNNEL_EVENTS } from "../../packages/shared/src/type.ts";
import type { IncomingRequest } from "../../packages/shared/src/type.ts";

const SERVER_URL = "http://localhost:3000";

console.log("Connecting to Tunnel Server...");

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log("✅ Connected to Server!");
  console.log(`My ID: ${socket.id}`);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from Server");
});

// サーバーからリクエストが転送されてきた時の処理
socket.on(TUNNEL_EVENTS.REQUEST_INCOMING, (data: IncomingRequest) => {
  console.log("\n📨 Received Request from Server:");
  console.log("--------------------------------");
  console.log(`Method: ${data.method}`);
  console.log(`Path:   ${data.path}`);
  console.log(`Body:   ${JSON.stringify(data.body)}`);
  console.log("--------------------------------");
});

socket.on("connect_error", (err) => {
  console.error("Connection Error:", err.message);
});
