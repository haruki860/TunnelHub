"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// ログの型定義（簡易版）
interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
}

export default function Home() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 1. サーバー(ポート3000)に接続
    const SERVER_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
    const socket = io(SERVER_URL);

    socket.on("connect", () => {
      console.log("Connected to Dashboard Server!");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // 2. 'new-log' イベントを受け取ってリストに追加
    socket.on("new-log", (newLog: RequestLog) => {
      console.log("New Log:", newLog);
      setLogs((prev) => [newLog, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-400">
          TunnelHub Dashboard
        </h1>
        <div
          className={`px-4 py-2 rounded-full ${
            isConnected ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl mb-4 font-semibold border-b border-gray-700 pb-2">
          Realtime Request Logs
        </h2>

        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-10">
            Waiting for requests...
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.requestId}
                className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`font-bold px-2 py-1 rounded text-sm ${getMethodColor(
                      log.method
                    )}`}
                  >
                    {log.method}
                  </span>
                  <span className="font-mono text-gray-300">{log.path}</span>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`font-bold ${getStatusColor(log.status)}`}>
                    {log.status}
                  </span>
                  <span className="text-sm text-gray-400 min-w-[60px] text-right">
                    {log.duration}ms
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// デザイン用のヘルパー関数
function getMethodColor(method: string) {
  switch (method) {
    case "GET":
      return "bg-blue-900 text-blue-200";
    case "POST":
      return "bg-green-900 text-green-200";
    case "PUT":
      return "bg-yellow-900 text-yellow-200";
    case "DELETE":
      return "bg-red-900 text-red-200";
    default:
      return "bg-gray-700 text-gray-200";
  }
}

function getStatusColor(status: number) {
  if (status >= 500) return "text-red-500";
  if (status >= 400) return "text-yellow-500";
  if (status >= 200) return "text-green-500";
  return "text-gray-500";
}
