"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function EntryContent() {
  const [tunnelId, setTunnelId] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tunnelId.trim()) return;

    // 1. CookieにTunnel IDを保存 (ルートパス、1日有効)
    // localhost同士ならポートが違ってもCookieは共有されます
    document.cookie = `tunnel_id=${tunnelId}; path=/; max-age=86400; SameSite=Lax`;

    // 2. 元のアクセス先へ戻す (なければサーバーのルートへ)
    const returnUrl = searchParams.get("returnUrl");

    if (returnUrl) {
      // サーバー側へ戻る
      window.location.href = returnUrl;
    } else {
      // 特に指定がなければダッシュボードへ
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1e293b] p-8 rounded-xl border border-gray-800 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-500 mb-2">
            🚀 TunnelHub
          </h1>
          <p className="text-gray-400">
            アクセス先のTunnel IDを入力してください
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label
              htmlFor="tunnelId"
              className="block text-sm font-medium text-gray-400 mb-2"
            >
              Tunnel ID
            </label>
            <input
              type="text"
              id="tunnelId"
              value={tunnelId}
              onChange={(e) => setTunnelId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
              placeholder="例: my-api"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            Go to Tunnel
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          Powered by TunnelHub
        </p>
      </div>
    </div>
  );
}

export default function EntryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EntryContent />
    </Suspense>
  );
}
