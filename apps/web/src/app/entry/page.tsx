"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function EntryForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Serverから渡された「戻る場所」
  const returnUrl = searchParams.get("returnUrl");

  const [tunnelId, setTunnelId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tunnelId) return;
    setIsLoading(true);

    if (returnUrl && returnUrl.startsWith("http")) {
      // ケースA: トンネルアクセス (Serverに戻る)
      // IDをクエリパラメータとして付与してリダイレクトバック
      const url = new URL(returnUrl);
      url.searchParams.set("tunnel_id", tunnelId);
      window.location.href = url.toString();
    } else {
      // ケースB: returnUrlがない場合 (万が一のフォールバック)
      // ダッシュボードとして扱う
      router.push(`/${tunnelId}`);
    }
  };

  return (
    <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
          TunnelHub
        </h1>
        <p className="text-gray-400 text-sm">Authentication Required</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="tunnelId"
            className="block text-sm font-medium text-gray-400 mb-2"
          >
            Enter Tunnel ID
          </label>
          <input
            type="text"
            id="tunnelId"
            value={tunnelId}
            onChange={(e) => setTunnelId(e.target.value)}
            className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-600 transition-all"
            placeholder="e.g. my-room"
            autoComplete="off"
            autoFocus
            required
          />
          <p className="text-xs text-gray-500 mt-2">
            Please enter the ID to access the tunnel.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-lg flex justify-center items-center ${
            isLoading
              ? "opacity-70 cursor-not-allowed"
              : "hover:transform hover:-translate-y-0.5"
          }`}
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            "Access Tunnel"
          )}
        </button>
      </form>
    </div>
  );
}

export default function EntryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      <Suspense fallback={<div className="text-blue-500">Loading...</div>}>
        <EntryForm />
      </Suspense>
    </div>
  );
}
