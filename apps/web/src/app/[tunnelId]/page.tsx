"use client";

import { useEffect, useState, use } from "react";
import { io } from "socket.io-client";

// Next.js 15+ / React 19 では params は Promise になりました
interface PageProps {
  params: Promise<{ tunnelId: string }>;
}

interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
}

export default function DashboardPage({ params }: PageProps) {
  // use() フックで Promise をアンラップ
  const { tunnelId } = use(params);

  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const SERVER_URL =
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

    // ★重要: type: 'dashboard' をつけて、ホストではなく「閲覧者」として接続
    const socket = io(SERVER_URL, {
      query: {
        tunnelId: tunnelId,
        type: "dashboard",
      },
    });

    socket.on("connect", () => {
      console.log(`Connected to Dashboard Room: ${tunnelId}`);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("new-log", (newLog: RequestLog) => {
      setLogs((prev) => [newLog, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [tunnelId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">
            TunnelHub Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Viewing logs for:{" "}
            <span className="text-white font-mono bg-gray-800 px-2 py-0.5 rounded">
              {tunnelId}
            </span>
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded-full text-sm font-bold ${
            isConnected
              ? "bg-green-900 text-green-300"
              : "bg-red-900 text-red-300"
          }`}
        >
          {isConnected ? "● Live" : "○ Offline"}
        </div>
      </header>

      <div className="max-w-5xl mx-auto">
        {logs.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
            <p>No requests yet.</p>
            <p className="text-sm mt-2">Access your tunnel to see logs here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.requestId}
                className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between shadow-lg hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-4 mb-2 sm:mb-0 overflow-hidden">
                  <span
                    className={`font-bold px-2 py-1 rounded text-xs w-16 text-center shrink-0 ${getMethodColor(
                      log.method
                    )}`}
                  >
                    {log.method}
                  </span>
                  <span
                    className="font-mono text-gray-300 text-sm truncate"
                    title={log.path}
                  >
                    {log.path}
                  </span>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 shrink-0 ml-auto">
                  <span
                    className={`font-bold text-sm ${getStatusColor(
                      log.status
                    )}`}
                  >
                    {log.status}
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right">
                    {log.duration}ms
                  </span>
                  <span className="text-xs text-gray-500 w-20 text-right">
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
  if (status >= 500) return "text-red-400";
  if (status >= 400) return "text-yellow-400";
  if (status >= 200) return "text-green-400";
  return "text-gray-500";
}
