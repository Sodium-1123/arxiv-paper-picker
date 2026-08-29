// app/likes/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LikedPaper {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  citation_count: number;
  categories: string[];
  created_at: string;
}

export default function LikesPage() {
  const [papers, setPapers] = useState<LikedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchLikedPapers();
  }, []);

  const fetchLikedPapers = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("liked_papers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPapers(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("liked_papers").delete().eq("id", id);
    if (!error) {
      setPapers((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">保存した論文（いいね一覧）</h1>
        <Link
          href="/"
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          ← 抽選画面に戻る
        </Link>
      </header>

      <main className="max-w-4xl mx-auto space-y-4">
        {loading ? (
          <p className="text-center text-gray-500">読み込み中...</p>
        ) : papers.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500">保存された論文はまだありません。</p>
          </div>
        ) : (
          papers.map((paper) => (
            <div
              key={paper.id}
              className="bg-white p-5 rounded-lg shadow-sm border border-gray-200"
            >
              <div className="flex justify-between items-start gap-4 mb-2">
                <a
                  href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lg font-bold text-blue-600 hover:underline"
                >
                  {paper.title}
                </a>
                <button
                  onClick={() => handleDelete(paper.id)}
                  className="px-3 py-1 rounded text-sm bg-red-100 hover:bg-red-200 text-red-600 transition"
                >
                  削除
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                著者: {paper.authors?.join(", ")}
              </p>

              <div className="flex gap-4 text-xs text-gray-500 mb-3">
                <span>
                  引用数: <strong>{paper.citation_count}</strong>
                </span>
                <span>カテゴリ: {paper.categories?.join(", ")}</span>
                <span>
                  保存日: {new Date(paper.created_at).toLocaleDateString()}
                </span>
              </div>

              {paper.abstract && (
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded line-clamp-3">
                  {paper.abstract}
                </p>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
