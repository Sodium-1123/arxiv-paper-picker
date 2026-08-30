// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ARXIV_CATEGORIES } from "@/utils/categories";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Paper {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  citation_count: number;
  categories: string[];
  url: string;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [totalCount, setTotalCount] = useState<number>(10);
  const [minCitations, setMinCitations] = useState<number>(10);
  const [weights, setWeights] = useState<{ [key: string]: number }>(
    ARXIV_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 10 }), {})
  );

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // 共有モーダル用ステート
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 1. 認証状態の監視とデータ同期
  useEffect(() => {
    const savedCount = localStorage.getItem("arxiv_totalCount");
    if (savedCount) setTotalCount(Number(savedCount));

    const savedMinCitations = localStorage.getItem("arxiv_minCitations");
    if (savedMinCitations) setMinCitations(Number(savedMinCitations));

    const savedWeights = localStorage.getItem("arxiv_weights");
    if (savedWeights) setWeights(JSON.parse(savedWeights));

    const savedPapers = localStorage.getItem("arxiv_papers");
    if (savedPapers) setPapers(JSON.parse(savedPapers));

    const syncLikedStatus = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/auth");
          return;
        }

        const { data, error } = await supabase
          .from("liked_papers")
          .select("arxiv_id");

        if (error) {
          console.warn("いいね同期注意:", error.message);
          if (error.code === "PGRST301" || error.message.includes("JWT")) {
            router.push("/auth");
          }
        } else if (data) {
          setLikedIds(new Set(data.map((item) => item.arxiv_id)));
        }
      } catch (err) {
        console.warn("同期例外:", err);
      }
    };

    syncLikedStatus();
    setIsInitialized(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/auth");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  // 2. 設定変更時の自動保存
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem("arxiv_totalCount", totalCount.toString());
    localStorage.setItem("arxiv_minCitations", minCitations.toString());
    localStorage.setItem("arxiv_weights", JSON.stringify(weights));
  }, [totalCount, minCitations, weights, isInitialized]);

  const handleWeightChange = (id: string, value: number) => {
    setWeights((prev) => ({ ...prev, [id]: value }));
  };

  // 3. 論文のランダム抽出
  const fetchPapers = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalCount, minCitations, weights }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "データ取得に失敗しました");

      const newPapers = data.papers || [];
      setPapers(newPapers);
      localStorage.setItem("arxiv_papers", JSON.stringify(newPapers));
    } catch (err: any) {
      setMessage(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. いいね保存処理
  const handleLike = async (paper: Paper) => {
    setMessage("");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("セッションが切れました。ログイン画面へ移動します...");
      setTimeout(() => {
        router.push("/auth");
      }, 1000);
      return;
    }

    const { error } = await supabase.from("liked_papers").insert({
      user_id: user.id,
      arxiv_id: paper.arxiv_id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      citation_count: paper.citation_count,
      categories: paper.categories,
    });

    if (error) {
      console.warn("いいね保存エラー:", error);
      if (error.code === "23505") {
        setMessage("この論文は既に保存されています。");
        setLikedIds((prev) => new Set([...Array.from(prev), paper.arxiv_id]));
      } else if (
        error.code === "PGRST301" ||
        error.message.toLowerCase().includes("jwt") ||
        error.message.toLowerCase().includes("unauthorized")
      ) {
        setMessage("認証エラーが発生しました。ログイン画面へリダイレクトします。");
        setTimeout(() => {
          router.push("/auth");
        }, 1000);
      } else {
        setMessage(
          `保存失敗 [${error.code}]: ${error.message} (${error.details || "詳細なし"})`
        );
      }
    } else {
      setMessage("論文を保存しました！");
      setLikedIds((prev) => new Set([...Array.from(prev), paper.arxiv_id]));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("arxiv_papers");
    router.push("/auth");
    router.refresh();
  };

  // 共有URLの構築ヘルパー
  const getShareUrl = () => {
    if (typeof window === "undefined" || papers.length === 0) return "";
    const encoded = encodeURIComponent(JSON.stringify(papers));
    return `${window.location.origin}/share?d=${encoded}`;
  };

  const handleCopyLink = () => {
    const url = getShareUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTwitterShare = () => {
    const url = getShareUrl();
    const text = encodeURIComponent(
      "今回ランダムに選んだ論文はこれでした！📚✨\n"
    );
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(
      url
    )}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">arXiv Random Paper Picker</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/likes"
            className="text-sm bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded transition font-semibold"
          >
            ♥ いいね一覧を見る
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded transition"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">抽出条件の設定</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">取得件数</label>
              <input
                type="number"
                min={1}
                max={30}
                value={totalCount}
                onChange={(e) => setTotalCount(Number(e.target.value))}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                最低引用数
              </label>
              <input
                type="number"
                min={0}
                value={minCitations}
                onChange={(e) => setMinCitations(Number(e.target.value))}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>

          <h3 className="text-md font-semibold mb-3">
            分野ごとの比率設定（%）
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto p-2 border rounded bg-gray-50">
            {ARXIV_CATEGORIES.map((cat) => (
              <div key={cat.id} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{cat.name}</span>
                  <span>{weights[cat.id] || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights[cat.id] || 0}
                  onChange={(e) =>
                    handleWeightChange(cat.id, Number(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>

          <button
            onClick={fetchPapers}
            disabled={loading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition disabled:bg-gray-400"
          >
            {loading ? "論文を抽出中..." : "論文をランダム抽出"}
          </button>
        </section>

        {message && (
          <div className="bg-blue-100 text-blue-800 p-4 rounded font-medium">
            {message}
          </div>
        )}

        {papers.length > 0 && (
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-bold text-gray-700">
              抽出された論文 ({papers.length}件)
            </span>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition shadow-sm"
            >
              <span>🔗</span>
              <span>今回選んだ論文を共有する</span>
            </button>
          </div>
        )}

        <section className="space-y-4">
          {papers.map((paper, index) => {
            const isLiked = likedIds.has(paper.arxiv_id);
            return (
              <div
                key={index}
                className="bg-white p-5 rounded-lg shadow-sm border border-gray-200"
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-bold text-blue-600 hover:underline"
                  >
                    {paper.title}
                  </a>
                  <button
                    onClick={() => handleLike(paper)}
                    disabled={isLiked}
                    className={`px-3 py-1 rounded text-sm font-semibold transition shrink-0 ${
                      isLiked
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-pink-500 hover:bg-pink-600 text-white"
                    }`}
                  >
                    {isLiked ? "保存済み" : "♥ いいね"}
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-2">
                  著者: {Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors}
                </p>

                <div className="flex gap-4 text-xs text-gray-500 mb-3">
                  <span>
                    引用数: <strong>{paper.citation_count}</strong>
                  </span>
                  <span>カテゴリ: {Array.isArray(paper.categories) ? paper.categories.join(", ") : paper.categories}</span>
                </div>

                {paper.abstract && (
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded line-clamp-3">
                    {paper.abstract}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {/* 共有モーダル */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">
                🎉 今回選んだ論文を共有
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600">
              「今回ランダムに選んだ論文はこれでした！」の共有用URLを作成しました。リンクをコピーするかX(Twitter)で共有できます。
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500">
                共有用URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl()}
                  className="w-full bg-gray-50 border border-gray-300 p-2 rounded text-xs text-gray-700 focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded shrink-0 transition"
                >
                  {copied ? "コピー完了！" : "コピー"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleTwitterShare}
                className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white font-bold py-2.5 rounded-lg text-sm transition"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X (Twitter) でポストする
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg text-sm transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
