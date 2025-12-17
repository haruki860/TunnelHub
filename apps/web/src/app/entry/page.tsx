"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function EntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // サーバーから渡された「戻るべき場所」を取得
  const returnUrl = searchParams.get("returnUrl");
  
  const [tunnelId, setTunnelId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tunnelId) return;
    setIsLoading(true);

    // ★重要: CookieにIDを保存 (有効期限は1日, パスは全体)
    // これにより、Server(Render)への次のアクセス時にCookieが送信されます
    document.cookie = `tunnel_id=${tunnelId}; path=/; max-age=86400; SameSite=Lax`;

    // 少し待ってからリダイレクト（Cookieの反映を確実にするため）
    setTimeout(() => {
      if (returnUrl && returnUrl.startsWith("http")) {
         // Server(Render)へ戻る（外部サイトへの遷移なので window.location を使用）
         window.location.href = returnUrl;
      } else {
         // returnUrlがない場合はダッシュボードトップへ
         router.push("/");
      }
    }, 100);
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-700">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-500 mb-2">
          TunnelHub
        </h1>
        <p className="text-gray-400 text-sm">
          Secure Tunnel Access
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="tunnelId" className="block text-sm font-medium text-gray-300 mb-2">
            Enter Tunnel ID
          </label>
          <input
            type="text"
            id="tunnelId"
            value={tunnelId}
            onChange={(e) => setTunnelId(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-600 transition-all"
            placeholder="e.g. my-secret-room"
            autoComplete="off"
            autoFocus
            required
          />
          <p className="text-xs text-gray-500 mt-2">
            The ID specified when starting the CLI.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-md flex justify-center items-center ${
            isLoading ? "opacity-50 cursor-not-allowed" : "hover:transform hover:-translate-y-0.5"
          }`}
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            "Connect"
          )}
        </button>
      </form>
    </div>
  );
}

export default function EntryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      {/* useSearchParamsを使用するためSuspenseでラップ必須 */}
      <Suspense fallback={<div className="text-blue-500">Loading...</div>}>
        <EntryForm />
      </Suspense>
    </div>
  );
}