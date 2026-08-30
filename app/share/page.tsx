// app/share/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
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

function ShareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    const legacyDataParam = searchParams.get("d");

    const fetchSharedPapers = async () => {
      setLoading(true);
      setError("");

      if (idsParam) {
        // ID指定された短縮パラメータの処理
        const idList = idsParam.split(",").map((id) => id.trim()).filter(Boolean);
        if (idList.length === 0) {
          setError("指定された論文IDが存在しません。");
          setLoading(false);
          return;
        }

        try {
          // OpenAlex APIで各arXiv IDの論文情報をまとめて取得
          const filterParam = idList
            .map((id) => (id.startsWith("https://") ? id : `https://arxiv.org/abs/${id}`))
            .join("|");
          
          const openAlexUrl = `https://api.openalex.org/works?filter=locations.source.id:s4306400194,ids.arxiv:${encodeURIComponent(filterParam)}&per_page=50`;
          
          const res = await fetch(openAlexUrl);
          const data = await res.json();

          if (data.results && data.results.length > 0) {
            const fetchedPapers: Paper[] = data.results.map((item: any) => ({
              arxiv_id: item.ids?.arxiv
                ? item.ids.arxiv.replace("https://arxiv.org/abs/", "")
                : item.id,
              title: item.title,
              authors: item.authorships?.map((a: any) => a.author.display_name) || [],
              abstract: item.abstract_inverted_index
                ? "Abstract available on arXiv"
                : "",
              citation_count: item.cited_by_count || 0,
              categories: item.concepts?.slice(0, 2).map((c: any) => c.display_name) || ["arXiv"],
              url: item.ids?.arxiv || item.doi || item.id,
            }));
            setPapers(fetchedPapers);
          } else {
            // IDでの検索ヒットがない場合のフォールバック（シンプルなプレースホルダー生成）
            const fallbackPapers: Paper[] = idList.map((id) => ({
              arxiv_id: id,
              title: `arXiv Paper (${id})`,
              authors: ["arXiv Author"],
              abstract: "",
              citation_count: 0,
              categories: ["arXiv"],
              url: id.startsWith("http") ? id : `https://arxiv.org/abs/${id}`,
            }));
            setPapers(fallbackPapers);
          }
        } catch (err: any) {
          console.error("Shared papers fetch error:", err);
          setError("論文情報の取得中にエラーが発生しました。");
        }
      } else if (legacyDataParam) {
        // 旧方式（?d=... データ直接埋め込み）の互換性サポート
        try {
          const decodedStr = decodeURIComponent(legacyDataParam);
          const parsedPapers: Paper[] = JSON.parse(decodedStr);
          setPapers(parsedPapers);
        } catch (err) {
          console.error("Failed to parse shared papers data", err);
          setError("共有データの読み込みに失敗しました。");
        }
      } else {
        setError("共有された論文データが見つかりません。");
      }

      setLoading(false);
    };

    // ログイン情報の確認
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data } = await supabase.from("liked_papers").select("arxiv_id");
        if (data) {
          setLikedIds(new Set(data.map((item) => item.arxiv_id)));
        }
      }
    };

    fetchSharedPapers();
    checkUser();
  }, [searchParams, supabase]);

  const handleLike = async (paper: Paper) => {
    if (!currentUser) {
      router.push("/auth");
      return;
    }

    const { error } = await supabase.from("liked_papers").insert({
      user_id: currentUser.id,
      arxiv_id: paper.arxiv_id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      citation_count: paper.citation_count,
      categories: paper.categories,
    });

    if (error) {
      if (error.code === "23505") {
        setMessage("この論文は既に保存されています。");
        setLikedIds((prev) => new Set([...Array.from(prev), paper.arxiv_id]));
      } else {
        setMessage(`保存失敗: ${error.message}`);
      }
    } else {
      setMessage("論文を保存しました！");
      setLikedIds((prev) => new Set([...Array.from(prev), paper.arxiv_id]));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-8 border-b pb-4">
        <Link href="/" className="text-2xl font-bold hover:text-blue-600 transition">
          arXiv Random Paper Picker
        </Link>
        <Link
          href={currentUser ? "/" : "/auth"}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition"
        >
          {currentUser ? "自分で論文をランダム抽出する" : "ログインして使ってみる"}
        </Link>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎉</span>
            <h1 className="text-xl md:text-2xl font-extrabold">
              今回ランダムに選んだ論文はこれでした！
            </h1>
          </div>
          <p className="text-blue-100 text-sm md:text-base">
            arXivからランダム抽出された論文ピックアップリストです。気になった論文をぜひチェックしてみてください。
          </p>
        </div>

        {message && (
          <div className="bg-blue-100 text-blue-800 p-4 rounded font-medium">
            {message}
          </div>
        )}

        {loading ? (
          <div className="bg-white p-12 text-center rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500 font-medium animate-pulse">
              共有された論文データを読み込み中...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-600 p-4 rounded-lg text-center font-medium">
            {error}
          </div>
        ) : (
          <section className="space-y-4">
            {papers.map((paper, index) => {
              const isLiked = likedIds.has(paper.arxiv_id);
              return (
                <div
                  key={index}
                  className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <a
                      href={paper.url || `https://arxiv.org/abs/${paper.arxiv_id}`}
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
                      {isLiked
                        ? "保存済み"
                        : currentUser
                        ? "♥ いいね"
                        : "ログインして保存"}
                    </button>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    著者: {Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors}
                  </p>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                    <span>
                      引用数: <strong>{paper.citation_count}</strong>
                    </span>
                    <span>
                      カテゴリ: {Array.isArray(paper.categories) ? paper.categories.join(", ") : paper.categories}
                    </span>
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
        )}
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="text-center p-12 text-gray-500">読み込み中...</div>}>
      <ShareContent />
    </Suspense>
  );
}
