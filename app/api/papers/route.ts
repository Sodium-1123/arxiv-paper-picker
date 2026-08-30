// app/api/papers/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ARXIV_SOURCE_ID = "s4306400194";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      totalCount = 10,
      minCitations = 0,
      weights = {},
    } = await request.json();

    const activeCategories = Object.keys(weights).filter(
      (cat) => weights[cat] > 0
    );
    const totalWeight = activeCategories.reduce(
      (sum, cat) => sum + weights[cat],
      0
    );

    if (totalWeight === 0) {
      return NextResponse.json(
        { error: "比重（%）が指定されていません" },
        { status: 400 }
      );
    }

    // 1. 指定件数（totalCount）ぶん、重みに応じたルーレット抽選で分野ごとに割り振る
    const targetCounts: { [key: string]: number } = {};
    for (let i = 0; i < totalCount; i++) {
      let randomVal = Math.random() * totalWeight;
      for (const cat of activeCategories) {
        if (randomVal < weights[cat]) {
          targetCounts[cat] = (targetCounts[cat] || 0) + 1;
          break;
        }
        randomVal -= weights[cat];
      }
    }

    // 2. 重複防止Setと結果格納用配列
    const seenIds = new Set<string>();
    let combinedPapers: any[] = [];

    // 分野ごとに論文を取得
    for (const cat of Object.keys(targetCounts)) {
      const neededCount = targetCounts[cat];

      const url = `https://api.openalex.org/works?filter=locations.source.id:${ARXIV_SOURCE_ID},cited_by_count:>${minCitations}&search=${encodeURIComponent(
        cat
      )}&per_page=50`;

      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const fetchedResults = data.results || [];

        // 結果をランダムシャッフル
        const shuffled = fetchedResults.sort(() => 0.5 - Math.random());

        let addedForCat = 0;
        for (const item of shuffled) {
          if (addedForCat >= neededCount) break;

          const id = item.ids?.arxiv
            ? item.ids.arxiv.replace("https://arxiv.org/abs/", "")
            : item.id.replace("https://openalex.org/", "");

          if (!seenIds.has(id)) {
            seenIds.add(id);
            combinedPapers.push({
              arxiv_id: id,
              title: item.title || "Untitled Paper",
              authors:
                item.authorships?.map((a: any) => a.author.display_name) || [
                  "Unknown Author",
                ],
              abstract: item.abstract_inverted_index
                ? "Abstract available on arXiv"
                : "",
              citation_count: item.cited_by_count ?? 0,
              categories: [cat],
              url: item.ids?.arxiv || item.doi || item.id,
            });
            addedForCat++;
          }
        }
      } catch (e) {
        console.warn(`Category fetch error for ${cat}:`, e);
      }
    }

    // 3. もし特定のカテゴリで論文が足りず totalCount 未満だった場合、全体検索で不足分を自動補テン
    if (combinedPapers.length < totalCount) {
      try {
        const fallbackUrl = `https://api.openalex.org/works?filter=locations.source.id:${ARXIV_SOURCE_ID},cited_by_count:>${minCitations}&per_page=50`;
        const res = await fetch(fallbackUrl);
        if (res.ok) {
          const data = await res.json();
          const fallbackResults = (data.results || []).sort(
            () => 0.5 - Math.random()
          );

          for (const item of fallbackResults) {
            if (combinedPapers.length >= totalCount) break;

            const id = item.ids?.arxiv
              ? item.ids.arxiv.replace("https://arxiv.org/abs/", "")
              : item.id.replace("https://openalex.org/", "");

            if (!seenIds.has(id)) {
              seenIds.add(id);
              combinedPapers.push({
                arxiv_id: id,
                title: item.title || "Untitled Paper",
                authors:
                  item.authorships?.map((a: any) => a.author.display_name) || [
                    "Unknown Author",
                  ],
                abstract: item.abstract_inverted_index
                  ? "Abstract available on arXiv"
                  : "",
                citation_count: item.cited_by_count ?? 0,
                categories: ["arXiv"],
                url: item.ids?.arxiv || item.doi || item.id,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Fallback fetch error:", e);
      }
    }

    // 全体をランダムにシャッフルして指定件数に整形
    const finalResult = combinedPapers
      .sort(() => 0.5 - Math.random())
      .slice(0, totalCount);

    return NextResponse.json({ papers: finalResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
