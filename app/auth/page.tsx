// app/auth/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setMessage("");
    setLoading(true);

    try {
      if (isSignUp) {
        // 新規登録
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setMessage("アカウントの作成が完了しました！ログインしてください。");
        }
      } else {
        // ログイン
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "認証処理中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-lg shadow-md text-gray-800">
      <h1 className="text-2xl font-bold text-center mb-6">
        {isSignUp ? "新規アカウント作成" : "ログイン"}
      </h1>

      {errorMsg && (
        <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm">
          {errorMsg}
        </div>
      )}
      {message && (
        <div className="bg-green-100 text-green-600 p-3 rounded mb-4 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            メールアドレス (ID)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition disabled:bg-blue-300"
        >
          {loading
            ? "処理中..."
            : isSignUp
            ? "登録する"
            : "ログインする"}
        </button>
      </form>

      <button
        onClick={() => {
          setIsSignUp(!isSignUp);
          setErrorMsg("");
          setMessage("");
        }}
        className="w-full text-center text-sm text-blue-600 hover:underline mt-4"
      >
        {isSignUp
          ? "すでにアカウントをお持ちの方（ログイン）"
          : "新規登録はこちら"}
      </button>
    </div>
  );
}
