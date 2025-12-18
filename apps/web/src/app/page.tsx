"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [tunnelId, setTunnelId] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tunnelId.trim()) {
      // 入力されたIDのページへ遷移
      router.push(`/${tunnelId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-4">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
          TunnelHub
        </h1>
        <p className="text-gray-400 text-lg">
          Expose your local server securely. Monitor requests in real-time.
        </p>
      </div>

      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800">
        <h2 className="text-xl font-semibold mb-6 text-gray-200">
          View Tunnel Logs
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-600 transition-all"
              placeholder="e.g. my-room"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-lg transform active:scale-95"
          >
            Go to Dashboard
          </button>
        </form>
      </div>

      <footer className="mt-12 text-gray-600 text-sm">TunnelHub © 2024</footer>
    </div>
  );
}
