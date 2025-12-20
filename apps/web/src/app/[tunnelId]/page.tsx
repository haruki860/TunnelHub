"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useParams } from "next/navigation";

interface Log {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
  headers?: Record<string, string> | null;
  body?: unknown;
}

export default function TunnelPage() {
  const params = useParams();
  const tunnelId = params.tunnelId as string;
  const [logs, setLogs] = useState<Log[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 1. 初回データ取得 (REST API)
    fetch(`http://localhost:3000/api/logs/${tunnelId}`)
      .then((res) => res.json())
      .then((data) => setLogs(data))
      .catch((err) => console.error("Failed to fetch logs:", err));

    // 2. リアルタイム更新 (WebSocket)
    const socket = io("http://localhost:3000", {
      query: { tunnelId, type: "dashboard" },
    });

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("new-log", (newLog: Log) => {
      setLogs((prev) => [newLog, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [tunnelId]);

  // ★追加: 再送ボタンの処理
  const handleReplay = async (logId: string) => {
    try {
      // サーバーの再送APIを叩く
      const res = await fetch(`http://localhost:3000/api/replay/${logId}`, {
        method: "POST",
      });

      if (res.ok) {
        // 成功時の簡易フィードバック
        alert("🚀 リクエストを再送しました！");
      } else {
        const err = await res.json();
        alert(`❌ 再送失敗: ${err.message}`);
      }
    } catch (error) {
      console.error("Replay error:", error);
      alert("❌ エラーが発生しました");
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "text-green-600";
      case "POST":
        return "text-blue-600";
      case "PUT":
        return "text-orange-600";
      case "DELETE":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Tunnel Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              Tunnel ID:{" "}
              <span className="font-mono font-medium text-gray-700">
                {tunnelId}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? "Live" : "Connecting..."}
            </span>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Request Logs</h2>
            <span className="text-sm text-gray-500">
              {logs.length} requests
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No requests yet. Waiting for traffic...
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.requestId}
                  className="p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span
                        className={`font-mono font-bold w-16 ${getMethodColor(
                          log.method
                        )}`}
                      >
                        {log.method}
                      </span>
                      <span className="font-mono text-gray-700 text-sm break-all">
                        {log.path}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold text-sm ${
                            log.status >= 400
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {log.status}
                        </div>
                        <div className="text-xs text-gray-400">
                          {log.duration}ms
                        </div>
                      </div>

                      {/* ★追加: Replayボタン (group-hoverで表示) */}
                      <button
                        onClick={() => handleReplay(log.requestId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        title="Replay this request"
                      >
                        🔄 Replay
                      </button>

                      <div className="text-xs text-gray-400 w-20 text-right">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
